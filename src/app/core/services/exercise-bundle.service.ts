import { inject, Injectable, signal, OnDestroy } from '@angular/core';
import { ExerciseBundle } from '../models/workout.model';
import { FirestoreService } from './firestore.service';
import { AuthService } from './auth.service';
import { Unsubscribe } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class ExerciseBundleService implements OnDestroy {
  private readonly firestore = inject(FirestoreService);
  private readonly auth = inject(AuthService);
  private readonly COLLECTION = 'exerciseBundles';
  private readonly bundlesSignal = signal<ExerciseBundle[]>([]);
  private unsubscribe: Unsubscribe | null = null;
  private initialized = false;

  readonly bundles = this.bundlesSignal.asReadonly();

  constructor() {
    this.loadBundles();
  }

  ngOnDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  getById(id: string): ExerciseBundle | undefined {
    return this.bundlesSignal().find(b => b.id === id);
  }

  search(query: string): ExerciseBundle[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.bundlesSignal();
    return this.bundlesSignal().filter(b => b.name.toLowerCase().includes(q));
  }

  async addBundle(bundle: Omit<ExerciseBundle, 'id'>): Promise<ExerciseBundle> {
    if (!this.auth.isAdmin()) throw new Error('Admin access required');
    const userId = this.auth.userId();
    const now = new Date().toISOString();
    const data = {
      ...bundle,
      createdBy: userId || '',
      createdAt: now,
      updatedAt: now
    };
    const id = await this.firestore.addDocument(this.COLLECTION, data);
    return { ...data, id };
  }

  async updateBundle(id: string, changes: Partial<ExerciseBundle>): Promise<void> {
    if (!this.auth.isAdmin()) throw new Error('Admin access required');
    await this.firestore.updateDocument(this.COLLECTION, id, {
      ...changes,
      updatedAt: new Date().toISOString()
    });
  }

  async deleteBundle(id: string): Promise<void> {
    if (!this.auth.isAdmin()) throw new Error('Admin access required');
    await this.firestore.deleteDocument(this.COLLECTION, id);
  }

  private loadBundles(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubscribe = this.firestore.subscribe<ExerciseBundle>(
      this.COLLECTION,
      (bundles) => {
        bundles.sort((a, b) => a.name.localeCompare(b.name));
        this.bundlesSignal.set(bundles);
      }
    );
  }
}
