import { Component, inject, signal, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { MembershipService, MembershipTier } from '../../core/services/membership.service';
import { WorkoutService } from '../../core/services/workout.service';
import { FirestoreService } from '../../core/services/firestore.service';
import { formatDisplayDate } from '../../core/utils/date.util';

interface AdminUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  membership: MembershipTier;
  lastLogin: string;
  createdAt: string;
  workoutCount: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly membershipService = inject(MembershipService);
  private readonly workoutService = inject(WorkoutService);
  private readonly firestore = inject(FirestoreService);
  readonly activeTab = signal<'users' | 'stats'>('users');
  readonly users = signal<AdminUser[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly confirmingRoleFor = signal<string | null>(null);
  readonly togglingRole = signal<string | null>(null);
  readonly changingMembershipFor = signal<string | null>(null);

  get activeUsers(): number {
    return this.users().length;
  }

  get suspendedUsers(): number {
    return 0;
  }

  get adminCount(): number {
    return this.users().filter(u => u.role === 'admin').length;
  }

  get basicCount(): number {
    return this.users().filter(u => u.membership === 'basic').length;
  }

  get premiumCount(): number {
    return this.users().filter(u => u.membership === 'premium').length;
  }

  get eliteCount(): number {
    return this.users().filter(u => u.membership === 'elite').length;
  }

  membershipPercent(tier: MembershipTier): number {
    const total = this.users().length;
    if (!total) return 0;
    return this.users().filter(u => u.membership === tier).length / total * 100;
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const userDocs = await this.firestore.queryDocuments<AdminUser>('users');
      const workoutData = await this.workoutService.getAllWorkoutsForAdmin();
      const workoutCounts = new Map(workoutData.map(w => [w.userId, w.workouts.length]));

      const users: AdminUser[] = userDocs.map(u => ({
        id: u.id,
        username: u.username || '',
        email: u.email || '',
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        role: u.role || 'user',
        membership: (['basic', 'premium', 'elite'].includes(u.membership) ? u.membership : 'basic') as MembershipTier,
        lastLogin: u.lastLogin || '',
        createdAt: u.createdAt || '',
        workoutCount: workoutCounts.get(u.id) || 0
      }));

      this.users.set(users);
    } catch {
      this.users.set([]);
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  isSelf(userId: string): boolean {
    return this.auth.userId() === userId;
  }

  confirmRoleToggle(userId: string): void {
    this.confirmingRoleFor.set(userId);
  }

  cancelRoleToggle(): void {
    this.confirmingRoleFor.set(null);
  }

  async toggleUserRole(userId: string): Promise<void> {
    const user = this.users().find(u => u.id === userId);
    if (!user || this.togglingRole()) return;
    this.togglingRole.set(userId);
    try {
      const newRole = user.role === 'admin' ? 'user' : 'admin';
      await this.firestore.updateDocument('users', userId, { role: newRole });
      this.users.update(users =>
        users.map(u => u.id === userId ? { ...u, role: newRole } : u)
      );
    } finally {
      this.togglingRole.set(null);
      this.confirmingRoleFor.set(null);
    }
  }

  async changeMembership(userId: string, tier: MembershipTier): Promise<void> {
    if (this.changingMembershipFor()) return;
    this.changingMembershipFor.set(userId);
    try {
      await this.membershipService.setMembershipForUser(userId, tier);
      this.users.update(users =>
        users.map(u => u.id === userId ? { ...u, membership: tier } : u)
      );
    } finally {
      this.changingMembershipFor.set(null);
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return formatDisplayDate(new Date(dateStr));
  }

  formatDateTime(dateStr: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${formatDisplayDate(date)}, ${time}`;
  }
}
