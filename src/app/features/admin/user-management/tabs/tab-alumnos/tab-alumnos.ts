import { Component, inject, effect, ViewChild, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../../core/services/api';
import { UserEditService } from '../../../../../core/services/user-edit.service';
import { ResetPasswordDialog } from '../../../../../shared/components/reset-password-dialog/reset-password-dialog';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import { CreateUserDialog } from '../../../create-user-dialog/create-user-dialog/create-user-dialog';
import { UserAvatar } from '../../../../../shared/components/user-avatar/user-avatar';
import { UserDetailDialog } from '../../../user-detail-dialog/user-detail-dialog';

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
  seccion?: string;
}

@Component({
  selector: 'app-tab-alumnos',
  standalone: true,
  imports: [
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatDialogModule, MatDivider,
    MatFormFieldModule, MatInputModule, DatePipe,
    UserAvatar
  ],
  templateUrl: './tab-alumnos.html',
  styleUrl: './tab-alumnos.scss',
})
export class TabAlumnos implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  private router = inject(Router);
  private userEdit = inject(UserEditService);

  searchTerm = signal('');
  loading = signal(true);
  dataSource = new MatTableDataSource<AlumnoRow>([]);
  displayedColumns = ['codigo', 'documento', 'nombre', 'grado', 'nacimiento', 'telefono', 'estado', 'acciones'];

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor() {
    effect(() => {
      this.dataSource.filter = this.searchTerm().trim().toLowerCase();
      if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    });
  }

  ngOnInit() {
    this.dataSource.filterPredicate = (row: AlumnoRow, f: string) =>
      [row.codigo_estudiante, row.numero_documento ?? '',
      row.nombre, row.apellido_paterno, row.apellido_materno ?? '',
      row.grado ?? '', row.seccion ?? '']
        .join(' ').toLowerCase().includes(f);
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.api.get<any>('admin/users/alumnos').subscribe({
      next: res => {
        this.dataSource.data = res.data ?? res ?? [];
        setTimeout(() => { this.dataSource.paginator = this.paginator; });
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('Error al cargar la lista de alumnos', 'Error');
        this.loading.set(false);
      },
    });
  }

  abrirCrearAlumno() {
    this.dialog.open(CreateUserDialog, {
      width: '650px', disableClose: true,
      data: { rol: 'alumno' },
    }).afterClosed().subscribe(ok => { if (ok) this.loadData(); });
  }

  async editarAlumno(row: AlumnoRow) {
    const updated = await this.userEdit.openEdit(row as any, 'alumno');
    if (updated) this.loadData();
  }

  verDetalle(row: AlumnoRow) {
    this.dialog.open(UserDetailDialog, {
      width: '580px',
      maxHeight: '90vh',
      autoFocus: false,
      data: { id: row.id, tipo: 'alumnos' },
    });
  }

  resetPassword(row: AlumnoRow) {
    this.dialog.open(ResetPasswordDialog, {
      width: '400px',
      data: { id: row.id, nombre: `${row.nombre} ${row.apellido_paterno}` },
    });
  }

  toggleEstado(row: AlumnoRow) {
    const activo = row.activo ?? true;
    this.dialog.open(ConfirmDialog, {
      width: '380px',
      data: {
        title: activo ? '¿Desactivar alumno?' : '¿Reactivar alumno?',
        message: `Estás por ${activo ? 'desactivar' : 'reactivar'} la cuenta de ${row.nombre} ${row.apellido_paterno}.`,
        confirm: activo ? 'Desactivar' : 'Reactivar',
        danger: activo,
      },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      const req$ = activo
        ? this.api.delete(`admin/users/${row.id}`)
        : this.api.patch(`admin/users/${row.id}/reactivar`, {});
      req$.subscribe({
        next: () => { this.toastr.success('Cambios guardados', 'Éxito'); this.loadData(); },
        error: () => this.toastr.error('Ocurrió un error, intenta nuevamente', 'Error'),
      });
    });
  }
}