import { Component, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MembershipService, MembershipTier } from '../../core/services/membership.service';

@Component({
  selector: 'app-membership',
  standalone: true,
  templateUrl: './membership.component.html',
  styleUrl: './membership.component.scss'
})
export class MembershipComponent {
  readonly auth = inject(AuthService);
  readonly membershipService = inject(MembershipService);
  private readonly router = inject(Router);

  readonly currentPlan = computed(() => this.membershipService.membership());
  readonly changingTo = signal<MembershipTier | null>(null);
  readonly changeError = signal<string | null>(null);

  async upgradeTo(tier: MembershipTier): Promise<void> {
    if (this.changingTo()) return;
    this.changingTo.set(tier);
    this.changeError.set(null);
    try {
      await this.membershipService.upgrade(tier);
    } catch (err) {
      this.changeError.set(err instanceof Error ? err.message : 'Could not update your membership. Please try again.');
    } finally {
      this.changingTo.set(null);
    }
  }

  async downgrade(): Promise<void> {
    if (this.changingTo()) return;
    this.changingTo.set('basic');
    this.changeError.set(null);
    try {
      await this.membershipService.upgrade('basic');
    } catch (err) {
      this.changeError.set(err instanceof Error ? err.message : 'Could not update your membership. Please try again.');
    } finally {
      this.changingTo.set(null);
    }
  }

  isCurrentPlan(tier: MembershipTier): boolean {
    return this.membershipService.membership() === tier;
  }
}
