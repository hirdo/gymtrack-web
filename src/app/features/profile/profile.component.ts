import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { WorkoutService } from '../../core/services/workout.service';
import { MembershipService } from '../../core/services/membership.service';
import { StorageService } from '../../core/services/storage.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent {
  readonly auth = inject(AuthService);
  readonly profileService = inject(ProfileService);
  readonly workoutService = inject(WorkoutService);
  readonly membershipService = inject(MembershipService);
  private readonly storageService = inject(StorageService);

  readonly uploading = signal(false);
  readonly uploadError = signal<string | null>(null);

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const uid = this.auth.userId();
    if (!file || !uid) return;

    this.uploading.set(true);
    this.uploadError.set(null);
    try {
      const url = await this.storageService.uploadImage(uid, file);
      await this.profileService.updateAvatar(url);
    } catch (err) {
      this.uploadError.set(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      this.uploading.set(false);
    }
  }
}
