import { Component, inject, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-exercise-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './exercise-detail.component.html',
  styleUrl: './exercise-detail.component.scss'
})
export class ExerciseDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly exerciseService = inject(ExerciseLibraryService);
  readonly auth = inject(AuthService);

  readonly exercise = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return id ? this.exerciseService.getById(id) : undefined;
  });

  readonly alternatives = computed(() => {
    const ex = this.exercise();
    if (!ex) return [];
    return this.exerciseService.getAlternatives(ex.id).slice(0, 6);
  });

  readonly confirmingDelete = signal(false);
  readonly deleting = signal(false);
  readonly imageLoaded = signal(false);

  confirmDelete(): void {
    this.confirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  async deleteExercise(): Promise<void> {
    const ex = this.exercise();
    if (!ex || this.deleting()) return;
    this.deleting.set(true);
    try {
      await this.exerciseService.deleteExercise(ex.id);
      this.router.navigate(['/exercises']);
    } finally {
      this.deleting.set(false);
    }
  }
}
