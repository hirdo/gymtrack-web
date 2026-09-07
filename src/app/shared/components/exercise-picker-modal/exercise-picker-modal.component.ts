import { Component, inject, signal, computed, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { ExerciseLibraryService } from '../../../core/services/exercise-library.service';
import { ExerciseTemplate, MuscleGroup, Equipment } from '../../../core/models/workout.model';

@Component({
  selector: 'app-exercise-picker-modal',
  standalone: true,
  imports: [FormsModule, TitleCasePipe],
  templateUrl: './exercise-picker-modal.component.html',
  styleUrl: './exercise-picker-modal.component.scss'
})
export class ExercisePickerModalComponent implements OnChanges {
  readonly exerciseService = inject(ExerciseLibraryService);

  @Input() open = false;
  @Input() multiple = false;
  @Input() maxSelect = 5;
  @Input() excludeIds: string[] = [];
  @Input() preselectedIds: string[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() exerciseSelected = new EventEmitter<ExerciseTemplate>();
  @Output() multipleSelected = new EventEmitter<ExerciseTemplate[]>();

  readonly searchQuery = signal('');
  readonly selectedMuscle = signal<MuscleGroup | ''>('');
  readonly selectedEquipment = signal<Equipment | ''>('');
  readonly selectedIds = signal<string[]>([]);

  readonly allMuscleGroups: MuscleGroup[] = [
    'chest', 'back', 'shoulders', 'biceps', 'triceps',
    'forearms', 'core', 'quads', 'hamstrings', 'glutes', 'calves'
  ];

  readonly allEquipment: Equipment[] = [
    'barbell', 'dumbbell', 'machine', 'cable',
    'bodyweight', 'kettlebell', 'band', 'other'
  ];

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
    if (this.excludeIds.length > 0) {
      results = results.filter(e => !this.excludeIds.includes(e.id));
    }
    return results;
  });

  ngOnChanges(): void {
    if (this.open && this.multiple) {
      this.selectedIds.set([...this.preselectedIds]);
    }
  }

  isSelected(exercise: ExerciseTemplate): boolean {
    return this.selectedIds().includes(exercise.id);
  }

  toggleSelect(exercise: ExerciseTemplate): void {
    const ids = this.selectedIds();
    if (ids.includes(exercise.id)) {
      this.selectedIds.set(ids.filter(id => id !== exercise.id));
    } else if (ids.length < this.maxSelect) {
      this.selectedIds.set([...ids, exercise.id]);
    }
  }

  select(exercise: ExerciseTemplate): void {
    if (this.multiple) {
      this.toggleSelect(exercise);
      return;
    }
    this.exerciseSelected.emit(exercise);
    this.close();
  }

  confirmMultiple(): void {
    const ids = this.selectedIds();
    const chosen = this.exerciseService.exercises().filter(e => ids.includes(e.id));
    this.multipleSelected.emit(chosen);
    this.close();
  }

  close(): void {
    this.searchQuery.set('');
    this.selectedMuscle.set('');
    this.selectedEquipment.set('');
    this.selectedIds.set([]);
    this.closed.emit();
  }
}
