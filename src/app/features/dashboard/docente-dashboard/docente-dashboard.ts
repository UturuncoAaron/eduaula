import {
  Component, inject, signal, OnInit, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';
import { CalendarGrid } from '../../../shared/components/calendar-grid/calendar-grid';
import { CalendarSlot } from '../../../shared/components/calendar-grid/calendar-grid.types';

interface HorarioHoyItem {
  horaInicio: string;
  horaFin: string;
  aula: string | null;
  cursoNombre: string;
  color: string;
  seccionNombre: string;
  /**
   * Nombre del grado al que pertenece la sección (ej. "1ro", "5to").
   * Se muestra junto a la sección para que el docente distinga "5to A"
   * de "1ro A" cuando dicta el mismo curso en varios grados.
   * Opcional para compatibilidad con respuestas previas del backend.
   */
  gradoNombre?: string | null;
  dia?: string;
}

interface EntregaPendienteItem {
  tareaId: string;
  tareaTitulo: string;
  cursoNombre: string;
  fechaLimite: string;
  totalSinCalificar: number;
}

interface ComunicadoItem {
  id: string;
  titulo: string;
  contenido: string;
  fecha: string;
}

interface DocenteDashboardData {
  horarioHoy: HorarioHoyItem[];
  horario?: HorarioHoyItem[];
  entregasSinCalificar: EntregaPendienteItem[];
  comunicados: ComunicadoItem[];
}

@Component({
  selector: 'app-docente-dashboard',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, RouterLink, DatePipe, CalendarGrid],
  templateUrl: './docente-dashboard.html',
  styleUrl: './docente-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocenteDashboard implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  dashboardData = signal<DocenteDashboardData | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  readonly totalSinCalificar = computed(() =>
    this.dashboardData()?.entregasSinCalificar
      .reduce((acc, e) => acc + e.totalSinCalificar, 0) ?? 0,
  );

  // Usa horario completo si existe, si no usa horarioHoy como fallback.
  // El título incluye grado + sección ("5to A") cuando el backend lo manda;
  // sino cae a solo sección (compat con respuestas viejas).
  readonly calendarSlots = computed<CalendarSlot[]>(() => {
    const data = this.dashboardData();
    if (!data) return [];
    const fuente = data.horario ?? data.horarioHoy ?? [];
    return fuente.map(h => {
      const ubic = h.gradoNombre
        ? `${h.gradoNombre} ${h.seccionNombre}`
        : h.seccionNombre;
      return {
        id: `horario-${h.dia ?? 'hoy'}-${h.horaInicio}`,
        title: `${h.cursoNombre} · ${ubic}`,
        type: 'course' as const,
        startTime: h.horaInicio.slice(0, 5),
        endTime: h.horaFin.slice(0, 5),
        diaSemana: h.dia ?? getDiaHoy(),
        color: h.color,
        meta: {
          aula: h.aula,
          seccion: h.seccionNombre,
          grado: h.gradoNombre ?? null,
        },
      };
    });
  });

  ngOnInit(): void {
    this.api.get<DocenteDashboardData>('dashboard/resumen').subscribe({
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

function getDiaHoy(): string {
  const map: Record<number, string> = {
    1: 'lunes', 2: 'martes', 3: 'miercoles',
    4: 'jueves', 5: 'viernes',
  };
  return map[new Date().getDay()] ?? 'lunes';
}