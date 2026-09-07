import { inject, Injectable, signal, computed, OnDestroy } from '@angular/core';
import { ExerciseTemplate, MuscleGroup, Equipment } from '../models/workout.model';
import { FirestoreService } from './firestore.service';
import { AuthService } from './auth.service';
import { Unsubscribe } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class ExerciseLibraryService implements OnDestroy {
  private readonly firestore = inject(FirestoreService);
  private readonly auth = inject(AuthService);
  private readonly COLLECTION = 'exercises';
  private readonly exercisesSignal = signal<ExerciseTemplate[]>([]);
  private unsubscribe: Unsubscribe | null = null;
  private initialized = false;

  readonly exercises = this.exercisesSignal.asReadonly();

  readonly muscleGroups = computed(() => {
    const groups = new Set<MuscleGroup>();
    this.exercisesSignal().forEach(e =>
      e.primaryMuscles.forEach(m => groups.add(m))
    );
    return Array.from(groups).sort();
  });

  readonly equipmentTypes = computed(() => {
    const types = new Set<Equipment>();
    this.exercisesSignal().forEach(e => types.add(e.equipment));
    return Array.from(types).sort();
  });

  constructor() {
    this.loadExercises();
  }

  ngOnDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  getById(id: string): ExerciseTemplate | undefined {
    return this.exercisesSignal().find(e => e.id === id);
  }

  getByMuscleGroup(muscle: MuscleGroup): ExerciseTemplate[] {
    return this.exercisesSignal().filter(e =>
      e.primaryMuscles.includes(muscle)
    );
  }

  getByEquipment(equipment: Equipment): ExerciseTemplate[] {
    return this.exercisesSignal().filter(e => e.equipment === equipment);
  }

  search(query: string): ExerciseTemplate[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.exercisesSignal();
    return this.exercisesSignal().filter(e =>
      e.name.toLowerCase().includes(q)
    );
  }

  getAlternatives(exerciseId: string): ExerciseTemplate[] {
    const exercise = this.getById(exerciseId);
    if (!exercise) return [];
    return this.exercisesSignal()
      .filter(e => e.id !== exerciseId && e.primaryMuscles.some(m => exercise.primaryMuscles.includes(m)))
      .sort((a, b) => {
        const scoreA = a.primaryMuscles.filter(m => exercise.primaryMuscles.includes(m)).length;
        const scoreB = b.primaryMuscles.filter(m => exercise.primaryMuscles.includes(m)).length;
        return scoreB - scoreA || a.name.localeCompare(b.name);
      });
  }

  async addExercise(exercise: Omit<ExerciseTemplate, 'id'>): Promise<ExerciseTemplate> {
    if (!this.auth.isAdmin()) throw new Error('Admin access required');
    const userId = this.auth.userId();
    const data = {
      ...exercise,
      isCustom: true,
      createdBy: userId || ''
    };
    const id = await this.firestore.addDocument(this.COLLECTION, data);
    return { ...data, id };
  }

  async updateExercise(id: string, changes: Partial<ExerciseTemplate>): Promise<void> {
    if (!this.auth.isAdmin()) throw new Error('Admin access required');
    await this.firestore.updateDocument(this.COLLECTION, id, changes);
  }

  async deleteExercise(id: string): Promise<void> {
    if (!this.auth.isAdmin()) throw new Error('Admin access required');
    await this.firestore.deleteDocument(this.COLLECTION, id);
  }

  private loadExercises(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubscribe = this.firestore.subscribe<ExerciseTemplate>(
      this.COLLECTION,
      (exercises) => {
        exercises.sort((a, b) => a.name.localeCompare(b.name));
        this.exercisesSignal.set(exercises);
      }
    );
  }
}
