import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormArray,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { WorkoutService } from '../../../core/services/workout.service';
import { WorkoutCategory, ExerciseTrackingType, ExerciseTemplate, Workout } from '../../../core/models/workout.model';
import { ExercisePickerModalComponent } from '../../../shared/components/exercise-picker-modal/exercise-picker-modal.component';
import { toLocalDateString } from '../../../core/utils/date.util';

@Component({
  selector: 'app-workout-create',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ExercisePickerModalComponent],
  templateUrl: './workout-create.component.html',
  styleUrl: './workout-create.component.scss'
})
export class WorkoutCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly workoutService = inject(WorkoutService);

  readonly isEditMode = signal(false);
  private editId: string | null = null;

  readonly pickerOpen = signal(false);
  private pickerTarget: number | null = null;

  readonly minDate = toLocalDateString(new Date());
  readonly dateConflictWorkout = signal<Workout | null>(null);

  readonly categories: { value: WorkoutCategory; label: string }[] = [
    { value: 'strength', label: 'Strength' },
    { value: 'cardio', label: 'Cardio' },
    { value: 'flexibility', label: 'Flexibility' },
    { value: 'hiit', label: 'HIIT' },
    { value: 'custom', label: 'Custom' }
  ];

  readonly form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    category: ['strength' as WorkoutCategory, Validators.required],
    scheduledDate: [''],
    exercises: this.fb.array([this.createExerciseGroup()])
  });

  get exercises(): FormArray {
    return this.form.get('exercises') as FormArray;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const workout = this.workoutService.getById(id);
      if (workout && !workout.completedDate) {
        this.isEditMode.set(true);
        this.editId = id;
        this.form.patchValue({
          name: workout.name,
          description: workout.description || '',
          category: workout.category,
          scheduledDate: workout.scheduledDate || ''
        });
        this.exercises.clear();
        for (const ex of workout.exercises) {
          const group = this.createExerciseGroup();
          group.patchValue({
            exerciseId: ex.templateId || null,
            trackingType: ex.trackingType || 'reps',
            name: ex.name,
            imageUrl: ex.imageUrl || null,
            sets: ex.sets,
            reps: ex.reps ?? null,
            weight: ex.weight || null,
            duration: ex.duration || null,
            notes: ex.notes || ''
          });
          this.exercises.push(group);
        }
      } else if (workout?.completedDate) {
        this.router.navigate(['/workouts', id]);
      } else {
        this.router.navigate(['/workouts']);
      }
    }
  }

  createExerciseGroup(): FormGroup {
    return this.fb.group({
      exerciseId: [null as string | null],
      trackingType: ['reps' as ExerciseTrackingType],
      name: ['', Validators.required],
      imageUrl: [null as string | null],
      sets: [3, [Validators.required, Validators.min(1)]],
      reps: [10 as number | null, [Validators.min(1)]],
      weight: [null as number | null],
      duration: [null as number | null],
      notes: ['']
    });
  }

  addExercise(): void {
    this.exercises.push(this.createExerciseGroup());
  }

  removeExercise(index: number): void {
    if (this.exercises.length > 1) {
      this.exercises.removeAt(index);
    }
  }

  openExercisePicker(index: number): void {
    this.pickerTarget = index;
    this.pickerOpen.set(true);
  }

  onExercisePicked(exercise: ExerciseTemplate): void {
    if (this.pickerTarget === null) return;
    const group = this.exercises.at(this.pickerTarget);
    const trackingType = exercise.trackingType ?? 'reps';
    if (trackingType === 'duration') {
      group.patchValue({
        exerciseId: exercise.id,
        trackingType,
        name: exercise.name,
        imageUrl: exercise.imageUrl || null,
        sets: 1,
        reps: null,
        weight: null,
        duration: exercise.recommendedDuration ?? group.get('duration')?.value
      });
    } else if (trackingType === 'reps_only') {
      group.patchValue({
        exerciseId: exercise.id,
        trackingType,
        name: exercise.name,
        imageUrl: exercise.imageUrl || null,
        reps: exercise.recommendedReps ?? group.get('reps')?.value,
        weight: null,
        duration: null
      });
    } else {
      group.patchValue({
        exerciseId: exercise.id,
        trackingType,
        name: exercise.name,
        imageUrl: exercise.imageUrl || null,
        reps: exercise.recommendedReps ?? group.get('reps')?.value,
        weight: exercise.recommendedWeight ?? group.get('weight')?.value,
        duration: null
      });
    }
    this.pickerTarget = null;
  }

  closeExercisePicker(): void {
    this.pickerOpen.set(false);
    this.pickerTarget = null;
  }

  closeDateConflict(): void {
    this.dateConflictWorkout.set(null);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    const value = this.form.getRawValue();

    if (value.scheduledDate) {
      const conflict = this.workoutService.workouts().find(w =>
        w.scheduledDate === value.scheduledDate && w.id !== this.editId
      );
      if (conflict) {
        this.dateConflictWorkout.set(conflict);
        return;
      }
    }

    const exercises = value.exercises.map((e) => ({
      id: crypto.randomUUID(),
      templateId: e['exerciseId'] || undefined,
      trackingType: e['trackingType'] as ExerciseTrackingType,
      name: e['name']!,
      imageUrl: e['imageUrl'] || undefined,
      sets: e['sets']!,
      reps: e['reps'] || undefined,
      weight: e['weight'] || undefined,
      duration: e['duration'] || undefined,
      notes: e['notes'] || undefined
    }));

    if (this.isEditMode() && this.editId) {
      await this.workoutService.update(this.editId, {
        name: value.name!,
        description: value.description || undefined,
        category: value.category as WorkoutCategory,
        scheduledDate: value.scheduledDate || undefined,
        exercises
      });
      this.router.navigate(['/workouts', this.editId]);
    } else {
      const workout = await this.workoutService.add({
        name: value.name!,
        description: value.description || undefined,
        category: value.category as WorkoutCategory,
        scheduledDate: value.scheduledDate || undefined,
        exercises
      });
      this.router.navigate(['/workouts', workout.id]);
    }
  }

  cancel(): void {
    if (this.isEditMode() && this.editId) {
      this.router.navigate(['/workouts', this.editId]);
    } else {
      this.router.navigate(['/workouts']);
    }
  }
}
