import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../core/services/api';
import type { GradeLevel, Section, Course } from '../../../../core/models/academic';

type SeccionTab = 'cursos' | 'alumnos' | 'horario';

@Component({
    selector: 'app-grados-tab',
    standalone: true,
    imports: [
        MatButtonModule, MatIconModule, MatProgressSpinnerModule,
        MatTooltipModule, MatPaginatorModule, MatMenuModule, ReactiveFormsModule,
    ],
    templateUrl: './grados-tab.html',
    styleUrl: './grados-tab.scss',
})
export class GradosTab implements OnInit {
    private api = inject(ApiService);
    private toastr = inject(ToastService);
    private dialog = inject(MatDialog);
    private router = inject(Router);

    // ── Estado ────────────────────────────────────────────────────
    grados = signal<GradeLevel[]>([]);
    secciones = signal<Section[]>([]);
    cursos = signal<Course[]>([]);
    alumnos = signal<any[]>([]);

    loadingGrados = signal(true);
    loadingSecciones = signal(false);
    loadingCursos = signal(false);
    loadingAlumnos = signal(false);

    selectedGrado = signal<GradeLevel | null>(null);
    selectedSeccion = signal<Section | null>(null);
    periodoActivo = signal<number | null>(null);
    activeTab = signal<SeccionTab>('cursos');

    alumnoSearch = new FormControl('');
    alumnoPage = signal(0);
    alumnoPageSize = signal(10);

    // ── Computed ──────────────────────────────────────────────────
    seccionesDelGrado = computed(() =>
        this.secciones().filter(s => s.grado_id === this.selectedGrado()?.id),
    );

    cursosDeSeccion = computed(() =>
        this.cursos().filter(c => c.seccion_id === this.selectedSeccion()?.id),
    );

    seccionesPorGrado = computed(() => {
        const map = new Map<number, number>();
        this.secciones().forEach(s => map.set(s.grado_id, (map.get(s.grado_id) ?? 0) + 1));
        return map;
    });

    alumnosFiltrados = computed(() => {
        const q = this.alumnoSearch.value?.toLowerCase().trim() ?? '';
        return this.alumnos().filter(a =>
            !q || `${a.nombre} ${a.apellido_paterno} ${a.codigo_estudiante}`.toLowerCase().includes(q),
        );
    });

    alumnosPaginados = computed(() => {
        const start = this.alumnoPage() * this.alumnoPageSize();
        return this.alumnosFiltrados().slice(start, start + this.alumnoPageSize());
    });

    alumnosIds = computed(() => this.alumnos().map(a => a.alumno_id ?? a.id));
    capacidad = computed(() => this.selectedSeccion()?.capacidad ?? 35);
    ocupacion = computed(() => this.alumnos().length);
    porcentaje = computed(() => Math.round((this.ocupacion() / this.capacidad()) * 100));

    // ── Init ──────────────────────────────────────────────────────
    ngOnInit(): void {
        forkJoin({
            grados: this.api.get<GradeLevel[]>('academic/grados'),
            secciones: this.api.get<Section[]>('academic/secciones'),
            periodos: this.api.get<any[]>('academic/periodos'),
        }).subscribe({
            next: ({ grados, secciones, periodos }) => {
                this.grados.set((grados as any).data ?? []);
                this.secciones.set((secciones as any).data ?? []);
                const activo = ((periodos as any).data as any[]).find(p => p.activo);
                this.periodoActivo.set(activo?.id ?? null);
                this.loadingGrados.set(false);
            },
            error: () => {
                this.loadingGrados.set(false);
                this.toastr.error('Error al cargar datos académicos', 'Error');
            },
        });

        this.alumnoSearch.valueChanges.pipe(
            debounceTime(200), distinctUntilChanged(),
        ).subscribe(() => this.alumnoPage.set(0));
    }

    // ── Tabs ──────────────────────────────────────────────────────
    setTab(tab: SeccionTab): void { this.activeTab.set(tab); }

    // ── Navegación ────────────────────────────────────────────────
    selectGrado(g: GradeLevel): void {
        this.selectedGrado.set(this.selectedGrado()?.id === g.id ? null : g);
        this.selectedSeccion.set(null);
        this.cursos.set([]);
        this.alumnos.set([]);
        this.activeTab.set('cursos');
    }

    selectSeccion(s: Section): void {
        if (this.selectedSeccion()?.id === s.id) {
            this.selectedSeccion.set(null);
            this.cursos.set([]);
            this.alumnos.set([]);
            return;
        }
        this.selectedSeccion.set(s);
        this.activeTab.set('cursos');
        this.loadingCursos.set(true);
        this.loadingAlumnos.set(true);

        forkJoin({
            cursos: this.api.get<Course[]>(`courses?seccion_id=${s.id}`),
            alumnos: this.api.get<any[]>(`courses/seccion/${s.id}/students`),
        }).subscribe({
            next: ({ cursos, alumnos }) => {
                this.cursos.set((cursos as any).data ?? []);
                this.alumnos.set(this.mapAlumnos((alumnos as any).data ?? []));
                this.loadingCursos.set(false);
                this.loadingAlumnos.set(false);
            },
            error: () => {
                this.loadingCursos.set(false);
                this.loadingAlumnos.set(false);
            },
        });
    }

    // ── Reloaders ─────────────────────────────────────────────────
    private reloadSecciones(): void {
        this.loadingSecciones.set(true);
        this.api.get<Section[]>('academic/secciones').subscribe({
            next: r => {
                const data: Section[] = (r as any).data ?? [];
                this.secciones.set(data);
                const cur = this.selectedSeccion();
                if (cur) {
                    const fresh = data.find(s => s.id === cur.id);
                    if (fresh) this.selectedSeccion.set(fresh);
                }
                this.loadingSecciones.set(false);
            },
            error: () => this.loadingSecciones.set(false),
        });
    }

    private reloadCursos(): void {
        const s = this.selectedSeccion();
        if (!s) return;
        this.loadingCursos.set(true);
        this.api.get<Course[]>(`courses?seccion_id=${s.id}`).subscribe({
            next: r => { this.cursos.set((r as any).data ?? []); this.loadingCursos.set(false); },
            error: () => this.loadingCursos.set(false),
        });
    }

    private reloadAlumnos(): void {
        const s = this.selectedSeccion();
        if (!s) return;
        this.loadingAlumnos.set(true);
        this.alumnoSearch.setValue('', { emitEvent: false });
        this.alumnoPage.set(0);
        this.api.get<any[]>(`courses/seccion/${s.id}/students`).subscribe({
            next: r => {
                this.alumnos.set(this.mapAlumnos((r as any).data ?? []));
                this.loadingAlumnos.set(false);
            },
            error: () => this.loadingAlumnos.set(false),
        });
    }

    private mapAlumnos(raw: any[]): any[] {
        return raw.map(e => ({
            id: e.id,
            alumno_id: e.alumno_id ?? e.alumno?.id ?? e.id,
            nombre: e.alumno?.nombre ?? e.nombre ?? '',
            apellido_paterno: e.alumno?.apellido_paterno ?? e.apellido_paterno ?? '',
            apellido_materno: e.alumno?.apellido_materno ?? e.apellido_materno,
            codigo_estudiante: e.alumno?.codigo_estudiante ?? e.codigo_estudiante ?? '',
            activo: e.activo ?? true,
        }));
    }

    // ── Helpers ───────────────────────────────────────────────────
    getSeccionCount(gradoId: number): number { return this.seccionesPorGrado().get(gradoId) ?? 0; }
    getInitials(n: string, a: string): string { return `${n[0] ?? ''}${a[0] ?? ''}`.toUpperCase(); }
    onAlumnoPageChange(e: PageEvent): void { this.alumnoPage.set(e.pageIndex); this.alumnoPageSize.set(e.pageSize); }

    // ══════════════════════════════════════════════════════════════
    // NUEVO: Abrir modal de detalle de sección
    // ══════════════════════════════════════════════════════════════
    async openSeccionModal(s: Section): Promise<void> {
        const { SeccionDetailDialog } = await import(
            '../../../../shared/components/seccion-detail-dialog/seccion-detail-dialog'
        );
        const ref = this.dialog.open(SeccionDetailDialog, {
            width: '720px',
            maxWidth: '96vw',
            maxHeight: '90vh',
            panelClass: 'seccion-detail-panel',
            data: {
                seccion: s,
                gradoNombre: this.selectedGrado()!.nombre,
                periodoId: this.periodoActivo(),
            },
        });
        ref.afterClosed().subscribe(result => {
            if (result === 'reload') this.reloadSecciones();
        });
    }

    // ── Diálogos originales (sin cambios) ─────────────────────────
    async openCreateSeccion(): Promise<void> {
        if (!this.selectedGrado()) return;
        const { CreateSeccionDialog } = await import('../../../../shared/components/create-seccion-dialog/create-seccion-dialog');
        const ref = this.dialog.open(CreateSeccionDialog, {
            width: '480px',
            maxWidth: '95vw',
            panelClass: 'create-seccion-panel',
            data: { gradoId: this.selectedGrado()!.id, gradoNombre: this.selectedGrado()!.nombre },
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            this.api.post<any>('academic/secciones', {
                grado_id: this.selectedGrado()!.id,
                nombre: result.nombre,
                capacidad: result.capacidad,
            }).subscribe({
                next: r => {
                    this.reloadSecciones();
                    const c = r.data?.cursos?.creados ?? 0;
                    this.toastr.success(c > 0 ? `Sección "${result.nombre}" creada · ${c} cursos generados` : `Sección "${result.nombre}" creada`, 'Éxito');
                },
                error: err => this.toastr.error(err.error?.message ?? 'Error al crear sección', 'Error'),
            });
        });
    }

    async openEditSeccion(seccion: Section): Promise<void> {
        if (!this.selectedGrado()) return;
        const { CreateSeccionDialog } = await import('../../../../shared/components/create-seccion-dialog/create-seccion-dialog');
        const ref = this.dialog.open(CreateSeccionDialog, {
            width: '480px',
            maxWidth: '95vw',
            panelClass: 'create-seccion-panel',
            data: {
                gradoId: this.selectedGrado()!.id,
                gradoNombre: this.selectedGrado()!.nombre,
                seccionId: seccion.id,
                nombre: seccion.nombre,
                capacidad: seccion.capacidad,
                alumnosActuales: this.alumnos().length,
            },
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            this.api.patch<any>(`academic/secciones/${seccion.id}`, {
                nombre: result.nombre,
                capacidad: result.capacidad,
            }).subscribe({
                next: () => {
                    this.reloadSecciones();
                    this.toastr.success(`Sección "${result.nombre}" actualizada`, 'Éxito');
                },
                error: err => this.toastr.error(err.error?.message ?? 'Error al actualizar sección', 'Error'),
            });
        });
    }

    async openAddCourse(): Promise<void> {
        const s = this.selectedSeccion(); const g = this.selectedGrado();
        if (!s || !g) return;
        const pid = this.periodoActivo();
        if (!pid) { this.toastr.error('Sin periodo activo', 'Error'); return; }
        const { AddCourseDialog } = await import('../../../../shared/components/add-course-dialog/add-course-dialog');
        const ref = this.dialog.open(AddCourseDialog, { width: '500px', data: { seccionId: s.id, periodoId: pid, seccionNombre: s.nombre, gradoNombre: g.nombre } });
        ref.afterClosed().subscribe((c: any) => { if (c) this.reloadCursos(); });
    }

    // Navegamos al editor visual (grilla 5xN + modal por slot) en una página
    // dedicada; antes esto abría un modal con un formulario por curso.
    openSchedule(): void {
        const s = this.selectedSeccion(); const g = this.selectedGrado();
        if (!s || !g) return;
        const pid = this.periodoActivo();
        if (!pid) { this.toastr.error('Sin periodo activo', 'Error'); return; }
        this.router.navigate(
            ['/admin/secciones', s.id, 'periodo', pid, 'horario'],
            { queryParams: { seccion: s.nombre, grado: g.nombre } },
        );
    }

    async openAssignDocente(curso: Course): Promise<void> {
        const { AssignDocenteDialog } = await import('../../../../shared/components/assign-docente-dialog/assign-docente-dialog');
        const ref = this.dialog.open(AssignDocenteDialog, { width: '480px', data: { cursoId: curso.id, cursoNombre: curso.nombre, docenteActualId: curso.docente_id } });
        ref.afterClosed().subscribe((docenteId: string | undefined) => {
            if (!docenteId) return;
            this.api.patch(`courses/${curso.id}/assign-teacher`, { docente_id: docenteId }).subscribe({
                next: () => { this.reloadCursos(); this.toastr.success('Docente asignado', 'Éxito'); },
                error: () => this.toastr.error('Error al asignar docente', 'Error'),
            });
        });
    }

    async openAssignTutor(): Promise<void> {
        const s = this.selectedSeccion(); const g = this.selectedGrado();
        if (!s || !g) return;
        const { AssignTutorDialog } = await import('../../../../shared/components/assign-tutor-dialog/assign-tutor-dialog');
        const ref = this.dialog.open(AssignTutorDialog, { width: '520px', data: { seccionId: s.id, seccionNombre: s.nombre, gradoNombre: g.nombre, tutorActualId: s.tutor_id ?? null } });
        ref.afterClosed().subscribe((result: any) => { if (result !== undefined) this.reloadSecciones(); });
    }

    async toggleCurso(curso: Course): Promise<void> {
        const { ConfirmDialog } = await import('../../../../shared/components/confirm-dialog/confirm-dialog');
        const ref = this.dialog.open(ConfirmDialog, { width: '360px', data: { title: curso.activo ? '¿Desactivar curso?' : '¿Activar curso?', message: `El curso "${curso.nombre}" será ${curso.activo ? 'desactivado' : 'reactivado'}.`, confirm: curso.activo ? 'Desactivar' : 'Activar', cancel: 'Cancelar', danger: curso.activo } });
        ref.afterClosed().subscribe((ok: boolean) => {
            if (!ok) return;
            this.api.patch(`courses/${curso.id}`, { activo: !curso.activo }).subscribe({
                next: () => this.cursos.update(list => list.map(c => c.id === curso.id ? { ...c, activo: !c.activo } : c)),
                error: () => this.toastr.error('Error al actualizar curso', 'Error'),
            });
        });
    }

    async openMatricular(): Promise<void> {
        const s = this.selectedSeccion(); const g = this.selectedGrado();
        if (!s || !g) return;
        const pid = this.periodoActivo();
        if (!pid) { this.toastr.error('Sin periodo activo', 'Error'); return; }
        const { EnrollAlumnoDialog } = await import('../../../../shared/components/enroll-alumno-dialog/enroll-alumno-dialog');
        const ref = this.dialog.open(EnrollAlumnoDialog, { width: '500px', data: { seccionId: s.id, periodoId: pid, seccionNombre: s.nombre, gradoNombre: g.nombre, alumnosMatriculadosIds: this.alumnosIds() } });
        ref.afterClosed().subscribe((enrolled: any) => { if (enrolled) this.reloadAlumnos(); });
    }

    async retirarAlumno(alumno: any): Promise<void> {
        const { ConfirmDialog } = await import('../../../../shared/components/confirm-dialog/confirm-dialog');
        const ref = this.dialog.open(ConfirmDialog, { width: '380px', data: { title: '¿Retirar alumno?', message: `Se retirará a ${alumno.nombre} ${alumno.apellido_paterno} de la sección "${this.selectedSeccion()?.nombre}".`, confirm: 'Retirar', cancel: 'Cancelar', danger: true } });
        ref.afterClosed().subscribe((ok: boolean) => {
            if (!ok) return;
            this.api.delete(`courses/enroll/${alumno.id}`).subscribe({
                next: () => { this.alumnos.update(list => list.filter(a => a.id !== alumno.id)); this.toastr.success(`${alumno.nombre} retirado`, 'Éxito'); },
                error: () => this.toastr.error('Error al retirar alumno', 'Error'),
            });
        });
    }

    async verNotasAlumno(alumno: any): Promise<void> {
        const { AlumnoNotasDialog } = await import('../../../../shared/components/alumno-notas-dialog/alumno-notas-dialog');
        this.dialog.open(AlumnoNotasDialog, { width: '760px', maxWidth: '96vw', maxHeight: '90vh', panelClass: 'alumno-notas-panel', data: { alumnoId: alumno.alumno_id, nombre: `${alumno.apellido_paterno} ${alumno.apellido_materno ?? ''}, ${alumno.nombre}`, seccionNombre: this.selectedSeccion()?.nombre, gradoNombre: this.selectedGrado()?.nombre } });
    }
}