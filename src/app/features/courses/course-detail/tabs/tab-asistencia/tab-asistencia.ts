import { ChangeDetectionStrategy, Component, inject, input, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../../../core/services/api';
import { AuthService } from '../../../../../core/auth/auth';
import { LazyCourseStore } from '../../../data-access/lazy-course.store';
// IMPORTANTE: Asegúrate de importar AsistenciaCurso aquí
import { RosterRow, AsistenciaCurso, EstadoAsistencia, fromBackendEstado, toBackendEstado } from './asistencia.types';
import { RosterDelDia } from './components/roster-del-dia';
import { HistorialAsistencia } from './components/historial-asistencia';

@Component({
  selector: 'app-tab-asistencia',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, RosterDelDia, HistorialAsistencia],
  templateUrl: './tab-asistencia.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabAsistencia implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private store = inject(LazyCourseStore);

  courseId = input.required<string>({ alias: 'id' });
  readonly today = signal<string>(new Date().toISOString().substring(0, 10));
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly roster = signal<RosterRow[]>([]);
  readonly miHistorial = signal<AsistenciaCurso[]>([]);
  readonly cursoHistorial = signal<AsistenciaCurso[]>([]);
  readonly cursoSeccionId = signal<string | null>(null);

  get canEdit(): boolean { return this.auth.isDocente(); }
  get showHistorialCurso(): boolean { return this.auth.isDocente() || this.auth.isAdmin(); }

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
        const sec = (r.data as { seccion_id?: string } | null)?.seccion_id ?? null;
        this.cursoSeccionId.set(sec ? String(sec) : null);
        if (!sec) { this.loading.set(false); return; }
        this.loadRosterDelDia();
        this.loadHistorialCurso();
      },
      error: () => {
        this.toastr.error('Error al cargar curso');
        this.loading.set(false);
      },
    });
  }

  loadRosterDelDia() {
    const fecha = this.today();
    this.loading.set(true);
    forkJoin({
      roster: this.store.roster$(this.cursoSeccionId() ?? ''),
      asistencias: this.api.get<any[]>(`asistencias/curso/${this.courseId()}?fecha=${fecha}`),
    }).subscribe({
      next: ({ roster, asistencias }) => {
        const byAlumno = new Map<string, any>();
        (asistencias.data ?? []).forEach(a => byAlumno.set(a.alumno_id, a));

        const rows: RosterRow[] = roster.map((a: any) => {
          const realAlumnoId = a.id ?? '';
          const exist = byAlumno.get(realAlumnoId);
          const ui = exist ? fromBackendEstado(exist.estado, exist.observacion) : null;

          return {
            alumnoId: realAlumnoId,
            nombre: [a.nombre, a.apellido_paterno].filter(Boolean).join(' '),
            estado: ui?.estado ?? null,
            observacion: ui?.observacion ?? '',
            asistenciaId: exist?.id,
            dirty: false,
          };
        });
        this.roster.set(rows.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('Error al cargar lista');
        this.loading.set(false);
      }
    });
  }

  loadHistorialCurso() {
    this.api.get<AsistenciaCurso[]>(`asistencias/curso/${this.courseId()}?limit=500`).subscribe({
      next: r => this.cursoHistorial.set(r.data ?? []),
    });
  }

  loadMiHistorial() {
    this.loading.set(true);
    this.api.get<AsistenciaCurso[]>(`asistencias/curso/alumno/${this.auth.currentUser()?.id}?cursoId=${this.courseId()}`).subscribe({
      next: r => { this.miHistorial.set(r.data ?? []); this.loading.set(false); },
    });
  }

  setEstado(payload: { alumnoId: string; estado: EstadoAsistencia }) {
    this.roster.update(rows => rows.map(r => r.alumnoId === payload.alumnoId ? { ...r, estado: payload.estado, dirty: true } : r));
  }

  setObs(payload: { alumnoId: string; valor: string }) {
    this.roster.update(rows => rows.map(r => r.alumnoId === payload.alumnoId ? { ...r, observacion: payload.valor, dirty: true } : r));
  }

  marcarTodos(estado: EstadoAsistencia) {
    this.roster.update(rows => rows.map(r => ({ ...r, estado, dirty: true })));
  }

  guardar() {
    const dirtyRows = this.roster().filter(r => r.dirty);
    if (dirtyRows.length === 0) return;
    this.saving.set(true);

    const payload = {
      fecha: this.today(),
      alumnos: dirtyRows.map(r => ({
        alumno_id: r.alumnoId,
        ...toBackendEstado(r.estado ?? 'presente', r.observacion),
      })),
    };

    this.api.post(`asistencias/curso/${this.courseId()}/bulk`, payload).subscribe({
      next: () => {
        this.toastr.success('Guardado');
        this.saving.set(false);
        this.loadRosterDelDia();
      },
      error: () => this.saving.set(false)
    });
  }
}