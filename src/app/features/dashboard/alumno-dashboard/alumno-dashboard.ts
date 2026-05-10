import {
  Component, inject, signal, OnInit, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';
import { CalendarGrid } from '../../../shared/components/calendar-grid/calendar-grid';
import {
  CalendarSlot,
  CalendarDayEvent,
  CalendarCellClickEvent,
} from '../../../shared/components/calendar-grid/calendar-grid.types';

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
  imports: [MatIconModule, RouterLink, DatePipe, CalendarGrid],
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
  weekStart = signal(getTodayMonday());

  // Solo clases del horario — sin citas para no ensuciar la vista
  readonly calendarSlots = computed<CalendarSlot[]>(() => {
    const data = this.dashboardData();
    if (!data) return [];
    return data.horario.map(h => ({
      id: `horario-${h.dia}-${h.horaInicio}`,
      title: h.cursoNombre,
      type: 'course' as const,
      startTime: h.horaInicio.slice(0, 5),
      endTime: h.horaFin.slice(0, 5),
      diaSemana: h.dia,
      color: h.color,
      meta: { aula: h.aula, docente: h.docenteNombre },
    }));
  });

  // Comunicados con fecha como eventos del día
  readonly calendarEvents = computed<CalendarDayEvent[]>(() => {
    const data = this.dashboardData();
    if (!data) return [];
    return data.comunicados
      .filter(c => !!c.fecha)
      .map(c => ({
        date: c.fecha.slice(0, 10),
        title: c.titulo,
        type: 'event' as const,
        color: '#f59e0b',
        meta: { contenido: c.contenido },
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

  onWeekChange(monday: string): void {
    this.weekStart.set(monday);
  }

  onCellClick(_event: CalendarCellClickEvent): void {
    // futuro: abrir detalle del curso
  }

  getUrgencia(fechaLimite: string): 'rojo' | 'ambar' | 'verde' {
    const diff = (new Date(fechaLimite).getTime() - Date.now()) / 86_400_000;
    if (diff <= 1) return 'rojo';
    if (diff <= 5) return 'ambar';
    return 'verde';
  }
}

function getTodayMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}
