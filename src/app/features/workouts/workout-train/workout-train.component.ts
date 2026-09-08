import { Component, inject, computed, signal, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ExerciseLogService } from '../../../core/services/exercise-log.service';
import { WorkoutService } from '../../../core/services/workout.service';
import { ExerciseLibraryService } from '../../../core/services/exercise-library.service';
import { ExerciseTemplate, SetRecord } from '../../../core/models/workout.model';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { parseLocalDate, formatDisplayDate } from '../../../core/utils/date.util';

@Component({
  selector: 'app-workout-train',
  standalone: true,
  imports: [RouterLink, FormsModule, LoadingSpinnerComponent],
  templateUrl: './workout-train.component.html',
  styleUrl: './workout-train.component.scss'
})
export class WorkoutTrainComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly exerciseLogService = inject(ExerciseLogService);
  private readonly workoutService = inject(WorkoutService);
  private readonly exerciseLibraryService = inject(ExerciseLibraryService);
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  private readonly workoutId = this.route.snapshot.paramMap.get('id') || '';

  readonly currentExerciseIndex = signal(0);
  readonly weightInput = signal<number>(0);
  readonly repsInput = signal<number>(0);
  readonly durationInput = signal<number>(0);
  readonly restSeconds = signal(0);
  readonly isResting = signal(false);
  readonly elapsedSeconds = signal(0);
  readonly completing = signal(false);
  readonly altSwapOpen = signal(false);

  /** Which log is "active" (receiving newly logged sets) per exercise slot, once
   * the user has swapped away from the default (earliest-created) log for that slot. */
  private readonly activeLogId = signal<Map<number, string>>(new Map());

  readonly workout = computed(() => this.workoutService.getById(this.workoutId));

  readonly logs = computed(() => this.exerciseLogService.logsForWorkout(this.workoutId));

  readonly totalExercises = computed(() => this.workout()?.exercises.length ?? 0);

  readonly slots = computed(() => {
    const w = this.workout();
    if (!w) return [];
    return w.exercises.map((ex, i) => {
      const slotLogs = this.logs().filter(l => l.exerciseIndex === i);
      const primary = [...slotLogs].sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0];
      const completed = slotLogs.reduce((sum, l) => sum + l.sets.length, 0);
      const target = primary?.targetSets ?? ex.sets;
      return { index: i, name: ex.name, completed, target };
    });
  });

  readonly logsForCurrentSlot = computed(() =>
    this.logs()
      .filter(l => l.exerciseIndex === this.currentExerciseIndex())
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  );

  readonly currentLog = computed(() => {
    const slotLogs = this.logsForCurrentSlot();
    if (slotLogs.length === 0) return undefined;
    const activeId = this.activeLogId().get(this.currentExerciseIndex());
    if (activeId) {
      const found = slotLogs.find(l => l.id === activeId);
      if (found) return found;
    }
    return slotLogs[0];
  });

  readonly slotTargetSets = computed(() => this.logsForCurrentSlot()[0]?.targetSets ?? 0);

  readonly slotCompletedSets = computed(() =>
    this.logsForCurrentSlot().reduce((sum, l) => sum + l.sets.length, 0)
  );

  readonly currentExerciseImage = computed(() => {
    const log = this.currentLog();
    const w = this.workout();
    if (!log || !w) return undefined;
    const slotExercise = w.exercises[this.currentExerciseIndex()];
    if (log.exerciseTemplateId && log.exerciseTemplateId === slotExercise?.templateId) {
      return slotExercise.imageUrl;
    }
    return log.exerciseTemplateId ? this.exerciseLibraryService.getById(log.exerciseTemplateId)?.imageUrl : undefined;
  });

  readonly currentExerciseAlternatives = computed(() => {
    const w = this.workout();
    if (!w) return [];
    const slot = w.exercises[this.currentExerciseIndex()];
    if (!slot) return [];
    const ids = [slot.templateId, ...(slot.alternativeExerciseIds || [])].filter((id): id is string => !!id);
    return ids
      .map(id => this.exerciseLibraryService.getById(id))
      .filter((e): e is ExerciseTemplate => !!e);
  });

  readonly hasLoggedAnySet = computed(() => this.logs().some(l => l.sets.length > 0));

  readonly currentExerciseHistory = computed(() => {
    const log = this.currentLog();
    return log ? this.exerciseLogService.getExerciseHistory(log.exerciseName, log.exerciseTemplateId).slice(0, 5) : [];
  });

  readonly overallProgress = computed(() => {
    const slots = this.slots();
    const totalSets = slots.reduce((sum, s) => sum + s.target, 0);
    const completedSets = slots.reduce((sum, s) => sum + s.completed, 0);
    return totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  });

  constructor() {
    this.startElapsedTimer();
    const w = this.workout();
    if (w?.completedDate) {
      this.router.navigate(['/workouts', w.id]);
    }
    this.syncInputsFromCurrentLog();
  }

  ngOnDestroy(): void {
    this.stopTimers();
  }

  navigateExercise(index: number): void {
    this.currentExerciseIndex.set(index);
    this.stopRestTimer();
    this.altSwapOpen.set(false);
    this.syncInputsFromCurrentLog();
  }

  prevExercise(): void {
    if (this.currentExerciseIndex() > 0) {
      this.navigateExercise(this.currentExerciseIndex() - 1);
    }
  }

  nextExercise(): void {
    if (this.currentExerciseIndex() < this.totalExercises() - 1) {
      this.navigateExercise(this.currentExerciseIndex() + 1);
    }
  }

  toggleAltSwap(): void {
    this.altSwapOpen.set(!this.altSwapOpen());
  }

  async switchToExercise(templateId: string): Promise<void> {
    const w = this.workout();
    if (!w) return;
    if (this.currentLog()?.exerciseTemplateId === templateId) {
      this.altSwapOpen.set(false);
      return;
    }
    const alternate = this.exerciseLibraryService.getById(templateId);
    if (!alternate) return;

    const exerciseIndex = this.currentExerciseIndex();
    const logId = await this.exerciseLogService.addAlternateLog(w, exerciseIndex, alternate);
    const map = new Map(this.activeLogId());
    map.set(exerciseIndex, logId);
    this.activeLogId.set(map);
    this.altSwapOpen.set(false);
    this.syncInputsFromCurrentLog();
  }

  async logSet(): Promise<void> {
    const log = this.currentLog();
    if (!log) return;

    let setRecord: SetRecord;
    if (log.trackingType === 'duration') {
      setRecord = {
        setNumber: log.sets.length + 1,
        duration: this.durationInput(),
        completedAt: new Date().toISOString()
      };
    } else if (log.trackingType === 'reps_only') {
      setRecord = {
        setNumber: log.sets.length + 1,
        reps: this.repsInput(),
        completedAt: new Date().toISOString()
      };
    } else {
      setRecord = {
        setNumber: log.sets.length + 1,
        weight: this.weightInput(),
        reps: this.repsInput(),
        completedAt: new Date().toISOString()
      };
    }

    await this.exerciseLogService.logSet(log.id, setRecord);

    if (log.restTime && this.slotCompletedSets() + 1 < this.slotTargetSets()) {
      this.startRestTimer(log.restTime);
    }
  }

  async completeTraining(): Promise<void> {
    const w = this.workout();
    if (!w || !this.hasLoggedAnySet()) return;
    this.completing.set(true);
    await this.exerciseLogService.completeWorkoutLogs(w.id);
    await this.workoutService.markComplete(w.id);
    this.router.navigate(['/workouts', w.id]);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  formatHistoryDate(dateStr: string): string {
    return formatDisplayDate(parseLocalDate(dateStr));
  }

  skipRest(): void {
    this.stopRestTimer();
  }

  private syncInputsFromCurrentLog(): void {
    const log = this.currentLog();
    if (log) {
      const lastSet = log.sets[log.sets.length - 1];
      this.weightInput.set(lastSet?.weight ?? log.targetWeight ?? 0);
      this.repsInput.set(lastSet?.reps ?? log.targetReps ?? 12);
      this.durationInput.set(lastSet?.duration ?? log.targetDuration ?? 0);
    }
  }

  private startRestTimer(seconds: number): void {
    this.stopRestTimer();
    this.restSeconds.set(seconds);
    this.isResting.set(true);
    this.timerInterval = setInterval(() => {
      const remaining = this.restSeconds() - 1;
      if (remaining <= 0) {
        this.stopRestTimer();
      } else {
        this.restSeconds.set(remaining);
      }
    }, 1000);
  }

  private stopRestTimer(): void {
    this.isResting.set(false);
    this.restSeconds.set(0);
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private elapsedInterval: ReturnType<typeof setInterval> | null = null;

  private startElapsedTimer(): void {
    this.elapsedInterval = setInterval(() => {
      const startedAt = this.logs()[0]?.startedAt;
      if (startedAt) {
        const started = new Date(startedAt).getTime();
        this.elapsedSeconds.set(Math.round((Date.now() - started) / 1000));
      }
    }, 1000);
  }

  private stopTimers(): void {
    this.stopRestTimer();
    if (this.elapsedInterval) {
      clearInterval(this.elapsedInterval);
      this.elapsedInterval = null;
    }
  }
}
