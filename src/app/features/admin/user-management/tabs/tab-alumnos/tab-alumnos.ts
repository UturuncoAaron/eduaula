import {
  Component, inject, input, effect,
  ViewChild, OnInit, signal,
} from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../../../../core/services/api';
import { UpperCasePipe } from '@angular/common';


export interface AlumnoRow {
  id: string;
  codigo_estudiante: string;
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  fecha_nacimiento?: string;
  email?: string;
  telefono?: string;
}

@Component({
  selector: 'app-tab-alumnos',
  imports: [MatTableModule, MatPaginatorModule, MatIconModule, MatButtonModule, UpperCasePipe],
  templateUrl: './tab-alumnos.html',
})
export class TabAlumnos implements OnInit {
  private api = inject(ApiService);

  active = input<boolean>(false);
  searchTerm = input<string>('');

  dataSource = new MatTableDataSource<AlumnoRow>([]);
  displayedColumns = ['codigo', 'documento', 'nombre', 'acciones'];
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
    this.dataSource.filterPredicate = (data: AlumnoRow, filter: string) =>
      [data.numero_documento, data.codigo_estudiante, data.nombre,
      data.apellido_paterno, data.apellido_materno ?? '']
        .join(' ').toLowerCase().includes(filter);
  }

  loadData() {
    this.loading.set(true);
    this.api.get<AlumnoRow[]>('admin/users/alumnos').subscribe({
      next: (res) => {
        this.dataSource.data = res.data ?? [];
        this.dataSource.paginator = this.paginator;
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}