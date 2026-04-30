import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { ToastService } from 'ngx-toastr-notifier';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../../../core/services/api';
import type { Period } from '../../../../core/models/academic';

@Component({
  selector: 'app-periodos-tab',
  standalone: true,
  imports: [
    DatePipe, MatButtonModule, MatIconModule, MatTableModule,
    MatProgressSpinnerModule, MatTooltipModule,
  ],
  templateUrl: './periodos-tab.html',
  styleUrl: './periodos-tab.scss',
})
export class PeriodosTab implements OnInit {
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private dialog = inject(MatDialog);

  periodos = signal<Period[]>([]);
  loading = signal(true);

  cols = ['nombre', 'anio', 'bimestre', 'fechas', 'estado', 'acciones'];

  ngOnInit(): void { this.loadPeriodos(); }

  loadPeriodos(): void {
    this.loading.set(true);
    this.api.get<Period[]>('academic/periodos').subscribe({
      next: r => { this.periodos.set(r.data ?? []); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  async openCreatePeriodo(): Promise<void> {
    const { CreatePeriodoDialog } = await import(
      '../../../../shared/components/create-periodo-dialog/create-periodo-dialog'
    );
    const ref = this.dialog.open(CreatePeriodoDialog, { width: '520px' });

    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.api.post<Period>('academic/periodos', result).subscribe({
        next: r => {
          this.periodos.update(list =>
            [...list, r.data].sort((a, b) =>
              a.anio !== b.anio ? a.anio - b.anio : a.bimestre - b.bimestre
            )
          );
          this.toastr.success('Periodo creado correctamente', 'Éxito');
        },
        error: err => this.toastr.error(err.error?.message ?? 'Error al crear periodo', 'Error'),
      });
    });
  }

  async activarPeriodo(periodo: Period): Promise<void> {
    if (periodo.activo) return;

    const { ConfirmDialog } = await import(
      '../../../../shared/components/confirm-dialog/confirm-dialog'
    );
    const ref = this.dialog.open(ConfirmDialog, {
      width: '420px',
      data: {
        title: '¿Activar periodo?',
        message: `Se activará "${periodo.nombre}" y se desactivará el periodo actual. Los nuevos cursos usarán este periodo.`,
        confirm: 'Activar',
        cancel: 'Cancelar',
        danger: false,
      },
    });

    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.api.patch(`academic/periodos/${periodo.id}/activar`, {}).subscribe({
        next: () => {
          this.periodos.update(list =>
            list.map(p => ({ ...p, activo: p.id === periodo.id }))
          );
          this.toastr.success(`"${periodo.nombre}" activado correctamente`, 'Éxito');
        },
        error: () => this.toastr.error('Error al activar periodo', 'Error'),
      });
    });
  }
}