import {
  Component, inject, effect,
  ViewChild, OnInit, signal,
} from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { UpperCasePipe } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../../core/services/api';
import { ResetPasswordDialog } from '../../../../../shared/components/reset-password-dialog/reset-password-dialog';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import { CreateUserDialog } from '../../../create-user-dialog/create-user-dialog/create-user-dialog';

export interface AdminRow {
  id: string;
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  cargo?: string;
  email?: string;
  activo: boolean;
  created_at: string;
}

@Component({
  selector: 'app-tab-admins',
  standalone: true, // Asegúrate de que sea standalone
  imports: [
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatChipsModule,
    MatDialogModule, MatDivider, UpperCasePipe,
    MatFormFieldModule, MatInputModule
  ],
  templateUrl: './tab-admins.html',
  styleUrl: './tab-admins.scss',
})
export class TabAdmins implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);

  // Buscador reactivo
  searchTerm = signal<string>('');

  dataSource = new MatTableDataSource<AdminRow>([]);
  displayedColumns = ['documento', 'nombre', 'cargo', 'estado', 'acciones'];
  loading = signal(true);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor() {
    // Efecto para filtrar la tabla cada vez que el signal searchTerm cambie
    effect(() => {
      this.dataSource.filter = this.searchTerm().trim().toLowerCase();
      if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    });
  }

  ngOnInit() {
    this.dataSource.filterPredicate = (row: AdminRow, filter: string) =>
      [row.numero_documento, row.nombre, row.apellido_paterno,
      row.apellido_materno ?? '', row.cargo ?? '']
        .join(' ').toLowerCase().includes(filter);

    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.api.get<any>('admin/users/admins').subscribe({
      next: (res) => {
        this.dataSource.data = res.data ?? res ?? [];
        setTimeout(() => { this.dataSource.paginator = this.paginator; });
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('Error al cargar la lista de administradores', 'Error');
        this.loading.set(false);
      }
    });
  }

  // ─── NUEVO: Abrir Modal de Creación ──────────────────────────────────────────
  abrirCrearAdmin() {
    const dialogRef = this.dialog.open(CreateUserDialog, {
      width: '650px',
      disableClose: true,
      data: { rol: 'admin' } // Pasamos el rol para renderizar campos de admin
    });

    dialogRef.afterClosed().subscribe((creado: boolean) => {
      if (creado) {
        this.loadData();
      }
    });
  }

  // ─── Lógica existente ──────────────────────────────────────────────────────
  verDetalle(row: AdminRow) {
    console.log('Ver detalle admin:', row);
    // TODO: Redirigir a vista de detalle
  }

  resetPassword(row: AdminRow) {
    this.dialog.open(ResetPasswordDialog, {
      width: '400px',
      data: { id: row.id, nombre: `${row.nombre} ${row.apellido_paterno}` },
    });
  }

  toggleEstado(row: AdminRow) {
    const accion = row.activo ? 'desactivar' : 'reactivar';
    const nombre = `${row.nombre} ${row.apellido_paterno}`;
    const ref = this.dialog.open(ConfirmDialog, {
      width: '380px',
      data: {
        titulo: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} cuenta?`,
        mensaje: `Estás por ${accion} la cuenta de ${nombre}.`,
        accion,
        peligro: row.activo,
      },
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      const req$ = row.activo
        ? this.api.delete(`admin/users/${row.id}`)
        : this.api.patch(`admin/users/${row.id}/reactivar`, {});
      req$.subscribe({
        next: () => {
          this.toastr.success(
            row.activo ? 'Registro eliminado correctamente' : 'Cambios guardados correctamente',
            'Éxito',
          );
          this.loadData();
        },
        error: () => this.toastr.error('Ocurrió un error, intenta nuevamente', 'Error'),
      });
    });
  }
}