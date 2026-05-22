import {
  Component, ChangeDetectionStrategy, inject,
  signal, computed, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type EstadoDocente = 'presente' | 'tardanza' | 'ausente';

interface BloqueInfo {
  horario_id: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string | null;
  curso_nombre: string;
  seccion_nombre: string;
  estado_bloque: string | null;
}

interface DocenteDelDia {
  docente_id: string;
  docente_nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  primera_clase: string;
  ultima_clase: string;
  total_bloques: number;
  estado_actual: EstadoDocente | null;
  hora_llegada: string | null;
  motivo: string | null;
  ya_registrado: boolean;
  bloques_json: BloqueInfo[];
}

interface EstadoEdicion {
  estado: EstadoDocente;
  hora_llegada?: string;
  motivo?: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#14b8a6', '#3b82f6', '#8b5cf6',
  '#f59e0b', '#ef4444', '#10b981',
];

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DIAS = [
  'domingo', 'lunes', 'martes', 'miércoles',
  'jueves', 'viernes', 'sábado',
];

// ── Componente ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-asistencia-docentes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
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
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly docentes = signal<DocenteDelDia[]>([]);
  readonly edicion = signal<Map<string, EstadoEdicion>>(new Map());
  readonly docenteExpandido = signal<string | null>(null);

  // ── Computed ───────────────────────────────────────────────────────────────

  readonly fechaLabel = computed(() => {
    const d = new Date(this.fecha() + 'T00:00:00');
    return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  });

  readonly fechaCorta = computed(() => {
    const [y, m, d] = this.fecha().split('-');
    return `${d}/${m}/${y}`;
  });

  readonly isToday = computed(() => this.fecha() === this.todayStr);

  readonly totalPresentes = computed(() =>
    [...this.edicion().values()].filter(e => e.estado === 'presente').length);
  readonly totalTardanzas = computed(() =>
    [...this.edicion().values()].filter(e => e.estado === 'tardanza').length);
  readonly totalAusentes = computed(() =>
    [...this.edicion().values()].filter(e => e.estado === 'ausente').length);

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit() { this.cargarDocentes(); }

  // ── Carga ──────────────────────────────────────────────────────────────────

  cargarDocentes() {
    this.loading.set(true);
    this.api.get<any>(`reports/docentes/docentes-dia?fecha=${this.fecha()}`).subscribe({
      next: r => {
        const data: DocenteDelDia[] = Array.isArray(r)
          ? r : Array.isArray(r?.data) ? r.data : [];

        this.docentes.set(data);

        const m = new Map<string, EstadoEdicion>();
        for (const d of data) {
          m.set(d.docente_id, {
            estado: (d.estado_actual as EstadoDocente) ?? 'presente',
            hora_llegada: d.hora_llegada ?? undefined,
            motivo: d.motivo ?? undefined,
          });
        }
        this.edicion.set(m);
        this.loading.set(false);
      },
      error: () => {
        this.docentes.set([]);
        this.edicion.set(new Map());
        this.loading.set(false);
        this.toastr.error('No se pudo cargar la lista de docentes');
      },
    });
  }

  onFechaChange(value: string) {
    if (!value || value > this.todayStr) {
      this.toastr.warning('No puedes registrar asistencia de fechas futuras');
      return;
    }
    this.fecha.set(value);
    this.cargarDocentes();
  }

  // ── Edición ────────────────────────────────────────────────────────────────

  getEdicion(docenteId: string): EstadoEdicion {
    return this.edicion().get(docenteId) ?? { estado: 'presente' };
  }

  setEstado(docenteId: string, estado: EstadoDocente) {
    const m = new Map(this.edicion());
    const prev = m.get(docenteId) ?? { estado: 'presente' as EstadoDocente };
    m.set(docenteId, {
      ...prev,
      estado,
      // Limpiar campos que no aplican
      hora_llegada: estado === 'tardanza' ? prev.hora_llegada : undefined,
      motivo: estado === 'ausente' ? prev.motivo : undefined,
    });
    this.edicion.set(m);
  }

  setHoraLlegada(docenteId: string, valor: string) {
    const m = new Map(this.edicion());
    const prev = m.get(docenteId) ?? { estado: 'presente' as EstadoDocente };
    m.set(docenteId, { ...prev, hora_llegada: valor || undefined });
    this.edicion.set(m);
  }

  setMotivo(docenteId: string, valor: string) {
    const m = new Map(this.edicion());
    const prev = m.get(docenteId) ?? { estado: 'presente' as EstadoDocente };
    m.set(docenteId, { ...prev, motivo: valor || undefined });
    this.edicion.set(m);
  }

  marcarTodos(estado: EstadoDocente) {
    const m = new Map<string, EstadoEdicion>();
    for (const d of this.docentes()) {
      m.set(d.docente_id, { estado });
    }
    this.edicion.set(m);
  }

  toggleExpandir(docenteId: string) {
    this.docenteExpandido.set(
      this.docenteExpandido() === docenteId ? null : docenteId,
    );
  }

  // ── Guardar ────────────────────────────────────────────────────────────────

  guardar() {
    if (this.saving() || !this.docentes().length) return;
    this.saving.set(true);

    const payload = {
      fecha: this.fecha(),
      docentes: this.docentes().map(d => {
        const ed = this.edicion().get(d.docente_id) ?? { estado: 'presente' as EstadoDocente };
        return {
          docente_id: d.docente_id,
          estado: ed.estado,
          hora_llegada: ed.hora_llegada || undefined,
          motivo: ed.motivo || undefined,
        };
      }),
    };

    this.api.post('reports/docentes/registrar-diario', payload).subscribe({
      next: (res: any) => {
        this.saving.set(false);
        const bloques = res?.data?.bloques_registrados ?? res?.bloques_registrados ?? '?';
        this.toastr.success(`Asistencia guardada — ${bloques} bloques registrados`);
        this.cargarDocentes();
      },
      error: (err: any) => {
        this.saving.set(false);
        const msg = Array.isArray(err?.error?.message)
          ? err.error.message.join(', ')
          : err?.error?.message ?? 'No se pudo guardar';
        this.toastr.error(msg);
      },
    });
  }

  // ── Helpers UI ────────────────────────────────────────────────────────────

  getAvatarColor(apellido: string): string {
    let h = 0;
    for (const c of apellido) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }

  getInitials(d: DocenteDelDia): string {
    return `${d.docente_nombre.charAt(0)}${d.apellido_paterno.charAt(0)}`.toUpperCase();
  }

  formatHora(hora: string): string {
    return hora?.slice(0, 5) ?? '';
  }

  volver() { this.router.navigate(['/dashboard']); }
}