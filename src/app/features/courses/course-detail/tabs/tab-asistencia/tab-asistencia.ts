import {
  ChangeDetectionStrategy, Component, inject, input, signal,
  OnInit, effect, computed, untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { forkJoin } from 'rxjs';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../../../core/services/api';
import { AuthService } from '../../../../../core/auth/auth';
import { LazyCourseStore } from '../../../data-access/lazy-course.store';
import { PeriodoService } from '../../../../../core/services/periodo';
import { BimestreFilterService } from '@core/models/bimestre-filter';

import {
  RosterRow, AsistenciaCurso, EstadoAsistencia,
  fromBackendEstado, toBackendEstado,
} from './asistencia.types';
import { RosterDelDia } from './components/roster-del-dia';
import { HistorialAsistencia } from './components/historial-asistencia';

@Component({
  selector: 'app-tab-asistencia',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatProgressSpinnerModule, MatButtonToggleModule,
    MatIconModule, MatButtonModule,
    MatDatepickerModule, MatNativeDateModule,
    MatFormFieldModule, MatInputModule,
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
  private store = inject(LazyCourseStore);
  private periodoSvc = inject(PeriodoService);
  private bimFiltro = inject(BimestreFilterService);

  courseId = input.required<string>({ alias: 'id' });

  readonly today = signal<string>(new Date().toISOString().substring(0, 10));
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly viewMode = signal<'hoy' | 'historial'>('hoy');
  readonly historialLoaded = signal(false);

  // ── Filtros de fecha (ahora en el padre) ──
  readonly filtroDesde = signal<Date | null>(null);
  readonly filtroHasta = signal<Date | null>(null);

  // ── Datos ──
  readonly roster = signal<RosterRow[]>([]);
  readonly miHistorial = signal<AsistenciaCurso[]>([]);
  readonly cursoHistorial = signal<AsistenciaCurso[]>([]);
  readonly cursoSeccionId = signal<string | null>(null);
  readonly courseAnio = signal<number | null>(null);

  get canEdit(): boolean { return this.auth.isDocente(); }
  get showHistorialCurso(): boolean { return this.auth.isDocente() || this.auth.isAdmin(); }

  readonly periodoActivoId = computed<string | null>(() => {
    const bim = this.bimFiltro.bimestre();
    const anio = this.courseAnio();
    if (bim === null || anio === null) return null;
    const p = this.periodoSvc.all().find(x => x.anio === anio && x.bimestre === bim);
    return p ? String(p.id) : null;
  });

  constructor() {
    effect(() => {
      this.periodoActivoId();
      const desde = this.filtroDesde();
      const hasta = this.filtroHasta();

      // Solo recargar si ambas fechas están completas o ambas vacías
      const datesReady = (desde && hasta) || (!desde && !hasta);
      if (!datesReady) return;

      if (this.viewMode() === 'historial' && this.showHistorialCurso) {
        untracked(() => {
          this.cursoHistorial.set([]);
          this.historialLoaded.set(false);
          this.loadHistorialCurso();
        });
      }
    });
  }

  ngOnInit() {
    this.store.course$(this.courseId()).subscribe(c => {
      if (c) this.courseAnio.set(c.anio ?? null);
    });
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
      },
      error: () => { this.toastr.error('Error al cargar curso'); this.loading.set(false); },
    });
  }

  onViewChange(mode: 'hoy' | 'historial') {
    this.viewMode.set(mode);
    if (mode === 'historial' && this.showHistorialCurso && !this.historialLoaded()) {
      this.cursoHistorial.set([]);
      this.loadHistorialCurso();
    }
  }

  /** Limpia ambos filtros de fecha */
  limpiarFechas() {
    this.filtroDesde.set(null);
    this.filtroHasta.set(null);
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
          const exist = byAlumno.get(a.id ?? '');
          const ui = exist ? fromBackendEstado(exist.estado, exist.observacion) : null;
          return {
            alumnoId: a.id ?? '',
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
      error: () => { this.toastr.error('Error al cargar lista'); this.loading.set(false); },
    });
  }

  loadHistorialCurso() {
    const bim = this.bimFiltro.bimestre();
    const pid = this.periodoActivoId();

    // Bimestre seleccionado pero ese periodo no existe en BD → vacío inmediato
    if (bim !== null && !pid) {
      this.cursoHistorial.set([]);
      this.historialLoaded.set(true);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    let url = `asistencias/curso/${this.courseId()}?limit=500`;
    if (pid) url += `&periodo_id=${pid}`;

    const desde = this.filtroDesde()?.toISOString().substring(0, 10) ?? null;
    const hasta = this.filtroHasta()?.toISOString().substring(0, 10) ?? null;
    if (desde) url += `&desde=${desde}`;
    if (hasta) url += `&hasta=${hasta}`;

    this.api.get<AsistenciaCurso[]>(url).subscribe({
      next: r => {
        this.cursoHistorial.set(r.data ?? []);
        this.historialLoaded.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.cursoHistorial.set([]);
        this.historialLoaded.set(true);
        this.loading.set(false);
      },
    });
  }

  loadMiHistorial() {
    this.loading.set(true);
    const pid = this.periodoActivoId();
    let url = `asistencias/curso/alumno/${this.auth.currentUser()?.id}?cursoId=${this.courseId()}`;
    if (pid) url += `&periodo_id=${pid}`;
    this.api.get<AsistenciaCurso[]>(url).subscribe({
      next: r => { this.miHistorial.set(r.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  exportarExcel() {
    const cid = this.courseId();
    const pid = this.periodoActivoId();
    const desde = this.filtroDesde()?.toISOString().substring(0, 10) ?? null;
    const hasta = this.filtroHasta()?.toISOString().substring(0, 10) ?? null;

    this.toastr.info('Generando Excel...');
    const params: Record<string, string> = { curso_id: cid };
    if (pid) params['periodo_id'] = pid;
    if (desde) params['desde'] = desde;
    if (hasta) params['hasta'] = hasta;

    this.api.getBlob('reports/asistencias/excel', params).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Asistencia_${new Date().getTime()}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.toastr.error('Error al generar Excel'),
    });
  }

  setEstado(payload: { alumnoId: string; estado: EstadoAsistencia }) {
    this.roster.update(rows =>
      rows.map(r => r.alumnoId === payload.alumnoId ? { ...r, estado: payload.estado, dirty: true } : r),
    );
  }

  setObs(payload: { alumnoId: string; valor: string }) {
    this.roster.update(rows =>
      rows.map(r => r.alumnoId === payload.alumnoId ? { ...r, observacion: payload.valor, dirty: true } : r),
    );
  }

  marcarTodos(estado: EstadoAsistencia) {
    this.roster.update(rows => rows.map(r => ({ ...r, estado, dirty: true })));
  }

  guardar() {
    const dirtyRows = this.roster().filter(r => r.dirty);
    if (!dirtyRows.length) return;
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
        if (this.viewMode() === 'historial') this.loadHistorialCurso();
      },
      error: () => this.saving.set(false),
    });
  }
}