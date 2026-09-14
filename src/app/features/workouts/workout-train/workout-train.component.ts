import { Component, ElementRef, inject, computed, signal, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ExerciseLogService } from '../../../core/services/exercise-log.service';
import { WorkoutService } from '../../../core/services/workout.service';
import { ExerciseLibraryService } from '../../../core/services/exercise-library.service';
import { ExerciseTemplate, ExerciseTrackingType, SetRecord } from '../../../core/models/workout.model';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { CountdownRingComponent } from '../../../shared/components/countdown-ring/countdown-ring.component';
import { parseLocalDate, formatDisplayDate, formatTime as formatTimeUtil } from '../../../core/utils/date.util';

@Component({
  selector: 'app-workout-train',
  standalone: true,
  imports: [RouterLink, FormsModule, LoadingSpinnerComponent, CountdownRingComponent],
  templateUrl: './workout-train.component.html',
  styleUrl: './workout-train.component.scss'
})
export class WorkoutTrainComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly exerciseLogService = inject(ExerciseLogService);
  private readonly workoutService = inject(WorkoutService);
  private readonly exerciseLibraryService = inject(ExerciseLibraryService);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private elapsedInterval: ReturnType<typeof setInterval> | null = null;

  private readonly workoutId = this.route.snapshot.paramMap.get('id') || '';

  readonly currentExerciseIndex = signal(0);
  readonly weightInput = signal<number | null>(null);
  readonly repsInput = signal<number | null>(null);
  readonly durationInput = signal<number | null>(null);
  readonly logSetError = signal<string | null>(null);

  readonly restSeconds = signal(0);
  readonly restTotalSeconds = signal(0);
  readonly isResting = signal(false);
  readonly restJustFinished = signal(false);
  readonly restClosing = signal(false);

  readonly durationRemaining = signal(0);
  readonly durationRunning = signal(false);
  readonly durationJustFinished = signal(false);

  readonly elapsedSeconds = signal(0);
  readonly completing = signal(false);
  readonly loggingSet = signal(false);
  readonly altSwapOpen = signal(false);
  readonly altSwapClosing = signal(false);
  readonly justCompletedSet = signal(false);

  readonly editingSet = signal<{ logId: string; setNumber: number } | null>(null);
  readonly editWeightInput = signal<number | null>(null);
  readonly editRepsInput = signal<number | null>(null);
  readonly editDurationInput = signal<number | null>(null);

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
    this.resetDurationTimer();
  }

  ngOnDestroy(): void {
    this.stopTimers();
  }

  navigateExercise(index: number): void {
    this.currentExerciseIndex.set(index);
    this.resetAltSwap();
    this.resetForNewSlot();
    queueMicrotask(() => this.scrollActivePillIntoView());
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
    if (this.altSwapOpen()) {
      this.closeAltSwap();
    } else {
      this.altSwapOpen.set(true);
    }
  }

  async switchToExercise(templateId: string): Promise<void> {
    const w = this.workout();
    if (!w) return;
    if (this.currentLog()?.exerciseTemplateId === templateId) {
      this.closeAltSwap();
      return;
    }
    const alternate = this.exerciseLibraryService.getById(templateId);
    if (!alternate) return;

    const exerciseIndex = this.currentExerciseIndex();
    const logId = await this.exerciseLogService.addAlternateLog(w, exerciseIndex, alternate);
    const map = new Map(this.activeLogId());
    map.set(exerciseIndex, logId);
    this.activeLogId.set(map);
    this.closeAltSwap();
    this.resetForNewSlot();
  }

  private closeAltSwap(): void {
    if (!this.altSwapOpen()) return;
    this.altSwapClosing.set(true);
    setTimeout(() => {
      this.altSwapOpen.set(false);
      this.altSwapClosing.set(false);
    }, 160);
  }

  private resetAltSwap(): void {
    this.altSwapOpen.set(false);
    this.altSwapClosing.set(false);
  }

  async logSet(): Promise<void> {
    const log = this.currentLog();
    if (!log || this.loggingSet()) return;

    if (log.trackingType === 'duration') {
      if (this.durationInput() === null) {
        this.logSetError.set('Complete the timer or enter a duration before logging.');
        return;
      }
    } else {
      if (this.repsInput() === null) {
        this.logSetError.set('Please enter reps before logging.');
        return;
      }
      if (log.trackingType === 'reps' && this.weightInput() === null) {
        this.logSetError.set('Please enter weight before logging.');
        return;
      }
    }

    let setRecord: SetRecord;
    if (log.trackingType === 'duration') {
      setRecord = {
        setNumber: log.sets.length + 1,
        duration: this.durationInput()!,
        completedAt: new Date().toISOString()
      };
    } else if (log.trackingType === 'reps_only') {
      setRecord = {
        setNumber: log.sets.length + 1,
        reps: this.repsInput()!,
        completedAt: new Date().toISOString()
      };
    } else {
      setRecord = {
        setNumber: log.sets.length + 1,
        weight: this.weightInput()!,
        reps: this.repsInput()!,
        completedAt: new Date().toISOString()
      };
    }

    this.loggingSet.set(true);
    try {
      await this.exerciseLogService.logSet(log.id, setRecord);
      this.flashCompletedTile();

      this.logSetError.set(null);
      this.weightInput.set(null);
      this.repsInput.set(null);
      if (log.trackingType === 'duration') {
        this.resetDurationTimer();
      } else {
        this.durationInput.set(null);
      }
      this.startRestTimer(log.restTime ?? 120);
    } finally {
      this.loggingSet.set(false);
    }
  }

  startDurationTimer(): void {
    const log = this.currentLog();
    if (!log) return;
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    if (this.durationRemaining() <= 0) {
      this.durationRemaining.set(log.targetDuration ?? 0);
    }
    this.durationRunning.set(true);
    this.durationJustFinished.set(false);
    this.durationInterval = setInterval(() => {
      const remaining = this.durationRemaining() - 1;
      if (remaining <= 0) {
        this.durationRemaining.set(0);
        this.stopDurationTimer(true);
      } else {
        this.durationRemaining.set(remaining);
      }
    }, 1000);
  }

  stopDurationTimer(finished: boolean): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    this.durationRunning.set(false);
    const log = this.currentLog();
    const target = log?.targetDuration ?? 0;
    const elapsed = Math.max(0, target - this.durationRemaining());
    this.durationInput.set(elapsed);
    if (finished) {
      this.durationJustFinished.set(true);
    }
  }

  resetDurationTimer(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    this.durationRunning.set(false);
    this.durationJustFinished.set(false);
    const log = this.currentLog();
    this.durationRemaining.set(log?.targetDuration ?? 0);
    this.durationInput.set(null);
  }

  startEditSet(logId: string, set: SetRecord): void {
    this.editingSet.set({ logId, setNumber: set.setNumber });
    this.editWeightInput.set(set.weight ?? null);
    this.editRepsInput.set(set.reps ?? null);
    this.editDurationInput.set(set.duration ?? null);
  }

  cancelEditSet(): void {
    this.editingSet.set(null);
  }

  isEditingSet(logId: string, setNumber: number): boolean {
    const editing = this.editingSet();
    return !!editing && editing.logId === logId && editing.setNumber === setNumber;
  }

  async saveEditSet(trackingType: ExerciseTrackingType): Promise<void> {
    const editing = this.editingSet();
    if (!editing) return;
    const changes: Partial<SetRecord> = {};
    if (trackingType === 'duration') {
      changes.duration = this.editDurationInput() ?? 0;
    } else if (trackingType === 'reps_only') {
      changes.reps = this.editRepsInput() ?? 0;
    } else {
      changes.weight = this.editWeightInput() ?? 0;
      changes.reps = this.editRepsInput() ?? 0;
    }
    await this.exerciseLogService.updateSet(editing.logId, editing.setNumber, changes);
    this.editingSet.set(null);
  }

  async removeSet(logId: string, setNumber: number): Promise<void> {
    await this.exerciseLogService.deleteSet(logId, setNumber);
  }

  private flashCompletedTile(): void {
    this.justCompletedSet.set(false);
    // Re-trigger the CSS animation on the next frame even if it's already mid-flash.
    requestAnimationFrame(() => this.justCompletedSet.set(true));
    setTimeout(() => this.justCompletedSet.set(false), 260);
  }

  async completeTraining(): Promise<void> {
    const w = this.workout();
    if (!w || !this.hasLoggedAnySet()) return;
    this.completing.set(true);
    await this.exerciseLogService.completeWorkoutLogs(w.id);
    await this.workoutService.markComplete(w.id, this.elapsedSeconds());
    this.router.navigate(['/workouts', w.id]);
  }

  formatTime(seconds: number): string {
    return formatTimeUtil(seconds);
  }

  formatHistoryDate(dateStr: string): string {
    return formatDisplayDate(parseLocalDate(dateStr));
  }

  skipRest(): void {
    this.finishRestTimer();
  }

  private scrollActivePillIntoView(): void {
    const pill = this.elementRef.nativeElement.querySelector<HTMLElement>('[data-active-pill="true"]');
    pill?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  private resetForNewSlot(): void {
    this.logSetError.set(null);
    this.editingSet.set(null);
    this.weightInput.set(null);
    this.repsInput.set(null);
    this.resetDurationTimer();
  }

  private startRestTimer(seconds: number): void {
    this.clearRestInterval();
    this.restClosing.set(false);
    this.restSeconds.set(seconds);
    this.restTotalSeconds.set(seconds);
    this.isResting.set(true);
    this.restJustFinished.set(false);
    this.timerInterval = setInterval(() => {
      const remaining = this.restSeconds() - 1;
      if (remaining <= 0) {
        this.restSeconds.set(0);
        this.restJustFinished.set(true);
        this.clearRestInterval();
      } else {
        this.restSeconds.set(remaining);
      }
    }, 1000);
  }

  /** Animated close — countdown "Got it" dismissal or an explicit "Skip Rest" tap. */
  private finishRestTimer(): void {
    this.clearRestInterval();
    if (!this.isResting()) return;
    this.restClosing.set(true);
    setTimeout(() => {
      this.isResting.set(false);
      this.restSeconds.set(0);
      this.restJustFinished.set(false);
      this.restClosing.set(false);
    }, 200);
  }

  /** Hard/immediate reset — tearing down the component, no animation. */
  private stopRestTimer(): void {
    this.clearRestInterval();
    this.isResting.set(false);
    this.restJustFinished.set(false);
    this.restClosing.set(false);
    this.restSeconds.set(0);
  }

  private clearRestInterval(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

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
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    if (this.elapsedInterval) {
      clearInterval(this.elapsedInterval);
      this.elapsedInterval = null;
    }
  }
}
