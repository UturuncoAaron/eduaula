import {
  Component, inject, effect,
  ViewChild, OnInit, signal,
} from '@angular/core';
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
import { ResetPasswordDialog } from '../../../../../shared/components/reset-password-dialog/reset-password-dialog';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';

// Importa tu diálogo de creación (Ajusta la ruta si es necesario)
import { CreateUserDialog } from '../../../create-user-dialog/create-user-dialog/create-user-dialog';

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
  standalone: true,
  imports: [
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatDialogModule, MatDivider,
    MatFormFieldModule, MatInputModule, DatePipe,
  ],
  templateUrl: './tab-alumnos.html',
  styleUrl: './tab-alumnos.scss',
})
export class TabAlumnos implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  private router = inject(Router);

  // Buscador reactivo
  searchTerm = signal<string>('');

  dataSource = new MatTableDataSource<AlumnoRow>([]);
  displayedColumns = ['codigo', 'documento', 'nombre', 'grado', 'nacimiento', 'telefono', 'estado', 'acciones'];
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
    this.dataSource.filterPredicate = (row: AlumnoRow, filter: string) =>
      [row.codigo_estudiante, row.numero_documento ?? '',
      row.nombre, row.apellido_paterno, row.apellido_materno ?? '',
      row.grado ?? '', row.seccion ?? '']
        .join(' ').toLowerCase().includes(filter);

    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.api.get<any>('admin/users/alumnos').subscribe({
      next: (res) => {
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

  // ─── NUEVO: Abrir Modal de Creación ──────────────────────────────────────────
  abrirCrearAlumno() {
    const dialogRef = this.dialog.open(CreateUserDialog, {
      width: '650px', // Ancho recomendado para formularios a 2 columnas
      disableClose: true, // Evita que se cierre al hacer clic afuera por accidente
      data: { rol: 'alumno' } // Le pasamos el rol para que renderice los campos correctos
    });

    // Escuchamos cuando se cierra el modal
    dialogRef.afterClosed().subscribe((creado: boolean) => {
      // Si el modal devuelve 'true' (se guardó algo), recargamos la tabla
      if (creado) {
        this.loadData();
      }
    });
  }

  // ─── Lógica existente ──────────────────────────────────────────────────────
  verDetalle(row: AlumnoRow) {
    this.router.navigate(['/admin/usuarios', 'alumnos', row.id]);
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
        next: () => {
          this.toastr.success(
            activo ? 'Registro eliminado correctamente' : 'Cambios guardados correctamente', 'Éxito'
          );
          this.loadData();
        },
        error: () => this.toastr.error('Ocurrió un error, intenta nuevamente', 'Error'),
      });
    });
  }
}