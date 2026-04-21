import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../../../core/services/api';
import { CreateSeccionDialog } from '../../../../shared/components/create-seccion-dialog/create-seccion-dialog';
import { AssignDocenteDialog } from '../../../../shared/components/assign-docente-dialog/assign-docente-dialog';
import type { GradeLevel, Section, Course } from '../../../../core/models/academic';

@Component({
    selector: 'app-grados-tab',
    imports: [
        MatButtonModule, MatIconModule, MatTableModule,
        MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule,
    ],
    templateUrl: './grados-tab.html',
    styleUrl: './grados-tab.scss',
})
export class GradosTab implements OnInit {
    private api = inject(ApiService);
    private snack = inject(MatSnackBar);
    private dialog = inject(MatDialog);

    // ── Estado ────────────────────────────────────────────────────
    grados = signal<GradeLevel[]>([]);
    secciones = signal<Section[]>([]);
    cursos = signal<Course[]>([]);

    loadingGrados = signal(true);
    loadingSecciones = signal(false);
    loadingCursos = signal(false);

    selectedGrado = signal<GradeLevel | null>(null);
    selectedSeccion = signal<Section | null>(null);

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

    cursoCols = ['nombre', 'docente', 'estado', 'acciones'];

    // ────────────────────────────────────────────────────────────

    ngOnInit() {
        this.loadGrados();
        this.loadSecciones();
    }

    // ── Loaders ───────────────────────────────────────────────────

    loadGrados() {
        this.loadingGrados.set(true);
        this.api.get<GradeLevel[]>('academic/grados').subscribe({
            next: r => { this.grados.set(r.data); this.loadingGrados.set(false); },
            error: () => this.loadingGrados.set(false),
        });
    }

    loadSecciones() {
        this.loadingSecciones.set(true);
        this.api.get<Section[]>('academic/secciones').subscribe({
            next: r => { this.secciones.set(r.data); this.loadingSecciones.set(false); },
            error: () => this.loadingSecciones.set(false),
        });
    }

    loadCursosDeSeccion(seccionId: number) {
        this.loadingCursos.set(true);
        this.api.get<Course[]>('courses').subscribe({
            next: r => {
                this.cursos.set(r.data);
                this.loadingCursos.set(false);
            },
            error: () => this.loadingCursos.set(false),
        });
    }

    // ── Navegación jerárquica ─────────────────────────────────────

    selectGrado(g: GradeLevel) {
        if (this.selectedGrado()?.id === g.id) {
            // Deseleccionar si click en el mismo
            this.selectedGrado.set(null);
            this.selectedSeccion.set(null);
            this.cursos.set([]);
        } else {
            this.selectedGrado.set(g);
            this.selectedSeccion.set(null);
            this.cursos.set([]);
        }
    }

    selectSeccion(s: Section) {
        if (this.selectedSeccion()?.id === s.id) {
            this.selectedSeccion.set(null);
            this.cursos.set([]);
        } else {
            this.selectedSeccion.set(s);
            this.loadCursosDeSeccion(s.id);
        }
    }

    getSeccionCount(gradoId: number): number {
        return this.seccionesPorGrado().get(gradoId) ?? 0;
    }

    // ── Secciones ─────────────────────────────────────────────────

    openCreateSeccion() {
        if (!this.selectedGrado()) return;

        const ref = this.dialog.open(CreateSeccionDialog, {
            width: '480px',
            data: {
                gradoId: this.selectedGrado()!.id,
                gradoNombre: this.selectedGrado()!.nombre,
            },
        });

        ref.afterClosed().subscribe(result => {
            if (!result) return;

            this.api.post<any>('academic/secciones', {
                grado_id: this.selectedGrado()!.id,
                nombre: result.nombre,
                capacidad: result.capacidad,
            }).subscribe({
                next: r => {
                    this.secciones.update(list => [...list, r.data.seccion]);
                    const cursosCreados = r.data.cursos?.creados ?? 0;
                    if (cursosCreados > 0) {
                        this.snack.open(
                            `Sección creada + ${cursosCreados} cursos generados automáticamente`,
                            'OK', { duration: 4000 }
                        );
                    } else {
                        this.snack.open(
                            'Sección creada. Activa un periodo para generar cursos.',
                            'OK', { duration: 3000 }
                        );
                    }
                },
                error: err => this.snack.open(
                    err.error?.message ?? 'Error al crear sección',
                    'OK', { duration: 3000 }
                ),
            });
        });
    }

    // ── Cursos ────────────────────────────────────────────────────

    toggleCurso(curso: Course) {
        this.api.patch(`courses/${curso.id}`, { activo: !curso.activo }).subscribe({
            next: () => {
                this.cursos.update(list =>
                    list.map(c => c.id === curso.id ? { ...c, activo: !c.activo } : c)
                );
                this.snack.open(
                    curso.activo ? 'Curso desactivado' : 'Curso activado',
                    'OK', { duration: 2000 }
                );
            },
            error: () => this.snack.open('Error al actualizar curso', 'OK', { duration: 2000 }),
        });
    }

    openAssignDocente(curso: Course) {
        const ref = this.dialog.open(AssignDocenteDialog, {
            width: '480px',
            data: {
                cursoId: curso.id,
                cursoNombre: curso.nombre,
                docenteActualId: curso.docente_id,
            },
        });

        ref.afterClosed().subscribe((docenteId: string | null) => {
            if (!docenteId) return;

            this.api.patch(`courses/${curso.id}/assign-teacher`, { docente_id: docenteId }).subscribe({
                next: () => {
                    this.loadCursosDeSeccion(this.selectedSeccion()!.id);
                    this.snack.open(`Docente asignado a ${curso.nombre}`, 'OK', { duration: 2000 });
                },
                error: () => this.snack.open('Error al asignar docente', 'OK', { duration: 2000 }),
            });
        });
    }
}