import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkoutService } from '../../core/services/workout.service';
import { ProgramService } from '../../core/services/program.service';
import { ExerciseLogService } from '../../core/services/exercise-log.service';
import { parseLocalDate, formatDisplayDate } from '../../core/utils/date.util';
import { difficultyLabel, PROGRAM_DIFFICULTIES, ProgramDifficulty, Workout } from '../../core/models/workout.model';
import { CountUpDirective } from '../../shared/directives/count-up.directive';
import { CircularProgressComponent } from '../../shared/components/circular-progress/circular-progress.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, CountUpDirective, CircularProgressComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
  readonly workoutService = inject(WorkoutService);
  readonly programService = inject(ProgramService);
  readonly exerciseLogService = inject(ExerciseLogService);
  readonly difficultyLabel = difficultyLabel;
  readonly starRange = [1, 2, 3, 4, 5];
  protected readonly Math = Math;

  // Sets logged (across the exercise's logs, primary + any swapped alternates)
  // versus the workout's planned sets. Not forced to 100 on completedDate, so
  // a workout finished early still reads as partial effort rather than "done".
  workoutCompletionPercent(workout: Workout): number {
    const totalTarget = workout.exercises.reduce((sum, ex) => sum + (ex.sets || 0), 0);
    if (totalTarget === 0) return 0;
    const totalCompleted = this.exerciseLogService.logsForWorkout(workout.id)
      .reduce((sum, log) => sum + log.sets.length, 0);
    return Math.min(100, Math.round((totalCompleted / totalTarget) * 100));
  }

  difficultyStars(difficulty: ProgramDifficulty): number {
    return PROGRAM_DIFFICULTIES.find(d => d.value === difficulty)?.stars ?? 0;
  }

  readonly activeProgramCompletedDays = computed(() => {
    const runId = this.programService.userActiveProgramRunId();
    if (!runId) return 0;
    return this.workoutService.workouts().filter(w => w.programRunId === runId && w.completedDate).length;
  });

  readonly activeProgramProgress = computed(() => {
    const program = this.programService.userActiveProgram();
    if (!program || program.totalDays === 0) return 0;
    return Math.min(100, Math.round((this.activeProgramCompletedDays() / program.totalDays) * 100));
  });

  formatDate(dateStr: string): string {
    return formatDisplayDate(parseLocalDate(dateStr));
  }

  formatCompletedDate(iso: string): string {
    return formatDisplayDate(new Date(iso));
  }
}
