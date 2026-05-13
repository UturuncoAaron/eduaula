import {
  ChangeDetectionStrategy, Component,
  inject, input, signal, effect, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../../../core/services/api';
import { AuthService } from '../../../../../core/auth/auth';
import {
  AsistenciaCurso,
  EnrollmentRow,
  EstadoAsistencia,
  RosterRow,
  fromBackendEstado,
  fullName,
  toBackendEstado,
} from './asistencia.types';
import { RosterDelDia } from './components/roster-del-dia';
import { HistorialAsistencia } from './components/historial-asistencia';

/**
 * Tab "Asistencia" del curso. Orquesta carga de datos y delega el render
 * en sub-componentes:
 *
 * - **Docente del curso**: `RosterDelDia` (marca el día) + `HistorialAsistencia` (todos los días).
 * - **Admin / padre / psicólogo**: `RosterDelDia` (read-only) + `HistorialAsistencia`.
 * - **Alumno**: `HistorialAsistencia` con su historial personal.
 */
@Component({
  selector: 'app-tab-asistencia',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule, MatProgressSpinnerModule,
    RosterDelDia, HistorialAsistencia,
  ],
  templateUrl: './tab-asistencia.html',
  styleUrl: './tab-asistencia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabAsistencia implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);
  private toastr = inject(ToastService);

  // Recibe el `:id` del path /cursos/:id/asistencia via withComponentInputBinding.
  // eslint-disable-next-line @angular-eslint/no-input-rename
  courseId = input.required<string>({ alias: 'id' });

  readonly today = signal<string>(new Date().toISOString().substring(0, 10));
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly roster = signal<RosterRow[]>([]);
  /** Historial del alumno cuando soy alumno. */
  readonly miHistorial = signal<AsistenciaCurso[]>([]);
  /** Historial completo del curso cuando soy docente/admin. */
  readonly cursoHistorial = signal<AsistenciaCurso[]>([]);
  readonly cursoSeccionId = signal<string | null>(null);

  /** Puede editar el roster del día. */
  get canEdit(): boolean { return this.auth.isDocente(); }

  /** Debe mostrar el roster del día. */
  get showRoster(): boolean {
    return this.auth.isDocente() || this.auth.isAdmin();
  }

  /** Debe mostrar el historial completo (vista docente/admin). */
  get showHistorialCurso(): boolean {
    return this.auth.isDocente() || this.auth.isAdmin();
  }

  constructor() {
    // Cuando cambia la fecha, recargamos el snapshot del día.
    effect(() => {
      this.today();
      if (this.showRoster) this.loadRosterDelDia();
    });
  }

  ngOnInit() {
    if (this.auth.isAlumno()) {
      this.loadMiHistorial();
    } else {
      this.loadCurso();
    }
  }

  // ─── Carga inicial ─────────────────────────────────────────────
  private loadCurso() {
    this.loading.set(true);
    this.api.get<{ seccion_id: string }>(`courses/${this.courseId()}`).subscribe({
      next: r => {
        const sec = (r.data as { seccion_id?: string } | null)?.seccion_id ?? null;
        this.cursoSeccionId.set(sec ? String(sec) : null);
        if (!sec) {
          this.loading.set(false);
          return;
        }
        this.loadRosterDelDia();
        this.loadHistorialCurso();
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

    const fecha = this.today();
    forkJoin({
      roster: this.api.get<EnrollmentRow[]>(`courses/seccion/${sec}/students`),
      asistencias: this.api.get<AsistenciaCurso[]>(
        `asistencias/curso/${this.courseId()}?fecha=${fecha}`,
      ),
    }).subscribe({
      next: ({ roster, asistencias }) => {
        const enrollments = roster.data ?? [];
        const byAlumno = new Map<string, AsistenciaCurso>();
        for (const a of asistencias.data ?? []) byAlumno.set(a.alumno_id, a);

        const rows: RosterRow[] = enrollments.map(e => {
          const a = e.alumno;
          const id = a?.id ?? e.alumno_id ?? '';
          const exist = byAlumno.get(id);
          const ui = exist
            ? fromBackendEstado(exist.estado, exist.observacion)
            : null;
          return {
            alumnoId: id,
            nombre: fullName(a),
            estado: (ui?.estado ?? null) as EstadoAsistencia | null,
            observacion: ui?.observacion ?? '',
            asistenciaId: exist?.id,
            dirty: false,
          };
        });
        this.roster.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('No se pudo cargar la lista de alumnos');
        this.loading.set(false);
      },
    });
  }

  private loadHistorialCurso() {
    // Trae todo el historial del curso (limit alto). El componente lo agrupa
    // por alumno y construye una matriz por fecha. Mapeamos el estado del
    // backend (4 valores) al vocab UI (5 valores) antes de exponerlo.
    this.api.get<AsistenciaCurso[]>(
      `asistencias/curso/${this.courseId()}?limit=500`,
    ).subscribe({
      next: r => this.cursoHistorial.set(this.mapHistorial(r.data ?? [])),
      error: () => this.cursoHistorial.set([]),
    });
  }

  private loadMiHistorial() {
    this.loading.set(true);
    const url = `asistencias/curso/alumno/${this.auth.currentUser()?.id}?cursoId=${this.courseId()}`;
    this.api.get<AsistenciaCurso[]>(url).subscribe({
      next: r => {
        this.miHistorial.set(this.mapHistorial(r.data ?? []));
        this.loading.set(false);
      },
      error: () => {
        this.miHistorial.set([]);
        this.loading.set(false);
      },
    });
  }

  private mapHistorial(rows: AsistenciaCurso[]): AsistenciaCurso[] {
    return rows.map(r => {
      const ui = fromBackendEstado(r.estado as unknown as string, r.observacion);
      return { ...r, estado: ui.estado, observacion: ui.observacion };
    });
  }

  // ─── Mutaciones del roster ─────────────────────────────────────
  setEstado(payload: { alumnoId: string; estado: EstadoAsistencia }) {
    this.roster.update(rows =>
      rows.map(r =>
        r.alumnoId === payload.alumnoId
          ? { ...r, estado: payload.estado, dirty: r.estado !== payload.estado || r.dirty }
          : r,
      ),
    );
  }

  setObs(payload: { alumnoId: string; valor: string }) {
    this.roster.update(rows =>
      rows.map(r =>
        r.alumnoId === payload.alumnoId ? { ...r, observacion: payload.valor, dirty: true } : r,
      ),
    );
  }

  marcarTodos(estado: EstadoAsistencia) {
    this.roster.update(rows =>
      rows.map(r => ({ ...r, estado, dirty: r.estado !== estado || r.dirty })),
    );
  }

  // ─── Guardar ───────────────────────────────────────────────────
  guardar() {
    const dirtyRows = this.roster().filter(r => r.dirty && r.estado != null);
    if (dirtyRows.length === 0 || this.saving()) return;

    this.saving.set(true);
    // BulkAsistenciaDto del backend: { fecha, alumnos: [{ alumno_id, estado, observacion? }] }.
    // El estado UI (5 valores) se mapea al vocab del backend (4 valores).
    const payload = {
      fecha: this.today(),
      alumnos: dirtyRows.map(r => ({
        alumno_id: r.alumnoId,
        ...toBackendEstado(r.estado as NonNullable<EstadoAsistencia>, r.observacion),
      })),
    };

    this.api.post(`asistencias/curso/${this.courseId()}/bulk`, payload).subscribe({
      next: () => {
        this.toastr.success(`${dirtyRows.length} asistencia(s) registrada(s)`);
        this.saving.set(false);
        this.loadRosterDelDia();
        // Refrescamos historial completo para que la fila nueva aparezca abajo.
        this.loadHistorialCurso();
      },
      error: () => {
        this.toastr.error('No se pudo guardar la asistencia');
        this.saving.set(false);
      },
    });
  }
}
