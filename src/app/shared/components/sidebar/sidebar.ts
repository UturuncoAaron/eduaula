import { Component, inject, input, output, computed } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/auth/auth';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles: Array<'alumno' | 'docente' | 'admin' | 'padre'>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', roles: ['alumno', 'docente', 'admin', 'padre'] },
  { label: 'Mis cursos', icon: 'menu_book', route: '/cursos', roles: ['alumno', 'docente'] },
  { label: 'Exámenes', icon: 'assignment', route: '/examenes', roles: ['alumno', 'docente'] },
  { label: 'Tareas', icon: 'task_alt', route: '/tareas', roles: ['alumno', 'docente'] },
  { label: 'Notas', icon: 'grade', route: '/notas', roles: ['alumno', 'docente'] },
  { label: 'Foro', icon: 'forum', route: '/foro', roles: ['alumno', 'docente'] },
  { label: 'Clases en vivo', icon: 'videocam', route: '/clases-vivo', roles: ['alumno', 'docente'] },
  { label: 'Portal Padres', icon: 'family_restroom', route: '/portal-padres', roles: ['padre'] },
  { label: 'Usuarios', icon: 'manage_accounts', route: '/admin/usuarios', roles: ['admin'] },
  { label: 'Académico', icon: 'school', route: '/admin/academico', roles: ['admin'] },
  { label: 'Padre-Hijo', icon: 'link', route: '/admin/padre-hijo', roles: ['admin'] },
  { label: 'Reportes', icon: 'bar_chart', route: '/admin/reportes', roles: ['admin'] },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [MatIconModule, MatRippleModule, MatTooltipModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class SidebarComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  collapsed = input<boolean>(false);
  toggleCollapse = output<void>();

  user = computed(() => this.auth.currentUser());

  visibleItems = computed(() => {
    const rol = this.user()?.rol;
    if (!rol) return [];
    return NAV_ITEMS.filter(i => i.roles.includes(rol as any));
  });

  roleLabel = computed(() => {
    const map: Record<string, string> = {
      alumno: 'Estudiante', docente: 'Docente',
      admin: 'Administrador', padre: 'Padre / Tutor',
    };
    return map[this.user()?.rol ?? ''] ?? '';
  });

  roleColor = computed(() => {
    const map: Record<string, string> = {
      alumno: '#22C55E',
      docente: '#F59E0B',
      admin: '#EF4444',
      padre: '#A855F7',
    };
    return map[this.user()?.rol ?? ''] ?? '#94A3B8';
  });

  isActive(route: string): boolean {
    return this.router.isActive(route, {
      paths: 'subset', queryParams: 'ignored',
      fragment: 'ignored', matrixParams: 'ignored',
    });
  }

  navigate(route: string) { this.router.navigate([route]); }
  onToggle() { this.toggleCollapse.emit(); }
  logout() { this.auth.logout(); }
}