import {
  Component, inject, input, effect,
  ViewChild, OnInit, signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
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
import { UpperCasePipe } from '@angular/common';
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
  activo?: boolean;
  grado?: string;
  seccion?: string;
}

@Component({
  selector: 'app-tab-alumnos',
  imports: [
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatDialogModule, MatSnackBarModule, MatDivider,  DatePipe
  ],
  templateUrl: './tab-alumnos.html',
  styleUrl: './tab-alumnos.scss',
})
export class TabAlumnos implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  active = input<boolean>(false);
  searchTerm = input<string>('');

  dataSource = new MatTableDataSource<AlumnoRow>([]);
  displayedColumns = ['codigo', 'documento', 'nombre', 'grado', 'nacimiento', 'telefono', 'estado', 'acciones'];
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
    this.dataSource.filterPredicate = (row: AlumnoRow, filter: string) =>
      [row.codigo_estudiante, row.numero_documento ?? '',
      row.nombre, row.apellido_paterno, row.apellido_materno ?? '',
      row.grado ?? '', row.seccion ?? '']
        .join(' ').toLowerCase().includes(filter);
  }

  loadData() {
    this.loading.set(true);
    this.api.get<AlumnoRow[]>('admin/users/alumnos').subscribe({
      next: (res) => {
        this.dataSource.data = res.data ?? [];
        setTimeout(() => { this.dataSource.paginator = this.paginator; });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  verDetalle(row: AlumnoRow) {
    console.log('Ver detalle alumno:', row);
    // TODO: this.dialog.open(UserDetailDialog, { data: { id: row.id, rol: 'alumno' } });
  }

  resetPassword(row: AlumnoRow) {
    this.dialog.open(ResetPasswordDialog, {
      width: '400px',
      data: { id: row.id, nombre: `${row.nombre} ${row.apellido_paterno}` },
    });
  }

  toggleEstado(row: AlumnoRow) {
    const activo = row.activo ?? true;
    const ref = this.dialog.open(ConfirmDialog, {
      width: '380px',
      data: {
        titulo: activo ? '¿Desactivar alumno?' : '¿Reactivar alumno?',
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