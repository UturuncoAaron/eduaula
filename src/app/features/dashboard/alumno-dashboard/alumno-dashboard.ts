import {
  Component, inject, signal, OnInit, OnDestroy, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';
import { WeekGrid } from '../../../shared/components/week-grid/week-grid';
import { WeekDia, WeekSlot } from '../../../shared/components/week-grid/week-grid.types';

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
export class AlumnoDashboard implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  dashboardData = signal<AlumnoDashboardData | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  // ── QR del alumno ────────────────────────────────────────────────────────
  // El endpoint /alumnos/me/qr.png requiere JWT, por lo que no se puede usar
  // <img src="..."> directamente. Se fetchea como blob y se crea un object URL.
  readonly qrUrl = signal<SafeUrl | null>(null);
  readonly qrLoading = signal(true);
  readonly qrError = signal(false);
  private qrObjectUrl: string | null = null;

  // ── Horario ──────────────────────────────────────────────────────────────
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

  readonly tareasPendientes = computed(() => this.dashboardData()?.tareasPendientes ?? []);
  readonly comunicados = computed(() => this.dashboardData()?.comunicados ?? []);

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
    // Dashboard data y QR se cargan en paralelo — uno no bloquea al otro
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

    this.loadQr();
  }

  ngOnDestroy(): void {
    // Liberar el blob de memoria cuando el componente se destruye
    if (this.qrObjectUrl) {
      URL.revokeObjectURL(this.qrObjectUrl);
    }
  }

  /**
   * Carga el QR del alumno como blob autenticado.
   * Los interceptores de HttpClient agregan el JWT automáticamente.
   */
  private loadQr(): void {
    this.http.get(`${environment.apiUrl}/alumnos/me/qr.png?t=${Date.now()}`, { responseType: 'blob' }).subscribe({
      next: blob => {
        this.qrObjectUrl = URL.createObjectURL(blob);
        this.qrUrl.set(this.sanitizer.bypassSecurityTrustUrl(this.qrObjectUrl));
        this.qrLoading.set(false);
      },
      error: () => {
        this.qrError.set(true);
        this.qrLoading.set(false);
      },
    });
  }

  /** Descarga el QR como PNG — crea un <a> temporal y lo clickea. */
  downloadQr(): void {
    if (!this.qrObjectUrl) return;
    const nombre = this.auth.currentUser()?.nombre ?? 'alumno';
    const a = document.createElement('a');
    a.href = this.qrObjectUrl;
    a.download = `qr-${nombre.toLowerCase().replace(/\s+/g, '-')}.png`;
    a.click();
  }

  getUrgencia(fechaLimite: string): 'rojo' | 'ambar' | 'verde' {
    const diff = (new Date(fechaLimite).getTime() - Date.now()) / 86_400_000;
    if (diff <= 1) return 'rojo';
    if (diff <= 5) return 'ambar';
    return 'verde';
  }
}

function isWeekDia(s: string): boolean {
  return ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'].includes(s);
}