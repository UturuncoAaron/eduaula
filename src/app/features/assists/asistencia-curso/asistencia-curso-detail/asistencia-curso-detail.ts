import {
    Component, OnInit, computed, effect, inject, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import {
    MatButtonToggleChange, MatButtonToggleModule,
} from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../core/services/api';
import { CourseService } from '../../../courses/stores/course';
import { AssistsStore } from '../../stores/assists.store';
import {
    AsistenciaCursoRecord, BulkAsistenciaPayload,
    EstadoAsistencia, ESTADOS_ASISTENCIA,
    ESTADO_ASISTENCIA_COLOR, ESTADO_ASISTENCIA_ICON, ESTADO_ASISTENCIA_LABEL,
} from '../../../../core/models/asistencia';
import { Course } from '../../../../core/models/course';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';

/** Datos mínimos del alumno mostrados en la fila de asistencia. */
interface AlumnoMatricula {
    alumno_id: string;
    codigo_estudiante: string | null;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    foto_url: string | null;
}

/** Una fila editable: alumno + estado actual + observación. */
interface AsistenciaRow extends AlumnoMatricula {
    /** id del registro en BD si ya existe; null si todavía no se guardó. */
    recordId: string | null;
    estado: EstadoAsistencia;
    observacion: string;
}

type Filtro = 'todos' | EstadoAsistencia;

/** Shape laxo del payload de `courses/seccion/:id/students`. */
interface RawStudent {
    id?: string;
    alumno_id?: string;
    nombre?: string;
    apellido_paterno?: string;
    apellido_materno?: string | null;
    codigo_estudiante?: string | null;
    foto_url?: string | null;
    alumno?: {
        id?: string;
        nombre?: string;
        apellido_paterno?: string;
        apellido_materno?: string | null;
        codigo_estudiante?: string | null;
        foto_url?: string | null;
    } | null;
}

/**
 * Pasa lista de un curso para una fecha determinada.
 *
 * Flujo:
 *  1. Carga el curso (para conocer su `seccion_id`).
 *  2. En paralelo: trae los alumnos matriculados de la sección y los registros
 *     de asistencia ya existentes para la fecha seleccionada.
 *  3. Une ambos: si existe registro, usa su estado/observación; si no, default
 *     a `'asistio'` (escenario típico: el docente solo marca las excepciones).
 *  4. Al guardar, envía el bulk completo a `POST /asistencias/curso/:id/bulk`.
 *     El backend hace upsert por `(alumno_id, curso_id, fecha)` así que
 *     re-enviar todo es seguro y simple.
 */
@Component({
    selector: 'app-asistencia-curso-detail',
    standalone: true,
    imports: [
        FormsModule,
        MatCardModule, MatIconModule, MatButtonModule, MatButtonToggleModule,
        MatFormFieldModule, MatInputModule,
        MatDatepickerModule, MatNativeDateModule,
        MatProgressSpinnerModule, MatTooltipModule, MatMenuModule,
        PageHeader, EmptyState,
    ],
    templateUrl: './asistencia-curso-detail.html',
    styleUrl: './asistencia-curso-detail.scss',
})
export class AsistenciaCursoDetail implements OnInit {
    private route = inject(ActivatedRoute);
    private api = inject(ApiService);
    private store = inject(AssistsStore);
    private courseService = inject(CourseService);
    private toastr = inject(ToastService);

    readonly ESTADOS = ESTADOS_ASISTENCIA;
    readonly ESTADO_LABEL = ESTADO_ASISTENCIA_LABEL;
    readonly ESTADO_ICON = ESTADO_ASISTENCIA_ICON;
    readonly ESTADO_COLOR = ESTADO_ASISTENCIA_COLOR;

    readonly cursoId = signal<string>('');
    readonly curso = signal<Course | null>(null);

    /** Fecha como Date (para MatDatepicker). El ISO se deriva en `fechaIso`. */
    readonly fechaDate = signal<Date>(this.startOfToday());
    readonly fechaIso = computed(() => this.toIsoDate(this.fechaDate()));

    readonly rows = signal<AsistenciaRow[]>([]);
    readonly loading = signal(true);
    readonly saving = signal(false);
    readonly filtro = signal<Filtro>('todos');

    readonly hoy = this.startOfToday();
    readonly esFutura = computed(() => this.fechaDate().getTime() > this.hoy.getTime());

    readonly contadores = computed(() => {
        const acc: Record<EstadoAsistencia, number> = {
            asistio: 0, falta: 0, tardanza: 0, justificado: 0,
        };
        for (const r of this.rows()) acc[r.estado]++;
        return acc;
    });
    readonly total = computed(() => this.rows().length);
    readonly filasFiltradas = computed(() => {
        const f = this.filtro();
        return f === 'todos' ? this.rows() : this.rows().filter(r => r.estado === f);
    });

    constructor() {
        // Recargar cuando cambian cursoId o fecha. El primer disparo es el load
        // inicial cuando el ngOnInit setea cursoId.
        effect(() => {
            const id = this.cursoId();
            const fecha = this.fechaIso();
            if (id && fecha) this.cargar();
        });
    }

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('cursoId') ?? '';
        if (!id) {
            this.loading.set(false);
            return;
        }
        this.cursoId.set(id);
    }

    // ─── Carga ─────────────────────────────────────────────────────────

    async cargar(): Promise<void> {
        const cursoId = this.cursoId();
        const fecha = this.fechaIso();
        if (!cursoId || !fecha) return;

        this.loading.set(true);
        try {
            const curso = await this.ensureCurso(cursoId);
            const seccionId = curso?.seccion_id ? String(curso.seccion_id) : null;
            if (!seccionId) {
                this.toastr.error('El curso no tiene sección asignada.', 'Error');
                this.rows.set([]);
                return;
            }

            const [studentsRes, attendanceRes] = await Promise.all([
                firstValueFrom(this.api.get<RawStudent[]>(`courses/seccion/${seccionId}/students`)),
                firstValueFrom(this.store.classListByCurso(cursoId, { fecha, limit: 500 })),
            ]);

            const alumnos = (studentsRes?.data ?? []).map(this.mapAlumno);
            const records = (attendanceRes?.data ?? []) as AsistenciaCursoRecord[];
            const byAlumno = new Map(records.map(r => [r.alumno_id, r] as const));

            const rows: AsistenciaRow[] = alumnos.map(a => {
                const rec = byAlumno.get(a.alumno_id);
                return {
                    ...a,
                    recordId: rec?.id ?? null,
                    estado: rec?.estado ?? 'asistio',
                    observacion: rec?.observacion ?? '',
                };
            });
            this.ordenar(rows);
            this.rows.set(rows);
        } catch (err: unknown) {
            console.error('[asistencia-curso] cargar', err);
            this.toastr.error(this.errorMessage(err, 'No se pudo cargar la asistencia'), 'Error');
            this.rows.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    private async ensureCurso(cursoId: string): Promise<Course | null> {
        const cur = this.curso();
        if (cur && cur.id === cursoId) return cur;
        try {
            const r = await firstValueFrom(this.courseService.getCourse(cursoId));
            const c = r?.data ?? null;
            this.curso.set(c);
            return c;
        } catch {
            return null;
        }
    }

    // ─── Handlers UI ───────────────────────────────────────────────────

    onEstadoChange(alumnoId: string, ev: MatButtonToggleChange) {
        this.setEstado(alumnoId, ev.value as EstadoAsistencia);
    }

    setEstado(alumnoId: string, estado: EstadoAsistencia) {
        this.rows.update(rs =>
            rs.map(r => r.alumno_id === alumnoId ? { ...r, estado } : r),
        );
    }

    setObservacion(alumnoId: string, observacion: string) {
        this.rows.update(rs =>
            rs.map(r => r.alumno_id === alumnoId ? { ...r, observacion } : r),
        );
    }

    marcarTodos(estado: EstadoAsistencia) {
        this.rows.update(rs => rs.map(r => ({ ...r, estado })));
    }

    setFiltro(f: Filtro) {
        this.filtro.set(f);
    }

    onFechaChange(d: Date | null) {
        if (!d) return;
        // Normalizamos a inicio del día en zona horaria local para que el ISO no
        // se desplace por TZ.
        const normalized = new Date(d);
        normalized.setHours(0, 0, 0, 0);
        this.fechaDate.set(normalized);
    }

    // ─── Guardar ───────────────────────────────────────────────────────

    async guardar(): Promise<void> {
        if (this.esFutura()) {
            this.toastr.warning('No puedes registrar asistencia en una fecha futura.', 'Aviso');
            return;
        }
        if (this.rows().length === 0) {
            this.toastr.info('No hay alumnos para registrar.', 'Aviso');
            return;
        }

        const cursoId = this.cursoId();
        const fecha = this.fechaIso();
        if (!cursoId || !fecha) return;

        this.saving.set(true);
        try {
            const body: BulkAsistenciaPayload = {
                fecha,
                alumnos: this.rows().map(r => ({
                    alumno_id: r.alumno_id,
                    estado: r.estado,
                    observacion: r.observacion?.trim() ? r.observacion.trim() : undefined,
                })),
            };
            const res = await firstValueFrom(this.store.classBulk(cursoId, body));
            const n = res?.data?.registrados ?? this.rows().length;
            this.toastr.success(`Asistencia guardada (${n} alumnos).`, 'Éxito');
            // Recargar para tomar IDs y datos canónicos del backend.
            await this.cargar();
        } catch (err: unknown) {
            console.error('[asistencia-curso] guardar', err);
            this.toastr.error(this.errorMessage(err, 'No se pudo guardar'), 'Error');
        } finally {
            this.saving.set(false);
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────────

    iniciales(r: AlumnoMatricula): string {
        const a = (r.apellido_paterno?.[0] ?? '').toUpperCase();
        const n = (r.nombre?.[0] ?? '').toUpperCase();
        return `${a}${n}` || 'A';
    }

    fullName(r: AlumnoMatricula): string {
        const apellidos = [r.apellido_paterno, r.apellido_materno]
            .filter((s): s is string => !!s && s.trim().length > 0)
            .join(' ');
        return `${apellidos}, ${r.nombre}`.trim();
    }

    private mapAlumno = (e: RawStudent): AlumnoMatricula => ({
        alumno_id: e.alumno?.id ?? e.alumno_id ?? e.id ?? '',
        codigo_estudiante: e.alumno?.codigo_estudiante ?? e.codigo_estudiante ?? null,
        nombre: e.alumno?.nombre ?? e.nombre ?? '',
        apellido_paterno: e.alumno?.apellido_paterno ?? e.apellido_paterno ?? '',
        apellido_materno: e.alumno?.apellido_materno ?? e.apellido_materno ?? null,
        foto_url: e.alumno?.foto_url ?? e.foto_url ?? null,
    });

    private ordenar(rows: AsistenciaRow[]): void {
        rows.sort((a, b) => {
            const ap = (a.apellido_paterno ?? '').localeCompare(b.apellido_paterno ?? '', 'es');
            if (ap !== 0) return ap;
            const am = (a.apellido_materno ?? '').localeCompare(b.apellido_materno ?? '', 'es');
            if (am !== 0) return am;
            return (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es');
        });
    }

    private startOfToday(): Date {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /** YYYY-MM-DD en zona horaria local (no UTC). */
    private toIsoDate(d: Date): string {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    private errorMessage(err: unknown, fallback: string): string {
        const e = err as { error?: { message?: string | { message?: string } } } | null;
        const m = e?.error?.message;
        if (typeof m === 'string') return m;
        if (m && typeof m === 'object' && typeof m.message === 'string') return m.message;
        return fallback;
    }
}
