import { inject, Injectable, signal, computed, effect, OnDestroy } from '@angular/core';
import { Workout } from '../models/workout.model';
import { AuthService } from './auth.service';
import { FirestoreService } from './firestore.service';
import { toLocalDateString } from '../utils/date.util';
import { where, Unsubscribe } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class WorkoutService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly firestore = inject(FirestoreService);
  private readonly COLLECTION = 'workouts';
  private readonly workoutsSignal = signal<Workout[]>([]);
  private unsubscribe: Unsubscribe | null = null;
  private sessionsCleanupChecked = false;

  readonly workouts = this.workoutsSignal.asReadonly();

  readonly recentWorkouts = computed(() =>
    this.workoutsSignal()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
  );

  readonly totalWorkouts = computed(() => this.workoutsSignal().length);

  readonly completedWorkouts = computed(() =>
    this.workoutsSignal().filter(w => w.completedDate).length
  );

  readonly thisWeekCount = computed(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const mondayISO = monday.toISOString();
    return this.workoutsSignal().filter(w => w.completedDate && w.completedDate >= mondayISO).length;
  });

  readonly streak = computed(() => {
    const completed = this.workoutsSignal().filter(w => w.completedDate);
    if (completed.length === 0) return 0;

    const uniqueDays = new Set(
      completed.map(w => toLocalDateString(new Date(w.completedDate!)))
    );
    const sortedDays = Array.from(uniqueDays).sort().reverse();

    const today = toLocalDateString(new Date());
    const yesterday = toLocalDateString(new Date(Date.now() - 86400000));

    if (sortedDays[0] !== today && sortedDays[0] !== yesterday) return 0;

    let count = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const prev = new Date(sortedDays[i - 1]);
      const curr = new Date(sortedDays[i]);
      const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
      if (diffDays === 1) {
        count++;
      } else {
        break;
      }
    }
    return count;
  });

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      this.cleanupSubscription();
      if (userId) {
        this.subscribeToWorkouts(userId);
      } else {
        this.workoutsSignal.set([]);
      }
    });
    effect(() => {
      if (this.auth.isAdmin()) {
        this.runSessionsCleanupMigration();
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanupSubscription();
  }

  getById(id: string): Workout | undefined {
    return this.workoutsSignal().find((w) => w.id === id);
  }

  getByCategory(category: string): Workout[] {
    return this.workoutsSignal().filter((w) => w.category === category);
  }

  async add(workout: Omit<Workout, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Workout> {
    const userId = this.auth.userId();
    const now = new Date().toISOString();
    const data = {
      ...workout,
      userId: userId || '',
      createdAt: now,
      updatedAt: now
    };
    const id = await this.firestore.addDocument(this.COLLECTION, data);
    const newWorkout: Workout = { ...data, id };
    return newWorkout;
  }

  async update(id: string, changes: Partial<Workout>): Promise<void> {
    await this.firestore.updateDocument(this.COLLECTION, id, {
      ...changes,
      updatedAt: new Date().toISOString()
    });
  }

  async delete(id: string): Promise<void> {
    await this.firestore.deleteDocument(this.COLLECTION, id);
  }

  async markComplete(id: string): Promise<void> {
    await this.update(id, { completedDate: new Date().toISOString() });
  }

  async getAllWorkoutsForAdmin(): Promise<{ userId: string; workouts: Workout[] }[]> {
    const all = await this.firestore.queryDocuments<Workout>(this.COLLECTION);
    const grouped = new Map<string, Workout[]>();
    for (const w of all) {
      const uid = w.userId || 'unknown';
      if (!grouped.has(uid)) grouped.set(uid, []);
      grouped.get(uid)!.push(w);
    }
    return Array.from(grouped, ([userId, workouts]) => ({ userId, workouts }));
  }

  private async runSessionsCleanupMigration(): Promise<void> {
    if (this.sessionsCleanupChecked) return;
    this.sessionsCleanupChecked = true;

    const marker = await this.firestore.getDocument('meta', 'workoutSessionsCleanup');
    if (marker) return;

    const oldSessions = await this.firestore.queryDocuments<{ id: string }>('workout_sessions');
    await Promise.all(oldSessions.map(s => this.firestore.deleteDocument('workout_sessions', s.id)));

    await this.firestore.setDocument('meta', 'workoutSessionsCleanup', {
      migratedAt: new Date().toISOString()
    });
  }

  private subscribeToWorkouts(userId: string): void {
    this.unsubscribe = this.firestore.subscribe<Workout>(
      this.COLLECTION,
      (workouts) => {
        workouts.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        this.workoutsSignal.set(workouts);
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
