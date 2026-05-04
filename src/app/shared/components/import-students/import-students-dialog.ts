import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../core/services/api';
import { environment } from '../../../../environments/environment';

// Interfaces de tu API original
interface Seccion { id: string; nombre: string; grado?: { nombre: string } }
interface Periodo { id: number; nombre: string; activo: boolean }
interface ImportError { fila: number; numero_documento: string; motivo: string }
interface ImportResult {
  total: number;
  creados: number;
  matriculados: number;
  omitidos: number;
  errores: ImportError[];
}

@Component({
  selector: 'app-import-students-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatSelectModule, MatProgressBarModule, MatTooltipModule,
  ],
  templateUrl: './import-students-dialog.html',
  styleUrl: './import-students-dialog.scss',
})
export class ImportStudentsDialog implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private ref = inject(MatDialogRef<ImportStudentsDialog>);

  secciones = signal<Seccion[]>([]);
  periodos = signal<Periodo[]>([]);

  // Archivo y Estados
  archivo = signal<File | null>(null);
  uploading = signal(false);
  isDragging = signal(false);
  resultado = signal<ImportResult | null>(null);

  form = this.fb.group({
    seccion_id: [null as string | null, Validators.required],
    periodo_id: [null as number | null, Validators.required],
  });
  allowedTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  ngOnInit(): void {
    this.api.get<Seccion[]>('academic/secciones').subscribe({
      next: r => this.secciones.set((r as any).data ?? []),
      error: () => this.secciones.set([]),
    });
    this.api.get<Periodo[]>('academic/periodos').subscribe({
      next: r => {
        const data: Periodo[] = (r as any).data ?? [];
        this.periodos.set(data);
        const activo = data.find(p => p.activo);
        if (activo) this.form.patchValue({ periodo_id: activo.id });
      },
      error: () => this.periodos.set([]),
    });
  }
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  pickFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (f) this.handleFile(f);
    input.value = ''; // Reset input
  }

  handleFile(file: File) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const isValidExt = ['csv', 'xls', 'xlsx'].includes(extension || '');

    if (this.allowedTypes.includes(file.type) || isValidExt) {
      this.archivo.set(file);
      this.resultado.set(null);
    } else {
      this.toastr.error('Solo se permiten archivos Excel (.xlsx, .xls) o CSV.', 'Formato inválido');
      this.archivo.set(null);
    }
  }

  removeFile() {
    this.archivo.set(null);
    this.resultado.set(null);
  }

  formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  // ── Descarga de Plantilla ─────────────────────────────────────
  descargarPlantilla(): void {
    // Mantengo tu endpoint original si funciona, 
    // pero si falla, te sugiero cambiarlo a la generación en memoria que te pasé antes.
    window.open(`${environment.apiUrl}/admin/import/students/template`, '_blank');
  }

  // ── Envío a la API ────────────────────────────────────────────
  importar(): void {
    if (this.form.invalid || !this.archivo()) {
      this.form.markAllAsTouched();
      if (!this.archivo()) this.toastr.error('Selecciona un archivo', 'Error');
      return;
    }

    const { seccion_id, periodo_id } = this.form.value;
    const fd = new FormData();
    fd.append('file', this.archivo()!);

    this.uploading.set(true);
    this.resultado.set(null);

    this.api.postForm<ImportResult>(
      `admin/import/students?seccion_id=${seccion_id}&periodo_id=${periodo_id}`,
      fd,
    ).subscribe({
      next: r => {
        const data: ImportResult = (r as any).data;
        this.uploading.set(false);
        this.resultado.set(data);

        this.toastr.success(
          `${data.creados} creados · ${data.matriculados} matriculados`,
          'Importación completada',
        );

        if (data.errores.length === 0) {
          setTimeout(() => this.ref.close(true), 2000);
        }
      },
      error: e => {
        this.uploading.set(false);
        this.toastr.error(e?.error?.message ?? 'Error en la importación', 'Error');
      },
    });
  }

  cerrar(): void {
    this.ref.close(this.resultado() !== null);
  }
}