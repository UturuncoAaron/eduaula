import { Component, inject, signal, computed, OnInit } from '@angular/core';
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
  grado_id: number; // ── CORRECCIÓN: number para coincidir con GradeLevel.id ──
  anio: number;
  activo: boolean;
  fecha_matricula: string;
}

@Component({
  selector: 'app-matriculas',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    MatButtonModule, MatIconModule, MatSelectModule,
    MatFormFieldModule, MatTooltipModule,
    MatProgressSpinnerModule, MatPaginatorModule,
  ],
  templateUrl: './matriculas.html',
  styleUrl: './matriculas.scss',
})
export class Matriculas implements OnInit {
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private dialog = inject(MatDialog);

  // ── Filtros ───────────────────────────────────────────────────
  grados = signal<GradeLevel[]>([]);
  secciones = signal<Section[]>([]);
  periodos = signal<Period[]>([]);

  // ── CORRECCIÓN: number | null para coincidir con GradeLevel.id (number) ──
  gradoFiltro = new FormControl<number | null>(null);
  seccionFiltro = new FormControl<string | null>(null);
  anioFiltro = new FormControl<number | null>(null);
  busqueda = new FormControl('');

  // ── Datos ─────────────────────────────────────────────────────
  matriculas = signal<MatriculaRow[]>([]);
  loading = signal(false);
  loadingFiltros = signal(true);

  // ── Paginación ────────────────────────────────────────────────
  page = signal(0);
  pageSize = signal(10);

  // ── Años disponibles (derivados de periodos) ──────────────────
  aniosDisponibles = computed(() => {
    const set = new Set(this.periodos().map(p => p.anio));
    return [...set].sort((a, b) => b - a); // descendente
  });

  // ── Computed ──────────────────────────────────────────────────
  seccionesFiltradas = computed(() => {
    const gId = this.gradoFiltro.value;
    return gId !== null ? this.secciones().filter(s => s.grado_id === gId) : this.secciones();
  });

  periodoActivo = computed(() => this.periodos().find(p => p.activo) ?? null);

  matriculasFiltradas = computed(() => {
    const q = this.busqueda.value?.toLowerCase().trim() ?? '';
    if (!q) return this.matriculas();
    return this.matriculas().filter(m =>
      m.nombre.toLowerCase().includes(q) ||
      m.apellido_paterno.toLowerCase().includes(q) ||
      m.codigo_estudiante.toLowerCase().includes(q),
    );
  });

  matriculasPaginadas = computed(() => {
    const start = this.page() * this.pageSize();
    return this.matriculasFiltradas().slice(start, start + this.pageSize());
  });

  totalActivas = computed(() => this.matriculas().filter(m => m.activo).length);
  totalInactivas = computed(() => this.matriculas().filter(m => !m.activo).length);

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

        // Default: año del periodo activo
        const activo = ((periodos as any).data as Period[]).find(p => p.activo);
        if (activo) this.anioFiltro.setValue(activo.anio);

        this.loadingFiltros.set(false);
      },
      error: () => this.loadingFiltros.set(false),
    });

    this.busqueda.valueChanges.pipe(
      debounceTime(200), distinctUntilChanged(),
    ).subscribe(() => this.page.set(0));

    this.gradoFiltro.valueChanges.subscribe(() => {
      this.seccionFiltro.setValue(null);
      this.matriculas.set([]);
    });
  }

  // ── Carga ─────────────────────────────────────────────────────
  cargarMatriculas(): void {
    const sid = this.seccionFiltro.value;
    if (!sid) { this.matriculas.set([]); return; }

    const params = new URLSearchParams();
    const anio = this.anioFiltro.value;
    if (anio) params.set('anio', String(anio));
    params.set('seccion_id', String(sid));

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
    this.seccionFiltro.setValue(null);
    this.anioFiltro.setValue(this.periodoActivo()?.anio ?? null);
    this.busqueda.setValue('');
    this.cargarMatriculas();
  }

  // ── Acciones ──────────────────────────────────────────────────
  async matricularAlumno(): Promise<void> {
    const anio = this.anioFiltro.value ?? this.periodoActivo()?.anio;
    const sid = this.seccionFiltro.value;
    const periodo = this.periodos().find(p => p.anio === anio && p.activo)
      ?? this.periodos().find(p => p.anio === anio);

    if (!anio) { this.toastr.error('Selecciona un año primero'); return; }
    if (!sid) { this.toastr.error('Selecciona una sección primero'); return; }
    if (!periodo) { this.toastr.error('No hay periodo configurado para ese año'); return; }

    const seccion = this.secciones().find(s => s.id === sid);
    const grado = this.grados().find(g => g.id === seccion?.grado_id);

    const { EnrollAlumnoDialog } = await import(
      '../../../shared/components/enroll-alumno-dialog/enroll-alumno-dialog'
    );
    const ref = this.dialog.open(EnrollAlumnoDialog, {
      width: '500px',
      data: {
        periodoId: periodo.id,
        seccionId: sid,
        seccionNombre: seccion?.nombre ?? '',
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
    ref.afterClosed().subscribe((huboImportacion: boolean) => {
      if (huboImportacion) this.cargarMatriculas();
    });
  }

  async retirarAlumno(m: MatriculaRow): Promise<void> {
    const { ConfirmDialog } = await import(
      '../../../shared/components/confirm-dialog/confirm-dialog'
    );
    const ref = this.dialog.open(ConfirmDialog, {
      width: '400px',
      data: {
        title: '¿Retirar alumno?',
        message: `Se retirará a ${m.nombre} ${m.apellido_paterno} de ${m.grado_nombre} — Sección ${m.seccion_nombre}.`,
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
    return !!(this.gradoFiltro.value || this.seccionFiltro.value);
  }
}