import {
  Component, inject, signal, OnInit, OnDestroy, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api';
import { PsychologyStore } from '../../psychology/data-access/psychology.store';

interface CitaHoyItem {
  id: string;
  tipo: string;
  modalidad: string;
  fechaHora: string;
  duracionMin: number;
  alumnoNombre: string;
  alumnoId: string;
  estado: string;
}

interface AlumnoSeguimientoItem {
  alumnoId: string;
  nombre: string;
  apellidoPaterno: string;
  grado: string;
  seccion: string;
  desde: string;
}

interface ComunicadoItem {
  id: string;
  titulo: string;
  contenido: string;
  fecha: string;
}

interface PsicologaDashboardData {
  citasHoy: CitaHoyItem[];
  alumnosEnSeguimiento: AlumnoSeguimientoItem[];
  comunicados: ComunicadoItem[];
}

@Component({
  selector: 'app-psychology-dashboard',
  standalone: true,
  imports: [MatIconModule, DatePipe, TitleCasePipe],
  templateUrl: './psychology-dashboard.html',
  styleUrl: './psychology-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PsychologyDashboard implements OnInit, OnDestroy {
  private readonly api   = inject(ApiService);
  private readonly store = inject(PsychologyStore);

  dashboardData = signal<PsicologaDashboardData | null>(null);
  loading       = signal(true);
  error         = signal<string | null>(null);

  readonly tieneCitasHoy = computed(() =>
    (this.dashboardData()?.citasHoy?.length ?? 0) > 0,
  );

  readonly totalSeguimiento = computed(() =>
    this.dashboardData()?.alumnosEnSeguimiento?.length ?? 0,
  );

  readonly modalidadIcon: Record<string, string | undefined> = {
    presencial: 'location_on',
    virtual:    'videocam',
    telefonico: 'phone',
  };

  readonly tipoCitaLabel: Record<string, string | undefined> = {
    academico:   'Académico',
    conductual:  'Conductual',
    psicologico: 'Psicológico',
    familiar:    'Familiar',
    otro:        'Otro',
  };

  ngOnInit() {
    this.api.get<PsicologaDashboardData>('dashboard/resumen').subscribe({
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

  ngOnDestroy() {
    this.store.reset();
  }
}