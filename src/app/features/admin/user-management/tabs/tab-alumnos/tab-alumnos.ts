import { Component, ViewChild, OnInit, signal, computed, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, filter, switchMap, forkJoin } from 'rxjs';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../../core/services/api';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import { UserDialog } from '../../../../../shared/components/user-dialog/user-dialog';
import { UserAvatar } from '../../../../../shared/components/user-avatar/user-avatar';
import { UserDetailDialog } from '../../../user-detail-dialog/user-detail-dialog';
import type { GradeLevel, Section } from '../../../../../core/models/academic';
import { User } from '@core/models/user';

export interface AlumnoRow {
  id: string;
  codigo_estudiante: string;
  numero_documento?: string;
  tipo_documento?: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  fecha_nacimiento?: string;
  telefono?: string;
  email?: string;
  foto_url?: string | null;
  activo: boolean;
  inclusivo: boolean;
  grado?: string;
  grado_id?: string;
  seccion?: string;
  seccion_id?: string;
}

@Component({
  selector: 'app-tab-alumnos',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, UpperCasePipe,
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatDialogModule, MatDividerModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule,
    UserAvatar,
  ],
  templateUrl: './tab-alumnos.html',
  styleUrl: './tab-alumnos.scss',
})
export class TabAlumnos implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  grados = signal<GradeLevel[]>([]);
  secciones = signal<Section[]>([]);
  loadingFiltros = signal<boolean>(true);

  gradoFiltro = new FormControl<string | null>(null);
  seccionFiltro = new FormControl<string | null>(null);
  busqueda = new FormControl('', { nonNullable: true });

  seccionesFiltradas = computed(() => {
    const gId = this.gradoFiltro.value;
    return gId
      ? this.secciones().filter(s => s.grado_id === gId)
      : this.secciones();
  });

  loading = signal<boolean>(true);
  dataSource = new MatTableDataSource<AlumnoRow>([]);
  displayedColumns: string[] = ['codigo', 'documento', 'nombre', 'grado', 'nacimiento', 'telefono', 'estado', 'acciones'];

  total = signal<number>(0);
  page = signal<number>(1);
  pageSize = signal<number>(20);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  ngOnInit(): void {
    this.initAcademicFilters();
    this.setupReactiveStreams();
  }

  private initAcademicFilters(): void {
    this.loadingFiltros.set(true);

    forkJoin({
      grados: this.api.get<GradeLevel[]>('academic/grados'),
      secciones: this.api.get<Section[]>('academic/secciones'),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ grados, secciones }) => {
        this.grados.set((grados as any).data ?? []);
        this.secciones.set((secciones as any).data ?? []);
        this.loadingFiltros.set(false);
        this.loadData();
      },
      error: () => {
        this.toastr.error('Error al inicializar la estructura de los filtros académicos.', 'Error');
        this.loadingFiltros.set(false);
        this.loading.set(false);
      },
    });
  }

  private setupReactiveStreams(): void {
    this.gradoFiltro.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.seccionFiltro.setValue(null, { emitEvent: false });
      this.page.set(1);
      this.loadData();
    });

    this.busqueda.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.page.set(1);
      this.loadData();
    });
  }

  loadData(): void {
    const sid = this.seccionFiltro.value;
    const gid = this.gradoFiltro.value;
    const q = this.busqueda.value.trim();

    const params = new URLSearchParams({
      page: String(this.page()),
      limit: String(this.pageSize())
    });

    if (sid) params.set('seccion_id', sid);
    else if (gid) params.set('grado_id', String(gid));

    if (q.length >= 2) params.set('q', q);

    this.loading.set(true);

    this.api.get<any>(`admin/users/alumnos?${params.toString()}`).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        const body = res?.data ?? res;
        this.dataSource.data = Array.isArray(body) ? body : (body.data ?? []);
        this.total.set(Array.isArray(body) ? body.length : (body.total ?? 0));
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('Ocurrió un error al cargar la lista de alumnos.', 'Error');
        this.loading.set(false);
      },
    });
  }

  aplicarFiltros(): void {
    this.page.set(1);
    this.loadData();
  }

  limpiarFiltros(): void {
    this.gradoFiltro.setValue(null, { emitEvent: false });
    this.seccionFiltro.setValue(null, { emitEvent: false });
    this.busqueda.setValue('', { emitEvent: false });
    this.page.set(1);
    this.loadData();
  }

  hayFiltrosActivos(): boolean {
    return !!(this.gradoFiltro.value || this.seccionFiltro.value || this.busqueda.value);
  }

  onPageChange(e: PageEvent): void {
    this.page.set(e.pageIndex + 1);
    this.pageSize.set(e.pageSize);
    this.loadData();
  }

  abrirCrearAlumno(): void {
    this.dialog.open(UserDialog, {
      width: '90vw',
      maxWidth: '520px',
      disableClose: true,
      autoFocus: false,
      panelClass: 'custom-modal-panel',
      data: { mode: 'create', rol: 'alumno' },
    }).afterClosed().pipe(filter(Boolean)).subscribe(() => this.loadData());
  }

  editarAlumno(row: AlumnoRow): void {
    this.dialog.open(UserDialog, {
      width: '90vw',
      maxWidth: '520px',
      disableClose: true,
      autoFocus: false,
      panelClass: 'custom-modal-panel',
      data: {
        mode: 'edit',
        rol: 'alumno',
        isSelf: false,
        user: {
          id: row.id,
          rol: 'alumno',
          nombre: row.nombre,
          apellido_paterno: row.apellido_paterno,
          apellido_materno: row.apellido_materno ?? '',
          email: row.email ?? '',
          telefono: row.telefono ?? '',
          foto_url: null,
          tipo_documento: row.tipo_documento ?? 'dni',
          numero_documento: row.numero_documento ?? '',
          inclusivo: row.inclusivo ?? false,
        } as unknown as User,
      },
    }).afterClosed().pipe(filter(result => result?.updated)).subscribe(() => this.loadData());
  }

  verDetalle(row: AlumnoRow): void {
    this.dialog.open(UserDetailDialog, {
      width: '90vw',
      maxWidth: '520px',
      maxHeight: '85vh',
      autoFocus: false,
      data: { id: row.id, tipo: 'alumnos' },
    });
  }

  toggleEstado(row: AlumnoRow): void {
    const activo = row.activo ?? true;

    this.dialog.open(ConfirmDialog, {
      width: '85vw',
      maxWidth: '360px',
      data: {
        title: activo ? '¿Desactivar alumno?' : '¿Reactivar alumno?',
        message: `Estás por ${activo ? 'desactivar' : 'reactivar'} la cuenta de ${row.nombre} ${row.apellido_paterno}.`,
        confirm: activo ? 'Desactivar' : 'Reactivar',
        cancel: 'Cancelar',
        danger: activo,
      },
    }).afterClosed().pipe(
      filter(Boolean),
      switchMap(() => activo
        ? this.api.delete(`admin/users/${row.id}`)
        : this.api.patch(`admin/users/${row.id}/reactivar`, {})
      )
    ).subscribe({
      next: () => {
        this.toastr.success('Cambios guardados con éxito.', 'Éxito');
        this.loadData();
      },
      error: () => this.toastr.error('Error al intentar actualizar el estado de la cuenta.', 'Error'),
    });
  }
}