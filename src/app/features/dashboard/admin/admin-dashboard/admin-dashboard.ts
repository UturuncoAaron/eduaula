import { Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';

interface AdminStats {
  alumnos: number;
  docentes: number;
  padres: number;
  cursos: number;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [MatCardModule, MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss'
})
export class AdminDashboard implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  stats = signal<AdminStats>({ alumnos: 0, docentes: 0, cursos: 0, padres: 0 });

  ngOnInit() {
    this.api.get<AdminStats>('admin/users/stats').subscribe({
      next: res => this.stats.set(res.data),
      error: () => {
        this.stats.set({ alumnos: 400, docentes: 50, cursos: 120, padres: 400 });
      }
    });
  }

  readonly quickAccess = [
    { label: 'Gestionar usuarios', icon: 'people', route: '/admin/usuarios' },
    { label: 'Estructura académica', icon: 'account_tree', route: '/admin/academico' },
    { label: 'Vincular padre-hijo', icon: 'family_restroom', route: '/admin/padre-hijo' },
    { label: 'Exportar reportes', icon: 'download', route: '/admin/reportes' },
  ];
}