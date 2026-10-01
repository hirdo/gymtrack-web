import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { ExerciseBundleService } from '../../core/services/exercise-bundle.service';
import { ExerciseTemplate, ExerciseTrackingType, MuscleGroup } from '../../core/models/workout.model';
import { ExercisePickerModalComponent } from '../../shared/components/exercise-picker-modal/exercise-picker-modal.component';
import { FieldErrorComponent } from '../../shared/components/field-error/field-error.component';

@Component({
  selector: 'app-exercise-bundle-create',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ExercisePickerModalComponent, FieldErrorComponent],
  templateUrl: './exercise-bundle-create.component.html',
  styleUrl: './exercise-bundle-create.component.scss'
})
export class ExerciseBundleCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly bundleService = inject(ExerciseBundleService);
  readonly exerciseService = inject(ExerciseLibraryService);

  readonly isEditMode = signal(false);
  private editId: string | null = null;
  readonly submitting = signal(false);

  readonly confirmingDelete = signal(false);
  readonly deleting = signal(false);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    mainExerciseId: [null as string | null, Validators.required],
    mainExerciseName: [''],
    alternativeExerciseIds: [[] as string[]]
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    const bundle = this.bundleService.getById(id);
    if (!bundle) {
      this.router.navigate(['/exercises'], { queryParams: { tab: 'bundles' } });
      return;
    }

    this.isEditMode.set(true);
    this.editId = id;
    this.form.patchValue({
      name: bundle.name,
      mainExerciseId: bundle.mainExerciseId,
      mainExerciseName: this.exerciseService.getById(bundle.mainExerciseId)?.name || '',
      alternativeExerciseIds: bundle.alternativeExerciseIds
    });
  }

  readonly mainPickerOpen = signal(false);

  openMainPicker(): void {
    this.mainPickerOpen.set(true);
  }

  closeMainPicker(): void {
    this.mainPickerOpen.set(false);
  }

  onMainExercisePicked(exercise: ExerciseTemplate): void {
    this.form.patchValue({
      mainExerciseId: exercise.id,
      mainExerciseName: exercise.name,
      alternativeExerciseIds: []
    });
    this.mainPickerOpen.set(false);
  }

  readonly altPickerOpen = signal(false);

  openAltPicker(): void {
    this.altPickerOpen.set(true);
  }

  closeAltPicker(): void {
    this.altPickerOpen.set(false);
  }

  onAlternativesPicked(exercises: ExerciseTemplate[]): void {
    this.form.get('alternativeExerciseIds')?.setValue(exercises.map(e => e.id));
  }

  removeAlternative(id: string): void {
    const control = this.form.get('alternativeExerciseIds');
    const current = (control?.value as string[]) || [];
    control?.setValue(current.filter(i => i !== id));
  }

  altExcludeIds(): string[] {
    const mainId = this.form.value.mainExerciseId;
    return mainId ? [mainId] : [];
  }

  altPreselectedIds(): string[] {
    return (this.form.value.alternativeExerciseIds as string[]) || [];
  }

  altTrackingType(): ExerciseTrackingType | null {
    const mainId = this.form.value.mainExerciseId;
    return mainId ? (this.exerciseService.getById(mainId)?.trackingType ?? 'reps') : null;
  }

  altMuscles(): MuscleGroup[] | null {
    const mainId = this.form.value.mainExerciseId;
    return mainId ? this.exerciseService.getById(mainId)?.primaryMuscles ?? null : null;
  }

  getExerciseImage(exerciseId: string | null | undefined): string | undefined {
    return exerciseId ? this.exerciseService.getById(exerciseId)?.imageUrl : undefined;
  }

  getExerciseName(exerciseId: string): string | undefined {
    return this.exerciseService.getById(exerciseId)?.name;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;

    const value = this.form.getRawValue();
    const data = {
      name: value.name!,
      mainExerciseId: value.mainExerciseId!,
      alternativeExerciseIds: value.alternativeExerciseIds ?? []
    };

    this.submitting.set(true);
    try {
      if (this.isEditMode() && this.editId) {
        await this.bundleService.updateBundle(this.editId, data);
      } else {
        await this.bundleService.addBundle(data);
      }
      this.router.navigate(['/exercises'], { queryParams: { tab: 'bundles' } });
    } finally {
      this.submitting.set(false);
    }
  }

  confirmDelete(): void {
    this.confirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  async deleteBundle(): Promise<void> {
    if (!this.editId || this.deleting()) return;
    this.deleting.set(true);
    try {
      await this.bundleService.deleteBundle(this.editId);
      this.router.navigate(['/exercises'], { queryParams: { tab: 'bundles' } });
    } finally {
      this.deleting.set(false);
    }
  }
}
