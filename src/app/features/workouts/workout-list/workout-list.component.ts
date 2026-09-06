import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WorkoutService } from '../../../core/services/workout.service';
import { ExerciseLogService } from '../../../core/services/exercise-log.service';
import { WorkoutCategory } from '../../../core/models/workout.model';
import { parseLocalDate } from '../../../core/utils/date.util';

@Component({
  selector: 'app-workout-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './workout-list.component.html',
  styleUrl: './workout-list.component.scss'
})
export class WorkoutListComponent {
  readonly workoutService = inject(WorkoutService);
  private readonly exerciseLogService = inject(ExerciseLogService);
  readonly selectedCategory = signal<WorkoutCategory | 'all'>('all');

  readonly categories: { value: WorkoutCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'strength', label: 'Strength' },
    { value: 'cardio', label: 'Cardio' },
    { value: 'flexibility', label: 'Flexibility' },
    { value: 'hiit', label: 'HIIT' },
    { value: 'custom', label: 'Custom' }
  ];

  get filteredWorkouts() {
    const cat = this.selectedCategory();
    const workouts = cat === 'all' ? this.workoutService.workouts() : this.workoutService.getByCategory(cat);
    return [...workouts].sort((a, b) =>
      (a.scheduledDate || '9999-99-99').localeCompare(b.scheduledDate || '9999-99-99')
    );
  }

  filterBy(category: WorkoutCategory | 'all'): void {
    this.selectedCategory.set(category);
  }

  formatDate(dateStr: string): string {
    return parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async deleteWorkout(id: string, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    await this.exerciseLogService.deleteLogsForWorkout(id);
    await this.workoutService.delete(id);
  }
}
