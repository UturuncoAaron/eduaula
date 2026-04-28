import { Component, inject, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgOptimizedImage } from '@angular/common';
import { AuthService } from '../../../core/auth/auth';
import { NAV_ITEMS, UserRole } from './navigation.config';

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatRippleModule,
    MatTooltipModule,
    NgOptimizedImage
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  private auth = inject(AuthService);

  // La señal recibe el estado desde el componente padre (el Layout/Header)
  collapsed = input<boolean>(false);

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
}