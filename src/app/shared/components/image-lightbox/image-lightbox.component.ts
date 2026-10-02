import { Component, inject } from '@angular/core';
import { ImageLightboxService } from '../../../core/services/image-lightbox.service';

@Component({
  selector: 'app-image-lightbox',
  standalone: true,
  templateUrl: './image-lightbox.component.html',
  styleUrl: './image-lightbox.component.scss'
})
export class ImageLightboxComponent {
  readonly lightbox = inject(ImageLightboxService);
}
