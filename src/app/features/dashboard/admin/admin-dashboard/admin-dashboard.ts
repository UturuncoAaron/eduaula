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

  // Simulamos actividad reciente para darle vida al dashboard
  recentActivity = signal<Activity[]>([
    { id: 1, tipo: 'user', mensaje: 'Nuevo docente registrado: Carlos Mendoza', fecha: new Date() },
    { id: 2, tipo: 'system', mensaje: 'Copia de seguridad del sistema completada', fecha: new Date(Date.now() - 3600000) },
    { id: 3, tipo: 'alert', mensaje: '3 pagos de pensiones pendientes de revisión', fecha: new Date(Date.now() - 7200000) },
  ]);

  ngOnInit() {
    this.api.get<AdminStats>('admin/users/stats').subscribe({
      next: res => this.stats.set(res.data),
      error: () => {
        this.stats.set({ alumnos: 428, docentes: 35, cursos: 24, padres: 310 });
      }
    });
  }

  readonly quickAccess = [
    { label: 'Gestionar usuarios', desc: 'Altas, bajas y roles', icon: 'people', route: '/admin/usuarios', color: 'blue' },
    { label: 'Estructura académica', desc: 'Grados, secciones y cursos', icon: 'account_tree', route: '/admin/academico', color: 'purple' },
    { label: 'Vincular familias', desc: 'Relación padre-hijo', icon: 'family_restroom', route: '/admin/padre-hijo', color: 'green' },
    { label: 'Exportar reportes', desc: 'Métricas y excel', icon: 'analytics', route: '/admin/reportes', color: 'orange' },
  ];
}