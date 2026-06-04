import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../../../core/services/api';
import { ReportsStore, ExportFormat } from '../../data-access/reports.store';

interface ListaItem {
  id: string;
  nombre: string;
}

@Component({
  selector: 'app-export-grades-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './export-grades-tab.html',
  styleUrl: './export-grades-tab.scss'
})
export class ExportGradesTab implements OnInit {
  private api = inject(ApiService);
  readonly store = inject(ReportsStore);

  readonly grados = signal<ListaItem[]>([]);
  readonly secciones = signal<ListaItem[]>([]);
  readonly periodos = signal<ListaItem[]>([]);

  filtroGradoId = '';
  filtroSeccionId = '';
  filtroPeriodoId = '';

  ngOnInit(): void {
    this.api.get<ListaItem[]>('academic/grados').subscribe({
      next: (r: any) => this.grados.set(r?.data ?? r ?? [])
    });
    this.api.get<ListaItem[]>('academic/periodos').subscribe({
      next: (r: any) => this.periodos.set(r?.data ?? r ?? [])
    });
  }

  onGradoChange(gradoId: string): void {
    this.filtroGradoId = gradoId;
    this.filtroSeccionId = '';
    this.secciones.set([]);
    if (!gradoId) return;

    this.api.get<ListaItem[]>(`academic/secciones?gradoId=${gradoId}`).subscribe({
      next: (r: any) => this.secciones.set(r?.data ?? r ?? [])
    });
  }

  descargarFormato(format: ExportFormat): void {
    const params = {
      periodo_id: this.filtroPeriodoId || undefined,
      grado_id: this.filtroGradoId || undefined,
      seccion_id: this.filtroSeccionId || undefined
    };
    this.store.executeSecureDownload('academic_general', format, params);
  }
}