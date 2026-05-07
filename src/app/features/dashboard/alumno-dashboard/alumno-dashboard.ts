import {
  Component, inject, signal, OnInit, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { DatePipe, NgStyle } from '@angular/common';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';

export interface HorarioItem {
  dia: string;
  horaInicio: string;
  horaFin: string;
  aula: string | null;
  cursoNombre: string;
  docenteNombre: string;
  color: string;
}

export interface TareaPendiente {
  id: string;
  titulo: string;
  cursoNombre: string;
  fechaLimite: string;
  tipo: 'tarea';
}

export interface Comunicado {
  id: string;
  titulo: string;
  contenido: string;
  fecha: string;
}

export interface AlumnoDashboardData {
  horario: HorarioItem[];
  tareasPendientes: TareaPendiente[];
  comunicados: Comunicado[];
}

const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] as const;

const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie',
};

@Component({
  selector: 'app-alumno-dashboard',
  standalone: true,
  imports: [MatIconModule, RouterLink, DatePipe, NgStyle],
  templateUrl: './alumno-dashboard.html',
  styleUrl: './alumno-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlumnoDashboard implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  dashboardData = signal<AlumnoDashboardData | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  readonly diasSemana = DIAS_ORDEN;
  readonly diasLabel = DIAS_LABEL;

  readonly diaHoy = new Date()
    .toLocaleDateString('es-PE', { weekday: 'long' })
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  readonly horarioPorDia = computed(() => {
    const data = this.dashboardData();
    if (!data) return {} as Record<string, HorarioItem[]>;
    return DIAS_ORDEN.reduce((acc, dia) => {
      acc[dia] = data.horario.filter(h => h.dia === dia);
      return acc;
    }, {} as Record<string, HorarioItem[]>);
  });

  ngOnInit() {
    this.api.get<AlumnoDashboardData>('dashboard/resumen').subscribe({
      next: res => {
        this.dashboardData.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la información del dashboard.');
        this.loading.set(false);
      },
    });
  }

  getUrgencia(fechaLimite: string): 'rojo' | 'ambar' | 'verde' {
    const diff = (new Date(fechaLimite).getTime() - Date.now()) / 86_400_000;
    if (diff <= 1) return 'rojo';
    if (diff <= 5) return 'ambar';
    return 'verde';
  }

  getSlotStyle(color: string): Record<string, string> {
    return {
      'background-color': `${color}18`,
      'border-left': `3px solid ${color}`,
    };
  }

  getSlotTextStyle(color: string): Record<string, string> {
    return { color };
  }
}