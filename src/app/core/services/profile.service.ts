import { inject, Injectable, computed, signal, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { FirestoreService } from './firestore.service';
import { UserProfile } from '../models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly auth = inject(AuthService);
  private readonly firestore = inject(FirestoreService);

  private readonly avatarUrlSignal = signal<string | undefined>(undefined);

  readonly loaded = computed(() => this.auth.profileLoaded());
  readonly error = computed(() => this.auth.profileError());

  readonly profile = computed<UserProfile | null>(() => {
    const kcProfile = this.auth.userProfile();
    if (!kcProfile) return null;

    return {
      id: kcProfile.id || '',
      email: kcProfile.email || '',
      firstName: kcProfile.firstName || '',
      lastName: kcProfile.lastName || '',
      joinDate: kcProfile.createdTimestamp
        ? new Date(kcProfile.createdTimestamp).toISOString()
        : undefined,
      avatarUrl: this.avatarUrlSignal()
    };
  });

  constructor() {
    effect(() => {
      const uid = this.auth.userId();
      if (uid) {
        this.firestore.getDocument<{ avatarUrl?: string }>('users', uid).then(doc => {
          this.avatarUrlSignal.set(doc?.avatarUrl);
        });
      } else {
        this.avatarUrlSignal.set(undefined);
      }
    });
  }

  async updateAvatar(url: string): Promise<void> {
    const uid = this.auth.userId();
    if (!uid) return;
    await this.firestore.updateDocument('users', uid, { avatarUrl: url });
    this.avatarUrlSignal.set(url);
  }
}
