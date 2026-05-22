import {
  Component, inject, signal, computed,
  OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../core/services/api';
import type { CourseCatalog as CourseCatalogModel } from '../../../../core/models/course';

@Component({
  selector: 'app-course-catalog',
  standalone: true,
  imports: [
    KeyValuePipe,
    ReactiveFormsModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule,
    MatMenuModule,
  ],
  templateUrl: './course-catalog.html',
  styleUrl: './course-catalog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseCatalog implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);
  private router = inject(Router);

  loading = signal(true);
  catalogo = signal<CourseCatalogModel[]>([]);
  search = new FormControl('');
  areaFiltro = signal<string | null>(null);

  filtrado = computed(() => {
    const q = this.search.value?.toLowerCase().trim() ?? '';
    const area = this.areaFiltro();
    return this.catalogo().filter(c => {
      const matchQ = !q || c.nombre.toLowerCase().includes(q);
      const matchArea = !area || c.area === area;
      return matchQ && matchArea;
    });
  });

  porArea = computed(() => {
    const map = new Map<string, number>();
    this.catalogo().forEach(c => {
      const key = c.area ?? 'Sin área';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  });

  ngOnInit(): void {
    this.loadCatalogo();
    this.search.valueChanges.pipe(
      debounceTime(200), distinctUntilChanged(),
    ).subscribe(() => { });
  }

  private loadCatalogo(): void {
    this.loading.set(true);
    this.api.get<any>('courses/catalog').subscribe({
      next: r => {
        this.catalogo.set((r as any).data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('Error al cargar el catálogo', 'Error');
        this.loading.set(false);
      },
    });
  }

  setArea(area: string | null): void {
    this.areaFiltro.set(this.areaFiltro() === area ? null : area);
  }

  goBack(): void {
    this.router.navigate(['/admin/academico']);
  }

  async openCreate(): Promise<void> {
    const { CourseCatalogFormDialog } = await import(
      '../../../../shared/components/course-catalog-form-dialog/course-catalog-form-dialog'
    );
    const ref = this.dialog.open(CourseCatalogFormDialog, {
      width: '480px', maxWidth: '95vw',
      data: { mode: 'create' },
    });
    ref.afterClosed().subscribe((result: any) => {
      if (!result) return;
      this.api.post<any>('courses/catalog', result).subscribe({
        next: r => {
          this.catalogo.update(list => [...list, (r as any).data]);
          this.toastr.success(`Curso "${result.nombre}" creado`, 'Éxito');
        },
        error: err =>
          this.toastr.error(err.error?.message ?? 'Error al crear', 'Error'),
      });
    });
  }

  async openEdit(item: CourseCatalogModel): Promise<void> {
    const { CourseCatalogFormDialog } = await import(
      '../../../../shared/components/course-catalog-form-dialog/course-catalog-form-dialog'
    );
    const ref = this.dialog.open(CourseCatalogFormDialog, {
      width: '480px', maxWidth: '95vw',
      data: { mode: 'edit', item },
    });
    ref.afterClosed().subscribe((result: any) => {
      if (!result) return;
      this.api.patch<any>(`courses/catalog/${item.id}`, result).subscribe({
        next: r => {
          this.catalogo.update(list =>
            list.map(c => c.id === item.id
              ? { ...c, ...(r as any).data }
              : c,
            ),
          );
          this.toastr.success('Curso actualizado', 'Éxito');
        },
        error: err =>
          this.toastr.error(err.error?.message ?? 'Error al actualizar', 'Error'),
      });
    });
  }

  async toggleActivo(item: CourseCatalogModel): Promise<void> {
    const { ConfirmDialog } = await import(
      '../../../../shared/components/confirm-dialog/confirm-dialog'
    );
    const ref = this.dialog.open(ConfirmDialog, {
      width: '360px',
      data: {
        title: item.activo ? '¿Desactivar curso?' : '¿Activar curso?',
        message: `"${item.nombre}" ${item.activo
          ? 'no aparecerá al asignar cursos a secciones'
          : 'volverá a estar disponible'}.`,
        confirm: item.activo ? 'Desactivar' : 'Activar',
        cancel: 'Cancelar',
        danger: item.activo,
      },
    });
    ref.afterClosed().subscribe((ok: boolean) => {
      if (!ok) return;
      this.api.patch<any>(`courses/catalog/${item.id}`, { activo: !item.activo })
        .subscribe({
          next: () => this.catalogo.update(list =>
            list.map(c => c.id === item.id
              ? { ...c, activo: !c.activo }
              : c,
            ),
          ),
          error: () => this.toastr.error('Error al actualizar', 'Error'),
        });
    });
  }
}