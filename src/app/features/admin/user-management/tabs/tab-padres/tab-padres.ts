import { Component, inject, effect, ViewChild, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
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

export interface PadreRow {
  id: string;
  tipo_documento?: string;
  numero_documento?: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  relacion: string;
  email?: string;
  telefono?: string;
  foto_url?: string | null;
  activo?: boolean;
}

const RELACION_LABEL: Record<string, string> = {
  padre: 'Padre', madre: 'Madre',
  tutor: 'Tutor Legal', apoderado: 'Apoderado',
};

@Component({
  selector: 'app-tab-padres',
  standalone: true,
  imports: [
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatDialogModule, MatDivider,
    MatFormFieldModule, MatInputModule,
    UserAvatar
  ],
  templateUrl: './tab-padres.html',
  styleUrl: './tab-padres.scss',
})
export class TabPadres implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  private router = inject(Router);
  private userEdit = inject(UserEditService);

  searchTerm = signal('');
  loading = signal(true);
  dataSource = new MatTableDataSource<PadreRow>([]);
  displayedColumns = ['documento', 'nombre', 'relacion', 'estado', 'acciones'];
  readonly relacionLabel = RELACION_LABEL;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor() {
    effect(() => {
      this.dataSource.filter = this.searchTerm().trim().toLowerCase();
      if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    });
  }

  ngOnInit() {
    this.dataSource.filterPredicate = (row: PadreRow, f: string) =>
      [row.numero_documento ?? '', row.nombre, row.apellido_paterno,
      row.apellido_materno ?? '', row.relacion]
        .join(' ').toLowerCase().includes(f);
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.api.get<any>('admin/users/padres').subscribe({
      next: res => {
        this.dataSource.data = res.data ?? res ?? [];
        setTimeout(() => { this.dataSource.paginator = this.paginator; });
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('Error al cargar la lista de padres/tutores', 'Error');
        this.loading.set(false);
      },
    });
  }

  abrirCrearPadre() {
    this.dialog.open(CreateUserDialog, {
      width: '650px', disableClose: true,
      data: { rol: 'padre' },
    }).afterClosed().subscribe(ok => { if (ok) this.loadData(); });
  }

  async editarPadre(row: PadreRow) {
    const updated = await this.userEdit.openEdit(row as any, 'padre');
    if (updated) this.loadData();
  }

  verDetalle(row: PadreRow) {
    this.dialog.open(UserDetailDialog, {
      width: '580px',
      maxHeight: '90vh',
      autoFocus: false,
      data: { id: row.id, tipo: 'padres' },
    });
  }

  resetPassword(row: PadreRow) {
    this.dialog.open(ResetPasswordDialog, {
      width: '400px',
      data: { id: row.id, nombre: `${row.nombre} ${row.apellido_paterno}` },
    });
  }

  toggleEstado(row: PadreRow) {
    const activo = row.activo ?? true;
    this.dialog.open(ConfirmDialog, {
      width: '380px',
      data: {
        title: activo ? '¿Desactivar tutor?' : '¿Reactivar tutor?',
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