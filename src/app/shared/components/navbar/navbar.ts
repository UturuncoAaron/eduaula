import { Component, inject, input, output, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../../core/auth/auth';
import { NotificationsStore } from '../../../core/services/notifications-store';
import { NotificationsBell } from '../notifications-bell/notifications-bell';
import { Rol } from '../../../core/models/user';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
    MatBadgeModule,
    NotificationsBell,
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private notifications = inject(NotificationsStore);

  sidebarCollapsed = input<boolean>(false);
  toggleSidebar = output<void>();

  unreadCount = this.notifications.unreadCount;
  user = this.auth.currentUser;

  initials = () => {
    const u = this.user();
    if (!u) return 'U';
    return (
      (u.nombre?.charAt(0) ?? '') +
      (u.apellido_paterno?.charAt(0) ?? '')
    ).toUpperCase() || 'U';
  };

  private roleLabels: Record<Rol, string> = {
    alumno: 'Estudiante',
    docente: 'Docente',
    admin: 'Administrador',
    padre: 'Padre / Tutor',
    psicologa: 'Psicóloga',
    auxiliar: 'Auxiliar',
  };

  private roleColors: Record<Rol, string> = {
    alumno: '#10b981',
    docente: '#f59e0b',
    admin: '#ef4444',
    padre: '#8b5cf6',
    psicologa: '#0ea5e9',
    auxiliar: '#14b8a6',
  };

  roleLabel = () => {
    const rol = this.user()?.rol as Rol;
    return rol ? this.roleLabels[rol] : 'Usuario';
  };

  roleColor = () => {
    const rol = this.user()?.rol as Rol;
    return rol ? this.roleColors[rol] : '#64748b';
  };

  ngOnInit() {
    this.notifications.connect();
  }

  onToggleSidebar() { this.toggleSidebar.emit(); }

  goToProfile() { this.router.navigate(['/perfil']); }
  goToNotificaciones() { this.router.navigate(['/notificaciones']); }
  goToConfiguracion() { this.router.navigate(['/configuracion']); }

  onLogout() {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}