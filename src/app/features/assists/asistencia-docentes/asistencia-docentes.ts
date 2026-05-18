import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';

type EstadoAsistencia = 'presente' | 'tardanza' | 'ausente' | 'permiso' | 'licencia';

interface HorarioBloque {
  horario_id: string;
  docente_id: string;
  docente_nombre: string;
  apellido_paterno: string;
  curso_nombre: string;
  seccion_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  aula?: string;
  estado_actual?: EstadoAsistencia | null;
}

const AVATAR_COLORS = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

@Component({
  selector: 'app-asistencia-docentes',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asistencia-docentes.html',
  styleUrl: './asistencia-docentes.scss',
})
export class AsistenciaDocentes implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toastr = inject(ToastService);
  private readonly router = inject(Router);

  readonly todayStr = new Date().toISOString().slice(0, 10);
  readonly fecha = signal<string>(this.todayStr);

  readonly fechaLabel = computed(() => {
    const d = new Date(this.fecha() + 'T00:00:00');
    return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  });

  readonly fechaCorta = computed(() => {
    const [y, m, d] = this.fecha().split('-');
    return `${d}/${m}/${y}`;
  });

  readonly isToday = computed(() => this.fecha() === this.todayStr);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly bloques = signal<HorarioBloque[]>([]);

  readonly estados = signal<Map<string, EstadoAsistencia>>(new Map());

  readonly totalPresentes = computed(() => [...this.estados().values()].filter(e => e === 'presente').length);
  readonly totalTardanzas = computed(() => [...this.estados().values()].filter(e => e === 'tardanza').length);
  readonly totalAusentes = computed(() => [...this.estados().values()].filter(e => e === 'ausente').length);
  readonly totalPermisos = computed(() => [...this.estados().values()].filter(e => e === 'permiso' || e === 'licencia').length);

  readonly yaRegistrado = computed(() =>
    this.bloques().length > 0 && this.bloques().some(b => b.estado_actual !== null)
  );

  readonly esFindeSemana = computed(() => {
    const d = new Date(this.fecha() + 'T00:00:00');
    return d.getDay() === 0 || d.getDay() === 6;
  });

  ngOnInit() { this.loadHorarios(); }

  onFechaChange(value: string) {
    if (!value || value > this.todayStr) {
      this.toastr.warning('No puedes registrar asistencia de fechas futuras');
      return;
    }
    this.fecha.set(value);
    this.loadHorarios();
  }

  loadHorarios() {
    this.loading.set(true);
    this.api.get<any>(`asistencias/docente/horarios-dia?fecha=${this.fecha()}`).subscribe({
      next: r => {
        // ── DEBUG ── quitar después de identificar el problema
        console.log('=== DEBUG loadHorarios ===');
        console.log('fecha consultada:', this.fecha());
        console.log('RAW response:', r);
        console.log('typeof r:', typeof r);
        console.log('Array.isArray(r):', Array.isArray(r));
        console.log('r?.data:', r?.data);
        console.log('Array.isArray(r?.data):', Array.isArray(r?.data));
        console.log('r?.data?.data:', r?.data?.data);
        console.log('=========================');
        // ── FIN DEBUG ──

        const data: HorarioBloque[] = Array.isArray(r) ? r : (Array.isArray(r?.data) ? r.data : []);
        console.log('data final parseada (length):', data.length, data);

        this.bloques.set(data);

        const m = new Map<string, EstadoAsistencia>();
        for (const b of data) {
          m.set(b.horario_id, (b.estado_actual as EstadoAsistencia) ?? 'presente');
        }
        this.estados.set(m);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('ERROR loadHorarios:', err);
        this.bloques.set([]);
        this.estados.set(new Map());
        this.loading.set(false);
        this.toastr.error('No se pudo cargar el horario del día');
      },
    });
  }

  pickEstado(horarioId: string, estado: EstadoAsistencia) {
    const m = new Map(this.estados());
    m.set(horarioId, estado);
    this.estados.set(m);
  }

  estadoActual(b: HorarioBloque): EstadoAsistencia {
    return this.estados().get(b.horario_id) ?? 'presente';
  }

  marcarTodos(estado: EstadoAsistencia) {
    const m = new Map<string, EstadoAsistencia>();
    for (const b of this.bloques()) m.set(b.horario_id, estado);
    this.estados.set(m);
  }

  getAvatarColor(nombre: string): string {
    let h = 0;
    for (const c of nombre) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }

  initials(b: HorarioBloque): string {
    return `${b.docente_nombre.charAt(0)}${b.apellido_paterno.charAt(0)}`.toUpperCase();
  }

  guardar() {
    if (this.saving() || !this.bloques().length) return;
    this.saving.set(true);

    const registros = this.bloques().map(b => ({
      horario_id: b.horario_id,
      docente_id: b.docente_id,
      estado: this.estadoActual(b),
    }));

    this.api.post('asistencias/docente/bulk', { fecha: this.fecha(), registros }).subscribe({
      next: () => {
        this.saving.set(false);
        const msg = this.isToday() ? 'Asistencia de docentes guardada ✓' : `Registro del ${this.fecha()} actualizado ✓`;
        this.toastr.success(msg);
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.saving.set(false);
        const msg = Array.isArray(err?.error?.message)
          ? err.error.message.join(', ')
          : (err?.error?.message ?? 'No se pudo guardar el registro');
        this.toastr.error(msg);
      },
    });
  }

  volver() { this.router.navigate(['/dashboard']); }
}