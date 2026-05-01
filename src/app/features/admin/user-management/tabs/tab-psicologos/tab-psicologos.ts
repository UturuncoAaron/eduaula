import {
  Component, inject, effect,
  ViewChild, OnInit, signal,
} from '@angular/core';
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
import { CreateUserDialog } from '../../../create-user-dialog/create-user-dialog/create-user-dialog';

export interface PsicologaRow {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  especialidad: string;
  correo: string;
  telefono?: string;
  activo: boolean;
}

@Component({
  selector: 'app-tab-psicologos',
  standalone: true,
  imports: [
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatDialogModule, MatDivider,
    MatFormFieldModule, MatInputModule
  ],
  templateUrl: './tab-psicologos.html',
  styleUrl: './tab-psicologos.scss',
})
export class TabPsicologos implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);

  searchTerm = signal<string>('');
  dataSource = new MatTableDataSource<PsicologaRow>([]);
  displayedColumns = ['dni', 'nombre', 'especialidad', 'contacto', 'estado', 'acciones'];
  loading = signal(true);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor() {
    effect(() => {
      this.dataSource.filter = this.searchTerm().trim().toLowerCase();
      if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    });
  }

  ngOnInit() {
    this.dataSource.filterPredicate = (row: PsicologaRow, filter: string) =>
      [row.dni, row.nombres, row.apellidos, row.especialidad]
        .join(' ').toLowerCase().includes(filter);

    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    // Endpoint basado en tu estructura de backend
    this.api.get<any>('admin/users/psicologos').subscribe({
      next: (res) => {
        this.dataSource.data = res.data ?? res ?? [];
        setTimeout(() => { this.dataSource.paginator = this.paginator; });
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('Error al cargar la lista de psicólogas', 'Error');
        this.loading.set(false);
      }
    });
  }

  abrirCrearPsicologa() {
    const dialogRef = this.dialog.open(CreateUserDialog, {
      width: '650px',
      disableClose: true,
      data: { rol: 'psicologa' }
    });

    dialogRef.afterClosed().subscribe((creado: boolean) => {
      if (creado) this.loadData();
    });
  }

  resetPassword(row: PsicologaRow) {
    this.dialog.open(ResetPasswordDialog, {
      width: '400px',
      data: { id: row.id, nombre: `${row.nombres} ${row.apellidos}` },
    });
  }

  toggleEstado(row: PsicologaRow) {
    const activo = row.activo;
    const ref = this.dialog.open(ConfirmDialog, {
      width: '380px',
      data: {
        titulo: activo ? '¿Desactivar cuenta?' : '¿Reactivar cuenta?',
        mensaje: `Estás por ${activo ? 'desactivar' : 'reactivar'} la cuenta de la psicóloga ${row.nombres}.`,
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
          this.toastr.success('Cambios guardados correctamente', 'Éxito');
          this.loadData();
        },
        error: () => this.toastr.error('Ocurrió un error al procesar la solicitud', 'Error'),
      });
    });
  }
}