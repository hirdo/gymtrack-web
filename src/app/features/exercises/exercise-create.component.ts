import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { StorageService } from '../../core/services/storage.service';
import { WorkoutCategory, MuscleGroup, Equipment, ExerciseTrackingType, TimeUnit } from '../../core/models/workout.model';
import { convertTimeValue } from '../../core/utils/date.util';
import { FieldErrorComponent } from '../../shared/components/field-error/field-error.component';

@Component({
  selector: 'app-exercise-create',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TitleCasePipe, FieldErrorComponent],
  templateUrl: './exercise-create.component.html',
  styleUrl: './exercise-create.component.scss'
})
export class ExerciseCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly exerciseService = inject(ExerciseLibraryService);
  private readonly storageService = inject(StorageService);

  readonly categories: WorkoutCategory[] = ['strength', 'cardio', 'flexibility', 'hiit', 'custom'];
  readonly muscleGroups: MuscleGroup[] = [
    'chest', 'back', 'shoulders', 'biceps', 'triceps',
    'forearms', 'core', 'legs', 'glutes', 'stretch'
  ];
  readonly equipmentList: Equipment[] = [
    'barbell', 'dumbbell', 'machine', 'cable',
    'bodyweight', 'other'
  ];

  readonly selectedMuscles = new Set<MuscleGroup>();

  readonly isEditMode = signal(false);
  private editId: string | null = null;

  readonly selectedFile = signal<File | null>(null);
  readonly imagePreviewUrl = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    category: ['strength' as WorkoutCategory, Validators.required],
    equipment: ['barbell' as Equipment, Validators.required],
    trackingType: ['reps' as ExerciseTrackingType, Validators.required],
    recommendedReps: [null as number | null],
    recommendedWeight: [null as number | null],
    recommendedDuration: [null as number | null],
    recommendedDurationUnit: ['min' as TimeUnit],
    recommendedRestTime: [null as number | null],
    recommendedRestTimeUnit: ['min' as TimeUnit],
    instructions: ['']
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    const exercise = this.exerciseService.getById(id);
    if (!exercise) {
      this.router.navigate(['/exercises']);
      return;
    }

    this.isEditMode.set(true);
    this.editId = id;
    const durationUnit: TimeUnit = exercise.recommendedDurationUnit ?? 'min';
    const restTimeUnit: TimeUnit = exercise.recommendedRestTimeUnit ?? 'min';
    this.form.patchValue({
      name: exercise.name,
      category: exercise.category,
      equipment: exercise.equipment,
      trackingType: exercise.trackingType || 'reps',
      recommendedReps: exercise.recommendedReps ?? null,
      recommendedWeight: exercise.recommendedWeight ?? null,
      recommendedDuration: exercise.recommendedDuration != null
        ? (durationUnit === 'sec' ? exercise.recommendedDuration : exercise.recommendedDuration / 60)
        : null,
      recommendedDurationUnit: durationUnit,
      recommendedRestTime: exercise.recommendedRestTime != null
        ? (restTimeUnit === 'sec' ? exercise.recommendedRestTime : exercise.recommendedRestTime / 60)
        : null,
      recommendedRestTimeUnit: restTimeUnit,
      instructions: exercise.instructions || ''
    });
    for (const muscle of exercise.primaryMuscles) {
      this.selectedMuscles.add(muscle);
    }
    if (exercise.imageUrl) {
      this.imagePreviewUrl.set(exercise.imageUrl);
    }
  }

  setTimeUnit(group: FormGroup, valueField: string, unitField: string, unit: TimeUnit): void {
    const currentUnit = (group.get(unitField)?.value as TimeUnit) ?? 'min';
    if (currentUnit === unit) return;
    const currentValue = group.get(valueField)?.value as number | null;
    const newValue = currentValue != null ? convertTimeValue(currentValue, currentUnit, unit) : currentValue;
    group.patchValue({ [valueField]: newValue, [unitField]: unit });
  }

  toggleMuscle(muscle: MuscleGroup): void {
    if (this.selectedMuscles.has(muscle)) {
      this.selectedMuscles.delete(muscle);
    } else {
      this.selectedMuscles.add(muscle);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.selectedFile.set(file);
    this.imagePreviewUrl.set(URL.createObjectURL(file));
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.selectedMuscles.size === 0 || this.submitting()) return;

    const value = this.form.getRawValue();
    const durationUnit: TimeUnit = value.recommendedDurationUnit ?? 'min';
    const restTimeUnit: TimeUnit = value.recommendedRestTimeUnit ?? 'min';
    const data = {
      name: value.name!,
      category: value.category!,
      equipment: value.equipment!,
      trackingType: value.trackingType!,
      recommendedReps: value.trackingType !== 'duration' ? (value.recommendedReps || undefined) : undefined,
      recommendedWeight: value.trackingType === 'reps' ? (value.recommendedWeight || undefined) : undefined,
      recommendedDuration: value.trackingType === 'duration' && value.recommendedDuration
        ? Math.round(durationUnit === 'sec' ? value.recommendedDuration : value.recommendedDuration * 60)
        : undefined,
      recommendedDurationUnit: value.trackingType === 'duration' && value.recommendedDuration ? durationUnit : undefined,
      recommendedRestTime: value.recommendedRestTime
        ? Math.round(restTimeUnit === 'sec' ? value.recommendedRestTime : value.recommendedRestTime * 60)
        : undefined,
      recommendedRestTimeUnit: value.recommendedRestTime ? restTimeUnit : undefined,
      primaryMuscles: Array.from(this.selectedMuscles),
      instructions: value.instructions || ''
    };

    this.submitting.set(true);
    try {
      let exerciseId: string;
      if (this.isEditMode() && this.editId) {
        exerciseId = this.editId;
        await this.exerciseService.updateExercise(exerciseId, data);
      } else {
        const exercise = await this.exerciseService.addExercise({ ...data, isCustom: true });
        exerciseId = exercise.id;
      }

      const file = this.selectedFile();
      if (file) {
        this.uploading.set(true);
        this.uploadError.set(null);
        try {
          const imageUrl = await this.storageService.uploadImage(exerciseId, file);
          await this.exerciseService.updateExercise(exerciseId, { imageUrl });
        } catch (err) {
          this.uploadError.set(
            err instanceof Error ? err.message : 'Image upload failed.'
          );
          return;
        } finally {
          this.uploading.set(false);
        }
      }

      this.router.navigate(['/exercises', exerciseId]);
    } finally {
      this.submitting.set(false);
    }
  }
}
