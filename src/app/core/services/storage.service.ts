import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly configured = !!environment.cloudinary.cloudName &&
    !environment.cloudinary.cloudName.startsWith('YOUR_');

  async uploadImage(id: string, file: File): Promise<string> {
    if (!this.configured) {
      throw new Error('Cloudinary is not configured for this project yet.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', environment.cloudinary.uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${environment.cloudinary.cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );
    if (!response.ok) {
      throw new Error('Image upload failed.');
    }

    const data = await response.json();
    return data.secure_url as string;
  }
}
