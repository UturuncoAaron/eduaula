import {
  Component, inject, input, computed, signal,
  ChangeDetectionStrategy, OnInit,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgOptimizedImage } from '@angular/common';

import { AuthService } from '../../../core/auth/auth';
import { environment } from '../../../../environments/environment';
import { NAV_ITEMS, UserRole } from './navigation.config';

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatRippleModule,
    MatTooltipModule,
    NgOptimizedImage,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar implements OnInit {
  private auth = inject(AuthService);
  private http = inject(HttpClient);

  collapsed = input<boolean>(false);

  user = computed(() => this.auth.currentUser());
  isTutor = signal(false);

  visibleItems = computed(() => {
    const rol = this.user()?.rol as UserRole;
    if (!rol) return [];
    const tutor = this.isTutor();
    return NAV_ITEMS.filter(i =>
      i.roles.includes(rol) && (!i.requiresTutor || tutor),
    );
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

  ngOnInit() {
    const rol = this.user()?.rol as UserRole | undefined;
    if (rol === 'docente' || rol === 'admin') {
      this.http
        .get<unknown | null>(`${environment.apiUrl}/academic/tutoria/me`)
        .pipe(catchError(() => of(null)))
        .subscribe(data => this.isTutor.set(data !== null));
    }
  }
}
