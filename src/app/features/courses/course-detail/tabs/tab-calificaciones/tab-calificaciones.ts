import {
  ChangeDetectionStrategy, Component, effect,
  inject, input, signal, computed, OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatExpansionModule } from '@angular/material/expansion';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../../../core/services/api';
import { AuthService } from '../../../../../core/auth/auth';
import { PeriodoService } from '../../../../../core/services/periodo';
import { GradeBadge } from '../../../../../shared/components/grade-badge/grade-badge';
import { UserAvatar } from '../../../../../shared/components/user-avatar/user-avatar';
import { NewActividadDialog, NewActividadResult } from '../../../../grades/register-grades/new-actividad-dialog/new-actividad-dialog';

// ── Tipos compartidos ──────────────────────────────────────────────────────────

type TipoNota = 'tarea' | 'practica' | 'participacion' | 'proyecto' | 'otro';

interface MiNota {
  id: string;
  titulo: string;
  tipo: TipoNota;
  nota: number | null;
  observaciones: string | null;
  fecha: string | null;
  bimestre: number;
  periodo_nombre: string;
}

interface BimestreAgrupado {
  bimestre: number;
  periodoNombre: string;
  notas: MiNota[];
  promedio: number | null;
}

interface Actividad {
  titulo: string;
  tipo: TipoNota;
}

interface ActividadStats extends Actividad {
  total: number;
  conNota: number;
  promedio: number | null;
  fecha: string | null;
}

interface CellGrade {
  id?: string;
  nota: number | null;
  observaciones: string | null;
  fecha: string | null;
}

interface GradeRow {
  alumno_id: string;
  codigo_estudiante: string | null;
  alumno: { nombre: string; apellido_paterno: string; apellido_materno: string | null };
  notas: Record<string, CellGrade | null>;
  promedio: number | null;
}

interface CourseGridResponse {
  curso_id: string;
  periodo_id: string;
  actividades: Actividad[];
  filas: GradeRow[];
}

interface PendingChange {
  row: GradeRow;
  titulo: string;
  act: Actividad;
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<TipoNota, string> = {
  tarea: 'Tarea', practica: 'Práctica',
  participacion: 'Participación', proyecto: 'Proyecto', otro: 'Otro',
};
const TIPO_ICON: Record<TipoNota, string> = {
  tarea: 'assignment', practica: 'edit_note',
  participacion: 'forum', proyecto: 'rocket_launch', otro: 'star',
};
const TIPO_COLOR: Record<TipoNota, string> = {
  tarea: '#2e7d32', practica: '#ed6c02',
  participacion: '#9c27b0', proyecto: '#d32f2f', otro: '#616161',
};

@Component({
  selector: 'app-tab-calificaciones',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatTooltipModule, MatMenuModule, MatExpansionModule,
    GradeBadge, UserAvatar,
  ],
  templateUrl: './tab-calificaciones.html',
  styleUrl: './tab-calificaciones.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabCalificaciones implements OnInit {
  readonly auth = inject(AuthService);
  readonly periodoService = inject(PeriodoService);
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private dialog = inject(MatDialog);

  courseId = input.required<string>({ alias: 'id' });

  readonly TIPO_LABEL = TIPO_LABEL;
  readonly TIPO_ICON = TIPO_ICON;
  readonly TIPO_COLOR = TIPO_COLOR;

  loading = signal(true);

  // ── Estado alumno ──────────────────────────────────
  misNotas = signal<MiNota[]>([]);

  bimestresAgrupados = computed<BimestreAgrupado[]>(() => {
    const grupos = new Map<number, BimestreAgrupado>();
    for (const n of this.misNotas()) {
      let g = grupos.get(n.bimestre);
      if (!g) {
        g = { bimestre: n.bimestre, periodoNombre: n.periodo_nombre, notas: [], promedio: null };
        grupos.set(n.bimestre, g);
      }
      g.notas.push(n);
    }
    for (const g of grupos.values()) {
      const vals = g.notas.map(n => n.nota).filter((v): v is number => v != null);
      g.promedio = vals.length === 0
        ? null
        : Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
    }
    return [...grupos.values()].sort((a, b) => a.bimestre - b.bimestre);
  });

  // ── Estado docente ─────────────────────────────────
  filas = signal<GradeRow[]>([]);
  actividades = signal<Actividad[]>([]);
  vistaActividad = signal<Actividad | null>(null);
  pendingChanges = signal<Map<string, PendingChange>>(new Map());
  savingBulk = signal(false);
  periodoId = signal<number>(0);

  hasActividades = computed(() => this.actividades().length > 0);
  hasAlumnos = computed(() => this.filas().length > 0);
  hasPendingChanges = computed(() => this.pendingChanges().size > 0);
  pendingCount = computed(() => this.pendingChanges().size);

  actividadesConStats = computed<ActividadStats[]>(() => {
    const total = this.filas().length;
    return this.actividades().map(act => {
      const cells = this.filas()
        .map(f => f.notas[act.titulo])
        .filter((c): c is CellGrade => !!c);
      const conNota = cells.filter(c => c.nota != null);
      const promedio = conNota.length === 0
        ? null
        : Math.round((conNota.reduce((a, b) => a + (b.nota ?? 0), 0) / conNota.length) * 100) / 100;
      return { ...act, total, conNota: conNota.length, promedio, fecha: cells.find(c => c.fecha)?.fecha ?? null };
    });
  });

  constructor() {
    effect(() => {
      if (!this.periodoService.loaded()) return;
      const activos = this.periodoService.activos();
      if (activos.length === 0 || this.periodoId() !== 0) return;
      this.periodoId.set(activos[0].id);
      if (this.auth.isDocente() || this.auth.isAdmin()) {
        this.loadGrades();
      }
    });
  }

  ngOnInit() {
    this.periodoService.loadAll();
    if (this.auth.isAlumno()) {
      this.loadMisNotas();
    } else {
      const activo = this.periodoService.activos()[0];
      if (activo) {
        this.periodoId.set(activo.id);
        this.loadGrades();
      }
    }
  }

  // ── Alumno: cargar mis notas ───────────────────────

  private loadMisNotas() {
    this.loading.set(true);
    this.api.get<MiNota[]>(`grades/my?cursoId=${this.courseId()}`).subscribe({
      next: res => {
        this.misNotas.set((res as any).data ?? []);
        this.loading.set(false);
      },
      error: () => { this.misNotas.set([]); this.loading.set(false); },
    });
  }

  // ── Docente: cargar grilla ─────────────────────────

  loadGrades() {
    const periodoId = this.periodoId();
    if (!periodoId || periodoId === 0) { this.loading.set(false); return; }
    this.loading.set(true);
    this.api.get<CourseGridResponse>(`grades/course/${this.courseId()}?periodoId=${periodoId}`).subscribe({
      next: r => {
        const data = (r as any).data as CourseGridResponse;
        this.actividades.set(data?.actividades ?? []);
        this.filas.set(data?.filas ?? []);
        this.loading.set(false);
      },
      error: err => {
        this.actividades.set([]); this.filas.set([]); this.loading.set(false);
        this.toastr.error(err?.error?.message ?? 'No se pudieron cargar las notas', 'Error');
      },
    });
  }

  onPeriodoChange(nuevo: number) {
    if (this.hasPendingChanges() && !confirm(`Hay ${this.pendingCount()} cambios sin guardar. ¿Cambiar de bimestre y descartarlos?`)) return;
    this.periodoId.set(nuevo);
    this.pendingChanges.set(new Map());
    this.vistaActividad.set(null);
    this.loadGrades();
  }

  // ── Navegación vistas ──────────────────────────────

  abrirEditor(act: Actividad) { this.vistaActividad.set(act); }

  volverALista() {
    if (this.hasPendingChanges() && !confirm(`Hay ${this.pendingCount()} cambios sin guardar. ¿Salir y descartarlos?`)) return;
    this.pendingChanges.set(new Map());
    this.loadGrades();
    this.vistaActividad.set(null);
  }

  // ── Celda helpers ──────────────────────────────────

  cellKey(row: GradeRow, titulo: string) { return `${row.alumno_id}::${titulo}`; }
  cellNota(row: GradeRow, titulo: string) { return row.notas[titulo]?.nota ?? null; }
  isCellDirty(row: GradeRow, titulo: string) { return this.pendingChanges().has(this.cellKey(row, titulo)); }

  onCellInput(row: GradeRow, titulo: string, raw: string) {
    const num = raw === '' ? null : Number(raw);
    if (num !== null && (Number.isNaN(num) || num < 0 || num > 20)) return;
    row.notas[titulo] = { ...(row.notas[titulo] ?? { nota: null, observaciones: null, fecha: null }), nota: num };
    row.promedio = this.computeAvg(row);
    const act = this.actividades().find(a => a.titulo === titulo);
    if (!act) return;
    const map = new Map(this.pendingChanges());
    map.set(this.cellKey(row, titulo), { row, titulo, act });
    this.pendingChanges.set(map);
    this.filas.set([...this.filas()]);
  }

  private computeAvg(row: GradeRow): number | null {
    const vals = Object.values(row.notas).map(c => c?.nota ?? null).filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }

  // ── Guardar / descartar ────────────────────────────

  guardarCambios() {
    const changes = [...this.pendingChanges().values()];
    if (changes.length === 0) return;
    const cursoId = this.courseId();
    const periodoId = this.periodoId();
    const items = changes.map(({ row, titulo, act }) => {
      const cell = row.notas[titulo];
      if (!cell || (cell.nota == null && !cell.id)) return null;
      return { alumno_id: row.alumno_id, curso_id: cursoId, periodo_id: periodoId, titulo, tipo: act.tipo, nota: cell.nota, observaciones: cell.observaciones, fecha: cell.fecha };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    if (items.length === 0) { this.toastr.info('No hay notas con valor para guardar', 'Aviso'); this.pendingChanges.set(new Map()); return; }

    this.savingBulk.set(true);
    this.api.post(`grades/course/${cursoId}/bulk`, { items }).subscribe({
      next: () => {
        this.savingBulk.set(false);
        this.pendingChanges.set(new Map());
        this.toastr.success(`${items.length} ${items.length === 1 ? 'nota guardada' : 'notas guardadas'}`, 'OK');
        this.loadGrades();
      },
      error: err => {
        this.savingBulk.set(false);
        this.toastr.error(err?.error?.message ?? 'Error al guardar', 'Error');
      },
    });
  }

  descartarCambios() {
    if (!confirm(`¿Descartar los ${this.pendingCount()} cambios sin guardar?`)) return;
    this.pendingChanges.set(new Map());
    this.loadGrades();
  }

  // ── Nueva / eliminar actividad ─────────────────────

  newActividad() {
    if (this.hasPendingChanges() && !confirm(`Hay ${this.pendingCount()} cambios sin guardar. ¿Continuar?`)) return;
    this.pendingChanges.set(new Map());
    const ref = this.dialog.open(NewActividadDialog, {
      data: { existing: this.actividades().map(a => a.titulo) },
      width: '440px',
    });
    ref.afterClosed().subscribe((res?: NewActividadResult) => {
      if (!res) return;
      const nueva: Actividad = { titulo: res.titulo, tipo: res.tipo };
      this.actividades.set([...this.actividades(), nueva]);
      this.filas.set(this.filas().map(f => ({
        ...f,
        notas: { ...f.notas, [nueva.titulo]: { nota: null, observaciones: null, fecha: res.fecha } },
      })));
      this.toastr.success(`Actividad "${res.titulo}" creada`, 'OK');
      this.vistaActividad.set(nueva);
    });
  }

  deleteActividad(titulo: string, ev?: Event) {
    ev?.stopPropagation();
    if (!confirm(`¿Eliminar la actividad "${titulo}" y todas sus notas?`)) return;
    const ids = this.filas().map(f => f.notas[titulo]?.id).filter((id): id is string => !!id);
    const removeLocal = () => {
      this.actividades.set(this.actividades().filter(a => a.titulo !== titulo));
      this.filas.set(this.filas().map(f => {
        const { [titulo]: _omit, ...rest } = f.notas;
        return { ...f, notas: rest, promedio: this.computeAvgFromNotas(rest) };
      }));
      const map = new Map(this.pendingChanges());
      for (const key of [...map.keys()]) { if (key.endsWith(`::${titulo}`)) map.delete(key); }
      this.pendingChanges.set(map);
      if (this.vistaActividad()?.titulo === titulo) this.vistaActividad.set(null);
      this.toastr.success(`Actividad "${titulo}" eliminada`, 'OK');
    };
    if (ids.length === 0) { removeLocal(); return; }
    Promise.all(ids.map(id => this.api.delete(`grades/${id}`).toPromise().catch(() => null))).then(removeLocal);
  }

  private computeAvgFromNotas(notas: Record<string, CellGrade | null>) {
    const vals = Object.values(notas).map(c => c?.nota ?? null).filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }

  // ── Helpers UI ─────────────────────────────────────

  alumnoFullName(row: GradeRow): string {
    const a = row.alumno;
    return `${a.apellido_paterno}${a.apellido_materno ? ` ${a.apellido_materno}` : ''}, ${a.nombre}`;
  }
}