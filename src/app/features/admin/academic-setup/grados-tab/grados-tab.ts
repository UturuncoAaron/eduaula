import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ApiService } from '../../../../core/services/api';
import type { GradeLevel, Section, Course } from '../../../../core/models/academic';

@Component({
    selector: 'app-grados-tab',
    standalone: true,
    imports: [
        MatButtonModule, MatIconModule, MatTableModule,
        MatSnackBarModule, MatProgressSpinnerModule,
        MatTooltipModule, MatPaginatorModule, ReactiveFormsModule,
    ],
    templateUrl: './grados-tab.html',
    styleUrl: './grados-tab.scss',
})
export class GradosTab implements OnInit {
    private api = inject(ApiService);
    private snack = inject(MatSnackBar);
    private dialog = inject(MatDialog);

    // ── Estado principal ──────────────────────────────────────────
    grados = signal<GradeLevel[]>([]);
    secciones = signal<Section[]>([]);
    cursos = signal<Course[]>([]);

    loadingGrados = signal(true);
    loadingSecciones = signal(false);
    loadingCursos = signal(false);

    selectedGrado = signal<GradeLevel | null>(null);
    selectedSeccion = signal<Section | null>(null);
    periodoActivo = signal<number | null>(null);

    cursoCols = ['nombre', 'docente', 'estado', 'acciones'];

    // ── Alumnos ───────────────────────────────────────────────────
    alumnos = signal<any[]>([]);
    loadingAlumnos = signal(false);
    alumnoSearch = new FormControl('');
    alumnoPage = signal(0);
    alumnoPageSize = signal(10);

    alumnosFiltrados = computed(() => {
        const q = this.alumnoSearch.value?.toLowerCase().trim() ?? '';
        return this.alumnos().filter(a =>
            !q || `${a.nombre} ${a.apellido_paterno} ${a.codigo_estudiante}`.toLowerCase().includes(q)
        );
    });

    alumnosPaginados = computed(() => {
        const start = this.alumnoPage() * this.alumnoPageSize();
        return this.alumnosFiltrados().slice(start, start + this.alumnoPageSize());
    });

    alumnosIds = computed(() => this.alumnos().map(a => a.alumno_id ?? a.id));

    // ── Computed ──────────────────────────────────────────────────
    seccionesDelGrado = computed(() =>
        this.secciones().filter(s => s.grado_id === this.selectedGrado()?.id)
    );

    cursosDeSeccion = computed(() =>
        this.cursos().filter(c => c.seccion_id === this.selectedSeccion()?.id)
    );

    seccionesPorGrado = computed(() => {
        const map = new Map<number, number>();
        this.secciones().forEach(s =>
            map.set(s.grado_id, (map.get(s.grado_id) ?? 0) + 1)
        );
        return map;
    });

    capacidad = computed(() => this.selectedSeccion()?.capacidad ?? 35);
    ocupacion = computed(() => this.alumnos().length);
    porcentaje = computed(() => Math.round((this.ocupacion() / this.capacidad()) * 100));

    // ── Init ──────────────────────────────────────────────────────
    ngOnInit() {
        this.loadingGrados.set(true);
        this.loadingSecciones.set(true);

        forkJoin({
            grados: this.api.get<GradeLevel[]>('academic/grados'),
            secciones: this.api.get<Section[]>('academic/secciones'),
            periodos: this.api.get<any[]>('academic/periodos'),
        }).subscribe({
            next: ({ grados, secciones, periodos }) => {
                this.grados.set(grados.data ?? []);
                this.secciones.set(secciones.data ?? []);
                const activo = (periodos.data as any[]).find(p => p.activo);
                this.periodoActivo.set(activo?.id ?? null);
                this.loadingGrados.set(false);
                this.loadingSecciones.set(false);
            },
            error: () => {
                this.loadingGrados.set(false);
                this.loadingSecciones.set(false);
                this.snack.open('Error al cargar datos académicos', 'Cerrar', { duration: 3000 });
            },
        });

        // Búsqueda reactiva de alumnos con debounce
        this.alumnoSearch.valueChanges.pipe(
            debounceTime(200),
            distinctUntilChanged(),
        ).subscribe(() => this.alumnoPage.set(0));
    }

    // ── Loaders ───────────────────────────────────────────────────
    private reloadSecciones() {
        this.loadingSecciones.set(true);
        this.api.get<Section[]>('academic/secciones').subscribe({
            next: r => { this.secciones.set(r.data ?? []); this.loadingSecciones.set(false); },
            error: () => this.loadingSecciones.set(false),
        });
    }

    loadCursosDeSeccion(seccionId: number) {
        this.loadingCursos.set(true);
        this.api.get<Course[]>(`courses?seccion_id=${seccionId}`).subscribe({
            next: r => { this.cursos.set(r.data ?? []); this.loadingCursos.set(false); },
            error: () => this.loadingCursos.set(false),
        });
    }

    loadAlumnosDeSeccion(seccionId: number) {
        this.loadingAlumnos.set(true);
        this.alumnos.set([]);
        this.alumnoSearch.setValue('', { emitEvent: false });
        this.alumnoPage.set(0);

        this.api.get<any[]>(`courses/seccion/${seccionId}/students`).subscribe({
            next: (res) => {
                const raw = (res as any).data ?? [];
                this.alumnos.set(raw.map((e: any) => ({
                    id: e.id,
                    alumno_id: e.alumno_id ?? e.alumno?.id ?? e.id,
                    nombre: e.alumno?.nombre ?? e.nombre ?? '',
                    apellido_paterno: e.alumno?.apellido_paterno ?? e.apellido_paterno ?? '',
                    apellido_materno: e.alumno?.apellido_materno ?? e.apellido_materno,
                    codigo_estudiante: e.alumno?.codigo_estudiante ?? e.codigo_estudiante ?? '',
                    activo: e.activo ?? true,
                })));
                this.loadingAlumnos.set(false);
            },
            error: () => this.loadingAlumnos.set(false),
        });
    }

    // ── Navegación ────────────────────────────────────────────────
    selectGrado(g: GradeLevel) {
        if (this.selectedGrado()?.id === g.id) {
            this.selectedGrado.set(null);
            this.selectedSeccion.set(null);
            this.cursos.set([]);
            this.alumnos.set([]);
        } else {
            this.selectedGrado.set(g);
            this.selectedSeccion.set(null);
            this.cursos.set([]);
            this.alumnos.set([]);
        }
    }

    selectSeccion(s: Section) {
        if (this.selectedSeccion()?.id === s.id) {
            this.selectedSeccion.set(null);
            this.cursos.set([]);
            this.alumnos.set([]);
        } else {
            this.selectedSeccion.set(s);
            // Carga cursos y alumnos en paralelo
            forkJoin({
                cursos: this.api.get<Course[]>(`courses?seccion_id=${s.id}`),
                alumnos: this.api.get<any[]>(`courses/seccion/${s.id}/students`),
            }).subscribe({
                next: ({ cursos, alumnos }) => {
                    this.cursos.set((cursos as any).data ?? []);
                    const raw = (alumnos as any).data ?? [];
                    this.alumnos.set(raw.map((e: any) => ({
                        id: e.id,
                        alumno_id: e.alumno_id ?? e.alumno?.id ?? e.id,
                        nombre: e.alumno?.nombre ?? '',
                        apellido_paterno: e.alumno?.apellido_paterno ?? '',
                        apellido_materno: e.alumno?.apellido_materno,
                        codigo_estudiante: e.alumno?.codigo_estudiante ?? '',
                        activo: e.activo ?? true,
                    })));
                    this.loadingCursos.set(false);
                    this.loadingAlumnos.set(false);
                },
            });
            this.loadingCursos.set(true);
            this.loadingAlumnos.set(true);
        }
    }

    getSeccionCount(gradoId: number): number {
        return this.seccionesPorGrado().get(gradoId) ?? 0;
    }

    onAlumnoPageChange(e: PageEvent) {
        this.alumnoPage.set(e.pageIndex);
        this.alumnoPageSize.set(e.pageSize);
    }

    getInitials(nombre: string, apellido: string): string {
        return `${(nombre[0] ?? '').toUpperCase()}${(apellido[0] ?? '').toUpperCase()}`;
    }

    // ── Dialogs (lazy loaded) ─────────────────────────────────────

    async openCreateSeccion() {
        if (!this.selectedGrado()) return;
        const { CreateSeccionDialog } = await import(
            '../../../../shared/components/create-seccion-dialog/create-seccion-dialog'
        );
        const ref = this.dialog.open(CreateSeccionDialog, {
            width: '480px',
            data: { gradoId: this.selectedGrado()!.id, gradoNombre: this.selectedGrado()!.nombre },
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            this.api.post<any>('academic/secciones', {
                grado_id: this.selectedGrado()!.id,
                nombre: result.nombre,
                capacidad: result.capacidad,
            }).subscribe({
                next: (r) => {
                    this.reloadSecciones();
                    const c = r.data?.cursos?.creados ?? 0;
                    this.snack.open(
                        c > 0 ? `Sección "${result.nombre}" creada · ${c} cursos generados`
                            : `Sección "${result.nombre}" creada`,
                        'OK', { duration: 4000 },
                    );
                },
                error: (err) => this.snack.open(err.error?.message ?? 'Error al crear sección', 'Cerrar', { duration: 3000 }),
            });
        });
    }

    async openAddCourse() {
        const seccion = this.selectedSeccion();
        const grado = this.selectedGrado();
        if (!seccion || !grado) return;
        const pid = this.periodoActivo();
        if (!pid) { this.snack.open('No hay periodo activo', 'Cerrar', { duration: 3000 }); return; }

        const { AddCourseDialog } = await import(
            '../../../../shared/components/add-course-dialog/add-course-dialog'
        );
        const ref = this.dialog.open(AddCourseDialog, {
            width: '500px',
            data: { seccionId: seccion.id, periodoId: pid, seccionNombre: seccion.nombre, gradoNombre: grado.nombre },
        });
        ref.afterClosed().subscribe((c: any) => {
            if (c) this.loadCursosDeSeccion(seccion.id);
        });
    }

    async openAssignDocente(curso: Course) {
        const { AssignDocenteDialog } = await import(
            '../../../../shared/components/assign-docente-dialog/assign-docente-dialog'
        );
        const ref = this.dialog.open(AssignDocenteDialog, {
            width: '480px',
            data: { cursoId: curso.id, cursoNombre: curso.nombre, docenteActualId: curso.docente_id },
        });
        ref.afterClosed().subscribe((docenteId: string | undefined) => {
            if (!docenteId) return;
            this.api.patch(`courses/${curso.id}/assign-teacher`, { docente_id: docenteId }).subscribe({
                next: () => { this.loadCursosDeSeccion(this.selectedSeccion()!.id); this.snack.open('Docente asignado', 'OK', { duration: 2000 }); },
                error: () => this.snack.open('Error al asignar docente', 'Cerrar', { duration: 3000 }),
            });
        });
    }

    async toggleCurso(curso: Course) {
        const { ConfirmDialog } = await import(
            '../../../../shared/components/confirm-dialog/confirm-dialog'
        );
        const ref = this.dialog.open(ConfirmDialog, {
            width: '360px',
            data: {
                title: curso.activo ? '¿Desactivar curso?' : '¿Activar curso?',
                message: `El curso "${curso.nombre}" será ${curso.activo ? 'desactivado' : 'reactivado'}.`,
                confirm: curso.activo ? 'Desactivar' : 'Activar',
                cancel: 'Cancelar', danger: curso.activo,
            },
        });
        ref.afterClosed().subscribe((ok: boolean) => {
            if (!ok) return;
            this.api.patch(`courses/${curso.id}`, { activo: !curso.activo }).subscribe({
                next: () => this.cursos.update(list => list.map(c => c.id === curso.id ? { ...c, activo: !c.activo } : c)),
                error: () => this.snack.open('Error al actualizar curso', 'OK', { duration: 2000 }),
            });
        });
    }

    async openMatricular() {
        const seccion = this.selectedSeccion();
        const grado = this.selectedGrado();
        if (!seccion || !grado) return;
        const pid = this.periodoActivo();
        if (!pid) { this.snack.open('No hay periodo activo', 'Cerrar', { duration: 3000 }); return; }

        const { EnrollAlumnoDialog } = await import(
            '../../../../shared/components/enroll-alumno-dialog/enroll-alumno-dialog'
        );
        const ref = this.dialog.open(EnrollAlumnoDialog, {
            width: '500px',
            data: {
                seccionId: seccion.id, periodoId: pid,
                seccionNombre: seccion.nombre, gradoNombre: grado.nombre,
                alumnosMatriculadosIds: this.alumnosIds(),
            },
        });
        ref.afterClosed().subscribe((enrolled: any) => {
            if (enrolled) this.loadAlumnosDeSeccion(seccion.id);
        });
    }

    async retirarAlumno(alumno: any) {
        const { ConfirmDialog } = await import('../../../../shared/components/confirm-dialog/confirm-dialog');
        const ref = this.dialog.open(ConfirmDialog, {
            width: '380px',
            data: {
                title: '¿Retirar alumno?',
                message: `Se retirará a ${alumno.nombre} ${alumno.apellido_paterno} de la sección "${this.selectedSeccion()?.nombre}".`,
                confirm: 'Retirar', cancel: 'Cancelar', danger: true,
            },
        });
        ref.afterClosed().subscribe((ok: boolean) => {
            if (!ok) return;
            this.api.delete(`courses/enroll/${alumno.id}`).subscribe({
                next: () => {
                    this.alumnos.update(list => list.filter(a => a.id !== alumno.id));
                    this.snack.open(`${alumno.nombre} ${alumno.apellido_paterno} retirado`, 'OK', { duration: 3000 });
                },
                error: () => this.snack.open('Error al retirar alumno', 'Cerrar', { duration: 3000 }),
            });
        });
    }

    async verNotasAlumno(alumno: any) {
        const { AlumnoNotasDialog } = await import(
            '../../../../shared/components/alumno-notas-dialog/alumno-notas-dialog'
        );
        this.dialog.open(AlumnoNotasDialog, {
            width: '700px',
            maxHeight: '90vh',
            data: {
                alumnoId: alumno.alumno_id,
                nombre: `${alumno.apellido_paterno} ${alumno.apellido_materno ?? ''}, ${alumno.nombre}`,
                seccionNombre: this.selectedSeccion()?.nombre,
                gradoNombre: this.selectedGrado()?.nombre,
            },
        });
    }
}