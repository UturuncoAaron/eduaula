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

interface ListaItem { id: string; nombre: string; }
interface AlumnoDropdown { id: string; nombre: string; apellido_paterno: string; apellido_materno: string; }

@Component({
  selector: 'app-section-report-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatTabsModule, MatProgressBarModule, MatTooltipModule
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
  readonly alumnosFiltrados = signal<AlumnoDropdown[]>([]);

  gradoId = '';
  seccionId = '';
  alumnoId = '';
  periodoId = '';
  semanaFiltro = '';

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
    this.alumnoId = '';
    this.secciones.set([]);
    this.alumnosFiltrados.set([]);
    if (!gradoId) return;
    this.api.get<ListaItem[]>(`academic/secciones?gradoId=${gradoId}`).subscribe({
      next: (r: any) => this.secciones.set(r?.data ?? r ?? [])
    });
  }

  onSeccionChange(seccionId: string): void {
    this.seccionId = seccionId;
    this.alumnoId = '';
    this.alumnosFiltrados.set([]);
    if (!seccionId) return;
    this.api.get<AlumnoDropdown[]>(`academic/alumnos-by-seccion?seccionId=${seccionId}`).subscribe({
      next: (r: any) => this.alumnosFiltrados.set(r?.data ?? r ?? [])
    });
  }

  onPeriodoChange(periodoId: string): void {
    this.periodoId = periodoId;
    this.semanaFiltro = '';
  }

  cargar(): void {
    if (!this.periodoId) {
      this.toastr.error('Debe seleccionar al menos el Periodo Académico', 'Faltan Parámetros');
      return;
    }
    // Firma nativa segura mapeando strings directos o queries encapsuladas
    this.store.loadSeccionResumen(this.seccionId, this.periodoId);
  }

  descargarFormato(formato: 'xlsx' | 'pdf' | 'csv'): void {
    if (!this.periodoId) return;

    if (formato === 'xlsx') {
      this.store.downloadXlsx(this.seccionId, this.periodoId);
    } else if (formato === 'pdf') {
      this.store.downloadPdf(this.seccionId, this.periodoId);
    } else {
      this.store.executeSecureDownload('section_summary', 'csv', {
        seccion_id: this.seccionId,
        periodo_id: this.periodoId
      });
    }
  }
}