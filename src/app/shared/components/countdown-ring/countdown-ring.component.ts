import { Component, Input } from '@angular/core';

// Sibling to app-circular-progress: same "percentage ring" SVG idea, but
// this one takes arbitrary center content (mm:ss text, "Let's go!", Start/Stop
// buttons) via ng-content instead of always rendering a percent number.
//
// Uses a 100x100 viewBox (rather than the tighter 36x36 "circumference~=100"
// trick) and rotates via an SVG `transform` attribute on a <g>, not a CSS
// class, so the browser never has to rasterize a small-viewBox SVG and then
// scale+rotate that raster up to the on-screen size — on some mobile WebKit
// builds that path visibly facets the circle into an octagon at 160-180px.
@Component({
  selector: 'app-countdown-ring',
  standalone: true,
  template: `
    <div class="relative shrink-0 inline-flex items-center justify-center" [style.width.px]="size" [style.height.px]="size">
      <svg viewBox="0 0 100 100" class="w-full h-full">
        <g transform="rotate(-90 50 50)">
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-border)" [attr.stroke-width]="trackWidth" />
          <circle cx="50" cy="50" r="45" fill="none"
                  [attr.stroke]="strokeColor"
                  [attr.stroke-width]="trackWidth"
                  stroke-linecap="round"
                  [attr.stroke-dasharray]="circumference"
                  [attr.stroke-dashoffset]="circumference * (1 - clampedPercent / 100)"
                  class="ring-arc"></circle>
        </g>
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

  readonly circumference = 2 * Math.PI * 45;

  get clampedPercent(): number {
    return Math.max(0, Math.min(100, this.percent));
  }

  get strokeColor(): string {
    return this.colorClass === 'warning' ? 'var(--color-warning)' : 'var(--color-accent)';
  }
}

