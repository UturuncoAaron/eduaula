import { Component, ViewChild, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { UpperCasePipe } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../../core/services/api';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import { UserDialog } from '../../../../../shared/components/user-dialog/user-dialog';
import { UserAvatar } from '../../../../../shared/components/user-avatar/user-avatar';
import { UserDetailDialog } from '../../../user-detail-dialog/user-detail-dialog';

export interface AuxiliarRow {
  id: string;
  tipo_documento?: string;
  numero_documento?: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  cargo?: string;
  tipo_contrato?: string;
  estado_contrato?: string;
  fecha_inicio_contrato?: string | null;
  fecha_fin_contrato?: string | null;
  email?: string;
  telefono?: string;
  foto_url?: string | null;
  activo: boolean;
}

@Component({
  selector: 'app-tab-auxiliares',
  standalone: true,
  imports: [
    ReactiveFormsModule, UpperCasePipe,
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatDialogModule, MatDividerModule,
    MatFormFieldModule, MatInputModule, MatTooltipModule,
    UserAvatar,
  ],
  templateUrl: './tab-auxiliar.html',
  styleUrl: './tab-auxiliar.scss',
})
export class TabAuxiliar implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  // ── Controles reactivos ───────────────────────────────────────
  busqueda = new FormControl('', { nonNullable: true });

  // ── Estados Basados en Signals ───────────────────────────────
  loading = signal<boolean>(true);
  total = signal<number>(0);
  page = signal<number>(1);
  pageSize = signal<number>(20);

  dataSource = new MatTableDataSource<AuxiliarRow>([]);
  displayedColumns: string[] = ['documento', 'nombre', 'cargo', 'contrato', 'estado', 'acciones'];

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  ngOnInit(): void {
    this.loadData();

    this.busqueda.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.page.set(1);
      this.loadData();
    });
  }

  loadData(): void {
    const q = this.busqueda.value.trim();
    const params = new URLSearchParams({
      page: String(this.page()),
      limit: String(this.pageSize())
    });

    if (q.length >= 2) {
      params.set('q', q);
    }

    this.loading.set(true);
    this.api.get<any>(`admin/users/auxiliares?${params.toString()}`).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        const body = res?.data ?? res;
        this.dataSource.data = Array.isArray(body) ? body : (body.data ?? []);
        this.total.set(Array.isArray(body) ? body.length : (body.total ?? 0));
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('Error al cargar la lista de auxiliares', 'Error');
        this.loading.set(false);
      },
    });
  }

  onPageChange(e: PageEvent): void {
    this.page.set(e.pageIndex + 1);
    this.pageSize.set(e.pageSize);
    this.loadData();
  }

  limpiarBusqueda(): void {
    this.busqueda.setValue('');
    this.page.set(1);
    this.loadData();
  }

  // ── Orquestación de Diálogos Adaptativos ─────────────────────
  abrirCrearAuxiliar(): void {
    this.dialog.open(UserDialog, {
      width: '100%',
      maxWidth: '700px',
      disableClose: true,
      data: { mode: 'create', rol: 'auxiliar' },
    }).afterClosed().pipe(filter(Boolean)).subscribe(() => this.loadData());
  }

  editarAuxiliar(row: AuxiliarRow): void {
    this.dialog.open(UserDialog, {
      width: '100%',
      maxWidth: '700px',
      disableClose: true,
      data: {
        mode: 'edit',
        rol: 'auxiliar',
        isSelf: false,
        user: {
          id: row.id,
          rol: 'auxiliar',
          nombre: row.nombre,
          apellido_paterno: row.apellido_paterno,
          apellido_materno: row.apellido_materno ?? '',
          email: row.email ?? '',
          telefono: row.telefono ?? '',
          foto_url: row.foto_url ?? null,
          tipo_documento: row.tipo_documento ?? 'dni',
          numero_documento: row.numero_documento ?? '',
          cargo: row.cargo ?? '',
        },
      },
    }).afterClosed().pipe(filter(result => result?.updated)).subscribe(() => this.loadData());
  }

  verDetalle(row: AuxiliarRow): void {
    this.dialog.open(UserDetailDialog, {
      width: '100%',
      maxWidth: '580px',
      maxHeight: '90vh',
      autoFocus: false,
      data: { id: row.id, tipo: 'auxiliares' },
    });
  }

  toggleEstado(row: AuxiliarRow): void {
    const activo = row.activo ?? true;
    const accion = activo ? 'desactivar' : 'reactivar';

    this.dialog.open(ConfirmDialog, {
      width: '100%',
      maxWidth: '380px',
      data: {
        title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} auxiliar?`,
        message: `Estás por ${accion} la cuenta de ${row.nombre} ${row.apellido_paterno}.`,
        confirm: accion.charAt(0).toUpperCase() + accion.slice(1),
        cancel: 'Cancelar',
        danger: activo,
      },
    }).afterClosed().pipe(
      filter(Boolean),
      switchMap(() => activo
        ? this.api.delete(`admin/users/${row.id}`)
        : this.api.patch(`admin/users/${row.id}/reactivar`, {})
      )
    ).subscribe({
      next: () => {
        this.toastr.success('Cambios guardados con éxito.', 'Éxito');
        this.loadData();
      },
      error: () => this.toastr.error('Ocurrió un error al procesar el cambio de estado.', 'Error'),
    });
  }
}