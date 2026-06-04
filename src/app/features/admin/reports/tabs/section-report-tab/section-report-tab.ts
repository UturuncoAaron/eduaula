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
import { Period } from '../../../../../core/models/academic';


interface ListaItem { id: string; nombre: string; }
interface AlumnoDropdown { id: string; nombre: string; apellido_paterno: string; apellido_materno: string; }

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
  readonly periodos = signal<Period[]>([]);
  readonly alumnosFiltrados = signal<AlumnoDropdown[]>([]);

  gradoId = '';
  seccionId = '';
  alumnoId = '';
  filtroPeriodoId: number | null = null; // Mantiene consistencia con la clave numérica de la BD
  semanaFiltro = '';

  readonly seccionCargada = computed(() => this.store.seccionLoading() === 'success' && !!this.store.seccionResumen());
  readonly nombreCompleto = nombreCompleto;
  readonly categoriaChip = categoriaChip;
  readonly escalaChip = escalaChip;

  // Calcula las semanas lectivas reales basándose en los parámetros de fecha del periodo seleccionado
  readonly semanasDinamicas = computed<number[]>(() => {
    const activeId = this.filtroPeriodoId;
    if (!activeId) return [];

    const p = this.periodos().find(item => item.id === activeId);
    if (!p || !p.fecha_inicio || !p.fecha_fin) return [];

    const inicio = new Date(p.fecha_inicio);
    const fin = new Date(p.fecha_fin);
    const diferenciaDias = Math.floor((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));

    const totalSemanas = Math.ceil(diferenciaDias / 7) || 1;
    return Array.from({ length: totalSemanas }, (_, i) => i + 1);
  });

  ngOnInit(): void {
    this.api.get<ListaItem[]>('academic/grados').subscribe({
      next: (r: any) => this.grados.set(r?.data ?? r ?? [])
    });
    this.api.get<Period[]>('academic/periodos').subscribe({
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

  onPeriodoChange(periodoId: number | null): void {
    this.filtroPeriodoId = periodoId;
    this.semanaFiltro = '';
  }

  cargar(): void {
    if (!this.filtroPeriodoId) {
      this.toastr.error('Debe seleccionar al menos el Periodo Académico', 'Faltan Parámetros');
      return;
    }
    this.store.loadSeccionResumen(this.seccionId, String(this.filtroPeriodoId));
  }

  descargarFormato(formato: 'xlsx' | 'pdf' | 'csv'): void {
    if (!this.filtroPeriodoId) return;

    if (formato === 'xlsx') {
      this.store.downloadXlsx(this.seccionId, String(this.filtroPeriodoId));
    } else if (formato === 'pdf') {
      this.store.downloadPdf(this.seccionId, String(this.filtroPeriodoId));
    } else {
      this.store.executeSecureDownload('section_summary', 'csv', {
        seccion_id: this.seccionId,
        periodo_id: String(this.filtroPeriodoId)
      });
    }
  }
}