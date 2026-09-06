import { inject, Injectable, signal, computed, effect, OnDestroy } from '@angular/core';
import { TrainingProgram, Exercise } from '../models/workout.model';
import { AuthService } from './auth.service';
import { FirestoreService } from './firestore.service';
import { WorkoutService } from './workout.service';
import { ExerciseLibraryService } from './exercise-library.service';
import { ExerciseLogService } from './exercise-log.service';
import { Unsubscribe } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class ProgramService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly firestore = inject(FirestoreService);
  private readonly workoutService = inject(WorkoutService);
  private readonly exerciseService = inject(ExerciseLibraryService);
  private readonly exerciseLogService = inject(ExerciseLogService);
  private readonly COLLECTION = 'programs';
  private readonly programsSignal = signal<TrainingProgram[]>([]);
  private unsubscribe: Unsubscribe | null = null;

  readonly programs = this.programsSignal.asReadonly();

  readonly visiblePrograms = computed(() =>
    this.auth.isAdmin() ? this.programsSignal() : this.programsSignal().filter(p => p.isActive)
  );

  /** The program the current user is actively following: any program with at least
   * one not-yet-completed generated workout. Resolves on its own once every day
   * of the program has been completed, freeing the user to choose another. */
  readonly userActiveProgramId = computed(() =>
    this.workoutService.workouts().find(w => w.programId && !w.completedDate)?.programId
  );

  readonly userActiveProgram = computed(() => {
    const id = this.userActiveProgramId();
    return id ? this.getById(id) : undefined;
  });

  readonly totalPrograms = computed(() => this.programsSignal().length);

  private migrationChecked = false;

  constructor() {
    this.subscribeToPrograms();
    effect(() => {
      if (this.auth.isAdmin()) {
        this.runPublishMigration();
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanupSubscription();
  }

  getById(id: string): TrainingProgram | undefined {
    return this.programsSignal().find(p => p.id === id);
  }

  async create(program: Omit<TrainingProgram, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<TrainingProgram> {
    if (!this.auth.isAdmin()) throw new Error('Admin access required');
    const userId = this.auth.userId();
    const now = new Date().toISOString();
    const data = {
      ...program,
      userId: userId || '',
      createdAt: now,
      updatedAt: now
    };
    const id = await this.firestore.addDocument(this.COLLECTION, data);
    return { ...data, id } as TrainingProgram;
  }

  async update(id: string, changes: Partial<TrainingProgram>): Promise<void> {
    if (!this.auth.isAdmin()) throw new Error('Admin access required');
    await this.firestore.updateDocument(this.COLLECTION, id, {
      ...changes,
      updatedAt: new Date().toISOString()
    });
  }

  async delete(id: string): Promise<void> {
    if (!this.auth.isAdmin()) throw new Error('Admin access required');
    await this.firestore.deleteDocument(this.COLLECTION, id);
  }

  async setActive(id: string, active: boolean): Promise<void> {
    if (!this.auth.isAdmin()) throw new Error('Admin access required');
    await this.firestore.updateDocument(this.COLLECTION, id, {
      isActive: active,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Chooses a program to follow: generates one Workout per program day (no
   * scheduledDate — the user assigns that later from the workout itself). If
   * the user already has a different active program (one with incomplete
   * generated workouts), that program's not-yet-completed workouts are
   * deleted first, replacing it with this one.
   */
  async chooseProgram(id: string): Promise<void> {
    const program = this.getById(id);
    if (!program) return;

    const currentActiveId = this.userActiveProgramId();
    if (currentActiveId && currentActiveId !== id) {
      const staleWorkouts = this.workoutService.workouts().filter(w => w.programId === currentActiveId && !w.completedDate);
      for (const w of staleWorkouts) {
        await this.exerciseLogService.deleteLogsForWorkout(w.id);
        await this.workoutService.delete(w.id);
      }
    }

    for (const day of program.days) {
      const exercises: Exercise[] = day.exercises.map(e => ({
        id: crypto.randomUUID(),
        name: e.exerciseName,
        trackingType: e.trackingType,
        sets: e.targetSets,
        reps: e.targetReps,
        weight: e.targetWeight,
        duration: e.targetDuration,
        restTime: e.restTime,
        imageUrl: this.exerciseService.getById(e.exerciseId)?.imageUrl,
        templateId: e.exerciseId
      }));

      await this.workoutService.add({
        name: `${program.name} - ${day.name}`,
        category: 'strength',
        exercises,
        programId: program.id
      });
    }
  }

  async advanceDay(id: string): Promise<void> {
    if (!this.auth.isAdmin()) throw new Error('Admin access required');
    const program = this.getById(id);
    if (!program) return;

    const nextDay = (program.currentDay || 0) + 1;
    const completedSessions = (program.completedSessions || 0) + 1;

    await this.firestore.updateDocument(this.COLLECTION, id, {
      currentDay: nextDay >= program.totalDays ? 0 : nextDay,
      completedSessions,
      updatedAt: new Date().toISOString()
    });
  }

  private async runPublishMigration(): Promise<void> {
    if (this.migrationChecked) return;
    this.migrationChecked = true;

    const marker = await this.firestore.getDocument('meta', 'programsPublishMigration');
    if (marker) return;

    const all = await this.firestore.queryDocuments<TrainingProgram>(this.COLLECTION);
    const toPublish = all.filter(p => !p.isActive);
    await Promise.all(toPublish.map(p =>
      this.firestore.updateDocument(this.COLLECTION, p.id, {
        isActive: true,
        updatedAt: new Date().toISOString()
      })
    ));

    await this.firestore.setDocument('meta', 'programsPublishMigration', {
      migratedAt: new Date().toISOString()
    });
  }

  private subscribeToPrograms(): void {
    this.unsubscribe = this.firestore.subscribe<TrainingProgram>(
      this.COLLECTION,
      (programs) => {
        programs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        this.programsSignal.set(programs);
      }
    );
  }

  private cleanupSubscription(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
