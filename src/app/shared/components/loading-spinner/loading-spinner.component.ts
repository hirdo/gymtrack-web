import { Component } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  template: `
    <div class="flex items-center justify-center p-8" role="status">
      <div class="w-10 h-10 border-4 border-surface-light border-t-primary rounded-full animate-spin"></div>
      <span class="sr-only">Loading&hellip;</span>
    </div>
  `
})
export class LoadingSpinnerComponent {}
