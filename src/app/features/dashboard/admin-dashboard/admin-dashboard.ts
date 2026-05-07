import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import {  NgClass } from '@angular/common';
import { ApiService } from '../../../core/services/api';

interface Contadores {
  totalAlumnos: number;
  totalDocentes: number;
  totalPadres: number;
  totalAuxiliares: number;
}

interface AlertaOperativa {
  tipo: 'sin_docente' | 'sin_horario' | 'contrato_por_vencer';
  descripcion: string;
  referencia: string;
}

interface AdminDashboardData {
  contadores: Contadores;
  alertas: AlertaOperativa[];
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [MatCardModule, MatIconModule, MatButtonModule, RouterLink, NgClass, ],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard implements OnInit {
  private readonly api = inject(ApiService);

  loading = signal(true);
  error = signal(false);
  data = signal<AdminDashboardData | null>(null);

  readonly quickAccess = [
    { label: 'Gestionar usuarios', desc: 'Altas, bajas y roles', icon: 'people', route: '/admin/users', color: 'blue' },
    { label: 'Estructura académica', desc: 'Grados, secciones y cursos', icon: 'account_tree', route: '/admin/academic', color: 'purple' },
    { label: 'Vincular familias', desc: 'Relación padre-hijo', icon: 'family_restroom', route: '/admin/parent-child-link', color: 'green' },
    { label: 'Matrículas', desc: 'Gestión de matrículas', icon: 'how_to_reg', route: '/admin/matriculas', color: 'teal' },
    { label: 'Exportar reportes', desc: 'Métricas y excel', icon: 'analytics', route: '/admin/reports', color: 'orange' },
    { label: 'Ajustes del sistema', desc: 'Configuración general', icon: 'settings', route: '/admin/settings', color: 'gray' },
  ];

  readonly alertaConfig: Record<AlertaOperativa['tipo'], { icon: string; color: string }> = {
    sin_docente: { icon: 'person_off', color: 'orange' },
    sin_horario: { icon: 'event_busy', color: 'purple' },
    contrato_por_vencer: { icon: 'assignment_late', color: 'red' },
  };

  ngOnInit() {
    this.api.get<AdminDashboardData>('dashboard/resumen').subscribe({
      next: res => {
        this.data.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}