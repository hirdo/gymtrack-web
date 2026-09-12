import { Component, inject, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProgramService } from '../../core/services/program.service';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { AuthService } from '../../core/services/auth.service';
import { PROGRAM_DIFFICULTIES, ProgramDifficulty, TrainingProgram, difficultyLabel } from '../../core/models/workout.model';

@Component({
  selector: 'app-program-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './program-detail.component.html',
  styleUrl: './program-detail.component.scss'
})
export class ProgramDetailComponent {
  protected readonly Math = Math;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly programService = inject(ProgramService);
  private readonly exerciseService = inject(ExerciseLibraryService);
  readonly auth = inject(AuthService);

  readonly choosing = signal(false);
  readonly replaceConfirmProgram = signal<TrainingProgram | null>(null);
  readonly replaceConfirmClosing = signal(false);
  readonly starRange = [1, 2, 3, 4, 5];
  readonly publishing = signal(false);
  readonly confirmingDelete = signal(false);
  readonly deleting = signal(false);

  readonly program = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    const p = id ? this.programService.getById(id) : undefined;
    if (p && !p.isActive && !this.auth.isAdmin()) return undefined;
    return p;
  });

  readonly isMyActiveProgram = computed(() => {
    const p = this.program();
    return !!p && this.programService.userActiveProgramId() === p.id;
  });

  async publish(): Promise<void> {
    const p = this.program();
    if (!p || this.publishing()) return;
    this.publishing.set(true);
    try {
      await this.programService.setActive(p.id, true);
    } finally {
      this.publishing.set(false);
    }
  }

  async unpublish(): Promise<void> {
    const p = this.program();
    if (!p || this.publishing()) return;
    this.publishing.set(true);
    try {
      await this.programService.setActive(p.id, false);
    } finally {
      this.publishing.set(false);
    }
  }

  async chooseProgram(): Promise<void> {
    const p = this.program();
    if (!p || this.choosing()) return;

    const current = this.programService.userActiveProgram();
    if (current && current.id !== p.id) {
      this.replaceConfirmProgram.set(current);
      return;
    }

    await this.doChooseProgram(p.id);
  }

  async confirmReplace(): Promise<void> {
    const p = this.program();
    this.closeReplaceConfirm();
    if (p) await this.doChooseProgram(p.id);
  }

  cancelReplace(): void {
    this.closeReplaceConfirm();
  }

  private closeReplaceConfirm(): void {
    if (!this.replaceConfirmProgram()) return;
    this.replaceConfirmClosing.set(true);
    setTimeout(() => {
      this.replaceConfirmProgram.set(null);
      this.replaceConfirmClosing.set(false);
    }, 200);
  }

  private async doChooseProgram(id: string): Promise<void> {
    this.choosing.set(true);
    try {
      await this.programService.chooseProgram(id);
      this.router.navigate(['/workouts']);
    } finally {
      this.choosing.set(false);
    }
  }

  difficultyStars(difficulty: ProgramDifficulty): number {
    return PROGRAM_DIFFICULTIES.find(d => d.value === difficulty)?.stars ?? 0;
  }

  readonly difficultyLabel = difficultyLabel;

  getExerciseImage(exerciseId: string): string | undefined {
    return this.exerciseService.getById(exerciseId)?.imageUrl;
  }

  getExerciseName(exerciseId: string): string | undefined {
    return this.exerciseService.getById(exerciseId)?.name;
  }

  confirmDelete(): void {
    this.confirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  async deleteProgram(): Promise<void> {
    const p = this.program();
    if (!p || this.deleting()) return;
    this.deleting.set(true);
    try {
      await this.programService.delete(p.id);
      this.router.navigate(['/programs']);
    } finally {
      this.deleting.set(false);
    }
  }
}
