import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';
import { DatePipe } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../core/services/api';
import type { GradeLevel, Section, Period } from '../../../core/models/academic';
import { MatMenuModule } from '@angular/material/menu';

export interface MatriculaRow {
  id: string;
  alumno_id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  codigo_estudiante: string;
  seccion_id: string;
  seccion_nombre: string;
  grado_nombre: string;
  grado_id: string;
  anio: number;
  activo: boolean;
  fecha_matricula: string;
  condicion_final: 'pendiente' | 'aprobado' | 'desaprobado' | 'retirado';
}

export const CONDICIONES_FINALES = [
  { value: 'pendiente', label: 'Pendiente', icon: 'schedule', class: 'condicion-pendiente' },
  { value: 'aprobado', label: 'Aprobado', icon: 'check_circle', class: 'condicion-aprobado' },
  { value: 'desaprobado', label: 'Desaprobado', icon: 'cancel', class: 'condicion-desaprobado' },
  { value: 'retirado', label: 'Retirado', icon: 'person_remove', class: 'condicion-retirado' },
] as const;

type CondicionValue = typeof CONDICIONES_FINALES[number]['value'];

@Component({
  selector: 'app-matriculas',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    MatButtonModule, MatIconModule, MatSelectModule,
    MatFormFieldModule, MatTooltipModule,
    MatProgressSpinnerModule, MatPaginatorModule, MatMenuModule
  ],
  templateUrl: './matriculas.html',
  styleUrl: './matriculas.scss',
})
export class Matriculas implements OnInit {
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private dialog = inject(MatDialog);

  // ── Catálogos ─────────────────────────────────────────────────
  readonly condiciones = CONDICIONES_FINALES;
  grados = signal<GradeLevel[]>([]);
  secciones = signal<Section[]>([]);
  private periodos = signal<Period[]>([]);

  // ── Año actual (interno) ──────────────────────────────────────
  readonly anioActual = signal<number>(new Date().getFullYear());

  // ── Filtros ───────────────────────────────────────────────────
  gradoFiltro = new FormControl<string | null>(null);
  busqueda = new FormControl('');

  // Secciones disponibles para el grado seleccionado
  readonly seccionesFiltro = signal<{ id: string; nombre: string }[]>([]);
  readonly seccionFiltro = new FormControl<string | null>(null);

  // Convertimos el FormControl a signal para que computed() lo detecte
  private readonly seccionFiltroSig = toSignal(
    this.seccionFiltro.valueChanges,
    { initialValue: null as string | null },
  );

  // ── Datos ─────────────────────────────────────────────────────
  matriculas = signal<MatriculaRow[]>([]);
  loading = signal(false);
  loadingFiltros = signal(true);
  savingId = signal<string | null>(null);

  // ── Paginación ────────────────────────────────────────────────
  page = signal(0);
  pageSize = signal(15);

  // ── Computeds ─────────────────────────────────────────────────
  matriculasFiltradas = computed(() => {
    const q = this.busqueda.value?.toLowerCase().trim() ?? '';
    const secId = this.seccionFiltroSig(); // signal reactivo ✓
    let list = this.matriculas();

    if (secId) list = list.filter(m => m.seccion_id === secId);
    if (!q) return list;

    return list.filter(m =>
      m.nombre.toLowerCase().includes(q) ||
      m.apellido_paterno.toLowerCase().includes(q) ||
      m.codigo_estudiante.toLowerCase().includes(q),
    );
  });

  matriculasPaginadas = computed(() => {
    const start = this.page() * this.pageSize();
    return this.matriculasFiltradas().slice(start, start + this.pageSize());
  });

  // Stats generales
  totalActivas = computed(() => this.matriculas().filter(m => m.activo).length);
  totalInactivas = computed(() => this.matriculas().filter(m => !m.activo).length);

  // Stats de condición (solo activas)
  totalPendientes = computed(() => this.matriculas().filter(m => m.activo && m.condicion_final === 'pendiente').length);
  totalAprobados = computed(() => this.matriculas().filter(m => m.activo && m.condicion_final === 'aprobado').length);
  totalDesaprobados = computed(() => this.matriculas().filter(m => m.activo && m.condicion_final === 'desaprobado').length);
  totalRetirados = computed(() => this.matriculas().filter(m => m.activo && m.condicion_final === 'retirado').length);

  hayGradoSeleccionado = computed(() => !!this.gradoFiltro.value);

  // ── Init ──────────────────────────────────────────────────────
  ngOnInit(): void {
    forkJoin({
      grados: this.api.get<GradeLevel[]>('academic/grados'),
      secciones: this.api.get<Section[]>('academic/secciones'),
      periodos: this.api.get<Period[]>('academic/periodos'),
    }).subscribe({
      next: ({ grados, secciones, periodos }) => {
        this.grados.set((grados as any).data ?? []);
        this.secciones.set((secciones as any).data ?? []);
        this.periodos.set((periodos as any).data ?? []);

        const activo = ((periodos as any).data as Period[]).find(p => p.activo);
        if (activo) this.anioActual.set(activo.anio);

        this.loadingFiltros.set(false);
      },
      error: () => this.loadingFiltros.set(false),
    });

    // Búsqueda con debounce → resetear página
    this.busqueda.valueChanges.pipe(
      debounceTime(200), distinctUntilChanged(),
    ).subscribe(() => this.page.set(0));

    // Cambio de grado → poblar secciones y recargar
    this.gradoFiltro.valueChanges.subscribe((gid) => {
      this.matriculas.set([]);
      this.seccionFiltro.setValue(null, { emitEvent: false });
      this.seccionesFiltro.set(
        gid ? this.secciones().filter(s => s.grado_id === gid) : [],
      );
      this.cargarMatriculas();
    });

    // Cambio de sección → resetear página (el filtrado lo hace matriculasFiltradas)
    this.seccionFiltro.valueChanges.subscribe(() => this.page.set(0));
  }

  // ── Condición final ───────────────────────────────────────────
  getCondicion(value: string) {
    return CONDICIONES_FINALES.find(c => c.value === value) ?? CONDICIONES_FINALES[0];
  }

  async setCondicionFinal(m: MatriculaRow, condicion: string): Promise<void> {
    if (this.savingId()) return;
    if (condicion === m.condicion_final) return;

    if (condicion === 'retirado') {
      const prev = m.condicion_final;

      this.matriculas.update(list =>
        list.map(x => x.id === m.id ? { ...x, condicion_final: 'retirado' as CondicionValue } : x),
      );

      const { ConfirmDialog } = await import(
        '../../../shared/components/confirm-dialog/confirm-dialog'
      );
      const ref = this.dialog.open(ConfirmDialog, {
        width: '440px',
        data: {
          title: '¿Marcar como retirado?',
          message: `${m.nombre} ${m.apellido_paterno} quedará marcado como retirado.\n\nSu matrícula se inactivará y la cuenta se desactivará automáticamente 30 días después del cierre del año. No se elimina ningún dato.`,
          confirm: 'Sí, marcar retirado',
          cancel: 'Cancelar',
          danger: true,
        },
      });

      ref.afterClosed().subscribe((ok: boolean) => {
        if (!ok) {
          this.matriculas.update(list =>
            list.map(x => x.id === m.id ? { ...x, condicion_final: prev } : x),
          );
          return;
        }
        this.guardarCondicion(m.id, condicion);
      });
      return;
    }

    this.guardarCondicion(m.id, condicion);
  }

  private guardarCondicion(id: string, condicion: string): void {
    this.savingId.set(id);
    this.api.patch(`academic-years/matriculas/${id}/condicion-final`, { condicion })
      .subscribe({
        next: () => {
          this.matriculas.update(list =>
            list.map(x => x.id === id ? { ...x, condicion_final: condicion as CondicionValue } : x),
          );
          this.toastr.success('Condición final actualizada');
          this.savingId.set(null);
        },
        error: () => {
          this.toastr.error('Error al guardar condición final');
          this.savingId.set(null);
        },
      });
  }

  // ── Carga ─────────────────────────────────────────────────────
  cargarMatriculas(): void {
    const gid = this.gradoFiltro.value;
    if (!gid) { this.matriculas.set([]); return; }

    const params = new URLSearchParams({
      anio: String(this.anioActual()),
      grado_id: gid,
    });

    this.loading.set(true);
    this.page.set(0);

    this.api.get<MatriculaRow[]>(`academic/matriculas?${params.toString()}`).subscribe({
      next: r => { this.matriculas.set((r as any).data ?? []); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toastr.error('Error al cargar matrículas'); },
    });
  }

  aplicarFiltros(): void { this.cargarMatriculas(); }

  limpiarFiltros(): void {
    this.gradoFiltro.setValue(null);
    this.busqueda.setValue('');
    this.seccionFiltro.setValue(null);
    this.seccionesFiltro.set([]);
    this.matriculas.set([]);
  }

  // ── Acciones ──────────────────────────────────────────────────
  async matricularAlumno(): Promise<void> {
    const anio = this.anioActual();
    const gid = this.gradoFiltro.value;
    const periodo = this.periodos().find(p => p.anio === anio && p.activo)
      ?? this.periodos().find(p => p.anio === anio);

    if (!gid) { this.toastr.error('Selecciona un grado primero'); return; }
    if (!periodo) { this.toastr.error('No hay periodo configurado para ese año'); return; }

    const grado = this.grados().find(g => g.id === gid);
    const seccionesDelGrado = this.secciones().filter(s => s.grado_id === gid);

    const { EnrollAlumnoDialog } = await import(
      '../../../shared/components/enroll-alumno-dialog/enroll-alumno-dialog'
    );
    const ref = this.dialog.open(EnrollAlumnoDialog, {
      width: '500px',
      data: {
        periodoId: periodo.id,
        seccionId: seccionesDelGrado[0]?.id ?? null,
        seccionNombre: seccionesDelGrado[0]?.nombre ?? '',
        gradoNombre: grado?.nombre ?? '',
        alumnosMatriculadosIds: this.matriculas().map(m => m.alumno_id),
      },
    });
    ref.afterClosed().subscribe((enrolled: any) => { if (enrolled) this.cargarMatriculas(); });
  }

  async abrirCargaMasiva(): Promise<void> {
    const { ImportStudentsDialog } = await import(
      '../../../shared/components/import-students/import-students-dialog'
    );
    const ref = this.dialog.open(ImportStudentsDialog, {
      width: '580px', maxHeight: '90vh', disableClose: false,
    });
    ref.afterClosed().subscribe((ok: boolean) => { if (ok) this.cargarMatriculas(); });
  }

  async retirarAlumno(m: MatriculaRow): Promise<void> {
    const { ConfirmDialog } = await import(
      '../../../shared/components/confirm-dialog/confirm-dialog'
    );
    const ref = this.dialog.open(ConfirmDialog, {
      width: '400px',
      data: {
        title: '¿Retirar alumno?',
        message: `Se retirará a ${m.nombre} ${m.apellido_paterno} de ${m.grado_nombre} — Sección ${m.seccion_nombre}. La matrícula quedará inactiva.`,
        confirm: 'Retirar',
        cancel: 'Cancelar',
        danger: true,
      },
    });
    ref.afterClosed().subscribe((ok: boolean) => {
      if (!ok) return;
      this.api.delete(`courses/enroll/${m.id}`).subscribe({
        next: () => {
          this.matriculas.update(list =>
            list.map(x => x.id === m.id ? { ...x, activo: false } : x),
          );
          this.toastr.success('Alumno retirado correctamente');
        },
        error: () => this.toastr.error('Error al retirar alumno'),
      });
    });
  }

  // ── Paginación ────────────────────────────────────────────────
  onPageChange(e: PageEvent): void {
    this.page.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  // ── Helpers ───────────────────────────────────────────────────
  getInitials(nombre: string, apellido: string): string {
    return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase();
  }

  getAnioLabel(anio: number): string {
    return anio ? String(anio) : '—';
  }

  hayFiltrosActivos(): boolean {
    return !!(this.gradoFiltro.value || this.busqueda.value);
  }
  async confirmarRematricula(
    m: MatriculaRow,
    condicion: 'aprobado' | 'desaprobado',
  ): Promise<void> {
    const accion = condicion === 'aprobado'
      ? `promovido a ${m.grado_nombre} del año siguiente`
      : `repetirá ${m.grado_nombre} el año siguiente`;

    const { ConfirmDialog } = await import(
      '../../../shared/components/confirm-dialog/confirm-dialog'
    );
    const ref = this.dialog.open(ConfirmDialog, {
      width: '440px',
      data: {
        title: `¿Rematricualr a ${m.nombre} ${m.apellido_paterno}?`,
        message: `Quedará marcado como ${condicion.toUpperCase()} y será ${accion}.\n\nEsta acción crea una nueva matrícula para el año ${m.anio + 1}.`,
        confirm: condicion === 'aprobado' ? 'Sí, promover' : 'Sí, repetir año',
        cancel: 'Cancelar',
        danger: condicion === 'desaprobado',
      },
    });

    ref.afterClosed().subscribe((ok: boolean) => {
      if (!ok) return;
      this.api
        .post(`academic-years/${m.anio}/rematriculas/${m.id}`, { condicion })
        .subscribe({
          next: () => {
            this.toastr.success('Alumno rematriculado correctamente');
            this.cargarMatriculas();
          },
          error: () => this.toastr.error('Error al rematricualr alumno'),
        });
    });
  }
}