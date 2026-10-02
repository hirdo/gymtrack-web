import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ImageLightboxService {
  readonly activeImage = signal<{ url: string; alt: string } | null>(null);

  open(url: string | null | undefined, alt?: string | null): void {
    if (!url) return;
    this.activeImage.set({ url, alt: alt ?? '' });
  }

  close(): void {
    this.activeImage.set(null);
  }
}
