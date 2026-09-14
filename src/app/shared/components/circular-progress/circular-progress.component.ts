import { Component, computed, input } from '@angular/core';

// SVG "percentage ring" trick: viewBox 0 0 36 36 with r=15.9155 gives a
// circumference of ~100, so stroke-dasharray/-offset can be set directly in
// percentage units without computing 2*PI*r per instance.
@Component({
  selector: 'app-circular-progress',
  standalone: true,
  template: `
    <div class="relative shrink-0" [style.width.px]="size()" [style.height.px]="size()">
      <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--color-border)" [attr.stroke-width]="trackWidth()" />
        <circle
          cx="18" cy="18" r="15.9155" fill="none"
          [attr.stroke]="ringColor()"
          [attr.stroke-width]="trackWidth()"
          stroke-linecap="round"
          stroke-dasharray="100 100"
          [attr.stroke-dashoffset]="100 - clampedPercent()"
          class="ring-arc"
        />
      </svg>
      <span
        class="absolute inset-0 flex items-center justify-center font-heading font-extrabold tabular-nums leading-none"
        [style.color]="ringColor()"
        [style.font-size.px]="fontSize()"
      >{{ clampedPercent() }}</span>
    </div>
  `,
  styles: `
    .ring-arc {
      transition: stroke-dashoffset 0.7s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease-out;
    }

    @media (prefers-reduced-motion: reduce) {
      .ring-arc {
        transition: none;
      }
    }
  `
})
export class CircularProgressComponent {
  readonly percent = input<number>(0);
  readonly size = input<number>(44);
  readonly trackWidth = input<number>(3);

  readonly clampedPercent = computed(() => Math.max(0, Math.min(100, Math.round(this.percent()))));

  // Stepped red -> yellow -> green as completion crosses the 33 / 67 milestones.
  readonly ringColor = computed(() => {
    const p = this.clampedPercent();
    if (p < 33) return 'var(--color-error)';
    if (p < 67) return 'var(--color-warning)';
    return 'var(--color-success)';
  });

  readonly fontSize = computed(() => Math.round(this.size() * 0.32));
}
