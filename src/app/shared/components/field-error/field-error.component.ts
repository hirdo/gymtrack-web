import { Component, Input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Component({
  selector: 'app-field-error',
  standalone: true,
  template: `
    @if (message(); as msg) {
      <p class="text-error text-xs mt-1 ui-fade-in">{{ msg }}</p>
    }
  `
})
export class FieldErrorComponent {
  @Input() control: AbstractControl | null = null;
  @Input() label = 'This field';

  message(): string | null {
    const control = this.control;
    if (!control || !control.invalid || (!control.dirty && !control.touched)) {
      return null;
    }

    const errors = control.errors;
    if (!errors) {
      return null;
    }

    if (errors['required']) {
      return `${this.label} is required.`;
    }
    if (errors['min']) {
      return `${this.label} must be at least ${errors['min'].min}.`;
    }
    if (errors['max']) {
      return `${this.label} must be at most ${errors['max'].max}.`;
    }
    if (errors['minlength']) {
      return `${this.label} must be at least ${errors['minlength'].requiredLength} characters.`;
    }
    if (errors['pattern']) {
      return `${this.label} format is invalid.`;
    }
    return null;
  }
}
