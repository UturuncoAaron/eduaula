import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

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
  hora_llegada?: string | null;
  observacion?: string | null;
}

@Component({
  selector: 'app-asistencia-docentes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    PageHeader,
    EmptyState,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asistencia-docentes.html',
  styleUrl: './asistencia-docentes.scss',
})
export class AsistenciaDocentes implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toastr = inject(ToastService);

  readonly fecha = signal<string>(this.todayISO());
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly bloques = signal<HorarioBloque[]>([]);
  readonly estados = signal<Map<string, {
    estado: EstadoAsistencia;
    hora_llegada?: string;
    observacion?: string;
  }>>(new Map());

  readonly hayPendientes = computed(() =>
    this.bloques().some(b => !this.estados().get(b.horario_id)?.estado),
  );

  readonly estadosDisponibles: { value: EstadoAsistencia; label: string; icon: string }[] = [
    { value: 'presente', label: 'Presente', icon: 'check_circle' },
    { value: 'tardanza', label: 'Tardanza', icon: 'schedule' },
    { value: 'ausente', label: 'Ausente', icon: 'cancel' },
    { value: 'permiso', label: 'Permiso', icon: 'event_available' },
    { value: 'licencia', label: 'Licencia', icon: 'medical_services' },
  ];

  ngOnInit() { this.loadHorarios(); }

  private todayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  onFechaChange(value: string) {
    this.fecha.set(value);
    this.loadHorarios();
  }

  loadHorarios() {
    this.loading.set(true);

    // ── FIX: endpoint correcto ─────────────────────────────────
    // Antes: reports/docentes/horarios-dia  (no existe)
    // Ahora: asistencias/docente/horarios-dia  (creado en el service)
    this.api.get<any>(`asistencias/docente/horarios-dia?fecha=${this.fecha()}`).subscribe({
      next: r => {
        // Soporta array directo o { data: [] }
        const data: HorarioBloque[] = Array.isArray(r)
          ? r
          : Array.isArray(r?.data) ? r.data : [];

        this.bloques.set(data);

        const m = new Map<string, { estado: EstadoAsistencia; hora_llegada?: string; observacion?: string }>();
        for (const b of data) {
          if (b.estado_actual) {
            m.set(b.horario_id, {
              estado: b.estado_actual,
              hora_llegada: b.hora_llegada ?? undefined,
              observacion: b.observacion ?? undefined,
            });
          }
        }
        this.estados.set(m);
        this.loading.set(false);
      },
      error: () => {
        this.bloques.set([]);
        this.estados.set(new Map());
        this.loading.set(false);
        this.toastr.error('No se pudo cargar el horario del día');
      },
    });
  }

  pickEstado(b: HorarioBloque, estado: EstadoAsistencia) {
    const m = new Map(this.estados());
    const prev = m.get(b.horario_id) ?? { estado };
    m.set(b.horario_id, { ...prev, estado });
    this.estados.set(m);
  }

  estadoActual(b: HorarioBloque): EstadoAsistencia | null {
    return this.estados().get(b.horario_id)?.estado ?? null;
  }

  guardar() {
    const registros = this.bloques()
      .map(b => {
        const e = this.estados().get(b.horario_id);
        if (!e) return null;
        return {
          horario_id: b.horario_id,
          docente_id: b.docente_id,
          estado: e.estado,
          ...(e.estado === 'tardanza' && e.hora_llegada ? { hora_llegada: e.hora_llegada } : {}),
          ...(e.observacion ? { observacion: e.observacion } : {}),
        };
      })
      .filter(Boolean);

    if (!registros.length) {
      this.toastr.error('No marcaste ningún bloque');
      return;
    }

    this.saving.set(true);

    // ── FIX: endpoint correcto para guardar ───────────────────
    // Antes: reports/docentes/registrar/bulk  (no existe)
    // Ahora: asistencias/docente/bulk  (existe en el controller)
    this.api.post('asistencias/docente/bulk', {
      fecha: this.fecha(),
      registros,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toastr.success(`Se registraron ${registros.length} bloque(s)`);
        this.loadHorarios();
      },
      error: (err) => {
        this.saving.set(false);
        const msg = Array.isArray(err?.error?.message)
          ? err.error.message.join(', ')
          : err?.error?.message ?? 'No se pudo guardar el registro';
        this.toastr.error(msg);
      },
    });
  }
}