import { Component, inject, effect, ViewChild, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { UpperCasePipe } from '@angular/common';
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

export interface AdminRow {
  id: string;
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  cargo?: string;
  email?: string;
  telefono?: string;
  foto_url?: string | null;
  activo: boolean;
  created_at: string;
}

@Component({
  selector: 'app-tab-admins',
  standalone: true,
  imports: [
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatDialogModule,
    MatDivider, UpperCasePipe,
    MatFormFieldModule, MatInputModule,
    UserAvatar,
  ],
  templateUrl: './tab-admins.html',
  styleUrl: './tab-admins.scss',
})
export class TabAdmins implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  private router = inject(Router);
  private userEdit = inject(UserEditService);

  searchTerm = signal('');
  loading = signal(true);
  dataSource = new MatTableDataSource<AdminRow>([]);
  displayedColumns = ['documento', 'nombre', 'cargo', 'estado', 'acciones'];

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor() {
    effect(() => {
      this.dataSource.filter = this.searchTerm().trim().toLowerCase();
      if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    });
  }

  ngOnInit() {
    this.dataSource.filterPredicate = (row: AdminRow, f: string) =>
      [row.numero_documento, row.nombre, row.apellido_paterno,
      row.apellido_materno ?? '', row.cargo ?? '']
        .join(' ').toLowerCase().includes(f);
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.api.get<any>('admin/users/admins').subscribe({
      next: res => {
        this.dataSource.data = res.data ?? res ?? [];
        setTimeout(() => { this.dataSource.paginator = this.paginator; });
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('Error al cargar administradores', 'Error');
        this.loading.set(false);
      },
    });
  }

  abrirCrearAdmin() {
    this.dialog.open(CreateUserDialog, {
      width: '650px',
      disableClose: true,
      data: { rol: 'admin' },
    }).afterClosed().subscribe(ok => { if (ok) this.loadData(); });
  }

  async editarAdmin(row: AdminRow) {
    const updated = await this.userEdit.openEdit(row as any, 'admin');
    if (updated) this.loadData();
  }

  verDetalle(row: AdminRow) {
    this.dialog.open(UserDetailDialog, {
      width: '580px',
      maxHeight: '90vh',
      autoFocus: false,
      data: { id: row.id, tipo: 'admins' },
    });
  }

  resetPassword(row: AdminRow) {
    this.dialog.open(ResetPasswordDialog, {
      width: '400px',
      data: { id: row.id, nombre: `${row.nombre} ${row.apellido_paterno}` },
    });
  }

  toggleEstado(row: AdminRow) {
    const accion = row.activo ? 'desactivar' : 'reactivar';
    this.dialog.open(ConfirmDialog, {
      width: '380px',
      data: {
        title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} cuenta?`,
        message: `Estás por ${accion} la cuenta de ${row.nombre} ${row.apellido_paterno}.`,
        confirm: accion.charAt(0).toUpperCase() + accion.slice(1),
        danger: row.activo,
      },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      const req$ = row.activo
        ? this.api.delete(`admin/users/${row.id}`)
        : this.api.patch(`admin/users/${row.id}/reactivar`, {});
      req$.subscribe({
        next: () => { this.toastr.success('Cambios guardados', 'Éxito'); this.loadData(); },
        error: () => this.toastr.error('Error al procesar', 'Error'),
      });
    });
  }
}