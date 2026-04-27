// ═══════════════════════════════════════════
// tab-docentes.ts
// ═══════════════════════════════════════════
import {
  Component, inject, input, effect,
  ViewChild, OnInit, signal,
} from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../../core/services/api';
import { ResetPasswordDialog } from '../../../../../shared/components/reset-password-dialog/reset-password-dialog';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import { MatDivider } from '@angular/material/divider';

export interface DocenteRow {
  id: string;
  tipo_documento?: string;
  numero_documento?: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  especialidad?: string;
  titulo_profesional?: string;
  email?: string;
  telefono?: string;
  activo?: boolean;
}

@Component({
  selector: 'app-tab-docentes',
  standalone: true,
  imports: [
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatDialogModule, MatSnackBarModule, MatDivider
  ],
  templateUrl: './tab-docentes.html',
  styleUrl: './tab-docentes.scss',
})
export class TabDocentes implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  active = input<boolean>(false);
  searchTerm = input<string>('');

  dataSource = new MatTableDataSource<DocenteRow>([]);
  displayedColumns = ['documento', 'nombre', 'especialidad', 'estado', 'acciones'];
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
    this.dataSource.filterPredicate = (row: DocenteRow, filter: string) =>
      [row.numero_documento ?? '', row.nombre, row.apellido_paterno,
      row.apellido_materno ?? '', row.especialidad ?? '']
        .join(' ').toLowerCase().includes(filter);
  }

  loadData() {
    this.loading.set(true);
    this.api.get<DocenteRow[]>('admin/users/docentes').subscribe({
      next: (res) => {
        this.dataSource.data = res.data ?? [];
        setTimeout(() => { this.dataSource.paginator = this.paginator; });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  verDetalle(row: DocenteRow) {
    console.log('Ver detalle docente:', row);
  }

  resetPassword(row: DocenteRow) {
    this.dialog.open(ResetPasswordDialog, {
      width: '400px',
      data: { id: row.id, nombre: `${row.nombre} ${row.apellido_paterno}` },
    });
  }

  toggleEstado(row: DocenteRow) {
    const activo = row.activo ?? true;
    const ref = this.dialog.open(ConfirmDialog, {
      width: '380px',
      data: {
        titulo: activo ? '¿Desactivar docente?' : '¿Reactivar docente?',
        mensaje: `Estás por ${activo ? 'desactivar' : 'reactivar'} la cuenta de ${row.nombre} ${row.apellido_paterno}.`,
        peligro: activo,
      },
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      const req$ = activo
        ? this.api.delete(`admin/users/${row.id}`)
        : this.api.patch(`admin/users/${row.id}/reactivar`, {});
      req$.subscribe({
        next: () => { this.snack.open('Estado actualizado', 'Cerrar', { duration: 3000 }); this.loadData(); },
        error: () => this.snack.open('Error al cambiar estado', 'Cerrar', { duration: 3000 }),
      });
    });
  }
}