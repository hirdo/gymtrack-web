import { Component, inject, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { WorkoutService } from '../../../core/services/workout.service';
import { ExerciseLogService } from '../../../core/services/exercise-log.service';
import { ExerciseLog } from '../../../core/models/workout.model';

@Component({
  selector: 'app-workout-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './workout-detail.component.html',
  styleUrl: './workout-detail.component.scss'
})
export class WorkoutDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workoutService = inject(WorkoutService);
  private readonly exerciseLogService = inject(ExerciseLogService);

  readonly workout = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return id ? this.workoutService.getById(id) : undefined;
  });

  readonly hasBeenTrained = computed(() => {
    const w = this.workout();
    return w ? this.exerciseLogService.logsForWorkout(w.id).length > 0 : false;
  });

  readonly logsForWorkout = computed(() => {
    const w = this.workout();
    return w ? this.exerciseLogService.logsForWorkout(w.id) : [];
  });

  getLogForExercise(exerciseIndex: number): ExerciseLog | undefined {
    return this.logsForWorkout().find(l => l.exerciseIndex === exerciseIndex);
  }

  formatCompletedDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  readonly starting = signal(false);

  async startTraining(): Promise<void> {
    const w = this.workout();
    if (!w || this.starting()) return;
    this.starting.set(true);
    try {
      await this.exerciseLogService.startWorkoutLogs(w);
      await this.router.navigate(['/workouts', w.id, 'train']);
    } finally {
      this.starting.set(false);
    }
  }

  async markComplete(): Promise<void> {
    const w = this.workout();
    if (w) {
      await this.workoutService.markComplete(w.id);
    }
  }

  async deleteWorkout(): Promise<void> {
    const w = this.workout();
    if (w) {
      await this.exerciseLogService.deleteLogsForWorkout(w.id);
      await this.workoutService.delete(w.id);
      this.router.navigate(['/workouts']);
    }
  }
}
