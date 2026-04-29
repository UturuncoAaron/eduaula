import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { DatePipe, NgStyle } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';

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
  tipo: 'tarea' | 'examen';
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

const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie',
};

@Component({
  selector: 'app-alumno-dashboard',
  standalone: true,
  imports: [MatIconModule, RouterLink, DatePipe, NgStyle],
  templateUrl: './alumno-dashboard.html',
  styleUrl: './alumno-dashboard.scss',
})
export class AlumnoDashboard implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  dashboardData = signal<AlumnoDashboardData | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  readonly diasSemana = DIAS_ORDEN;
  readonly diasLabel = DIAS_LABEL;

  // Día actual en formato que coincide con la BD ('lunes', 'martes'...)
  readonly diaHoy = new Date()
    .toLocaleDateString('es-PE', { weekday: 'long' })
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quita tildes → 'miercoles'

  // Horario agrupado por día para el template
  readonly horarioPorDia = computed(() => {
    const data = this.dashboardData();
    if (!data) return {} as Record<string, HorarioItem[]>;
    return DIAS_ORDEN.reduce((acc, dia) => {
      acc[dia] = data.horario.filter(h => h.dia === dia);
      return acc;
    }, {} as Record<string, HorarioItem[]>);
  });

  ngOnInit() {
    // TEMPORAL para pruebas sin token — cambiar a 'dashboard/alumno/resumen' con JWT
    this.api.get<AlumnoDashboardData>('dashboard/alumno/resumen').subscribe({
      next: (res) => {
        this.dashboardData.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la información del dashboard.');
        this.loading.set(false);
      },
    });
  }

  // Urgencia de una tarea según días restantes
  getUrgencia(fechaLimite: string): 'rojo' | 'ambar' | 'verde' {
    const diff = (new Date(fechaLimite).getTime() - Date.now()) / 86_400_000;
    if (diff <= 1) return 'rojo';
    if (diff <= 5) return 'ambar';
    return 'verde';
  }

  // Color de fondo con opacidad para los bloques del horario
  getSlotStyle(color: string): Record<string, string> {
    return {
      'background-color': `${color}18`, // hex con ~10% opacidad
      'border-left': `3px solid ${color}`,
    };
  }

  getSlotTextStyle(color: string): Record<string, string> {
    return { color };
  }
}