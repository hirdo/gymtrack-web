import { Component, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WorkoutService } from '../../../core/services/workout.service';
import { ProgramService } from '../../../core/services/program.service';
import { Workout, WorkoutCategory } from '../../../core/models/workout.model';
import { parseLocalDate, formatDisplayDate } from '../../../core/utils/date.util';

@Component({
  selector: 'app-workout-list',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './workout-list.component.html',
  styleUrl: './workout-list.component.scss'
})
export class WorkoutListComponent {
  readonly workoutService = inject(WorkoutService);
  private readonly programService = inject(ProgramService);
  readonly selectedCategory = signal<WorkoutCategory | 'all'>('all');
  protected readonly Math = Math;

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

  private categoryFiltered(workouts: Workout[]) {
    const cat = this.selectedCategory();
    return cat === 'all' ? workouts : workouts.filter(w => w.category === cat);
  }

  /** Workouts generated from a program, shown in their own section, sorted day 1 → N.
   * Programs create one workout per day sequentially with no scheduledDate assigned yet
   * (that comes later from the workout itself), so createdAt is the reliable day-order signal. */
  get programWorkouts() {
    const workouts = this.categoryFiltered(this.visibleWorkouts.filter(w => !!w.programId));
    return [...workouts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Self-created workouts, shown in their own section, sorted by scheduled date. */
  get selfCreatedWorkouts() {
    const workouts = this.categoryFiltered(this.visibleWorkouts.filter(w => !w.programId));
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
}
