import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkoutService } from '../../core/services/workout.service';
import { ProgramService } from '../../core/services/program.service';
import { parseLocalDate, formatDisplayDate } from '../../core/utils/date.util';
import { difficultyLabel } from '../../core/models/workout.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
  readonly workoutService = inject(WorkoutService);
  readonly programService = inject(ProgramService);
  readonly difficultyLabel = difficultyLabel;

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
