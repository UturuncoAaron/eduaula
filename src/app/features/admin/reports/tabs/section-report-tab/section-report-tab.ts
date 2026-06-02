import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../../core/services/api';
import { ReportsStore } from '../../data-access/reports.store';
import { categoriaChip, escalaChip, nombreCompleto } from '../../_shared/chips.util';

interface ListaItem {
  id: string;
  nombre: string;
}

@Component({
  selector: 'app-section-report-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  templateUrl: './section-report-tab.html',
  styleUrl: './section-report-tab.scss'
})
export class SectionReportTab implements OnInit {
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  readonly store = inject(ReportsStore);

  readonly grados = signal<ListaItem[]>([]);
  readonly secciones = signal<ListaItem[]>([]);
  readonly periodos = signal<ListaItem[]>([]);

  gradoId = '';
  seccionId = '';
  periodoId = '';

  readonly seccionCargada = computed(() => this.store.seccionLoading() === 'success' && !!this.store.seccionResumen());

  readonly nombreCompleto = nombreCompleto;
  readonly categoriaChip = categoriaChip;
  readonly escalaChip = escalaChip;

  ngOnInit(): void {
    this.api.get<ListaItem[]>('academic/grados').subscribe({
      next: (r: any) => this.grados.set(r?.data ?? r ?? [])
    });
    this.api.get<ListaItem[]>('academic/periodos').subscribe({
      next: (r: any) => this.periodos.set(r?.data ?? r ?? [])
    });
  }

  onGradoChange(gradoId: string): void {
    this.gradoId = gradoId;
    this.seccionId = '';
    this.secciones.set([]);
    if (!gradoId) return;
    this.api.get<ListaItem[]>(`academic/secciones?gradoId=${gradoId}`).subscribe({
      next: (r: any) => this.secciones.set(r?.data ?? r ?? [])
    });
  }

  cargar(): void {
    if (!this.seccionId || !this.periodoId) {
      this.toastr.error('Campos requeridos vacíos', 'Error');
      return;
    }
    this.store.loadSeccionResumen(this.seccionId, this.periodoId);
  }

  descargarXlsx(): void {
    if (!this.seccionId || !this.periodoId) return;
    this.store.downloadXlsx(this.seccionId, this.periodoId);
  }
}