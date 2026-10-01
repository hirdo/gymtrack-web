import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormArray, FormGroup, AbstractControl, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ProgramService } from '../../core/services/program.service';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { ExerciseBundleService } from '../../core/services/exercise-bundle.service';
import { ExercisePickerModalComponent } from '../../shared/components/exercise-picker-modal/exercise-picker-modal.component';
import { BundlePickerModalComponent } from '../../shared/components/bundle-picker-modal/bundle-picker-modal.component';
import { FieldErrorComponent } from '../../shared/components/field-error/field-error.component';
import { ProgramDifficulty, ExerciseTemplate, ExerciseBundle, ExerciseTrackingType, MuscleGroup, TimeUnit, PROGRAM_DIFFICULTIES } from '../../core/models/workout.model';
import { convertTimeValue } from '../../core/utils/date.util';

@Component({
  selector: 'app-program-create',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, ExercisePickerModalComponent, BundlePickerModalComponent, DragDropModule, FieldErrorComponent],
  templateUrl: './program-create.component.html',
  styleUrl: './program-create.component.scss'
})
export class ProgramCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly programService = inject(ProgramService);
  readonly exerciseService = inject(ExerciseLibraryService);
  private readonly bundleService = inject(ExerciseBundleService);

  readonly difficulties = PROGRAM_DIFFICULTIES;

  starLabel(stars: number): string {
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  }

  readonly pickerOpen = signal(false);
  private pickerTarget: { dayIndex: number; exerciseIndex: number } | null = null;

  readonly isEditMode = signal(false);
  private editId: string | null = null;
  readonly submitting = signal(false);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    difficulty: ['intermediate' as ProgramDifficulty, Validators.required],
    sessionsPerWeek: [4, [Validators.required, Validators.min(1), Validators.max(7)]],
    days: this.fb.array([this.createDayGroup(0)])
  });

  get days(): FormArray {
    return this.form.get('days') as FormArray;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    const program = this.programService.getById(id);
    if (!program) {
      this.router.navigate(['/programs']);
      return;
    }

    this.isEditMode.set(true);
    this.editId = id;
    this.form.patchValue({
      name: program.name,
      description: program.description || '',
      difficulty: program.difficulty,
      sessionsPerWeek: program.sessionsPerWeek
    });

    this.days.clear();
    for (const day of program.days) {
      const dayGroup = this.createDayGroup(day.dayNumber);
      dayGroup.patchValue({ name: day.name });
      const exercises = dayGroup.get('exercises') as FormArray;
      exercises.clear();
      for (const ex of day.exercises) {
        const exGroup = this.createExerciseGroup();
        const durationUnit: TimeUnit = ex.targetDurationUnit ?? 'min';
        const restTimeUnit: TimeUnit = ex.restTimeUnit ?? 'min';
        exGroup.patchValue({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          trackingType: ex.trackingType ?? 'reps',
          targetSets: ex.targetSets,
          targetReps: ex.targetReps ?? null,
          targetWeight: ex.targetWeight ?? null,
          targetDuration: ex.targetDuration != null
            ? (durationUnit === 'sec' ? ex.targetDuration : ex.targetDuration / 60)
            : null,
          targetDurationUnit: durationUnit,
          restTime: ex.restTime != null
            ? (restTimeUnit === 'sec' ? ex.restTime : ex.restTime / 60)
            : null,
          restTimeUnit,
          alternativeExerciseIds: ex.alternativeExerciseIds ?? []
        });
        exercises.push(exGroup);
      }
      this.days.push(dayGroup);
    }
  }

  getDayExercises(dayIndex: number): FormArray {
    return this.days.at(dayIndex).get('exercises') as FormArray;
  }

  createDayGroup(dayNumber: number): FormGroup {
    return this.fb.group({
      dayNumber: [dayNumber],
      name: ['', Validators.required],
      exercises: this.fb.array([this.createExerciseGroup()])
    });
  }

  createExerciseGroup(): FormGroup {
    return this.fb.group({
      exerciseId: [crypto.randomUUID()],
      exerciseName: ['', Validators.required],
      trackingType: ['reps' as ExerciseTrackingType],
      targetSets: [3, [Validators.required, Validators.min(1)]],
      targetReps: [12 as number | null, [Validators.min(1)]],
      targetWeight: [null as number | null],
      targetDuration: [null as number | null],
      targetDurationUnit: ['min' as TimeUnit],
      restTime: [2 as number | null],
      restTimeUnit: ['min' as TimeUnit],
      alternativeExerciseIds: [[] as string[]]
    });
  }

  setTimeUnit(group: AbstractControl, valueField: string, unitField: string, unit: TimeUnit): void {
    const currentUnit = (group.get(unitField)?.value as TimeUnit) ?? 'min';
    if (currentUnit === unit) return;
    const currentValue = group.get(valueField)?.value as number | null;
    const newValue = currentValue != null ? convertTimeValue(currentValue, currentUnit, unit) : currentValue;
    group.patchValue({ [valueField]: newValue, [unitField]: unit });
  }

  addDay(): void {
    this.days.push(this.createDayGroup(this.days.length));
  }

  removeDay(index: number): void {
    if (this.days.length > 1) {
      this.days.removeAt(index);
      this.renumberDays();
    }
  }

  duplicateDay(index: number): void {
    const sourceValue = this.days.at(index).getRawValue();
    this.days.push(this.cloneDayGroup(sourceValue));
    this.renumberDays();
  }

  // Shared by duplicateDay() and duplicateDayRange() — builds a fresh day
  // FormGroup with the same name/exercises as the given day's raw value.
  // dayNumber is left at its placeholder; renumberDays() fixes it afterwards.
  private cloneDayGroup(sourceValue: Record<string, unknown>): FormGroup {
    const newDay = this.createDayGroup(0);
    newDay.patchValue({ name: sourceValue['name'] });
    const exercises = newDay.get('exercises') as FormArray;
    exercises.clear();
    for (const ex of sourceValue['exercises'] as Record<string, unknown>[]) {
      const exGroup = this.createExerciseGroup();
      exGroup.patchValue(ex);
      exercises.push(exGroup);
    }
    return newDay;
  }

  readonly duplicateRangeStart = signal(1);
  readonly duplicateRangeEnd = signal(1);

  canDuplicateRange(): boolean {
    const start = this.duplicateRangeStart();
    const end = this.duplicateRangeEnd();
    return start >= 1 && end >= start && end <= this.days.length;
  }

  // Duplicates Day `start`..`end` as a new block appended to the end, in the
  // same order, e.g. duplicating Days 1-3 of a 3-day program adds Days 4-6
  // with identical names/exercises.
  duplicateDayRange(): void {
    if (!this.canDuplicateRange()) return;
    const startIndex = this.duplicateRangeStart() - 1;
    const endIndex = this.duplicateRangeEnd() - 1;
    const sourceValues = [];
    for (let i = startIndex; i <= endIndex; i++) {
      sourceValues.push(this.days.at(i).getRawValue());
    }
    for (const sourceValue of sourceValues) {
      this.days.push(this.cloneDayGroup(sourceValue));
    }
    this.renumberDays();
  }

  dropDay(event: CdkDragDrop<unknown>): void {
    moveItemInArray(this.days.controls, event.previousIndex, event.currentIndex);
    this.days.updateValueAndValidity();
    this.renumberDays();
  }

  dropExercise(dayIndex: number, event: CdkDragDrop<unknown>): void {
    const exercises = this.getDayExercises(dayIndex);
    moveItemInArray(exercises.controls, event.previousIndex, event.currentIndex);
    exercises.updateValueAndValidity();
  }

  private renumberDays(): void {
    for (let i = 0; i < this.days.length; i++) {
      this.days.at(i).get('dayNumber')?.setValue(i);
    }
  }

  addExercise(dayIndex: number): void {
    this.getDayExercises(dayIndex).push(this.createExerciseGroup());
  }

  removeExercise(dayIndex: number, exerciseIndex: number): void {
    const exercises = this.getDayExercises(dayIndex);
    if (exercises.length > 1) {
      exercises.removeAt(exerciseIndex);
    }
  }

  openExercisePicker(dayIndex: number, exerciseIndex: number): void {
    this.pickerTarget = { dayIndex, exerciseIndex };
    this.pickerOpen.set(true);
  }

  onExercisePicked(
    exercise: ExerciseTemplate,
    target: { dayIndex: number; exerciseIndex: number } | null = this.pickerTarget
  ): void {
    if (!target) return;
    const group = this.getDayExercises(target.dayIndex).at(target.exerciseIndex);
    const trackingType = exercise.trackingType ?? 'reps';
    const durationUnit: TimeUnit = exercise.recommendedDurationUnit ?? 'min';
    const restTimeUnit: TimeUnit = exercise.recommendedRestTimeUnit ?? 'min';
    const targetDurationValue = exercise.recommendedDuration != null
      ? (durationUnit === 'sec' ? exercise.recommendedDuration : exercise.recommendedDuration / 60)
      : group.get('targetDuration')?.value;
    const targetDurationUnitValue = exercise.recommendedDuration != null ? durationUnit : group.get('targetDurationUnit')?.value;
    const restTimeValue = exercise.recommendedRestTime != null
      ? (restTimeUnit === 'sec' ? exercise.recommendedRestTime : exercise.recommendedRestTime / 60)
      : group.get('restTime')?.value;
    const restTimeUnitValue = exercise.recommendedRestTime != null ? restTimeUnit : group.get('restTimeUnit')?.value;

    if (trackingType === 'duration') {
      group.patchValue({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        trackingType,
        targetSets: 1,
        targetReps: null,
        targetWeight: null,
        targetDuration: targetDurationValue,
        targetDurationUnit: targetDurationUnitValue,
        restTime: restTimeValue,
        restTimeUnit: restTimeUnitValue,
        alternativeExerciseIds: []
      });
    } else if (trackingType === 'reps_only') {
      group.patchValue({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        trackingType,
        targetReps: exercise.recommendedReps ?? group.get('targetReps')?.value,
        targetWeight: null,
        targetDuration: null,
        restTime: restTimeValue,
        restTimeUnit: restTimeUnitValue,
        alternativeExerciseIds: []
      });
    } else {
      group.patchValue({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        trackingType,
        targetReps: exercise.recommendedReps ?? group.get('targetReps')?.value,
        targetWeight: exercise.recommendedWeight ?? group.get('targetWeight')?.value,
        targetDuration: null,
        restTime: restTimeValue,
        restTimeUnit: restTimeUnitValue,
        alternativeExerciseIds: []
      });
    }
    this.pickerTarget = null;
  }

  closeExercisePicker(): void {
    this.pickerOpen.set(false);
    this.pickerTarget = null;
  }

  readonly bundlePickerOpen = signal(false);
  private bundlePickerTarget: { dayIndex: number; exerciseIndex: number } | null = null;

  openBundlePicker(dayIndex: number, exerciseIndex: number): void {
    this.bundlePickerTarget = { dayIndex, exerciseIndex };
    this.bundlePickerOpen.set(true);
  }

  closeBundlePicker(): void {
    this.bundlePickerOpen.set(false);
    this.bundlePickerTarget = null;
  }

  onBundlePicked(bundle: ExerciseBundle): void {
    if (!this.bundlePickerTarget) return;
    const target = this.bundlePickerTarget;
    this.bundlePickerTarget = null;
    const mainExercise = this.exerciseService.getById(bundle.mainExerciseId);
    if (!mainExercise) return;
    this.onExercisePicked(mainExercise, target);
    this.getDayExercises(target.dayIndex).at(target.exerciseIndex)
      .patchValue({ alternativeExerciseIds: bundle.alternativeExerciseIds });
  }

  getExerciseImage(exerciseId: string): string | undefined {
    return this.exerciseService.getById(exerciseId)?.imageUrl;
  }

  getExerciseName(exerciseId: string): string | undefined {
    return this.exerciseService.getById(exerciseId)?.name;
  }

  readonly altPickerOpen = signal(false);
  private altPickerTarget: { dayIndex: number; exerciseIndex: number } | null = null;

  openAlternativesPicker(dayIndex: number, exerciseIndex: number): void {
    this.altPickerTarget = { dayIndex, exerciseIndex };
    this.altPickerOpen.set(true);
  }

  closeAlternativesPicker(): void {
    this.altPickerOpen.set(false);
    this.altPickerTarget = null;
  }

  onAlternativesPicked(exercises: ExerciseTemplate[]): void {
    if (!this.altPickerTarget) return;
    const group = this.getDayExercises(this.altPickerTarget.dayIndex).at(this.altPickerTarget.exerciseIndex);
    group.get('alternativeExerciseIds')?.setValue(exercises.map(e => e.id));
    this.altPickerTarget = null;
  }

  removeAlternative(dayIndex: number, exerciseIndex: number, id: string): void {
    const group = this.getDayExercises(dayIndex).at(exerciseIndex);
    const control = group.get('alternativeExerciseIds');
    const current = (control?.value as string[]) || [];
    control?.setValue(current.filter(i => i !== id));
  }

  altPickerTargetExcludeIds(): string[] {
    if (!this.altPickerTarget) return [];
    const mainId = this.getDayExercises(this.altPickerTarget.dayIndex).at(this.altPickerTarget.exerciseIndex).get('exerciseId')?.value;
    return mainId ? [mainId] : [];
  }

  altPreselectedIds(): string[] {
    if (!this.altPickerTarget) return [];
    const group = this.getDayExercises(this.altPickerTarget.dayIndex).at(this.altPickerTarget.exerciseIndex);
    return (group.get('alternativeExerciseIds')?.value as string[]) || [];
  }

  altPickerTargetTrackingType(): ExerciseTrackingType | null {
    if (!this.altPickerTarget) return null;
    const group = this.getDayExercises(this.altPickerTarget.dayIndex).at(this.altPickerTarget.exerciseIndex);
    return (group.get('trackingType')?.value as ExerciseTrackingType) ?? 'reps';
  }

  altPickerTargetMuscles(): MuscleGroup[] | null {
    if (!this.altPickerTarget) return null;
    const group = this.getDayExercises(this.altPickerTarget.dayIndex).at(this.altPickerTarget.exerciseIndex);
    const mainId = group.get('exerciseId')?.value as string | undefined;
    return mainId ? this.exerciseService.getById(mainId)?.primaryMuscles ?? null : null;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;

    const value = this.form.getRawValue();
    const days = value.days.map((d: Record<string, unknown>, i: number) => {
      const exercises = d['exercises'] as Record<string, unknown>[];
      return {
        dayNumber: i,
        name: d['name'] as string,
        exercises: exercises.map((e: Record<string, unknown>) => {
          const durationUnit: TimeUnit = (e['targetDurationUnit'] as TimeUnit) ?? 'min';
          const restTimeUnit: TimeUnit = (e['restTimeUnit'] as TimeUnit) ?? 'min';
          return {
            exerciseId: e['exerciseId'] as string,
            exerciseName: e['exerciseName'] as string,
            trackingType: e['trackingType'] as ExerciseTrackingType,
            targetSets: e['targetSets'] as number,
            targetReps: (e['targetReps'] as number) || undefined,
            targetWeight: (e['targetWeight'] as number) || undefined,
            targetDuration: e['targetDuration']
              ? Math.round(durationUnit === 'sec' ? (e['targetDuration'] as number) : (e['targetDuration'] as number) * 60)
              : undefined,
            targetDurationUnit: e['targetDuration'] ? durationUnit : undefined,
            restTime: e['restTime']
              ? Math.round(restTimeUnit === 'sec' ? (e['restTime'] as number) : (e['restTime'] as number) * 60)
              : undefined,
            restTimeUnit: e['restTime'] ? restTimeUnit : undefined,
            alternativeExerciseIds: (e['alternativeExerciseIds'] as string[])?.length ? (e['alternativeExerciseIds'] as string[]) : undefined
          };
        })
      };
    });

    this.submitting.set(true);
    try {
      if (this.isEditMode() && this.editId) {
        await this.programService.update(this.editId, {
          name: value.name!,
          description: value.description || undefined,
          difficulty: value.difficulty!,
          totalDays: days.length,
          sessionsPerWeek: value.sessionsPerWeek!,
          days
        });
        this.router.navigate(['/programs', this.editId]);
      } else {
        const program = await this.programService.create({
          name: value.name!,
          description: value.description || undefined,
          difficulty: value.difficulty!,
          totalDays: days.length,
          sessionsPerWeek: value.sessionsPerWeek!,
          days,
          isActive: false,
          currentDay: 0,
          completedSessions: 0
        });
        this.router.navigate(['/programs', program.id]);
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
