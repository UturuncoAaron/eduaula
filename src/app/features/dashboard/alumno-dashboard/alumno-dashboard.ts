import {
  Component, inject, signal, OnInit, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';
import { WeekGrid } from '../../../shared/components/week-grid/week-grid';
import {
  WeekDia,
  WeekSlot,
} from '../../../shared/components/week-grid/week-grid.types';

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

@Component({
  selector: 'app-alumno-dashboard',
  standalone: true,
  imports: [MatIconModule, RouterLink, DatePipe, WeekGrid],
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
  // Slots del horario — mostrados como días estáticos (Lun/Mar/Mié/Jue/Vie),
  // sin fechas, igual look que el editor admin (pixel-perfect).
  readonly calendarSlots = computed<WeekSlot[]>(() => {
    const data = this.dashboardData();
    if (!data) return [];
    return data.horario
      .filter(h => isWeekDia(h.dia))
      .map(h => ({
        id: `horario-${h.dia}-${h.horaInicio}`,
        dia: h.dia as WeekDia,
        horaInicio: h.horaInicio.slice(0, 5),
        horaFin: h.horaFin.slice(0, 5),
        title: h.cursoNombre,
        subtitle: `${h.horaInicio.slice(0, 5)}–${h.horaFin.slice(0, 5)}`,
        color: h.color,
        kind: 'course' as const,
      }));
  });

  readonly tareasPendientes = computed(() =>
    this.dashboardData()?.tareasPendientes ?? [],
  );

  readonly comunicados = computed(() =>
    this.dashboardData()?.comunicados ?? [],
  );

  // Stats rápidas para los KPIs
  readonly stats = computed(() => {
    const data = this.dashboardData();
    if (!data) return { clases: 0, tareas: 0, comunicados: 0 };
    return {
      clases: data.horario.length,
      tareas: data.tareasPendientes.length,
      comunicados: data.comunicados.length,
    };
  });

  ngOnInit(): void {
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
}

function isWeekDia(s: string): boolean {
  return (
    s === 'lunes' ||
    s === 'martes' ||
    s === 'miercoles' ||
    s === 'jueves' ||
    s === 'viernes' ||
    s === 'sabado'
  );
}
