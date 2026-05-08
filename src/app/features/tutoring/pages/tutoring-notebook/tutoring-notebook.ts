import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';

import { ToastService } from 'ngx-toastr-notifier';
import { TutoringStore } from '../../data-access/tutoring.store';
import type { AlumnoTutoria, NotebookItem } from '../../data-access/tutoring.types';
import {
  NotebookUploadDrawer,
  NotebookUploadTarget,
} from '../../../../shared/components/notebook-upload-drawer/notebook-upload-drawer';
import { BulkUpload, BulkUploadData } from '../../ui/bulk-upload/bulk-upload';

@Component({
  selector: 'app-tutoring-notebook',
  standalone: true,
  imports: [
    CommonModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSidenavModule,
    MatProgressBarModule,
    NotebookUploadDrawer,
  ],
  templateUrl: './tutoring-notebook.html',
  styleUrl: './tutoring-notebook.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TutoringNotebook {
  readonly store = inject(TutoringStore);
  private readonly toastr = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  readonly drawerRef    = viewChild<MatSidenav>('drawer');
  readonly uploadTarget = signal<NotebookUploadTarget | null>(null);

  readonly progresoPct = computed(() => {
    const { cargadas, total } = this.store.progreso();
    if (total === 0) return 0;
    return Math.round((cargadas / total) * 100);
  });

  readonly pendientes = computed(() => {
    const { cargadas, total } = this.store.progreso();
    return Math.max(0, total - cargadas);
  });

  readonly periodos = computed(() => this.store.data()?.periodos ?? []);
  readonly alumnos  = computed(() => this.store.data()?.alumnos ?? []);

  trackById = (_: number, a: AlumnoTutoria): string => a.id;

  initials(a: AlumnoTutoria): string {
    return `${a.nombre[0] ?? ''}${a.apellido_paterno[0] ?? ''}`.toUpperCase();
  }

  libretaDe(a: AlumnoTutoria): NotebookItem | null {
    return this.store.libretaDe(a);
  }

  selectPeriodo(id: number): void {
    this.store.periodoSeleccionadoId.set(id);
  }

  openUpload(a: AlumnoTutoria, libretaExistente: NotebookItem | null): void {
    const pid = this.store.periodoSeleccionadoId();
    if (!pid) {
      this.toastr.warning('Selecciona un bimestre primero', 'Aviso');
      return;
    }
    const data = this.store.data();
    if (!data) return;

    const periodo = data.periodos.find((p) => p.id === pid);
    if (!periodo) return;

    this.uploadTarget.set({
      cuenta_id:    a.id,
      cuenta_label: `${a.apellido_paterno} ${a.apellido_materno ?? ''}, ${a.nombre}`.trim(),
      periodo_id:    pid,
      periodo_label: `Bim ${periodo.bimestre} · ${periodo.anio}`,
      tipo: 'alumno',
      libreta_existente: libretaExistente
        ? { nombre_archivo: libretaExistente.nombre_archivo }
        : null,
    });

    this.drawerRef()?.open();
  }

  closeDrawer(): void {
    this.drawerRef()?.close();
    this.uploadTarget.set(null);
  }

  onUploaded(): void {
    this.closeDrawer();
    this.store.refresh();
  }

  openBulkUpload(): void {
    const pid  = this.store.periodoSeleccionadoId();
    const data = this.store.data();

    if (!pid || !data) {
      this.toastr.warning('Selecciona un bimestre primero', 'Aviso');
      return;
    }

    const periodo = data.periodos.find((p) => p.id === pid);
    if (!periodo) return;

    const existentes = new Set(
      data.alumnos
        .filter((a) => a.libretas.some((l) => l.periodo_id === pid))
        .map((a) => a.id),
    );

    const dialogData: BulkUploadData = {
      alumnos:       data.alumnos,
      periodo_id:    pid,
      periodo_label: `Bim ${periodo.bimestre} · ${periodo.anio}`,
      seccion_id:    data.seccion.id,
      existentes,
    };

    const ref = this.dialog.open(BulkUpload, {
      data: dialogData,
      maxWidth: '96vw',
      maxHeight: '90vh',
      panelClass: 'bulk-upload-dialog-panel',
      autoFocus: false,
    });

    ref.afterClosed().subscribe((result?: { uploaded?: number }) => {
      if (result?.uploaded && result.uploaded > 0) this.store.refresh();
    });
  }
}