import {
  Component, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ToastService } from 'ngx-toastr-notifier';
import { environment } from '../../../../../environments/environment';
import type { AlumnoTutoria } from '../../data-access/tutoring.types';
import { bestMatch, type MatchConfidence } from '../matching.util';

export interface BulkUploadData {
  alumnos: AlumnoTutoria[];
  periodo_id: number;
  periodo_label: string;
  seccion_id: string;        // ← agregado
  existentes: Set<string>;
}

type RowStatus = 'idle' | 'uploading' | 'done' | 'error' | 'skipped';

interface BulkRow {
  id: string;
  file: File;
  alumno: AlumnoTutoria | null;
  confidence: MatchConfidence;
  score: number;
  status: RowStatus;
  progress: number;
  error?: string;
  isReplace: boolean;
}

@Component({
  selector: 'app-bulk-upload',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatProgressSpinnerModule,
    MatSelectModule, MatFormFieldModule, MatTooltipModule,
  ],
  templateUrl: './bulk-upload.html',
  styleUrl: './bulk-upload.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkUpload {
  private readonly http    = inject(HttpClient);
  private readonly toastr  = inject(ToastService);
  readonly dialogRef = inject<MatDialogRef<BulkUpload, { uploaded: number }>>(MatDialogRef);
  readonly data      = inject<BulkUploadData>(MAT_DIALOG_DATA);

  readonly rows         = signal<BulkRow[]>([]);
  readonly isDragging   = signal(false);
  readonly isSubmitting = signal(false);

  readonly stats = computed(() => {
    const rs = this.rows();
    return {
      total:  rs.length,
      high:   rs.filter(r => r.confidence === 'high').length,
      medium: rs.filter(r => r.confidence === 'medium').length,
      none:   rs.filter(r => r.confidence === 'none').length,
      ready:  rs.filter(r => r.alumno !== null && r.status === 'idle').length,
      done:   rs.filter(r => r.status === 'done').length,
      error:  rs.filter(r => r.status === 'error').length,
    };
  });

  readonly canSubmit = computed(() =>
    !this.isSubmitting() && this.stats().ready > 0,
  );

  // ── Drag & drop ───────────────────────────────────────────────────────────

  onDragOver(e: DragEvent)  { e.preventDefault(); this.isDragging.set(true); }
  onDragLeave(e: DragEvent) { e.preventDefault(); this.isDragging.set(false); }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(false);
    this.addFiles(Array.from(e.dataTransfer?.files ?? []));
  }

  onFilePick(e: Event) {
    const input = e.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  // ── Agregar archivos ──────────────────────────────────────────────────────

  private addFiles(files: File[]) {
    const accepted = files.filter(f => /\.(pdf|jpg|jpeg|png)$/i.test(f.name));
    const skipped  = files.length - accepted.length;
    if (skipped > 0) {
      this.toastr.warning(
        `${skipped} archivo(s) ignorado(s) — solo PDF, JPG o PNG`,
        'Formato no permitido',
      );
    }

    const existingNames = new Set(this.rows().map(r => r.file.name));
    const fresh = accepted.filter(f => !existingNames.has(f.name));

    const assignedIds = new Set(
      this.rows().map(r => r.alumno?.id).filter((id): id is string => !!id),
    );

    const nuevos: BulkRow[] = fresh.map(f => {
      const m          = bestMatch(f.name, this.data.alumnos);
      const taken      = m.alumno && assignedIds.has(m.alumno.id);
      const finalAlumno      = taken ? null : m.alumno;
      const finalConfidence  = taken ? 'medium' as MatchConfidence : m.confidence;
      if (finalAlumno) assignedIds.add(finalAlumno.id);

      return {
        id:         crypto.randomUUID(),
        file:       f,
        alumno:     finalAlumno,
        confidence: finalConfidence,
        score:      m.score,
        status:     'idle',
        progress:   0,
        isReplace:  finalAlumno ? this.data.existentes.has(finalAlumno.id) : false,
      };
    });

    this.rows.update(rs => [...rs, ...nuevos]);
  }

  // ── Cambios en filas ──────────────────────────────────────────────────────

  onAlumnoChange(rowId: string, alumnoId: string | null) {
    this.rows.update(rs => rs.map(r => {
      if (r.id !== rowId) return r;
      const al = alumnoId
        ? this.data.alumnos.find(a => a.id === alumnoId) ?? null
        : null;
      return {
        ...r,
        alumno:     al,
        confidence: al ? (r.confidence === 'none' ? 'medium' : r.confidence) : 'none',
        isReplace:  al ? this.data.existentes.has(al.id) : false,
      };
    }));
  }

  removeRow(rowId: string) {
    this.rows.update(rs => rs.filter(r => r.id !== rowId));
  }

  clearAll() {
    if (this.isSubmitting()) return;
    this.rows.set([]);
  }

  alumnosDisponibles(currentRow: BulkRow): AlumnoTutoria[] {
    const taken = new Set(
      this.rows()
        .filter(r => r.id !== currentRow.id && r.alumno)
        .map(r => r.alumno!.id),
    );
    return this.data.alumnos.filter(a => !taken.has(a.id));
  }

  // ── Submit — una sola request al endpoint bulk ────────────────────────────

  submit() {
    if (!this.canSubmit()) return;
    this.isSubmitting.set(true);

    const ready = this.rows().filter(r => r.alumno && r.status === 'idle');

    const fd = new FormData();
    ready.forEach(r => fd.append('files', r.file));
    fd.append('seccion_id', this.data.seccion_id);
    fd.append('periodo_id', String(this.data.periodo_id));

    this.http.post<any>(`${environment.apiUrl}/libretas/bulk`, fd).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        const uploaded = res?.data?.uploaded ?? 0;
        const errors   = res?.data?.errors   ?? 0;
        const skipped  = res?.data?.skipped  ?? 0;

        if (errors === 0) {
          this.toastr.success(
            `${uploaded} libreta(s) cargada(s) correctamente`,
            'Éxito',
          );
          setTimeout(() => this.dialogRef.close({ uploaded }), 600);
        } else {
          this.toastr.warning(
            `${uploaded} cargada(s), ${errors} con error, ${skipped} sin match`,
            'Carga parcial',
          );
          // No cerramos para que el usuario vea el detalle
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.toastr.error(
          err?.error?.message ?? 'Error al subir las libretas',
          'Error',
        );
      },
    });
  }

  // ── Helpers de UI ─────────────────────────────────────────────────────────

  iconForConfidence(c: MatchConfidence): string {
    return c === 'high' ? 'check_circle' : c === 'medium' ? 'help' : 'cancel';
  }

  classForConfidence(c: MatchConfidence): string {
    return `conf-${c}`;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024)            return `${bytes} B`;
    if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  cancel() {
    if (this.isSubmitting()) return;
    this.dialogRef.close();
  }
}