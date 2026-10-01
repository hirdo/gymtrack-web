import { Component, inject, signal, computed, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { ExerciseLibraryService } from '../../../core/services/exercise-library.service';
import { ExerciseBundleService } from '../../../core/services/exercise-bundle.service';
import { ExerciseBundle, MuscleGroup } from '../../../core/models/workout.model';

@Component({
  selector: 'app-bundle-picker-modal',
  standalone: true,
  imports: [FormsModule, TitleCasePipe],
  templateUrl: './bundle-picker-modal.component.html',
  styleUrl: './bundle-picker-modal.component.scss'
})
export class BundlePickerModalComponent {
  readonly bundleService = inject(ExerciseBundleService);
  private readonly exerciseService = inject(ExerciseLibraryService);

  @Input() open = false;
  @Output() closed = new EventEmitter<void>();
  @Output() bundleSelected = new EventEmitter<ExerciseBundle>();

  readonly searchQuery = signal('');
  readonly selectedMuscle = signal<MuscleGroup | ''>('');

  readonly allMuscleGroups: MuscleGroup[] = [
    'chest', 'back', 'shoulders', 'biceps', 'triceps',
    'forearms', 'core', 'legs', 'glutes', 'stretch'
  ];

  readonly filteredBundles = computed(() => {
    let results = this.bundleService.search(this.searchQuery());
    const muscle = this.selectedMuscle();
    if (muscle) {
      results = results.filter(b => (this.exerciseService.getById(b.mainExerciseId)?.primaryMuscles ?? []).includes(muscle));
    }
    return results;
  });

  getMainExerciseName(bundle: ExerciseBundle): string | undefined {
    return this.exerciseService.getById(bundle.mainExerciseId)?.name;
  }

  getMainExerciseImage(bundle: ExerciseBundle): string | undefined {
    return this.exerciseService.getById(bundle.mainExerciseId)?.imageUrl;
  }

  select(bundle: ExerciseBundle): void {
    this.bundleSelected.emit(bundle);
    this.close();
  }

  close(): void {
    this.searchQuery.set('');
    this.selectedMuscle.set('');
    this.closed.emit();
  }
}
