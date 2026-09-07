import { Component, inject, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProgramService } from '../../core/services/program.service';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { AuthService } from '../../core/services/auth.service';
import { PROGRAM_DIFFICULTIES, ProgramDifficulty, TrainingProgram } from '../../core/models/workout.model';

@Component({
  selector: 'app-program-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './program-detail.component.html',
  styleUrl: './program-detail.component.scss'
})
export class ProgramDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly programService = inject(ProgramService);
  private readonly exerciseService = inject(ExerciseLibraryService);
  readonly auth = inject(AuthService);

  readonly choosing = signal(false);
  readonly replaceConfirmProgram = signal<TrainingProgram | null>(null);
  readonly starRange = [1, 2, 3, 4, 5];

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
    if (p) await this.programService.setActive(p.id, true);
  }

  async unpublish(): Promise<void> {
    const p = this.program();
    if (p) await this.programService.setActive(p.id, false);
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
    this.replaceConfirmProgram.set(null);
    if (p) await this.doChooseProgram(p.id);
  }

  cancelReplace(): void {
    this.replaceConfirmProgram.set(null);
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

  difficultyLabel(difficulty: ProgramDifficulty): string {
    return PROGRAM_DIFFICULTIES.find(d => d.value === difficulty)?.label ?? difficulty;
  }

  getExerciseImage(exerciseId: string): string | undefined {
    return this.exerciseService.getById(exerciseId)?.imageUrl;
  }

  getExerciseName(exerciseId: string): string | undefined {
    return this.exerciseService.getById(exerciseId)?.name;
  }

  async deleteProgram(): Promise<void> {
    const p = this.program();
    if (p) {
      await this.programService.delete(p.id);
      this.router.navigate(['/programs']);
    }
  }
}
