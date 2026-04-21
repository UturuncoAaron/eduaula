import { Component, inject, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/auth/auth';
import { UserRole } from '../sidebar/navigation.config';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    MatIconModule, MatButtonModule, MatMenuModule,
    MatTooltipModule, MatDividerModule,
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
    const nombre = u?.nombre ?? '';
    const apellido = u?.apellido_paterno ?? '';
    return `${nombre} ${apellido}`.trim()
      .split(' ').filter(Boolean)
      .map((n: string) => n[0])
      .slice(0, 2).join('').toUpperCase();
  });

  private roleLabels: Record<UserRole, string> = {
    alumno: 'Estudiante',
    docente: 'Docente',
    admin: 'Administrador',
    padre: 'Padre / Tutor',
  };

  private roleColors: Record<UserRole, string> = {
    alumno: '#10b981', // Emerald 500
    docente: '#f59e0b', // Amber 500
    admin: '#ef4444',   // Red 500
    padre: '#8b5cf6',   // Violet 500
  };

  roleLabel = computed(() => {
    const rol = this.user()?.rol as UserRole;
    return rol ? this.roleLabels[rol] : '';
  });

  roleColor = computed(() => {
    const rol = this.user()?.rol as UserRole;
    return rol ? this.roleColors[rol] : '#64748b'; // Slate 500
  });

  onToggleSidebar() {
    this.toggleSidebar.emit();
  }

  onLogout() {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}