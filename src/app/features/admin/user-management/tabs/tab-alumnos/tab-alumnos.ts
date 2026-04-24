import { Component, inject, input, effect, ViewChild, OnInit, signal } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { UpperCasePipe } from '@angular/common';
import { ApiService } from '../../../../../core/services/api';

@Component({
  selector: 'app-tab-alumnos',
  standalone: true,
  imports: [MatTableModule, MatPaginatorModule, MatIconModule, MatButtonModule, UpperCasePipe],
  templateUrl: './tab-alumnos.html',
  styleUrl: './tab-alumnos.scss'
})
export class TabAlumnos implements OnInit {
  private api = inject(ApiService);
  searchTerm = input<string>('');
  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = ['documento', 'nombre', 'codigo', 'estado', 'acciones'];

  loading = signal(true);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor() {
    // Escucha los cambios del buscador en tiempo real
    effect(() => {
      this.dataSource.filter = this.searchTerm();
      if (this.dataSource.paginator) {
        this.dataSource.paginator.firstPage(); // Regresa a la pág 1 al buscar
      }
    });
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.api.get<any[]>('admin/users/alumnos').subscribe({
      next: (res) => {
        this.dataSource.data = res.data;
        this.dataSource.paginator = this.paginator;

        // Filtro personalizado para buscar en múltiples columnas
        this.dataSource.filterPredicate = (data: any, filter: string) => {
          const dataStr = `${data.numero_documento} ${data.nombre} ${data.apellido_paterno} ${data.apellido_materno} ${data.codigo_estudiante}`.toLowerCase();
          return dataStr.indexOf(filter) !== -1;
        };

        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}