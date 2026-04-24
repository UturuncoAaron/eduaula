import { Component, inject, input, effect, ViewChild, OnInit, signal } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../../../../core/services/api';

@Component({
  selector: 'app-tab-admins',
  standalone: true,
  imports: [MatTableModule, MatPaginatorModule, MatIconModule, MatButtonModule],
  templateUrl: './tab-admins.html'
})
export class TabAdmins implements OnInit {
  private api = inject(ApiService);
  searchTerm = input<string>('');

  dataSource = new MatTableDataSource<any>([]);
  // Aquí usamos "cargo" en vez de especialidad o relación
  displayedColumns: string[] = ['documento', 'nombre', 'cargo', 'estado', 'acciones'];
  loading = signal(true);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor() {
    effect(() => {
      this.dataSource.filter = this.searchTerm();
      if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    });
  }

  ngOnInit() { this.loadData(); }

  loadData() {
    this.loading.set(true);
    // Apuntamos al endpoint de administradores
    this.api.get<any[]>('admin/users/admins').subscribe({
      next: (res) => {
        this.dataSource.data = res.data;
        this.dataSource.paginator = this.paginator;
        this.dataSource.filterPredicate = (data: any, filter: string) => {
          const dataStr = `${data.numero_documento} ${data.nombre} ${data.apellido_paterno} ${data.cargo}`.toLowerCase();
          return dataStr.indexOf(filter) !== -1;
        };
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}