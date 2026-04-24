import { Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { DatePipe, NgClass } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';

interface AdminStats {
  alumnos: number;
  docentes: number;
  padres: number;
  cursos: number;
}

interface Activity {
  id: number;
  tipo: 'user' | 'system' | 'alert';
  mensaje: string;
  fecha: Date;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [MatCardModule, MatIconModule, MatButtonModule, RouterLink, NgClass, DatePipe],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss'
})
export class AdminDashboard implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  stats = signal<AdminStats>({ alumnos: 0, docentes: 0, cursos: 0, padres: 0 });
  loadingStats = signal<boolean>(true);
  errorStats = signal<boolean>(false);

  recentActivity = signal<Activity[]>([]);

  ngOnInit() {
    this.api.get<AdminStats>('admin/users/stats').subscribe({
      next: res => {
        this.stats.set(res.data);
        this.loadingStats.set(false);
      },
      error: () => {
        // En lugar de cargar datos falsos, encendemos la bandera de error
        this.errorStats.set(true);
        this.loadingStats.set(false);
      }
    });
  }


  readonly quickAccess = [
    { label: 'Gestionar usuarios', desc: 'Altas, bajas y roles', icon: 'people', route: '/admin/user-management', color: 'blue' },
    { label: 'Estructura académica', desc: 'Grados, secciones y cursos', icon: 'account_tree', route: '/admin/academic-setup', color: 'purple' },
    { label: 'Vincular familias', desc: 'Relación padre-hijo', icon: 'family_restroom', route: '/admin/parent-child-link', color: 'green' },
    { label: 'Exportar reportes', desc: 'Métricas y excel', icon: 'analytics', route: '/admin/reports', color: 'orange' },
  ];
}