import { Component, ViewChild, OnInit, signal, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../../core/services/api';
import { ConfirmDialog } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import { UserDialog } from '../../../../../shared/components/user-dialog/user-dialog';
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
    ReactiveFormsModule,
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule, MatDialogModule, MatDivider,
    MatFormFieldModule, MatInputModule, MatTooltipModule,
    UserAvatar,
  ],
  templateUrl: './tab-padres.html',
  styleUrl: './tab-padres.scss',
})
export class TabPadres implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);

  busqueda = new FormControl('');

  loading = signal(true);
  dataSource = new MatTableDataSource<PadreRow>([]);
  displayedColumns = ['documento', 'nombre', 'relacion', 'estado', 'acciones'];
  readonly relacionLabel = RELACION_LABEL;

  total = signal(0);
  page = signal(1);
  pageSize = signal(20);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  ngOnInit(): void {
    this.loadData();

    this.busqueda.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      map(v => v?.trim() ?? ''),
    ).subscribe(() => {
      this.page.set(1);
      this.loadData();
    });
  }

  loadData(): void {
    const q = this.busqueda.value?.trim();
    const params = new URLSearchParams();
    if (q && q.length >= 2) params.set('q', q);
    params.set('page', String(this.page()));
    params.set('limit', String(this.pageSize()));

    this.loading.set(true);
    this.api.get<any>(`admin/users/padres?${params.toString()}`).subscribe({
      next: res => {
        const body = (res as any).data ?? res;
        if (Array.isArray(body)) {
          this.dataSource.data = body;
          this.total.set(body.length);
        } else {
          this.dataSource.data = body.data ?? [];
          this.total.set(body.total ?? 0);
        }
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('Error al cargar padres/tutores', 'Error');
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

  abrirCrearPadre(): void {
    this.dialog.open(UserDialog, {
      width: '700px',
      disableClose: true,
      data: { mode: 'create', rol: 'padre' },  // ← corregido
    }).afterClosed().subscribe(ok => { if (ok) this.loadData(); });
  }

  editarPadre(row: PadreRow): void {
    this.dialog.open(UserDialog, {
      width: '700px',
      disableClose: true,
      data: {
        mode: 'edit',
        rol: 'padre',
        isSelf: false,
        user: {
          id: row.id,
          rol: 'padre',
          nombre: row.nombre,
          apellido_paterno: row.apellido_paterno,
          apellido_materno: row.apellido_materno ?? '',
          email: row.email ?? '',
          telefono: row.telefono ?? '',
          foto_url: row.foto_url ?? null,
          tipo_documento: row.tipo_documento ?? 'dni',
          numero_documento: row.numero_documento ?? '',
          relacion_familiar: row.relacion ?? '',
        },
      },
    }).afterClosed().subscribe(result => { if (result?.updated) this.loadData(); });
  }

  verDetalle(row: PadreRow): void {
    this.dialog.open(UserDetailDialog, {
      width: '580px', maxHeight: '90vh', autoFocus: false,
      data: { id: row.id, tipo: 'padres' },
    });
  }

  toggleEstado(row: PadreRow): void {
    const activo = row.activo ?? true;
    this.dialog.open(ConfirmDialog, {
      width: '380px',
      data: {
        title: activo ? '¿Desactivar tutor?' : '¿Reactivar tutor?',
        message: `Estás por ${activo ? 'desactivar' : 'reactivar'} la cuenta de ${row.nombre} ${row.apellido_paterno}.`,
        confirm: activo ? 'Desactivar' : 'Reactivar',
        cancel: 'Cancelar',
        danger: activo,
      },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      const req$ = activo
        ? this.api.delete(`admin/users/${row.id}`)
        : this.api.patch(`admin/users/${row.id}/reactivar`, {});
      req$.subscribe({
        next: () => { this.toastr.success('Cambios guardados', 'Éxito'); this.loadData(); },
        error: () => this.toastr.error('Error al actualizar', 'Error'),
      });
    });
  }
}