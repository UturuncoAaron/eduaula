import { Component, inject, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/auth/auth';
import { UserRole } from '../sidebar/navigation.config';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Navbar {
  private auth = inject(AuthService);
  private router = inject(Router);

  sidebarCollapsed = input<boolean>(false);
  toggleSidebar = output<void>();

  user = computed(() => this.auth.currentUser());

  initials = computed(() => {
    const u = this.user();
    if (!u) return 'U';
    const first = u.nombre?.charAt(0) || '';
    const second = u.apellido_paterno?.charAt(0) || '';
    return (first + second).toUpperCase() || 'U';
  });

  private roleLabels: Record<UserRole, string> = {
    alumno: 'Estudiante',
    docente: 'Docente',
    admin: 'Administrador',
    padre: 'Padre / Tutor',
    psicologa: 'Psicóloga', // <-- Agregado
  };

  private roleColors: Record<UserRole, string> = {
    alumno: '#10b981',
    docente: '#f59e0b',
    admin: '#ef4444',
    padre: '#8b5cf6',
    psicologa: '#0ea5e9', // <-- Agregado (Color Azul Claro/Cyan)
  };

  roleLabel = computed(() => {
    const rol = this.user()?.rol as UserRole;
    return rol ? this.roleLabels[rol] : 'Usuario';
  });

  roleColor = computed(() => {
    const rol = this.user()?.rol as UserRole;
    return rol ? this.roleColors[rol] : '#64748b';
  });

  onToggleSidebar() {
    this.toggleSidebar.emit();
  }

  onLogout() {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}