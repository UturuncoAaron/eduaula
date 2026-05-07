import {
  Component, inject, signal, OnInit, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';

interface HorarioHoyItem {
  horaInicio: string;
  horaFin: string;
  aula: string | null;
  cursoNombre: string;
  color: string;
  seccionNombre: string;
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
  entregasSinCalificar: EntregaPendienteItem[];
  comunicados: ComunicadoItem[];
}

@Component({
  selector: 'app-docente-dashboard',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, RouterLink, DatePipe],
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

  // Total de entregas sin calificar para el banner
  readonly totalSinCalificar = computed(() =>
    this.dashboardData()?.entregasSinCalificar
      .reduce((acc, e) => acc + e.totalSinCalificar, 0) ?? 0,
  );

  // ¿Tiene clases hoy?
  readonly tieneClasesHoy = computed(() =>
    (this.dashboardData()?.horarioHoy?.length ?? 0) > 0,
  );

  ngOnInit() {
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