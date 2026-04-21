import { Component, inject, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgOptimizedImage } from '@angular/common';
import { AuthService } from '../../../core/auth/auth';
import { NAV_ITEMS, UserRole } from './navigation.config';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [MatIconModule, MatRippleModule, MatTooltipModule, NgOptimizedImage],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  private auth = inject(AuthService);
  private router = inject(Router);

  collapsed = input<boolean>(false);
  toggleCollapse = output<void>();

  user = computed(() => this.auth.currentUser());

  visibleItems = computed(() => {
    const rol = this.user()?.rol as UserRole;
    if (!rol) return [];
    return NAV_ITEMS.filter(i => i.roles.includes(rol));
  });

  private roleLabels: Record<UserRole, string> = {
    alumno: 'Estudiante', docente: 'Docente',
    admin: 'Administrador', padre: 'Padre / Tutor',
  };

  private roleColors: Record<UserRole, string> = {
    alumno: '#10b981', docente: '#f59e0b',
    admin: '#ef4444', padre: '#8b5cf6',
  };

  roleLabel = computed(() => {
    const rol = this.user()?.rol as UserRole;
    return rol ? this.roleLabels[rol] : '';
  });

  roleColor = computed(() => {
    const rol = this.user()?.rol as UserRole;
    return rol ? this.roleColors[rol] : '#64748b';
  });

  isActive(route: string): boolean {
    return this.router.isActive(route, {
      paths: 'subset', queryParams: 'ignored',
      fragment: 'ignored', matrixParams: 'ignored',
    });
  }

  navigate(route: string) { this.router.navigate([route]); }
  onToggle() { this.toggleCollapse.emit(); }
}