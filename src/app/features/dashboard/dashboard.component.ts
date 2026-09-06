import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkoutService } from '../../core/services/workout.service';
import { ProgramService } from '../../core/services/program.service';
import { parseLocalDate } from '../../core/utils/date.util';

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

  readonly activeProgramCompletedDays = computed(() => {
    const program = this.programService.userActiveProgram();
    if (!program) return 0;
    return this.workoutService.workouts().filter(w => w.programId === program.id && w.completedDate).length;
  });

  readonly activeProgramProgress = computed(() => {
    const program = this.programService.userActiveProgram();
    if (!program || program.totalDays === 0) return 0;
    return Math.min(100, Math.round((this.activeProgramCompletedDays() / program.totalDays) * 100));
  });

  formatDate(dateStr: string): string {
    return parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatCompletedDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
