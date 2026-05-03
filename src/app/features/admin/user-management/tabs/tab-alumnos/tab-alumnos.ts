import { Component, ViewChild, OnInit, signal, computed, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map, forkJoin } from 'rxjs';
import { DatePipe } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../../core/services/api';
import { UserEditService } from '../../../../../core/services/user-edit.service';
import { ResetPasswordDialog } from '../../../../../shared/components/reset-password-dialog/reset-password-dialog';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import { CreateUserDialog } from '../../../create-user-dialog/create-user-dialog/create-user-dialog';
import { UserAvatar } from '../../../../../shared/components/user-avatar/user-avatar';
import { UserDetailDialog } from '../../../user-detail-dialog/user-detail-dialog';
import type { GradeLevel, Section } from '../../../../../core/models/academic';

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
  activo?: boolean;
  grado?: string;
  grado_id?: number;
  seccion?: string;
  seccion_id?: string;
}

@Component({
  selector: 'app-tab-alumnos',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatDialogModule, MatDivider,
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
  private userEdit = inject(UserEditService);

  // ── Filtros ───────────────────────────────────────────────────
  grados = signal<GradeLevel[]>([]);
  secciones = signal<Section[]>([]);
  loadingFiltros = signal(true);

  gradoFiltro = new FormControl<number | null>(null);
  seccionFiltro = new FormControl<string | null>(null);
  busqueda = new FormControl('');

  seccionesFiltradas = computed(() => {
    const gId = this.gradoFiltro.value;
    return gId
      ? this.secciones().filter(s => s.grado_id === gId)
      : this.secciones();
  });

  // ── Datos ─────────────────────────────────────────────────────
  loading = signal(true);
  dataSource = new MatTableDataSource<AlumnoRow>([]);
  displayedColumns = ['codigo', 'documento', 'nombre', 'grado', 'nacimiento', 'telefono', 'estado', 'acciones'];

  // ── Paginación server-side ────────────────────────────────────
  total = signal(0);
  page = signal(1);    // 1-based
  pageSize = signal(20);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // ── Init ──────────────────────────────────────────────────────
  ngOnInit(): void {
    // Cargar filtros y datos iniciales en paralelo
    forkJoin({
      grados: this.api.get<GradeLevel[]>('academic/grados'),
      secciones: this.api.get<Section[]>('academic/secciones'),
    }).subscribe({
      next: ({ grados, secciones }) => {
        this.grados.set((grados as any).data ?? []);
        this.secciones.set((secciones as any).data ?? []);
        this.loadingFiltros.set(false);
        // ✅ Carga automática al entrar — primeros 20 alumnos
        this.loadData();
      },
      error: () => {
        this.loadingFiltros.set(false);
        this.loading.set(false);
      },
    });

    // Limpiar sección al cambiar grado y recargar
    this.gradoFiltro.valueChanges.subscribe(() => {
      this.seccionFiltro.setValue(null, { emitEvent: false });
      this.page.set(1);
      this.loadData();
    });

    // Búsqueda reactiva con debounce
    this.busqueda.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      map(v => v?.trim() ?? ''),
    ).subscribe(() => {
      this.page.set(1);
      this.loadData();
    });
  }

  // ── Carga ─────────────────────────────────────────────────────
  loadData(): void {
    const sid = this.seccionFiltro.value;
    const gid = this.gradoFiltro.value;
    const q = this.busqueda.value?.trim();

    const params = new URLSearchParams();
    if (sid) params.set('seccion_id', sid);
    else if (gid) params.set('grado_id', String(gid));
    if (q && q.length >= 2) params.set('q', q);
    params.set('page', String(this.page()));
    params.set('limit', String(this.pageSize()));

    this.loading.set(true);

    this.api.get<any>(`admin/users/alumnos?${params.toString()}`).subscribe({
      next: res => {
        const body = (res as any).data ?? res;
        if (Array.isArray(body)) {
          // Retrocompatible si el backend aún devuelve array plano
          this.dataSource.data = body;
          this.total.set(body.length);
        } else {
          this.dataSource.data = body.data ?? [];
          this.total.set(body.total ?? 0);
        }
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('Error al cargar alumnos', 'Error');
        this.loading.set(false);
      },
    });
  }

  // ── Filtros ───────────────────────────────────────────────────
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

  // ── Paginación ────────────────────────────────────────────────
  onPageChange(e: PageEvent): void {
    this.page.set(e.pageIndex + 1); // mat-paginator es 0-based
    this.pageSize.set(e.pageSize);
    this.loadData();
  }

  // ── Acciones ──────────────────────────────────────────────────
  abrirCrearAlumno(): void {
    this.dialog.open(CreateUserDialog, {
      width: '650px',
      disableClose: true,
      data: { rol: 'alumno' },
    }).afterClosed().subscribe(ok => { if (ok) this.loadData(); });
  }

  async editarAlumno(row: AlumnoRow): Promise<void> {
    const updated = await this.userEdit.openEdit(row as any, 'alumno');
    if (updated) this.loadData();
  }

  verDetalle(row: AlumnoRow): void {
    this.dialog.open(UserDetailDialog, {
      width: '580px',
      maxHeight: '90vh',
      autoFocus: false,
      data: { id: row.id, tipo: 'alumnos' },
    });
  }

  resetPassword(row: AlumnoRow): void {
    this.dialog.open(ResetPasswordDialog, {
      width: '400px',
      data: { id: row.id, nombre: `${row.nombre} ${row.apellido_paterno}` },
    });
  }

  toggleEstado(row: AlumnoRow): void {
    const activo = row.activo ?? true;
    this.dialog.open(ConfirmDialog, {
      width: '380px',
      data: {
        title: activo ? '¿Desactivar alumno?' : '¿Reactivar alumno?',
        message: `Estás por ${activo ? 'desactivar' : 'reactivar'} la cuenta de ${row.nombre} ${row.apellido_paterno}.`,
        confirm: activo ? 'Desactivar' : 'Reactivar',
        cancel: 'Cancelar',
        danger: activo,
      },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      const req$ = activo
        ? this.api.delete(`admin/users/${row.id}`)
        : this.api.patch(`admin/users/${row.id}/reactivar`, {});
      req$.subscribe({
        next: () => { this.toastr.success('Cambios guardados', 'Éxito'); this.loadData(); },
        error: () => this.toastr.error('Error al actualizar', 'Error'),
      });
    });
  }
}