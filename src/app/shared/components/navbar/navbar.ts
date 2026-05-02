import {
  Component, inject, signal, input, output,
  OnInit, ChangeDetectionStrategy
} from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';
import { UserRole } from '../sidebar/navigation.config';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
    MatBadgeModule,
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private api = inject(ApiService);

  sidebarCollapsed = input<boolean>(false);
  toggleSidebar = output<void>();

  unreadCount = signal(0);
  user = this.auth.currentUser;

  initials = () => {
    const u = this.user();
    if (!u) return 'U';
    return (
      (u.nombre?.charAt(0) ?? '') +
      (u.apellido_paterno?.charAt(0) ?? '')
    ).toUpperCase() || 'U';
  };

  private roleLabels: Record<UserRole, string> = {
    alumno: 'Estudiante',
    docente: 'Docente',
    admin: 'Administrador',
    padre: 'Padre / Tutor',
    psicologa: 'Psicóloga',
  };

  private roleColors: Record<UserRole, string> = {
    alumno: '#10b981',
    docente: '#f59e0b',
    admin: '#ef4444',
    padre: '#8b5cf6',
    psicologa: '#0ea5e9',
  };

  roleLabel = () => {
    const rol = this.user()?.rol as UserRole;
    return rol ? this.roleLabels[rol] : 'Usuario';
  };

  roleColor = () => {
    const rol = this.user()?.rol as UserRole;
    return rol ? this.roleColors[rol] : '#64748b';
  };

  ngOnInit() {
    this.api.get<{ count: number }>('notifications/unread-count').subscribe({
      next: (r: any) => this.unreadCount.set(r?.count ?? r?.data?.count ?? 0),
      error: () => this.unreadCount.set(0),
    });
  }

  onToggleSidebar() { this.toggleSidebar.emit(); }

  goToProfile() { this.router.navigate(['/perfil']); }
  goToNotificaciones() {
    this.router.navigate(['/notificaciones']);
    this.unreadCount.set(0);
  }
  goToConfiguracion() { this.router.navigate(['/configuracion']); }

  onLogout() {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}