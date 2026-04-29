import {
  Component, ChangeDetectionStrategy,
  inject, input, output, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';

import { environment } from '../../../../environments/environment';

export interface NotebookUploadTarget {
  cuenta_id: string;
  cuenta_label: string;            // "Aarón Pérez Quispe"
  periodo_id: number;
  periodo_label: string;           // "Bim 1 · 2026"
  tipo: 'alumno' | 'padre';
  libreta_existente?: {
    nombre_archivo: string | null;
  } | null;
}

@Component({
  selector: 'app-notebook-upload-drawer',
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './notebook-upload-drawer.html',
  styleUrl: './notebook-upload-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotebookUploadDrawer {
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);

  target = input<NotebookUploadTarget | null>(null);

  close = output<void>();
  uploaded = output<void>();

  file = signal<File | null>(null);
  observaciones = '';
  uploading = signal(false);
  dragging = signal(false);

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(e: DragEvent) {
    e.preventDefault();
    this.dragging.set(false);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragging.set(false);
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      this.snack.open('Solo se aceptan archivos PDF', 'Cerrar', { duration: 3000 });
      return;
    }
    this.file.set(f);
  }

  onFileSelect(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.file.set(f);
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  submit() {
    const target = this.target();
    const file = this.file();
    if (!target || !file) return;

    const fd = new FormData();
    fd.append('file', file);
    fd.append('cuenta_id', target.cuenta_id);
    fd.append('periodo_id', target.periodo_id.toString());
    if (this.observaciones.trim()) {
      fd.append('observaciones', this.observaciones.trim());
    }

    const path = target.tipo === 'alumno'
      ? '/libretas/alumno'
      : '/libretas/padre';
    const url = `${environment.apiUrl}${path}`;

    this.uploading.set(true);
    this.http.post(url, fd).subscribe({
      next: () => {
        this.uploading.set(false);
        this.snack.open('Libreta subida correctamente', 'Cerrar',
          { duration: 3000 });
        this.uploaded.emit();
        this.reset();
      },
      error: (err) => {
        this.uploading.set(false);
        const msg = err?.error?.message ?? 'Error al subir la libreta';
        this.snack.open(msg, 'Cerrar', { duration: 5000 });
      },
    });
  }

  onClose() {
    if (this.uploading()) return;
    this.reset();
    this.close.emit();
  }

  private reset() {
    this.file.set(null);
    this.observaciones = '';
    this.dragging.set(false);
  }
}
