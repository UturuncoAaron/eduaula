import {
  ChangeDetectionStrategy, Component,
  inject, input, signal, computed, effect, OnInit,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../../../core/services/api';
import { AuthService } from '../../../../../core/auth/auth';

interface EnrollmentRow {
  alumno_id?: string;
  alumno?: {
    id: string;
    nombre?: string | null;
    apellido_paterno?: string | null;
    apellido_materno?: string | null;
  } | null;
}

interface AsistenciaCurso {
  id: string;
  alumno_id: string;
  curso_id: string;
  fecha: string;
  estado: EstadoAsistencia;
  observacion?: string | null;
  created_at: string;
}

type EstadoAsistencia = 'presente' | 'ausente' | 'tardanza' | 'permiso' | 'licencia';

interface RosterRow {
  alumnoId: string;
  nombre: string;
  estado: EstadoAsistencia | null;
  observacion: string;
  /** id del registro existente en el backend, si lo hay (para update). */
  asistenciaId?: string;
  dirty: boolean;
}

const ESTADOS: { value: EstadoAsistencia; label: string; icon: string; class: string }[] = [
  { value: 'presente', label: 'Presente', icon: 'check_circle', class: 'estado-presente' },
  { value: 'tardanza', label: 'Tardanza', icon: 'schedule',     class: 'estado-tardanza' },
  { value: 'ausente',  label: 'Ausente',  icon: 'cancel',       class: 'estado-ausente'  },
  { value: 'permiso',  label: 'Permiso',  icon: 'event_busy',   class: 'estado-permiso'  },
  { value: 'licencia', label: 'Licencia', icon: 'medical_services', class: 'estado-licencia' },
];

/**
 * Tab de asistencia por curso.
 *
 * - **Docente del curso**: ve la lista (roster) de alumnos matriculados en la
 *   sección del curso y puede registrar/editar la asistencia del día. Bulk
 *   save en un solo request.
 * - **Alumno**: ve su propio historial de asistencia para este curso.
 * - **Admin / padre**: ven el listado del día (read-only).
 */
@Component({
  selector: 'app-tab-asistencia',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatChipsModule,
  ],
  templateUrl: './tab-asistencia.html',
  styleUrl: './tab-asistencia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabAsistencia implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);
  private toastr = inject(ToastService);

  // eslint-disable-next-line @angular-eslint/no-input-rename
  courseId = input.required<string>({ alias: 'id' });

  readonly today = signal<string>(new Date().toISOString().substring(0, 10));
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly roster = signal<RosterRow[]>([]);
  readonly miHistorial = signal<AsistenciaCurso[]>([]);
  readonly cursoSeccionId = signal<string | null>(null);

  readonly estados = ESTADOS;

  readonly dirtyCount = computed(() => this.roster().filter(r => r.dirty).length);
  readonly canSave = computed(() => this.dirtyCount() > 0 && !this.saving());

  readonly resumen = computed(() => {
    const r = this.roster();
    return {
      total: r.length,
      presente: r.filter(x => x.estado === 'presente').length,
      ausente:  r.filter(x => x.estado === 'ausente').length,
      tardanza: r.filter(x => x.estado === 'tardanza').length,
      sin_marcar: r.filter(x => x.estado === null).length,
    };
  });

  constructor() {
    // Cuando cambia la fecha, recargamos el snapshot del día.
    effect(() => {
      this.today();
      if (this.auth.isDocente() || this.auth.isAdmin()) this.loadRosterDelDia();
    });
  }

  ngOnInit() {
    if (this.auth.isAlumno()) {
      this.loadMiHistorial();
    } else {
      this.loadCurso();
    }
  }

  private loadCurso() {
    this.loading.set(true);
    this.api.get<{ seccion_id: string }>(`courses/${this.courseId()}`).subscribe({
      next: r => {
        const sec = (r.data as any)?.seccion_id ?? null;
        this.cursoSeccionId.set(sec ? String(sec) : null);
        if (!sec) {
          this.loading.set(false);
          return;
        }
        this.loadRosterDelDia();
      },
      error: () => {
        this.toastr.error('No se pudo cargar el curso');
        this.loading.set(false);
      },
    });
  }

  private loadRosterDelDia() {
    const sec = this.cursoSeccionId();
    if (!sec) return;
    this.loading.set(true);

    // 1) roster de la sección, 2) asistencias del día → merge
    const fecha = this.today();
    this.api.get<EnrollmentRow[]>(`courses/seccion/${sec}/students`).subscribe({
      next: rosterRes => {
        const enrollments = rosterRes.data ?? [];
        this.api.get<AsistenciaCurso[]>(`asistencias/curso/${this.courseId()}?fecha=${fecha}`).subscribe({
          next: asistRes => {
            const byAlumno = new Map<string, AsistenciaCurso>();
            for (const a of (asistRes.data ?? [])) byAlumno.set(a.alumno_id, a);

            const rows: RosterRow[] = enrollments.map(e => {
              const a = e.alumno;
              const id = a?.id ?? e.alumno_id ?? '';
              const exist = byAlumno.get(id);
              const nombre = [a?.nombre, a?.apellido_paterno, a?.apellido_materno]
                .filter(Boolean).join(' ');
              return {
                alumnoId: id,
                nombre: nombre || '(sin nombre)',
                estado: (exist?.estado ?? null) as EstadoAsistencia | null,
                observacion: exist?.observacion ?? '',
                asistenciaId: exist?.id,
                dirty: false,
              };
            });
            this.roster.set(rows);
            this.loading.set(false);
          },
          error: () => {
            this.roster.set([]);
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.toastr.error('No se pudo cargar la lista de alumnos');
        this.loading.set(false);
      },
    });
  }

  private loadMiHistorial() {
    this.loading.set(true);
    const url = `asistencias/curso/alumno/${this.auth.currentUser()?.id}?cursoId=${this.courseId()}`;
    this.api.get<AsistenciaCurso[]>(url).subscribe({
      next: r => {
        this.miHistorial.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.miHistorial.set([]);
        this.loading.set(false);
      },
    });
  }

  setEstado(alumnoId: string, estado: EstadoAsistencia) {
    this.roster.update(rows =>
      rows.map(r =>
        r.alumnoId === alumnoId
          ? { ...r, estado, dirty: r.estado !== estado || r.dirty }
          : r,
      ),
    );
  }

  setObservacion(alumnoId: string, valor: string) {
    this.roster.update(rows =>
      rows.map(r =>
        r.alumnoId === alumnoId ? { ...r, observacion: valor, dirty: true } : r,
      ),
    );
  }

  marcarTodos(estado: EstadoAsistencia) {
    this.roster.update(rows =>
      rows.map(r => ({ ...r, estado, dirty: r.estado !== estado || r.dirty })),
    );
  }

  estadoBadgeClass(estado: EstadoAsistencia | null): string {
    return ESTADOS.find(e => e.value === estado)?.class ?? '';
  }

  estadoLabel(estado: EstadoAsistencia | null): string {
    return ESTADOS.find(e => e.value === estado)?.label ?? '—';
  }

  guardar() {
    if (!this.canSave()) return;
    const dirtyRows = this.roster().filter(r => r.dirty && r.estado != null);
    if (dirtyRows.length === 0) return;

    this.saving.set(true);
    const payload = {
      fecha: this.today(),
      registros: dirtyRows.map(r => ({
        alumno_id: r.alumnoId,
        estado: r.estado,
        observacion: r.observacion || null,
      })),
    };

    this.api.post(`asistencias/curso/${this.courseId()}/bulk`, payload).subscribe({
      next: () => {
        this.toastr.success(`${dirtyRows.length} asistencia(s) registrada(s)`);
        this.saving.set(false);
        this.loadRosterDelDia();
      },
      error: () => {
        this.toastr.error('No se pudo guardar la asistencia');
        this.saving.set(false);
      },
    });
  }
}
