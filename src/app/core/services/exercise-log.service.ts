import { inject, Injectable, signal, computed, effect, OnDestroy } from '@angular/core';
import { ExerciseLog, ExerciseTemplate, SetRecord, Workout } from '../models/workout.model';
import { AuthService } from './auth.service';
import { FirestoreService } from './firestore.service';
import { toLocalDateString } from '../utils/date.util';
import { where, Unsubscribe } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class ExerciseLogService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly firestore = inject(FirestoreService);
  private readonly COLLECTION = 'exercise_logs';
  private readonly logsSignal = signal<ExerciseLog[]>([]);
  private unsubscribe: Unsubscribe | null = null;

  readonly logs = this.logsSignal.asReadonly();

  readonly completedLogs = computed(() =>
    this.logsSignal().filter(l => l.completedAt && l.sets.length > 0)
  );

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      this.cleanupSubscription();
      if (userId) {
        this.subscribeToLogs(userId);
      } else {
        this.logsSignal.set([]);
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanupSubscription();
  }

  logsForWorkout(workoutId: string): ExerciseLog[] {
    return this.logsSignal()
      .filter(l => l.workoutId === workoutId)
      .sort((a, b) => a.exerciseIndex - b.exerciseIndex);
  }

  async startWorkoutLogs(workout: Workout): Promise<void> {
    const userId = this.auth.userId();
    const now = new Date().toISOString();
    const date = workout.scheduledDate || toLocalDateString(new Date());

    for (let i = 0; i < workout.exercises.length; i++) {
      const ex = workout.exercises[i];
      const data = {
        userId: userId || '',
        workoutId: workout.id,
        exerciseIndex: i,
        exerciseTemplateId: ex.templateId,
        exerciseName: ex.name,
        trackingType: ex.trackingType || 'reps',
        date,
        targetSets: ex.sets,
        targetReps: ex.reps,
        targetWeight: ex.weight,
        targetDuration: ex.duration,
        restTime: ex.restTime,
        sets: [],
        startedAt: now,
        createdAt: now,
        updatedAt: now
      };
      await this.firestore.addDocument(this.COLLECTION, data);
    }
  }

  async addAlternateLog(workout: Workout, exerciseIndex: number, alternate: ExerciseTemplate): Promise<string> {
    const userId = this.auth.userId();
    const existing = this.logsSignal().find(l =>
      l.workoutId === workout.id && l.exerciseIndex === exerciseIndex && l.exerciseTemplateId === alternate.id
    );
    if (existing) return existing.id;

    const primary = this.logsForWorkout(workout.id).find(l => l.exerciseIndex === exerciseIndex);
    const now = new Date().toISOString();
    const trackingType = alternate.trackingType || 'reps';
    const data = {
      userId: userId || '',
      workoutId: workout.id,
      exerciseIndex,
      exerciseTemplateId: alternate.id,
      exerciseName: alternate.name,
      trackingType,
      date: primary?.date || toLocalDateString(new Date()),
      targetSets: primary?.targetSets ?? 3,
      targetReps: trackingType !== 'duration' ? (primary?.targetReps ?? alternate.recommendedReps) : undefined,
      targetWeight: trackingType === 'reps' ? (primary?.targetWeight ?? alternate.recommendedWeight) : undefined,
      targetDuration: trackingType === 'duration' ? (primary?.targetDuration ?? alternate.recommendedDuration) : undefined,
      restTime: primary?.restTime,
      sets: [],
      startedAt: now,
      createdAt: now,
      updatedAt: now
    };
    return this.firestore.addDocument(this.COLLECTION, data);
  }

  async logSet(logId: string, setRecord: SetRecord): Promise<void> {
    const log = this.logsSignal().find(l => l.id === logId);
    if (!log) return;
    await this.firestore.updateDocument(this.COLLECTION, logId, {
      sets: [...log.sets, setRecord],
      updatedAt: new Date().toISOString()
    });
  }

  async completeWorkoutLogs(workoutId: string): Promise<void> {
    const completedAt = new Date().toISOString();
    for (const log of this.logsForWorkout(workoutId)) {
      await this.firestore.updateDocument(this.COLLECTION, log.id, {
        completedAt,
        updatedAt: completedAt
      });
    }
  }

  async deleteLogsForWorkout(workoutId: string): Promise<void> {
    const logs = this.logsSignal().filter(l => l.workoutId === workoutId);
    for (const log of logs) {
      await this.firestore.deleteDocument(this.COLLECTION, log.id);
    }
  }

  getExerciseHistory(exerciseName: string, templateId?: string): { date: string; sets: SetRecord[] }[] {
    return this.completedLogs()
      .filter(l => templateId ? l.exerciseTemplateId === templateId : l.exerciseName === exerciseName)
      .map(l => ({ date: l.date, sets: l.sets }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  private subscribeToLogs(userId: string): void {
    this.unsubscribe = this.firestore.subscribe<ExerciseLog>(
      this.COLLECTION,
      (logs) => {
        this.logsSignal.set(logs);
      },
      where('userId', '==', userId)
    );
  }

  private cleanupSubscription(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
