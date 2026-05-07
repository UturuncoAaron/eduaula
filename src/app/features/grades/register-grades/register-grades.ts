import {
  ChangeDetectionStrategy, Component, effect,
  inject, signal, computed, OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { PeriodoService } from '../../../core/services/periodo';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { GradeBadge } from '../../../shared/components/grade-badge/grade-badge';
import { UserAvatar } from '../../../shared/components/user-avatar/user-avatar';
import { NewActividadDialog,NewActividadResult } from './new-actividad-dialog/new-actividad-dialog';


type TipoNota =
  | 'tarea' | 'practica'
  | 'participacion' | 'proyecto' | 'otro';

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
  alumno: {
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
  };
  notas: Record<string, CellGrade | null>;
  promedio: number | null;
}

interface CourseGridResponse {
  curso_id: string;
  periodo_id: number;
  actividades: Actividad[];
  filas: GradeRow[];
}

interface PendingChange {
  row: GradeRow;
  titulo: string;
  act: Actividad;
}

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
  selector: 'app-register-grades',
  imports: [
    FormsModule, RouterLink,
    MatDialogModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatTooltipModule, MatMenuModule,
    PageHeader, EmptyState, GradeBadge, UserAvatar,
  ],
  templateUrl: './register-grades.html',
  styleUrl: './register-grades.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterGrades implements OnInit {
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  readonly periodoService = inject(PeriodoService);

  readonly TIPO_LABEL = TIPO_LABEL;
  readonly TIPO_ICON = TIPO_ICON;
  readonly TIPO_COLOR = TIPO_COLOR;

  // Datos
  filas = signal<GradeRow[]>([]);
  actividades = signal<Actividad[]>([]);
  loading = signal(true);

  // Vista: null = lista de actividades, otherwise = editor de esa actividad
  vistaActividad = signal<Actividad | null>(null);

  // Saving / dirty state
  pendingChanges = signal<Map<string, PendingChange>>(new Map());
  savingBulk = signal(false);

  // Curso / periodo
  cursoId = signal('');
  cursoNombre = signal('');
  bimestre = signal(1);
  periodoId = signal(1);

  hasActividades = computed(() => this.actividades().length > 0);
  hasAlumnos = computed(() => this.filas().length > 0);
  hasPendingChanges = computed(() => this.pendingChanges().size > 0);
  pendingCount = computed(() => this.pendingChanges().size);

  /** Lista de actividades con stats (count, promedio, fecha) */
  actividadesConStats = computed<ActividadStats[]>(() => {
    const total = this.filas().length;
    return this.actividades().map(act => {
      const cells = this.filas()
        .map(f => f.notas[act.titulo])
        .filter((c): c is CellGrade => !!c);
      const conNota = cells.filter(c => c.nota != null);
      const promedio = conNota.length === 0
        ? null
        : Math.round(
          (conNota.reduce((a, b) => a + (b.nota ?? 0), 0) / conNota.length) * 100,
        ) / 100;
      const fecha = cells.find(c => c.fecha)?.fecha ?? null;
      return {
        ...act,
        total,
        conNota: conNota.length,
        promedio,
        fecha,
      };
    });
  });

  constructor() {
    // Cuando los periodos terminen de cargar, ajustar el bimestre actual
    // si el queryParam apuntaba a uno no-activo o inválido.
    effect(() => {
      if (!this.periodoService.loaded()) return;
      const activos = this.periodoService.activos();
      if (activos.length === 0) return;
      const current = this.periodoId();
      const isValid = Number.isFinite(current)
        && activos.some(p => p.id === current);
      if (!isValid) {
        this.periodoId.set(activos[0].id);
        this.bimestre.set(activos[0].bimestre);
        if (this.cursoId()) this.loadGrades();
      }
    });
  }

  ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    const rawBimestre = parseInt(qp.get('bimestre') ?? '1', 10);
    const bimestre = Number.isFinite(rawBimestre) ? rawBimestre : 1;
    const rawPeriodo = parseInt(qp.get('periodoId') ?? String(bimestre), 10);
    const periodo = Number.isFinite(rawPeriodo) ? rawPeriodo : bimestre;

    this.cursoId.set(qp.get('cursoId') ?? '');
    this.bimestre.set(bimestre);
    this.periodoId.set(periodo);
    this.cursoNombre.set(qp.get('cursoNombre') ?? 'Curso');

    // Singleton service: si ya cargó antes, es no-op
    this.periodoService.loadAll();

    if (!this.cursoId()) {
      this.loading.set(false);
      return;
    }

    this.loadGrades();
  }

  onPeriodoChange(nuevo: number) {
    if (this.hasPendingChanges()) {
      if (!confirm(
        `Hay ${this.pendingCount()} cambios sin guardar. ` +
        `¿Cambiar de bimestre y descartarlos?`,
      )) {
        return;
      }
    }
    this.periodoId.set(nuevo);
    const p = this.periodoService.porId(nuevo);
    if (p) this.bimestre.set(p.bimestre);
    this.pendingChanges.set(new Map());
    this.vistaActividad.set(null);
    this.loadGrades();
  }

  // ── Carga de grilla ────────────────────────────────

  loadGrades() {
    const cursoId = this.cursoId();
    const periodoId = this.periodoId();
    if (!cursoId || !Number.isFinite(periodoId)) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.api
      .get<CourseGridResponse>(
        `grades/course/${cursoId}?periodoId=${periodoId}`,
      )
      .subscribe({
        next: r => {
          const data = (r as any).data as CourseGridResponse | undefined;
          this.actividades.set(data?.actividades ?? []);
          this.filas.set(data?.filas ?? []);
          this.loading.set(false);
        },
        error: err => {
          console.error('Error al cargar notas', err);
          this.actividades.set([]);
          this.filas.set([]);
          this.loading.set(false);
          this.toastr.error(
            err?.error?.message?.message ??
            err?.error?.message ??
            'No se pudieron cargar las notas',
            'Error',
          );
        },
      });
  }

  // ── Navegación entre vistas ────────────────────────

  abrirEditor(act: Actividad) {
    this.vistaActividad.set(act);
  }

  volverALista() {
    if (this.hasPendingChanges()) {
      if (!confirm(
        `Hay ${this.pendingCount()} cambios sin guardar. ` +
        `¿Salir y descartarlos?`,
      )) {
        return;
      }
    }
    this.pendingChanges.set(new Map());
    this.loadGrades();
    this.vistaActividad.set(null);
  }

  // ── Helpers de celda ───────────────────────────────

  cellKey(row: GradeRow, titulo: string) {
    return `${row.alumno_id}::${titulo}`;
  }
  cellNota(row: GradeRow, titulo: string) {
    return row.notas[titulo]?.nota ?? null;
  }
  isCellDirty(row: GradeRow, titulo: string) {
    return this.pendingChanges().has(this.cellKey(row, titulo));
  }

  onCellInput(row: GradeRow, titulo: string, raw: string) {
    const num = raw === '' ? null : Number(raw);
    if (num !== null && (Number.isNaN(num) || num < 0 || num > 20)) return;

    const cell = row.notas[titulo] ?? {
      nota: null, observaciones: null, fecha: null,
    };
    row.notas[titulo] = { ...cell, nota: num };
    row.promedio = this.computeAvg(row);

    const act = this.actividades().find(a => a.titulo === titulo);
    if (!act) return;

    const key = this.cellKey(row, titulo);
    const map = new Map(this.pendingChanges());
    map.set(key, { row, titulo, act });
    this.pendingChanges.set(map);

    this.filas.set([...this.filas()]);
  }

  private computeAvg(row: GradeRow): number | null {
    const valores = Object.values(row.notas)
      .map(c => c?.nota ?? null)
      .filter((v): v is number => v != null);
    if (valores.length === 0) return null;
    return Math.round(
      (valores.reduce((a, b) => a + b, 0) / valores.length) * 100,
    ) / 100;
  }

  // ── Guardar / descartar cambios ────────────────────

  guardarCambios() {
    const changes = [...this.pendingChanges().values()];
    if (changes.length === 0) return;

    const cursoId = this.cursoId();
    const periodoId = this.periodoId();
    const items = changes
      .map(({ row, titulo, act }) => {
        const cell = row.notas[titulo];
        if (!cell) return null;
        if (cell.nota == null && !cell.id) return null;
        return {
          alumno_id: row.alumno_id,
          curso_id: cursoId,
          periodo_id: periodoId,
          titulo,
          tipo: act.tipo,
          nota: cell.nota,
          observaciones: cell.observaciones,
          fecha: cell.fecha,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (items.length === 0) {
      this.toastr.info('No hay notas con valor para guardar', 'Aviso');
      this.pendingChanges.set(new Map());
      return;
    }

    this.savingBulk.set(true);
    this.api
      .post(`grades/course/${cursoId}/bulk`, { items })
      .subscribe({
        next: () => {
          this.savingBulk.set(false);
          this.pendingChanges.set(new Map());
          this.toastr.success(
            `${items.length} ${items.length === 1 ? 'nota guardada' : 'notas guardadas'}`,
            'OK',
          );
          this.loadGrades();
        },
        error: err => {
          this.savingBulk.set(false);
          this.toastr.error(
            err?.error?.message?.message ??
            err?.error?.message ??
            'Error al guardar',
            'Error',
          );
        },
      });
  }

  descartarCambios() {
    if (!confirm(
      `¿Descartar los ${this.pendingCount()} cambios sin guardar?`,
    )) return;
    this.pendingChanges.set(new Map());
    this.loadGrades();
  }

  // ── Crear actividad ────────────────────────────────

  newActividad() {
    if (this.hasPendingChanges()) {
      if (!confirm(
        `Hay ${this.pendingCount()} cambios sin guardar. ` +
        `¿Crear una nueva actividad y descartarlos?`,
      )) {
        return;
      }
      this.pendingChanges.set(new Map());
      this.loadGrades();
    }

    const ref = this.dialog.open(NewActividadDialog, {
      data: { existing: this.actividades().map(a => a.titulo) },
      width: '440px',
    });
    ref.afterClosed().subscribe((res?: NewActividadResult) => {
      if (!res) return;
      const nueva: Actividad = { titulo: res.titulo, tipo: res.tipo };
      this.actividades.set([...this.actividades(), nueva]);
      const filas = this.filas().map(f => ({
        ...f,
        notas: {
          ...f.notas,
          [nueva.titulo]: { nota: null, observaciones: null, fecha: res.fecha },
        },
      }));
      this.filas.set(filas);
      this.toastr.success(`Actividad "${res.titulo}" creada`, 'OK');
      this.vistaActividad.set(nueva);
    });
  }

  // ── Eliminar actividad ─────────────────────────────

  deleteActividad(titulo: string, ev?: Event) {
    ev?.stopPropagation();
    if (!confirm(`¿Eliminar la actividad "${titulo}" y todas sus notas?`)) return;

    const filas = this.filas();
    const ids = filas
      .map(f => f.notas[titulo]?.id)
      .filter((id): id is string => !!id);

    const removeLocal = () => {
      this.actividades.set(
        this.actividades().filter(a => a.titulo !== titulo),
      );
      const next = filas.map(f => {
        const { [titulo]: _omit, ...rest } = f.notas;
        return {
          ...f,
          notas: rest,
          promedio: this.computeAvgFromNotas(rest),
        };
      });
      this.filas.set(next);
      const map = new Map(this.pendingChanges());
      for (const key of [...map.keys()]) {
        if (key.endsWith(`::${titulo}`)) map.delete(key);
      }
      this.pendingChanges.set(map);
      if (this.vistaActividad()?.titulo === titulo) {
        this.vistaActividad.set(null);
      }
      this.toastr.success(`Actividad "${titulo}" eliminada`, 'OK');
    };

    if (ids.length === 0) { removeLocal(); return; }
    Promise.all(
      ids.map(id =>
        this.api.delete(`grades/${id}`).toPromise().catch(() => null),
      ),
    ).then(removeLocal);
  }

  private computeAvgFromNotas(notas: Record<string, CellGrade | null>) {
    const valores = Object.values(notas)
      .map(c => c?.nota ?? null)
      .filter((v): v is number => v != null);
    if (valores.length === 0) return null;
    return Math.round(
      (valores.reduce((a, b) => a + b, 0) / valores.length) * 100,
    ) / 100;
  }

  // ── Helpers UI ─────────────────────────────────────

  alumnoFullName(row: GradeRow): string {
    const a = row.alumno;
    const ap2 = a.apellido_materno ? ` ${a.apellido_materno}` : '';
    return `${a.apellido_paterno}${ap2}, ${a.nombre}`;
  }
}
