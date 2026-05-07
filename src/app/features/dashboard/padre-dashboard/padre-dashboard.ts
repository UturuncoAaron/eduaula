import {
  Component, inject, signal, OnInit, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';

interface HijoItem {
  alumnoId: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  grado: string;
  seccion: string;
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
  imports: [RouterLink, MatIconModule, MatButtonModule, DatePipe],
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

  // Tipo explícito con undefined para que ?? en el template sea válido
  readonly tipoCitaLabel: Record<string, string | undefined> = {
    academico: 'Académico',
    conductual: 'Conductual',
    psicologico: 'Psicológico',
    familiar: 'Familiar',
    otro: 'Otro',
  };

  readonly modalidadIcon: Record<string, string | undefined> = {
    presencial: 'location_on',
    virtual: 'videocam',
    telefonico: 'phone',
  };

  readonly tieneCitas = computed(() =>
    (this.dashboardData()?.citasProximas?.length ?? 0) > 0,
  );

  readonly tieneLibretas = computed(() =>
    (this.dashboardData()?.libretas?.length ?? 0) > 0,
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

  getInitials(hijo: HijoItem): string {
    return `${hijo.nombre[0]}${hijo.apellidoPaterno[0]}`.toUpperCase();
  }

  getFullName(hijo: HijoItem): string {
    const mat = hijo.apellidoMaterno ? ` ${hijo.apellidoMaterno}` : '';
    return `${hijo.nombre} ${hijo.apellidoPaterno}${mat}`;
  }
}