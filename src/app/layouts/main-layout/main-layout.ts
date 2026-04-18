import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';
import { AuthService } from '../../core/auth/auth';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayoutComponent {
  readonly auth = inject(AuthService);
  collapsed = signal(false);

  toggleSidebar() { this.collapsed.update(v => !v); }
}