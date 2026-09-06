import { Component, inject, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProgramService } from '../../core/services/program.service';
import { WorkoutService } from '../../core/services/workout.service';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { AuthService } from '../../core/services/auth.service';
import { toLocalDateString } from '../../core/utils/date.util';
import { PROGRAM_DIFFICULTIES, ProgramDifficulty } from '../../core/models/workout.model';

@Component({
  selector: 'app-program-detail',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './program-detail.component.html',
  styleUrl: './program-detail.component.scss'
})
export class ProgramDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly programService = inject(ProgramService);
  private readonly workoutService = inject(WorkoutService);
  private readonly exerciseService = inject(ExerciseLibraryService);
  readonly auth = inject(AuthService);

  readonly applying = signal(false);
  readonly startDate = signal(toLocalDateString(new Date()));
  readonly conflictDates = signal<string[] | null>(null);
  readonly starRange = [1, 2, 3, 4, 5];

  readonly program = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    const p = id ? this.programService.getById(id) : undefined;
    if (p && !p.isActive && !this.auth.isAdmin()) return undefined;
    return p;
  });

  readonly progressPercent = computed(() => {
    const p = this.program();
    if (!p || p.totalDays === 0) return 0;
    return Math.round(((p.currentDay || 0) / p.totalDays) * 100);
  });

  async publish(): Promise<void> {
    const p = this.program();
    if (p) await this.programService.setActive(p.id, true);
  }

  async unpublish(): Promise<void> {
    const p = this.program();
    if (p) await this.programService.setActive(p.id, false);
  }

  async applyProgram(): Promise<void> {
    const p = this.program();
    if (!p || this.applying()) return;

    const dates = this.programService.calculateConsecutiveDates(this.startDate(), p.days.length);
    const conflicts = this.workoutService.getWorkoutsOnDates(dates)
      .map(w => w.scheduledDate!)
      .filter((d): d is string => !!d);

    if (conflicts.length > 0) {
      this.conflictDates.set(conflicts);
      return;
    }

    this.applying.set(true);
    try {
      await this.programService.applyProgram(p.id, this.startDate());
      this.router.navigate(['/schedule']);
    } finally {
      this.applying.set(false);
    }
  }

  closeConflictWarning(): void {
    this.conflictDates.set(null);
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

  async deleteProgram(): Promise<void> {
    const p = this.program();
    if (p) {
      await this.programService.delete(p.id);
      this.router.navigate(['/programs']);
    }
  }
}
