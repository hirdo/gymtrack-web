import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormArray, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ProgramService } from '../../core/services/program.service';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { ExercisePickerModalComponent } from '../../shared/components/exercise-picker-modal/exercise-picker-modal.component';
import { ProgramDifficulty, ExerciseTemplate, ExerciseTrackingType, PROGRAM_DIFFICULTIES } from '../../core/models/workout.model';

@Component({
  selector: 'app-program-create',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, ExercisePickerModalComponent, DragDropModule],
  templateUrl: './program-create.component.html',
  styleUrl: './program-create.component.scss'
})
export class ProgramCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly programService = inject(ProgramService);
  readonly exerciseService = inject(ExerciseLibraryService);

  readonly difficulties = PROGRAM_DIFFICULTIES;

  starLabel(stars: number): string {
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  }

  readonly pickerOpen = signal(false);
  private pickerTarget: { dayIndex: number; exerciseIndex: number } | null = null;

  readonly isEditMode = signal(false);
  private editId: string | null = null;

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
        exGroup.patchValue({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          trackingType: ex.trackingType ?? 'reps',
          targetSets: ex.targetSets,
          targetReps: ex.targetReps ?? null,
          targetWeight: ex.targetWeight ?? null,
          targetDuration: ex.targetDuration ?? null,
          restTime: ex.restTime ?? null,
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
      restTime: [90 as number | null],
      alternativeExerciseIds: [[] as string[]]
    });
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
    const newDay = this.createDayGroup(index + 1);
    newDay.patchValue({ name: sourceValue['name'] });
    const exercises = newDay.get('exercises') as FormArray;
    exercises.clear();
    for (const ex of sourceValue['exercises'] as Record<string, unknown>[]) {
      const exGroup = this.createExerciseGroup();
      exGroup.patchValue(ex);
      exercises.push(exGroup);
    }
    this.days.insert(index + 1, newDay);
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

  onExercisePicked(exercise: ExerciseTemplate): void {
    if (!this.pickerTarget) return;
    const group = this.getDayExercises(this.pickerTarget.dayIndex).at(this.pickerTarget.exerciseIndex);
    const trackingType = exercise.trackingType ?? 'reps';
    if (trackingType === 'duration') {
      group.patchValue({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        trackingType,
        targetSets: 1,
        targetReps: null,
        targetWeight: null,
        targetDuration: exercise.recommendedDuration ?? group.get('targetDuration')?.value,
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
        alternativeExerciseIds: []
      });
    }
    this.pickerTarget = null;
  }

  closeExercisePicker(): void {
    this.pickerOpen.set(false);
    this.pickerTarget = null;
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

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    const days = value.days.map((d: Record<string, unknown>, i: number) => {
      const exercises = d['exercises'] as Record<string, unknown>[];
      return {
        dayNumber: i,
        name: d['name'] as string,
        exercises: exercises.map((e: Record<string, unknown>) => ({
          exerciseId: e['exerciseId'] as string,
          exerciseName: e['exerciseName'] as string,
          trackingType: e['trackingType'] as ExerciseTrackingType,
          targetSets: e['targetSets'] as number,
          targetReps: (e['targetReps'] as number) || undefined,
          targetWeight: (e['targetWeight'] as number) || undefined,
          targetDuration: (e['targetDuration'] as number) || undefined,
          restTime: (e['restTime'] as number) || undefined,
          alternativeExerciseIds: (e['alternativeExerciseIds'] as string[])?.length ? (e['alternativeExerciseIds'] as string[]) : undefined
        }))
      };
    });

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
  }
}
