import {
  Component, inject, input, effect,
  ViewChild, OnInit, signal,
} from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../../core/services/api';
import { ResetPasswordDialog } from '../../../../../shared/components/reset-password-dialog/reset-password-dialog';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import { MatDivider } from '@angular/material/divider';
import { UpperCasePipe } from '@angular/common';

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
  imports: [
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatChipsModule,
    MatDialogModule, MatSnackBarModule, MatDivider, UpperCasePipe
  ],
  templateUrl: './tab-admins.html',
  styleUrl: './tab-admins.scss',
})
export class TabAdmins implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  active = input<boolean>(false);
  searchTerm = input<string>('');

  dataSource = new MatTableDataSource<AdminRow>([]);
  displayedColumns = ['documento', 'nombre', 'cargo', 'estado', 'acciones'];
  loading = signal(true);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor() {
    effect(() => { if (this.active()) this.loadData(); });
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
  }

  loadData() {
    this.loading.set(true);
    this.api.get<AdminRow[]>('admin/users/admins').subscribe({
      next: (res) => {
        this.dataSource.data = res.data ?? [];
        setTimeout(() => { this.dataSource.paginator = this.paginator; });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  verDetalle(row: AdminRow) {
    // El modal de detalle lo implementará el equipo — emitimos el objeto
    console.log('Ver detalle admin:', row);
    // TODO: this.dialog.open(UserDetailDialog, { data: { id: row.id, rol: 'admin' } });
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
          this.snack.open(`Cuenta ${row.activo ? 'desactivada' : 'reactivada'}`, 'Cerrar', { duration: 3000 });
          this.loadData();
        },
        error: () => this.snack.open('Error al cambiar estado', 'Cerrar', { duration: 3000 }),
      });
    });
  }
}