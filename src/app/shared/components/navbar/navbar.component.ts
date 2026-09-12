import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  readonly profileService = inject(ProfileService);
  readonly mobileMenuOpen = signal(false);
  readonly mobileMenuClosing = signal(false);

  private static readonly CLOSE_ANIMATION_MS = 200;

  toggleMobileMenu(): void {
    if (this.mobileMenuOpen()) {
      this.closeMobileMenu();
    } else {
      this.mobileMenuOpen.set(true);
    }
  }

  closeMobileMenu(): void {
    if (!this.mobileMenuOpen()) {
      return;
    }
    this.mobileMenuClosing.set(true);
    setTimeout(() => {
      this.mobileMenuOpen.set(false);
      this.mobileMenuClosing.set(false);
    }, NavbarComponent.CLOSE_ANIMATION_MS);
  }
}
