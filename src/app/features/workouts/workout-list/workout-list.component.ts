import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WorkoutService } from '../../../core/services/workout.service';
import { ProgramService } from '../../../core/services/program.service';
import { WorkoutCategory } from '../../../core/models/workout.model';
import { parseLocalDate, formatDisplayDate } from '../../../core/utils/date.util';

@Component({
  selector: 'app-workout-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './workout-list.component.html',
  styleUrl: './workout-list.component.scss'
})
export class WorkoutListComponent {
  readonly workoutService = inject(WorkoutService);
  private readonly programService = inject(ProgramService);
  readonly selectedCategory = signal<WorkoutCategory | 'all'>('all');

  readonly categories: { value: WorkoutCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'strength', label: 'Strength' },
    { value: 'cardio', label: 'Cardio' },
    { value: 'flexibility', label: 'Flexibility' },
    { value: 'hiit', label: 'HIIT' },
    { value: 'custom', label: 'Custom' }
  ];

  /** Self-created workouts, plus program workouts only while their run is still active —
   * once every workout in a program run is completed, that run stops being active and
   * its workouts drop out of this list (still viewable via the completed-workouts calendar). */
  get visibleWorkouts() {
    const activeRunId = this.programService.userActiveProgramRunId();
    return this.workoutService.workouts().filter(w => !w.programRunId || w.programRunId === activeRunId);
  }

  get filteredWorkouts() {
    const cat = this.selectedCategory();
    const workouts = cat === 'all' ? this.visibleWorkouts : this.visibleWorkouts.filter(w => w.category === cat);
    return [...workouts].sort((a, b) =>
      (a.scheduledDate || '9999-99-99').localeCompare(b.scheduledDate || '9999-99-99')
    );
  }

  filterBy(category: WorkoutCategory | 'all'): void {
    this.selectedCategory.set(category);
  }

  formatDate(dateStr: string): string {
    return formatDisplayDate(parseLocalDate(dateStr));
  }

  formatCompletedDate(iso: string): string {
    return formatDisplayDate(new Date(iso));
  }

  getProgramName(programId: string): string {
    return this.programService.getById(programId)?.name || 'Program';
  }
}
