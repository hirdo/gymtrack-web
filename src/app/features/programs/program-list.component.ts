import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProgramService } from '../../core/services/program.service';
import { AuthService } from '../../core/services/auth.service';
import { PROGRAM_DIFFICULTIES, ProgramDifficulty, difficultyLabel } from '../../core/models/workout.model';
import { FluidFieldBackgroundComponent } from '../../shared/components/fluid-field-background/fluid-field-background.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-program-list',
  standalone: true,
  imports: [RouterLink, FluidFieldBackgroundComponent, PaginationComponent],
  templateUrl: './program-list.component.html',
  styleUrl: './program-list.component.scss'
})
export class ProgramListComponent {
  readonly programService = inject(ProgramService);
  readonly auth = inject(AuthService);

  readonly starRange = [1, 2, 3, 4, 5];
  protected readonly Math = Math;

  readonly page = signal(1);
  private readonly pageSize = 10;

  readonly pagedPrograms = computed(() => {
    const all = this.programService.visiblePrograms();
    const start = (this.page() - 1) * this.pageSize;
    return all.slice(start, start + this.pageSize);
  });

  difficultyStars(difficulty: ProgramDifficulty): number {
    return PROGRAM_DIFFICULTIES.find(d => d.value === difficulty)?.stars ?? 0;
  }

  readonly difficultyLabel = difficultyLabel;
}
