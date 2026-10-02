import { Component, inject, signal, effect } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WorkoutService } from '../../../core/services/workout.service';
import { ProgramService } from '../../../core/services/program.service';
import { Workout, WorkoutCategory } from '../../../core/models/workout.model';
import { parseLocalDate, formatDisplayDate } from '../../../core/utils/date.util';
import { FluidFieldBackgroundComponent } from '../../../shared/components/fluid-field-background/fluid-field-background.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-workout-list',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet, FluidFieldBackgroundComponent, PaginationComponent],
  templateUrl: './workout-list.component.html',
  styleUrl: './workout-list.component.scss'
})
export class WorkoutListComponent {
  readonly workoutService = inject(WorkoutService);
  private readonly programService = inject(ProgramService);
  readonly selectedCategory = signal<WorkoutCategory | 'all'>('all');
  protected readonly Math = Math;

  readonly programPage = signal(1);
  readonly selfPage = signal(1);
  private readonly pageSize = 8;

  constructor() {
    effect(() => {
      this.selectedCategory();
      this.programPage.set(1);
      this.selfPage.set(1);
    });
  }

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
  get programWorkoutsAll() {
    const workouts = this.categoryFiltered(this.visibleWorkouts.filter(w => !!w.programId));
    return [...workouts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  get programWorkouts() {
    const start = (this.programPage() - 1) * this.pageSize;
    return this.programWorkoutsAll.slice(start, start + this.pageSize);
  }

  /** Self-created workouts, shown in their own section, sorted by scheduled date. */
  get selfCreatedWorkoutsAll() {
    const workouts = this.categoryFiltered(this.visibleWorkouts.filter(w => !w.programId));
    return [...workouts].sort((a, b) =>
      (a.scheduledDate || '9999-99-99').localeCompare(b.scheduledDate || '9999-99-99')
    );
  }

  get selfCreatedWorkouts() {
    const start = (this.selfPage() - 1) * this.pageSize;
    return this.selfCreatedWorkoutsAll.slice(start, start + this.pageSize);
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
