import {
  Component, inject, input, effect,
  ViewChild, OnInit, signal,
} from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../../../../core/services/api';

export interface AdminRow {
  id: string;
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  cargo?: string;
  activo: boolean;
}

@Component({
  selector: 'app-tab-admins',
  imports: [MatTableModule, MatPaginatorModule, MatIconModule, MatButtonModule],
  templateUrl: './tab-admins.html',
})
export class TabAdmins implements OnInit {
  private api = inject(ApiService);

  active     = input<boolean>(false);
  searchTerm = input<string>('');
  dataSource       = new MatTableDataSource<AdminRow>([]);
  displayedColumns = ['documento', 'nombre', 'cargo', 'estado', 'acciones'];
  loading          = signal(true);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor() {
    effect(() => { if (this.active()) this.loadData(); });
    effect(() => {
      this.dataSource.filter = this.searchTerm().trim().toLowerCase();
      if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    });
  }

  ngOnInit() {
    this.dataSource.filterPredicate = (data: AdminRow, filter: string) =>
      [data.numero_documento, data.nombre, data.apellido_paterno,
       data.apellido_materno ?? '', data.cargo ?? '']
        .join(' ').toLowerCase().includes(filter);
  }

  loadData() {
    this.loading.set(true);
    this.api.get<AdminRow[]>('admin/users/admins').subscribe({
      next: (res) => {
        this.dataSource.data = res.data ?? [];
        this.dataSource.paginator = this.paginator;
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}