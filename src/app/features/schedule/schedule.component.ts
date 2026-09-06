import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WorkoutService } from '../../core/services/workout.service';
import { toLocalDateString, formatDisplayDate } from '../../core/utils/date.util';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss'
})
export class ScheduleComponent {
  private readonly workoutService = inject(WorkoutService);

  readonly weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  readonly viewMode = signal<'week' | 'month'>('month');
  readonly currentWeekStart = signal(this.getMonday(new Date()));
  readonly currentMonthStart = signal(this.getMonthStart(new Date()));

  readonly weekDates = computed(() => {
    const start = this.currentWeekStart();
    return this.weekDays.map((_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  });

  readonly monthDates = computed(() => {
    const monthStart = this.currentMonthStart();
    const gridStart = this.getMonday(monthStart);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const gridEndWeekStart = this.getMonday(monthEnd);
    const totalDays = Math.round((gridEndWeekStart.getTime() - gridStart.getTime()) / 86400000) + 7;

    const dates: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  });

  readonly scheduledWorkouts = computed(() => {
    const workouts = this.workoutService.workouts();
    return workouts.filter(w => w.scheduledDate);
  });

  isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.currentMonthStart().getMonth();
  }

  getWorkoutsForDate(date: Date) {
    const dateStr = toLocalDateString(date);
    return this.scheduledWorkouts().filter(w => w.scheduledDate?.startsWith(dateStr));
  }

  previousWeek(): void {
    const current = this.currentWeekStart();
    const prev = new Date(current);
    prev.setDate(prev.getDate() - 7);
    this.currentWeekStart.set(prev);
  }

  nextWeek(): void {
    const current = this.currentWeekStart();
    const next = new Date(current);
    next.setDate(next.getDate() + 7);
    this.currentWeekStart.set(next);
  }

  previousMonth(): void {
    const current = this.currentMonthStart();
    this.currentMonthStart.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const current = this.currentMonthStart();
    this.currentMonthStart.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  goPrevious(): void {
    if (this.viewMode() === 'week') {
      this.previousWeek();
    } else {
      this.previousMonth();
    }
  }

  goNext(): void {
    if (this.viewMode() === 'week') {
      this.nextWeek();
    } else {
      this.nextMonth();
    }
  }

  formatDate(date: Date): string {
    return formatDisplayDate(date);
  }

  formatMonthYear(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  private getMonday(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private getMonthStart(d: Date): Date {
    const date = new Date(d.getFullYear(), d.getMonth(), 1);
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
