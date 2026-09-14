import { Component, Input } from '@angular/core';

// Sibling to app-circular-progress: same "percentage ring" SVG trick, but
// this one takes arbitrary center content (mm:ss text, "Let's go!", Start/Stop
// buttons) via ng-content instead of always rendering a percent number.
@Component({
  selector: 'app-countdown-ring',
  standalone: true,
  template: `
    <div class="relative shrink-0 inline-flex items-center justify-center" [style.width.px]="size" [style.height.px]="size">
      <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--color-border)" [attr.stroke-width]="trackWidth" />
        <circle cx="18" cy="18" r="15.9155" fill="none"
                [attr.stroke]="strokeColor"
                [attr.stroke-width]="trackWidth"
                stroke-linecap="round"
                stroke-dasharray="100 100"
                [attr.stroke-dashoffset]="100 - clampedPercent"
                class="ring-arc"></circle>
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: `
    .ring-arc {
      transition: stroke-dashoffset 1s linear;
    }

    @media (prefers-reduced-motion: reduce) {
      .ring-arc {
        transition: none;
      }
    }
  `
})
export class CountdownRingComponent {
  @Input() percent = 0;
  @Input() size = 160;
  @Input() trackWidth = 6;
  @Input() colorClass: 'accent' | 'warning' = 'accent';

  get clampedPercent(): number {
    return Math.max(0, Math.min(100, this.percent));
  }

  get strokeColor(): string {
    return this.colorClass === 'warning' ? 'var(--color-warning)' : 'var(--color-accent)';
  }
}
