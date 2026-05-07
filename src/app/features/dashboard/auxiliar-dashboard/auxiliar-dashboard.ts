import {
  Component, inject, signal, OnInit, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';
import { DatePipe } from '@angular/common';

interface SeccionAsistenciaItem {
  seccionId: string;
  seccionNombre: string;
  gradoNombre: string;
  totalAlumnos: number;
  registrada: boolean;
  totalFaltas: number;
  totalTardanzas: number;
}

interface ComunicadoItem {
  id: string;
  titulo: string;
  contenido: string;
  fecha: string;
}

interface AuxiliarDashboardData {
  seccionesHoy: SeccionAsistenciaItem[];
  comunicados: ComunicadoItem[];
}

@Component({
  selector: 'app-auxiliar-dashboard',
  standalone: true,
  imports: [MatIconModule, RouterLink,DatePipe],
  templateUrl: './auxiliar-dashboard.html',
  styleUrl: './auxiliar-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuxiliarDashboard implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  dashboardData = signal<AuxiliarDashboardData | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  // Contadores derivados de las secciones — sin queries extra
  readonly totalFaltas = computed(() =>
    this.dashboardData()?.seccionesHoy
      .reduce((acc, s) => acc + s.totalFaltas, 0) ?? 0,
  );

  readonly totalTardanzas = computed(() =>
    this.dashboardData()?.seccionesHoy
      .reduce((acc, s) => acc + s.totalTardanzas, 0) ?? 0,
  );

  readonly seccionesRegistradas = computed(() =>
    this.dashboardData()?.seccionesHoy
      .filter(s => s.registrada).length ?? 0,
  );

  readonly seccionesPendientes = computed(() =>
    this.dashboardData()?.seccionesHoy
      .filter(s => !s.registrada).length ?? 0,
  );

  ngOnInit() {
    this.api.get<AuxiliarDashboardData>('dashboard/resumen').subscribe({
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
}