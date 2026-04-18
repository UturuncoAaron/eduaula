import { Component, inject, input, output, computed } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/auth/auth';
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    MatIconModule, MatButtonModule, MatMenuModule,
    MatTooltipModule, MatDividerModule,
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class NavbarComponent {
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

  roleLabel = computed(() => {
    const map: Record<string, string> = {
      alumno: 'Estudiante',
      docente: 'Docente',
      admin: 'Administrador',
      padre: 'Padre / Tutor',
    };
    return map[this.user()?.rol ?? ''] ?? '';
  });

  roleColor = computed(() => {
    const map: Record<string, string> = {
      alumno: '#4caf50',
      docente: '#ff9800',
      admin: '#f44336',
      padre: '#9c27b0',
    };
    return map[this.user()?.rol ?? ''] ?? '#90a4ae';
  });

  onToggleSidebar() {
    this.toggleSidebar.emit();
  }

  onLogout() {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}