import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { ExerciseLibraryService } from '../../core/services/exercise-library.service';
import { ExerciseBundleService } from '../../core/services/exercise-bundle.service';
import { AuthService } from '../../core/services/auth.service';
import { MuscleGroup, Equipment } from '../../core/models/workout.model';
import { FluidFieldBackgroundComponent } from '../../shared/components/fluid-field-background/fluid-field-background.component';

@Component({
  selector: 'app-exercise-list',
  standalone: true,
  imports: [RouterLink, FormsModule, TitleCasePipe, FluidFieldBackgroundComponent],
  templateUrl: './exercise-list.component.html',
  styleUrl: './exercise-list.component.scss'
})
export class ExerciseListComponent {
  readonly exerciseService = inject(ExerciseLibraryService);
  readonly bundleService = inject(ExerciseBundleService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly activeTab = signal<'exercises' | 'bundles'>(
    this.route.snapshot.queryParamMap.get('tab') === 'bundles' ? 'bundles' : 'exercises'
  );

  readonly searchQuery = signal('');
  readonly selectedMuscle = signal<MuscleGroup | ''>('');
  readonly selectedEquipment = signal<Equipment | ''>('');

  readonly bundleSearchQuery = signal('');
  readonly filteredBundles = computed(() => this.bundleService.search(this.bundleSearchQuery()));

  readonly allMuscleGroups: MuscleGroup[] = [
    'chest', 'back', 'shoulders', 'biceps', 'triceps',
    'forearms', 'core', 'legs', 'glutes', 'stretch'
  ];

  readonly allEquipment: Equipment[] = [
    'barbell', 'dumbbell', 'machine', 'cable',
    'bodyweight', 'other'
  ];

  protected readonly Math = Math;

  readonly filteredExercises = computed(() => {
    let results = this.exerciseService.search(this.searchQuery());
    const muscle = this.selectedMuscle();
    if (muscle) {
      results = results.filter(e => e.primaryMuscles.includes(muscle));
    }
    const equip = this.selectedEquipment();
    if (equip) {
      results = results.filter(e => e.equipment === equip);
    }
    return results;
  });

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedMuscle.set('');
    this.selectedEquipment.set('');
  }

  getExerciseName(exerciseId: string): string | undefined {
    return this.exerciseService.getById(exerciseId)?.name;
  }

  getExerciseImage(exerciseId: string): string | undefined {
    return this.exerciseService.getById(exerciseId)?.imageUrl;
  }
}
