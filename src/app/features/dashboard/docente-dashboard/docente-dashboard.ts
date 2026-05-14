import {
  Component, inject, signal, OnInit, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';
import { WeekGrid } from '../../../shared/components/week-grid/week-grid';
import {
  WeekSlot,
  isWeekDia,
} from '../../../shared/components/week-grid/week-grid.types';

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
  imports: [MatIconModule, MatButtonModule, RouterLink, DatePipe, WeekGrid],
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

  // Slots del horario semanal del docente — mismo render pixel-perfect que
  // usa el alumno (`<app-week-grid>`). El backend manda `horario` (semana
  // completa) o `horarioHoy` (solo hoy) como fallback.
  //
  // Convenciones de UI:
  //  - title    → "Curso · Grado Sección"           (ej. "Matemática · 1ro A")
  //  - subtitle → "H:MMam/pm – H:MMam/pm"           (ej. "7:00am – 8:00am")
  //
  // Se ignoran días no soportados por `WeekGrid` (sábado/domingo del backend
  // por si alguna vez aparecen) — la grilla del dashboard es Lun–Vie.
  readonly calendarSlots = computed<WeekSlot[]>(() => {
    const data = this.dashboardData();
    if (!data) return [];
    const fuente = data.horario ?? data.horarioHoy ?? [];
    const out: WeekSlot[] = [];
    for (const h of fuente) {
      const dia = h.dia ?? getDiaHoy();
      if (!isWeekDia(dia)) continue;
      const ubic = h.gradoNombre
        ? `${h.gradoNombre} ${h.seccionNombre}`
        : h.seccionNombre;
      const inicio = h.horaInicio.slice(0, 5);
      const fin = h.horaFin.slice(0, 5);
      out.push({
        id: `horario-${dia}-${inicio}`,
        dia,
        horaInicio: inicio,
        horaFin: fin,
        title: `${h.cursoNombre} · ${ubic}`,
        subtitle: `${to12h(inicio)} – ${to12h(fin)}`,
        color: h.color,
        kind: 'course',
      });
    }
    return out;
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

/**
 * Convierte "HH:mm" 24h a "H:MMam/pm" 12h.
 * Ejemplos: "07:00" → "7:00am", "13:30" → "1:30pm", "00:15" → "12:15am".
 */
function to12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = mStr ?? '00';
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m}${ampm}`;
}