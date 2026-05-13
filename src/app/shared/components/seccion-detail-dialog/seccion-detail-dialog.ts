import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../core/services/api';
import type { Section, Course } from '../../../core/models/academic';

type SeccionTab = 'cursos' | 'alumnos' | 'horario';

export interface SeccionDetailDialogData {
    seccion: Section;
    gradoNombre: string;
    periodoId: number | null;
}

@Component({
    selector: 'app-seccion-detail-dialog',
    standalone: true,
    imports: [
        MatDialogModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatTooltipModule,
        MatPaginatorModule, MatMenuModule, ReactiveFormsModule,
    ],
    templateUrl: './seccion-detail-dialog.html',
    styleUrl: './seccion-detail-dialog.scss',
})
export class SeccionDetailDialog implements OnInit {
    readonly data: SeccionDetailDialogData = inject(MAT_DIALOG_DATA);
    private ref = inject(MatDialogRef<SeccionDetailDialog>);
    private dialog = inject(MatDialog);
    private router = inject(Router);
    private api = inject(ApiService);
    private toastr = inject(ToastService);

    // ── Estado ────────────────────────────────────────────────────
    cursos = signal<Course[]>([]);
    alumnos = signal<any[]>([]);

    loadingCursos = signal(true);
    loadingAlumnos = signal(true);

    activeTab = signal<SeccionTab>('cursos');

    alumnoSearch = new FormControl('');
    alumnoPage = signal(0);
    alumnoPageSize = signal(10);

    // ── Computed ──────────────────────────────────────────────────
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
    capacidad = computed(() => this.data.seccion.capacidad ?? 35);
    ocupacion = computed(() => this.alumnos().length);
    porcentaje = computed(() => Math.round((this.ocupacion() / this.capacidad()) * 100));

    // ── Init ──────────────────────────────────────────────────────
    ngOnInit(): void {
        forkJoin({
            cursos: this.api.get<Course[]>(`courses?seccion_id=${this.data.seccion.id}`),
            alumnos: this.api.get<any[]>(`courses/seccion/${this.data.seccion.id}/students`),
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

        this.alumnoSearch.valueChanges.pipe(
            debounceTime(200), distinctUntilChanged(),
        ).subscribe(() => this.alumnoPage.set(0));
    }

    // ── Helpers ───────────────────────────────────────────────────
    setTab(tab: SeccionTab): void { this.activeTab.set(tab); }
    getInitials(n: string, a: string): string { return `${n[0] ?? ''}${a[0] ?? ''}`.toUpperCase(); }
    onAlumnoPageChange(e: PageEvent): void { this.alumnoPage.set(e.pageIndex); this.alumnoPageSize.set(e.pageSize); }

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

    private reloadCursos(): void {
        this.loadingCursos.set(true);
        this.api.get<Course[]>(`courses?seccion_id=${this.data.seccion.id}`).subscribe({
            next: r => { this.cursos.set((r as any).data ?? []); this.loadingCursos.set(false); },
            error: () => this.loadingCursos.set(false),
        });
    }

    private reloadAlumnos(): void {
        this.loadingAlumnos.set(true);
        this.alumnoSearch.setValue('', { emitEvent: false });
        this.alumnoPage.set(0);
        this.api.get<any[]>(`courses/seccion/${this.data.seccion.id}/students`).subscribe({
            next: r => {
                this.alumnos.set(this.mapAlumnos((r as any).data ?? []));
                this.loadingAlumnos.set(false);
            },
            error: () => this.loadingAlumnos.set(false),
        });
    }

    // ── Cerrar ────────────────────────────────────────────────────
    close(): void { this.ref.close(); }

    // ── Editar sección ────────────────────────────────────────────
    async editarSeccion(): Promise<void> {
        const { CreateSeccionDialog } = await import('../create-seccion-dialog/create-seccion-dialog');
        const r = this.dialog.open(CreateSeccionDialog, {
            width: '480px', maxWidth: '95vw', panelClass: 'create-seccion-panel',
            data: {
                seccionId: this.data.seccion.id,
                nombre: this.data.seccion.nombre,
                capacidad: this.data.seccion.capacidad,
                alumnosActuales: this.alumnos().length,
            },
        });
        r.afterClosed().subscribe(result => {
            if (!result) return;
            this.api.patch<any>(`academic/secciones/${this.data.seccion.id}`, {
                nombre: result.nombre, capacidad: result.capacidad,
            }).subscribe({
                next: () => { this.toastr.success(`Sección "${result.nombre}" actualizada`, 'Éxito'); this.ref.close('reload'); },
                error: err => this.toastr.error(err.error?.message ?? 'Error al actualizar', 'Error'),
            });
        });
    }

    // ── Asignar tutor ─────────────────────────────────────────────
    async asignarTutor(): Promise<void> {
        const { AssignTutorDialog } = await import('../assign-tutor-dialog/assign-tutor-dialog');
        const r = this.dialog.open(AssignTutorDialog, {
            width: '520px',
            data: {
                seccionId: this.data.seccion.id,
                seccionNombre: this.data.seccion.nombre,
                gradoNombre: this.data.gradoNombre,
                tutorActualId: (this.data.seccion as any).tutor_id ?? null,
            },
        });
        r.afterClosed().subscribe(result => { if (result !== undefined) this.ref.close('reload'); });
    }

    // ── Agregar curso ─────────────────────────────────────────────
    async agregarCurso(): Promise<void> {
        const pid = this.data.periodoId;
        if (!pid) { this.toastr.error('Sin periodo activo', 'Error'); return; }
        const { AddCourseDialog } = await import('../add-course-dialog/add-course-dialog');
        const r = this.dialog.open(AddCourseDialog, {
            width: '500px',
            data: { seccionId: this.data.seccion.id, periodoId: pid, seccionNombre: this.data.seccion.nombre, gradoNombre: this.data.gradoNombre },
        });
        r.afterClosed().subscribe((c: any) => { if (c) this.reloadCursos(); });
    }

    // ── Asignar docente ───────────────────────────────────────────
    async asignarDocente(curso: Course): Promise<void> {
        const { AssignDocenteDialog } = await import('../assign-docente-dialog/assign-docente-dialog');
        const r = this.dialog.open(AssignDocenteDialog, {
            width: '480px',
            data: { cursoId: curso.id, cursoNombre: curso.nombre, docenteActualId: curso.docente_id },
        });
        r.afterClosed().subscribe((docenteId: string | undefined) => {
            if (!docenteId) return;
            this.api.patch(`courses/${curso.id}/assign-teacher`, { docente_id: docenteId }).subscribe({
                next: () => { this.reloadCursos(); this.toastr.success('Docente asignado', 'Éxito'); },
                error: () => this.toastr.error('Error al asignar docente', 'Error'),
            });
        });
    }

    // ── Toggle curso ──────────────────────────────────────────────
    async toggleCurso(curso: Course): Promise<void> {
        const { ConfirmDialog } = await import('../confirm-dialog/confirm-dialog');
        const r = this.dialog.open(ConfirmDialog, {
            width: '360px',
            data: {
                title: curso.activo ? '¿Desactivar curso?' : '¿Activar curso?',
                message: `El curso "${curso.nombre}" será ${curso.activo ? 'desactivado' : 'reactivado'}.`,
                confirm: curso.activo ? 'Desactivar' : 'Activar',
                cancel: 'Cancelar',
                danger: curso.activo,
            },
        });
        r.afterClosed().subscribe((ok: boolean) => {
            if (!ok) return;
            this.api.patch(`courses/${curso.id}`, { activo: !curso.activo }).subscribe({
                next: () => this.cursos.update(list => list.map(c => c.id === curso.id ? { ...c, activo: !c.activo } : c)),
                error: () => this.toastr.error('Error al actualizar curso', 'Error'),
            });
        });
    }

    // ── Matricular alumno ─────────────────────────────────────────
    async matricularAlumno(): Promise<void> {
        const pid = this.data.periodoId;
        if (!pid) { this.toastr.error('Sin periodo activo', 'Error'); return; }
        const { EnrollAlumnoDialog } = await import('../enroll-alumno-dialog/enroll-alumno-dialog');
        const r = this.dialog.open(EnrollAlumnoDialog, {
            width: '500px',
            data: { seccionId: this.data.seccion.id, periodoId: pid, seccionNombre: this.data.seccion.nombre, gradoNombre: this.data.gradoNombre, alumnosMatriculadosIds: this.alumnosIds() },
        });
        r.afterClosed().subscribe((enrolled: any) => { if (enrolled) this.reloadAlumnos(); });
    }

    // ── Retirar alumno ────────────────────────────────────────────
    async retirarAlumno(alumno: any): Promise<void> {
        const { ConfirmDialog } = await import('../confirm-dialog/confirm-dialog');
        const r = this.dialog.open(ConfirmDialog, {
            width: '380px',
            data: {
                title: '¿Retirar alumno?',
                message: `Se retirará a ${alumno.nombre} ${alumno.apellido_paterno} de la sección "${this.data.seccion.nombre}".`,
                confirm: 'Retirar',
                cancel: 'Cancelar',
                danger: true,
            },
        });
        r.afterClosed().subscribe((ok: boolean) => {
            if (!ok) return;
            this.api.delete(`courses/enroll/${alumno.id}`).subscribe({
                next: () => {
                    this.alumnos.update(list => list.filter(a => a.id !== alumno.id));
                    this.toastr.success(`${alumno.nombre} retirado`, 'Éxito');
                },
                error: () => this.toastr.error('Error al retirar alumno', 'Error'),
            });
        });
    }

    // ── Ver notas del alumno ──────────────────────────────────────
    async verNotasAlumno(alumno: any): Promise<void> {
        const { AlumnoNotasDialog } = await import('../alumno-notas-dialog/alumno-notas-dialog');
        this.dialog.open(AlumnoNotasDialog, {
            width: '760px',
            maxWidth: '96vw',
            maxHeight: '90vh',
            panelClass: 'alumno-notas-panel',
            data: {
                alumnoId: alumno.alumno_id,
                nombre: `${alumno.apellido_paterno} ${alumno.apellido_materno ?? ''}, ${alumno.nombre}`.trim(),
                seccionNombre: this.data.seccion.nombre,
                gradoNombre: this.data.gradoNombre,
            },
        });
    }

    // ── Gestionar horario ─────────────────────────────────────────
    // Navegamos al editor visual (página dedicada con grilla + modal de slot)
    // en vez del modal-en-modal anterior, que era más limitado.
    gestionarHorario(): void {
        const pid = this.data.periodoId;
        if (!pid) { this.toastr.error('Sin periodo activo', 'Error'); return; }
        this.ref.close();
        this.router.navigate(
            ['/admin/secciones', this.data.seccion.id, 'periodo', pid, 'horario'],
            {
                queryParams: {
                    seccion: this.data.seccion.nombre,
                    grado: this.data.gradoNombre,
                },
            },
        );
    }
}