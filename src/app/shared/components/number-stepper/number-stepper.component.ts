import { Component, Input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-number-stepper',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex items-stretch gap-2">
      <button
        type="button"
        class="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg border border-border bg-background text-text hover:bg-surface-light active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none"
        [disabled]="value() <= min"
        (click)="decrement()"
        aria-label="Decrease"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
        </svg>
      </button>
      <input
        type="number"
        class="w-full min-w-0 bg-background border border-border rounded-lg px-2 py-2.5 text-lg font-heading font-bold text-center text-text focus:border-primary focus:outline-none transition-colors"
        [ngModel]="value()"
        (ngModelChange)="onInputChange($event)"
        [step]="step"
        [min]="min"
        [inputMode]="inputmode"
      />
      <button
        type="button"
        class="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg border border-border bg-background text-text hover:bg-surface-light active:scale-95 transition-transform"
        (click)="increment()"
        aria-label="Increase"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  `
})
export class NumberStepperComponent {
  readonly value = model<number>(0);

  @Input() step = 1;
  @Input() min = 0;
  @Input() inputmode: 'decimal' | 'numeric' = 'decimal';

  increment(): void {
    this.value.set(this.round(this.value() + this.step));
  }

  decrement(): void {
    this.value.set(Math.max(this.min, this.round(this.value() - this.step)));
  }

  onInputChange(raw: number | string): void {
    const parsed = typeof raw === 'number' ? raw : parseFloat(raw);
    this.value.set(Number.isFinite(parsed) ? Math.max(this.min, parsed) : this.min);
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
