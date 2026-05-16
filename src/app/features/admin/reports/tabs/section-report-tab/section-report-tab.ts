import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
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
    DatePipe,
    TitleCasePipe,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './section-report-tab.html',
  styleUrl: './section-report-tab.scss',
})
export class SectionReportTab implements OnInit {
  private api = inject(ApiService);
  private toastr= inject(ToastService);
  readonly store = inject(ReportsStore);

  readonly grados = signal<ListaItem[]>([]);
  readonly secciones = signal<ListaItem[]>([]);
  readonly periodos = signal<ListaItem[]>([]);

  gradoId = '';
  seccionId = '';
  periodoId = '';

  readonly seccionCargada = computed(
    () =>
      this.store.seccionLoading() === 'success' && !!this.store.seccionResumen(),
  );

  // Helpers expuestos a la plantilla
  readonly nombreCompleto = nombreCompleto;
  readonly categoriaChip = categoriaChip;
  readonly escalaChip = escalaChip;

  ngOnInit(): void {
    this.api.get<ListaItem[]>('academic/grados').subscribe({
      next: (r) => this.grados.set(r.data ?? []),
    });
    this.api.get<ListaItem[]>('academic/periodos').subscribe({
      next: (r) => this.periodos.set(r.data ?? []),
    });
  }

  onGradoChange(gradoId: string): void {
    this.gradoId = gradoId;
    this.seccionId = '';
    this.secciones.set([]);
    if (!gradoId) return;
    this.api
      .get<ListaItem[]>(`academic/secciones?gradoId=${gradoId}`)
      .subscribe({ next: (r) => this.secciones.set(r.data ?? []) });
  }

  cargar(): void {
    if (!this.seccionId || !this.periodoId) {
      this.toastr.success('Selecciona sección y periodo', 'OK', { duration: 3000 });
      return;
    }
    this.store.loadSeccionResumen(this.seccionId, this.periodoId);
  }
  descargarXlsx(): void {
    if (!this.seccionId || !this.periodoId) return;
    this.store.downloadXlsx(this.seccionId, this.periodoId);
  }
}
