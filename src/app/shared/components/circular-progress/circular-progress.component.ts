import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-circular-progress',
  standalone: true,
  template: `
    <div class="relative inline-flex items-center justify-center shrink-0" [style.width.px]="size" [style.height.px]="size">
      <svg [attr.width]="size" [attr.height]="size" class="-rotate-90">
        <circle [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="radius"
                fill="none" stroke="currentColor" [attr.stroke-width]="strokeWidth"
                class="text-surface-light"></circle>
        <circle [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="radius"
                fill="none" stroke="currentColor" [attr.stroke-width]="strokeWidth"
                stroke-linecap="round"
                [attr.stroke-dasharray]="circumference"
                [attr.stroke-dashoffset]="dashOffset"
                class="transition-all duration-1000 ease-linear"
                [class.text-primary]="colorClass === 'text-primary'"
                [class.text-accent]="colorClass === 'text-accent'"
                [class.text-warning]="colorClass === 'text-warning'"></circle>
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class CircularProgressComponent {
  @Input() progress = 0;
  @Input() size = 160;
  @Input() colorClass: 'text-primary' | 'text-accent' | 'text-warning' = 'text-primary';
  @Input() strokeWidth = 10;

  get radius(): number {
    return (this.size - this.strokeWidth) / 2;
  }

  get circumference(): number {
    return 2 * Math.PI * this.radius;
  }

  get dashOffset(): number {
    const clamped = Math.max(0, Math.min(100, this.progress));
    return this.circumference * (1 - clamped / 100);
  }
}
