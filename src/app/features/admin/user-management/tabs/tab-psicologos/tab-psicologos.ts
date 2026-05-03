import { Component, inject, effect, ViewChild, OnInit, signal } from '@angular/core';
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
import { AssignStudentsDialog } from './dialogs/assign-students-dialog/assign-students-dialog';
import { UserAvatar } from '../../../../../shared/components/user-avatar/user-avatar';
import { UserDetailDialog } from '../../../user-detail-dialog/user-detail-dialog';

export interface PsicologaRow {
  id: string;
  dni: string;
  tipo_documento?: string;
  nombres: string;
  apellidos: string;
  apellido_paterno: string;
  apellido_materno?: string;
  especialidad: string;
  correo: string;
  telefono?: string;
  foto_url?: string | null;
  activo: boolean;
}

@Component({
  selector: 'app-tab-psicologos',
  standalone: true,
  imports: [
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatDialogModule, MatDivider,
    MatFormFieldModule, MatInputModule,
    UserAvatar
  ],
  templateUrl: './tab-psicologos.html',
  styleUrl: './tab-psicologos.scss',
})
export class TabPsicologos implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  private userEdit = inject(UserEditService);

  searchTerm = signal('');
  loading = signal(true);
  dataSource = new MatTableDataSource<PsicologaRow>([]);
  displayedColumns = ['dni', 'nombre', 'especialidad', 'contacto', 'estado', 'acciones'];

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor() {
    effect(() => {
      this.dataSource.filter = this.searchTerm().trim().toLowerCase();
      if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    });
  }

  ngOnInit() {
    this.dataSource.filterPredicate = (row: PsicologaRow, f: string) =>
      [row.dni, row.nombres, row.apellidos, row.especialidad]
        .join(' ').toLowerCase().includes(f);
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.api.get<any>('admin/users/psicologos').subscribe({
      next: res => {
        this.dataSource.data = res.data ?? res ?? [];
        setTimeout(() => { this.dataSource.paginator = this.paginator; });
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('Error al cargar la lista de psicólogas', 'Error');
        this.loading.set(false);
      },
    });
  }

  abrirCrearPsicologa() {
    this.dialog.open(CreateUserDialog, {
      width: '650px', disableClose: true,
      data: { rol: 'psicologa' },
    }).afterClosed().subscribe(ok => { if (ok) this.loadData(); });
  }

  async editarPsicologa(row: PsicologaRow) {
    // El backend devuelve nombres/apellidos pero EditProfileDialog espera nombre/apellido_paterno
    const updated = await this.userEdit.openEdit({
      id: row.id,
      nombre: row.nombres,
      apellido_paterno: row.apellido_paterno,
      apellido_materno: row.apellido_materno,
      email: row.correo,
      telefono: row.telefono,
      foto_url: row.foto_url,
    } as any, 'psicologa');
    if (updated) this.loadData();
  }

  asignarAlumnos(row: PsicologaRow) {
    this.dialog.open(AssignStudentsDialog, {
      width: '640px', maxHeight: '85vh', autoFocus: false,
      data: { psicologaId: row.id, psicologaNombre: `${row.nombres} ${row.apellidos}`.trim() },
    });
  }

  resetPassword(row: PsicologaRow) {
    this.dialog.open(ResetPasswordDialog, {
      width: '400px',
      data: { id: row.id, nombre: `${row.nombres} ${row.apellidos}` },
    });
  }

  toggleEstado(row: PsicologaRow) {
    this.dialog.open(ConfirmDialog, {
      width: '380px',
      data: {
        title: row.activo ? '¿Desactivar cuenta?' : '¿Reactivar cuenta?',
        message: `Estás por ${row.activo ? 'desactivar' : 'reactivar'} la cuenta de ${row.nombres}.`,
        confirm: row.activo ? 'Desactivar' : 'Reactivar',
        danger: row.activo,
      },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      const req$ = row.activo
        ? this.api.delete(`admin/users/${row.id}`)
        : this.api.patch(`admin/users/${row.id}/reactivar`, {});
      req$.subscribe({
        next: () => { this.toastr.success('Cambios guardados', 'Éxito'); this.loadData(); },
        error: () => this.toastr.error('Error al procesar la solicitud', 'Error'),
      });
    });
  }
  verDetalle(row: PsicologaRow) {
    this.dialog.open(UserDetailDialog, {
      width: '580px',
      maxHeight: '90vh',
      autoFocus: false,
      data: { id: row.id, tipo: 'psicologos' },
    });
  }
}