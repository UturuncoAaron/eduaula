import {
  Component, inject, signal, OnInit, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';
import { UserAvatar } from '../../../shared/components/user-avatar/user-avatar';

interface HijoItem {
  alumnoId: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  grado: string;
  seccion: string;
  seccionId: string;
  codigoEstudiante: string;
  fotoStorageKey: string | null;
  promedioGeneral: number | null;
  porcentajeAsistencia: number | null;
  citasPendientes: number;
  asistioHoy: boolean | null;
}

interface CitaItem {
  id: string;
  tipo: string;
  modalidad: string;
  fechaHora: string;
  estado: string;
  convocadoPor: string;
  alumnoNombre: string;
}

interface LibretaItem {
  id: string;
  periodoNombre: string;
  storageKey: string;
  creadaEn: string;
  alumnoNombre: string;
}

interface ComunicadoItem {
  id: string;
  titulo: string;
  contenido: string;
  fecha: string;
}

interface PadreDashboardData {
  hijos: HijoItem[];
  citasProximas: CitaItem[];
  comunicados: ComunicadoItem[];
  libretas: LibretaItem[];
}

@Component({
  selector: 'app-padre-dashboard',
  standalone: true,
  imports: [
    RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    DatePipe, DecimalPipe, UserAvatar,
  ],
  templateUrl: './padre-dashboard.html',
  styleUrl: './padre-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PadreDashboard implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  dashboardData = signal<PadreDashboardData | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  readonly tipoCitaLabel: Record<string, string> = {
    academico: 'Académico', conductual: 'Conductual',
    psicologico: 'Psicológico', familiar: 'Familiar', otro: 'Otro',
  };

  readonly tieneCitas = computed(() =>
    (this.dashboardData()?.citasProximas?.length ?? 0) > 0,
  );

  readonly tieneLibretas = computed(() =>
    (this.dashboardData()?.libretas?.length ?? 0) > 0,
  );

  readonly totalCitasPendientes = computed(() =>
    this.dashboardData()?.hijos?.reduce((sum, h) => sum + (h.citasPendientes ?? 0), 0) ?? 0,
  );

  ngOnInit() {
    this.api.get<PadreDashboardData>('dashboard/resumen').subscribe({
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

  getFullName(hijo: HijoItem): string {
    const mat = hijo.apellidoMaterno ? ` ${hijo.apellidoMaterno}` : '';
    return `${hijo.nombre} ${hijo.apellidoPaterno}${mat}`;
  }

  attendanceColor(pct: number | null): string {
    if (pct === null) return '#64748b';
    if (pct >= 90) return '#16a34a';
    if (pct >= 75) return '#ca8a04';
    return '#dc2626';
  }

  gradeColor(avg: number | null): string {
    if (avg === null) return '#64748b';
    if (avg >= 17) return '#16a34a';
    if (avg >= 14) return '#2563eb';
    if (avg >= 11) return '#ca8a04';
    return '#dc2626';
  }
}