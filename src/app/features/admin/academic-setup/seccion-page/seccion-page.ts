import {
  Component, inject, signal, computed,
  OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../core/services/api';
import { LazyCourseStore } from '../../../courses/data-access/lazy-course.store';
import type { Section, Course } from '../../../../core/models/academic';

type Tab = 'alumnos' | 'cursos' | 'horario';

@Component({
  selector: 'app-seccion-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule,
    MatMenuModule, MatPaginatorModule,
  ],
  templateUrl: './seccion-page.html',
  styleUrl: './seccion-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeccionPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  private store = inject(LazyCourseStore);

  // ── Params ────────────────────────────────────────────────
  seccionId = signal('');
  gradoNombre = signal('');

  // ── Estado ────────────────────────────────────────────────
  seccion = signal<Section | null>(null);
  cursos = signal<Course[]>([]);
  alumnos = signal<any[]>([]);
  anio = signal<number>(new Date().getFullYear());

  loading = signal(true);
  loadingCursos = signal(false);
  activeTab = signal<Tab>('alumnos');

  alumnoSearch = new FormControl('');
  alumnoPage = signal(0);
  alumnoPageSize = signal(10);

  // ── Computed ──────────────────────────────────────────────
  capacidad = computed(() => this.seccion()?.capacidad ?? 35);
  ocupacion = computed(() => this.alumnos().length);
  porcentaje = computed(() =>
    Math.min(100, Math.round((this.ocupacion() / this.capacidad()) * 100)),
  );

  alumnosFiltrados = computed(() => {
    const q = this.alumnoSearch.value?.toLowerCase().trim() ?? '';
    return this.alumnos().filter(a =>
      !q || `${a.nombre} ${a.apellido_paterno} ${a.codigo_estudiante}`
        .toLowerCase().includes(q),
    );
  });

  alumnosPaginados = computed(() => {
    const start = this.alumnoPage() * this.alumnoPageSize();
    return this.alumnosFiltrados().slice(start, start + this.alumnoPageSize());
  });

  alumnosIds = computed(() => this.alumnos().map(a => a.alumno_id ?? a.id));

  // ── Init ──────────────────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('seccionId') ?? '';
    const qp = this.route.snapshot.queryParams;
    this.seccionId.set(id);
    this.gradoNombre.set(qp['grado'] ?? '');

    forkJoin({
      secciones: this.api.get<any>('academic/secciones'),
      periodos: this.api.get<any>('academic/periodos'),
      alumnos: this.store.rosterRaw$<any>(id),
    }).subscribe({
      next: ({ secciones, periodos, alumnos }) => {
        const lista: Section[] = (secciones as any).data ?? [];
        this.seccion.set(lista.find(s => s.id === id) ?? null);

        const activo = ((periodos as any).data as any[]).find(p => p.activo);
        this.anio.set(activo?.anio ?? new Date().getFullYear());

        this.alumnos.set(this.mapAlumnos(alumnos ?? []));
        this.loading.set(false);

        // Cursos los cargamos después para no bloquear la UI
        this.loadCursos();
      },
      error: () => {
        this.toastr.error('Error al cargar la sección', 'Error');
        this.loading.set(false);
      },
    });

    this.alumnoSearch.valueChanges.pipe(
      debounceTime(200), distinctUntilChanged(),
    ).subscribe(() => this.alumnoPage.set(0));
  }

  // ── Loaders ───────────────────────────────────────────────
  private loadCursos(): void {
    this.loadingCursos.set(true);
    this.api.get<any>(
      `courses?seccion_id=${this.seccionId()}&anio=${this.anio()}`
    ).subscribe({
      next: r => {
        this.cursos.set((r as any).data ?? []);
        this.loadingCursos.set(false);
      },
      error: () => this.loadingCursos.set(false),
    });
  }

  private reloadAlumnos(): void {
    this.alumnoSearch.setValue('', { emitEvent: false });
    this.alumnoPage.set(0);
    this.store.invalidateRoster(this.seccionId());
    this.store.rosterRaw$<any>(this.seccionId()).subscribe({
      next: r => this.alumnos.set(this.mapAlumnos(r ?? [])),
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

  // ── Navegación ────────────────────────────────────────────
  goBack(): void {
    this.router.navigate(['/admin/academico']);
  }

  goToHorario(): void {
    this.router.navigate(
      ['/admin/secciones', this.seccionId(), 'horario'],
      { queryParams: { anio: this.anio(), seccion: this.seccion()?.nombre, grado: this.gradoNombre() } },
    );
  }

  // ── Tabs ──────────────────────────────────────────────────
  setTab(tab: Tab): void { this.activeTab.set(tab); }

  // ── Helpers ───────────────────────────────────────────────
  getInitials(n: string, a: string): string {
    return `${n[0] ?? ''}${a[0] ?? ''}`.toUpperCase();
  }

  onPageChange(e: PageEvent): void {
    this.alumnoPage.set(e.pageIndex);
    this.alumnoPageSize.set(e.pageSize);
  }

  // ── Acciones sección ──────────────────────────────────────
  async editarSeccion(): Promise<void> {
    const s = this.seccion();
    if (!s) return;
    const { CreateSeccionDialog } = await import(
      '../../../../shared/components/create-seccion-dialog/create-seccion-dialog'
    );
    const ref = this.dialog.open(CreateSeccionDialog, {
      width: '480px', maxWidth: '95vw',
      data: { seccionId: s.id, nombre: s.nombre, capacidad: s.capacidad },
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.api.patch<any>(`academic/secciones/${s.id}`, {
        nombre: result.nombre, capacidad: result.capacidad,
      }).subscribe({
        next: () => {
          this.toastr.success('Sección actualizada', 'Éxito');
          this.seccion.update(sec => sec ? { ...sec, ...result } : sec);
        },
        error: err =>
          this.toastr.error(err.error?.message ?? 'Error', 'Error'),
      });
    });
  }

  async asignarTutor(): Promise<void> {
    const s = this.seccion();
    if (!s) return;
    const { AssignTutorDialog } = await import(
      '../../../../shared/components/assign-tutor-dialog/assign-tutor-dialog'
    );
    const ref = this.dialog.open(AssignTutorDialog, {
      width: '520px',
      data: {
        seccionId: s.id, seccionNombre: s.nombre,
        gradoNombre: this.gradoNombre(),
        tutorActualId: (s as any).tutor_id ?? null,
      },
    });
    ref.afterClosed().subscribe(result => {
      if (result !== undefined) {
        this.api.get<any>('academic/secciones').subscribe(r => {
          const lista: Section[] = (r as any).data ?? [];
          this.seccion.set(lista.find(sec => sec.id === s.id) ?? s);
        });
      }
    });
  }

  // ── Acciones cursos ───────────────────────────────────────
  async asignarDocente(curso: Course): Promise<void> {
    const { AssignDocenteDialog } = await import(
      '../../../../shared/components/assign-docente-dialog/assign-docente-dialog'
    );
    const ref = this.dialog.open(AssignDocenteDialog, {
      width: '480px',
      data: { cursoId: curso.id, cursoNombre: curso.nombre, docenteActualId: curso.docente_id },
    });
    ref.afterClosed().subscribe((docenteId: string | undefined) => {
      if (!docenteId) return;
      this.api.patch(`courses/${curso.id}/assign-teacher`, { docente_id: docenteId })
        .subscribe({
          next: () => {
            this.toastr.success('Docente asignado', 'Éxito');
            this.loadCursos();
          },
          error: () => this.toastr.error('Error al asignar docente', 'Error'),
        });
    });
  }

  async toggleCurso(curso: Course): Promise<void> {
    const { ConfirmDialog } = await import(
      '../../../../shared/components/confirm-dialog/confirm-dialog'
    );
    const ref = this.dialog.open(ConfirmDialog, {
      width: '360px',
      data: {
        title: curso.activo ? '¿Desactivar curso?' : '¿Activar curso?',
        message: `El curso "${curso.nombre}" será ${curso.activo ? 'desactivado' : 'reactivado'}.`,
        confirm: curso.activo ? 'Desactivar' : 'Activar',
        cancel: 'Cancelar',
        danger: curso.activo,
      },
    });
    ref.afterClosed().subscribe((ok: boolean) => {
      if (!ok) return;
      this.api.patch(`courses/${curso.id}`, { activo: !curso.activo }).subscribe({
        next: () => this.cursos.update(list =>
          list.map(c => c.id === curso.id ? { ...c, activo: !c.activo } : c),
        ),
        error: () => this.toastr.error('Error al actualizar curso', 'Error'),
      });
    });
  }

  // ── Acciones alumnos ──────────────────────────────────────
  async matricularAlumno(): Promise<void> {
    const { EnrollAlumnoDialog } = await import(
      '../../../../shared/components/enroll-alumno-dialog/enroll-alumno-dialog'
    );
    const ref = this.dialog.open(EnrollAlumnoDialog, {
      width: '500px',
      data: {
        seccionId: this.seccionId(),
        anio: this.anio(),
        seccionNombre: this.seccion()?.nombre,
        gradoNombre: this.gradoNombre(),
      },
    });
    ref.afterClosed().subscribe((enrolled: any) => {
      if (enrolled) this.reloadAlumnos();
    });
  }

  async retirarAlumno(alumno: any): Promise<void> {
    const { ConfirmDialog } = await import(
      '../../../../shared/components/confirm-dialog/confirm-dialog'
    );
    const ref = this.dialog.open(ConfirmDialog, {
      width: '380px',
      data: {
        title: '¿Retirar alumno?',
        message: `Se retirará a ${alumno.nombre} ${alumno.apellido_paterno} de la sección.`,
        confirm: 'Retirar', cancel: 'Cancelar', danger: true,
      },
    });
    ref.afterClosed().subscribe((ok: boolean) => {
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

  async verNotas(alumno: any): Promise<void> {
    const { AlumnoNotasDialog } = await import(
      '../../../../shared/components/alumno-notas-dialog/alumno-notas-dialog'
    );
    this.dialog.open(AlumnoNotasDialog, {
      width: '760px', maxWidth: '96vw', maxHeight: '90vh',
      panelClass: 'alumno-notas-panel',
      data: {
        alumnoId: alumno.alumno_id,
        nombre: `${alumno.apellido_paterno} ${alumno.apellido_materno ?? ''}, ${alumno.nombre}`.trim(),
        seccionNombre: this.seccion()?.nombre,
        gradoNombre: this.gradoNombre(),
      },
    });
  }
  async agregarCurso(): Promise<void> {
    const { AddCourseDialog } = await import(
      '../../../../shared/components/add-course-dialog/add-course-dialog'
    );
    const ref = this.dialog.open(AddCourseDialog, {
      width: '500px', maxWidth: '95vw',
      data: {
        seccionId: this.seccionId(),
        anio: this.anio(),
        seccionNombre: this.seccion()?.nombre,
        gradoNombre: this.gradoNombre(),
      },
    });
    ref.afterClosed().subscribe((c: any) => {
      if (c) this.loadCursos();
    });
  }
}