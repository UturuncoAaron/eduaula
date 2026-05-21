import {
  ChangeDetectionStrategy, Component, OnInit,
  inject, signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';
import { UserAvatar } from '@shared/components/user-avatar/user-avatar';
import { ApiService } from '@core/services/api';
// ─── Modelo ─────────────────────────────────────────────────────

interface AlumnoRow {
  id: string;
  codigo_estudiante: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  telefono?: string;
  foto_url?: string | null;
  /** Viene del backend — true si tiene necesidades especiales */
  inclusivo: boolean;
  grado?: string;
  seccion?: string;
  /** Flag del endpoint psychology/directory/students */
  enSeguimiento: boolean;
}

// ─── Componente ─────────────────────────────────────────────────

@Component({
  selector: 'app-tab-mis-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, UserAvatar,
    MatTableModule, MatPaginatorModule,
    MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatTooltipModule,
  ],
  templateUrl: './tab-mis-alumnos.html',
  styleUrl: './tab-mis-alumnos.scss',
})
export class TabMisAlumnos implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);   // ← necesario para navegación relativa
  private readonly toastr = inject(ToastService);

  // ── Búsqueda ──────────────────────────────────────────────────
  readonly busqueda = new FormControl('');

  // ── Tabla ─────────────────────────────────────────────────────
  readonly loading = signal(true);
  readonly dataSource = new MatTableDataSource<AlumnoRow>([]);
  readonly displayedColumns = ['codigo', 'nombre', 'grado', 'seguimiento', 'acciones'];

  // ── Paginación ────────────────────────────────────────────────
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(20);

  ngOnInit(): void {
    this.loadData();

    this.busqueda.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged(),
    ).subscribe(() => {
      this.page.set(1);
      this.loadData();
    });
  }

  loadData(): void {
    const params = new URLSearchParams();
    const q = this.busqueda.value?.trim();
    if (q && q.length >= 2) params.set('q', q);
    params.set('page', String(this.page()));
    params.set('limit', String(this.pageSize()));

    this.loading.set(true);
    this.api.get<any>(`psychology/directory/students?${params}`).subscribe({
      next: (res) => {
        const body = (res as any).data ?? res;
        this.dataSource.data = Array.isArray(body) ? body : (body.data ?? []);
        this.total.set(Array.isArray(body) ? body.length : (body.total ?? 0));
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('Error al cargar alumnos', 'Error');
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
  }

  verFicha(row: AlumnoRow): void {
    // Navegación relativa: desde 'alumnos' sube un nivel → entra a 'student/:id'
    // Funciona independientemente de dónde estén montadas las PSYCHOLOGY_ROUTES
    this.router.navigate(['../student', row.id], { relativeTo: this.route });
  }
}