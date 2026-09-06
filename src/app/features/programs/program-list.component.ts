import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProgramService } from '../../core/services/program.service';
import { AuthService } from '../../core/services/auth.service';
import { PROGRAM_DIFFICULTIES, ProgramDifficulty } from '../../core/models/workout.model';

@Component({
  selector: 'app-program-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './program-list.component.html',
  styleUrl: './program-list.component.scss'
})
export class ProgramListComponent {
  readonly programService = inject(ProgramService);
  readonly auth = inject(AuthService);

  readonly starRange = [1, 2, 3, 4, 5];

  progressPercent(currentDay: number | undefined, totalDays: number): number {
    return totalDays > 0 ? Math.round(((currentDay || 0) / totalDays) * 100) : 0;
  }

  difficultyStars(difficulty: ProgramDifficulty): number {
    return PROGRAM_DIFFICULTIES.find(d => d.value === difficulty)?.stars ?? 0;
  }

  difficultyLabel(difficulty: ProgramDifficulty): string {
    return PROGRAM_DIFFICULTIES.find(d => d.value === difficulty)?.label ?? difficulty;
  }
}
