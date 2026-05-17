import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal, ViewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map, forkJoin } from 'rxjs';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../core/services/api';
import { UserAvatar } from '../../../../shared/components/user-avatar/user-avatar';
import type { GradeLevel, Section } from '../../../../core/models/academic';

interface AlumnoRow {
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
  foto_url?: string | null;
  activo?: boolean;
  inclusivo?: boolean;
  grado?: string;
  seccion?: string;
}

@Component({
  selector: 'app-tab-mis-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, UserAvatar,
    MatTableModule, MatPaginatorModule, MatIconModule,
    MatButtonModule, MatMenuModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule,
 
  ],
  templateUrl: './tab-mis-alumnos.html',
  styleUrl: './tab-mis-alumnos.scss',
})
export class TabMisAlumnos implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private toastr = inject(ToastService);

  // ── Filtros ───────────────────────────────────────────────────
  grados = signal<GradeLevel[]>([]);
  secciones = signal<Section[]>([]);
  loadingFiltros = signal(true);

  gradoFiltro = new FormControl<string | null>(null);
  seccionFiltro = new FormControl<string | null>(null);
  busqueda = new FormControl('');

  seccionesFiltradas = computed(() => {
    const gId = this.gradoFiltro.value;
    return gId
      ? this.secciones().filter(s => s.grado_id === (gId as any))
      : this.secciones();
  });

  // ── Tabla ─────────────────────────────────────────────────────
  loading = signal(true);
  dataSource = new MatTableDataSource<AlumnoRow>([]);
  displayedColumns = ['codigo', 'nombre', 'grado', 'telefono', 'acciones'];

  total = signal(0);
  page = signal(1);
  pageSize = signal(20);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  ngOnInit(): void {
    forkJoin({
      grados: this.api.get<GradeLevel[]>('academic/grados'),
      secciones: this.api.get<Section[]>('academic/secciones'),
    }).subscribe({
      next: ({ grados, secciones }) => {
        this.grados.set((grados as any).data ?? []);
        this.secciones.set((secciones as any).data ?? []);
        this.loadingFiltros.set(false);
        this.loadData();
      },
      error: () => {
        this.loadingFiltros.set(false);
        this.loading.set(false);
      },
    });

    this.gradoFiltro.valueChanges.subscribe(() => {
      this.seccionFiltro.setValue(null, { emitEvent: false });
      this.page.set(1);
      this.loadData();
    });

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
    const params = new URLSearchParams();
    const sid = this.seccionFiltro.value;
    const gid = this.gradoFiltro.value;
    const q = this.busqueda.value?.trim();

    if (sid) params.set('seccion_id', sid);
    else if (gid) params.set('grado_id', String(gid));
    if (q && q.length >= 2) params.set('q', q);
    params.set('page', String(this.page()));
    params.set('limit', String(this.pageSize()));

    this.loading.set(true);
    this.api.get<any>(`admin/users/alumnos?${params}`).subscribe({
      next: res => {
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

  limpiarFiltros(): void {
    this.gradoFiltro.setValue(null, { emitEvent: false });
    this.seccionFiltro.setValue(null, { emitEvent: false });
    this.busqueda.setValue('', { emitEvent: false });
    this.page.set(1);
    this.loadData();
  }

  hayFiltros(): boolean {
    return !!(this.gradoFiltro.value || this.seccionFiltro.value || this.busqueda.value);
  }

  verFicha(row: AlumnoRow): void {
    this.router.navigate(['/psicologa/student', row.id]);
  }
}