import { Directive, ElementRef, effect, inject, input } from '@angular/core';

// Tweens the host element's text content from its current shown value up to
// the bound number. Re-fires whenever the bound value changes, so a live
// stat update (not just first render) also animates.
@Directive({
  selector: '[appCountUp]',
  standalone: true
})
export class CountUpDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly appCountUp = input<number>(0);
  readonly appCountUpDuration = input<number>(700);

  private current = 0;
  private frame: number | null = null;
  private readonly reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    effect(() => {
      this.animateTo(this.appCountUp());
    });
  }

  private animateTo(target: number): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }

    const start = this.current;
    const delta = target - start;
    if (this.reducedMotion || delta === 0) {
      this.setValue(target);
      return;
    }

    const duration = this.appCountUpDuration();
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.setValue(Math.round(start + delta * eased));
      this.frame = t < 1 ? requestAnimationFrame(step) : null;
    };
    this.frame = requestAnimationFrame(step);
  }

  private setValue(value: number): void {
    this.current = value;
    this.el.nativeElement.textContent = String(value);
  }
}
