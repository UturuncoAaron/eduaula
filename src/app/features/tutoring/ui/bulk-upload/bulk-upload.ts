import {
  Component, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { from, of } from 'rxjs';
import { mergeMap, tap, catchError } from 'rxjs/operators';

import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';

import { environment } from '../../../../../environments/environment';
import type { AlumnoTutoria } from '../../data-access/tutoring.types';
import { bestMatch, type MatchConfidence } from '../matching.util';

export interface BulkUploadData {
  alumnos: AlumnoTutoria[];
  periodo_id: number;
  periodo_label: string;
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
  private readonly http = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);
  readonly dialogRef = inject<MatDialogRef<BulkUpload, { uploaded: number }>>(MatDialogRef);
  readonly data = inject<BulkUploadData>(MAT_DIALOG_DATA);

  readonly rows = signal<BulkRow[]>([]);
  readonly isDragging = signal(false);
  readonly isSubmitting = signal(false);

  readonly stats = computed(() => {
    const rs = this.rows();
    return {
      total: rs.length,
      high: rs.filter(r => r.confidence === 'high').length,
      medium: rs.filter(r => r.confidence === 'medium').length,
      none: rs.filter(r => r.confidence === 'none').length,
      ready: rs.filter(r => r.alumno !== null && r.status === 'idle').length,
      done: rs.filter(r => r.status === 'done').length,
      error: rs.filter(r => r.status === 'error').length,
    };
  });

  readonly canSubmit = computed(() =>
    !this.isSubmitting() && this.stats().ready > 0,
  );

  onDragOver(e: DragEvent) { e.preventDefault(); this.isDragging.set(true); }
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

  private addFiles(files: File[]) {
    const accepted = files.filter(f => /\.(pdf|jpg|jpeg|png)$/i.test(f.name));
    const skipped = files.length - accepted.length;
    if (skipped > 0) {
      this.snack.open(`${skipped} archivo(s) ignorado(s) (solo PDF/JPG/PNG)`, 'OK', { duration: 4000 });
    }

    const existingNames = new Set(this.rows().map(r => r.file.name));
    const fresh = accepted.filter(f => !existingNames.has(f.name));

    const assignedIds = new Set(
      this.rows().map(r => r.alumno?.id).filter((id): id is string => !!id),
    );

    const nuevos: BulkRow[] = fresh.map(f => {
      const m = bestMatch(f.name, this.data.alumnos);
      const taken = m.alumno && assignedIds.has(m.alumno.id);
      const finalAlumno = taken ? null : m.alumno;
      const finalConfidence = taken ? 'medium' : m.confidence;
      if (finalAlumno) assignedIds.add(finalAlumno.id);

      return {
        id: crypto.randomUUID(),
        file: f,
        alumno: finalAlumno,
        confidence: finalConfidence,
        score: m.score,
        status: 'idle',
        progress: 0,
        isReplace: finalAlumno ? this.data.existentes.has(finalAlumno.id) : false,
      };
    });

    this.rows.update(rs => [...rs, ...nuevos]);
  }

  onAlumnoChange(rowId: string, alumnoId: string | null) {
    this.rows.update(rs => rs.map(r => {
      if (r.id !== rowId) return r;
      const al = alumnoId ? this.data.alumnos.find(a => a.id === alumnoId) ?? null : null;
      return {
        ...r,
        alumno: al,
        confidence: al ? (r.confidence === 'none' ? 'medium' : r.confidence) : 'none',
        isReplace: al ? this.data.existentes.has(al.id) : false,
      };
    }));
  }

  removeRow(rowId: string) { this.rows.update(rs => rs.filter(r => r.id !== rowId)); }

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

  submit() {
    if (!this.canSubmit()) return;
    this.isSubmitting.set(true);

    const ready = this.rows().filter(r => r.alumno && r.status === 'idle');
    const CONCURRENCY = 4;

    from(ready).pipe(
      mergeMap(row => this.uploadOne(row), CONCURRENCY),
    ).subscribe({
      complete: () => {
        this.isSubmitting.set(false);
        const { done, error } = this.stats();
        if (error === 0) {
          this.snack.open(
            `${done} libreta(s) cargada(s) correctamente`,
            'OK', { duration: 4000 },
          );
          setTimeout(() => this.dialogRef.close({ uploaded: done }), 600);
        } else {
          this.snack.open(
            `${done} cargada(s), ${error} con error. Revisa la lista.`,
            'OK', { duration: 6000 },
          );
        }
      },
    });
  }

  private uploadOne(row: BulkRow) {
    this.updateRow(row.id, { status: 'uploading', progress: 0 });

    const fd = new FormData();
    fd.append('file', row.file);
    fd.append('cuenta_id', row.alumno!.id);
    fd.append('tipo', 'alumno');
    fd.append('periodo_id', String(this.data.periodo_id));

    // ⚠️ Ajusta el endpoint si tu backend usa otro path (ej. /libretas).
    return this.http.post<unknown>(
      `${environment.apiUrl}/notebooks`,
      fd,
      { reportProgress: true, observe: 'events' },
    ).pipe(
      tap((event: HttpEvent<unknown>) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const pct = Math.round((event.loaded / event.total) * 100);
          this.updateRow(row.id, { progress: pct });
        } else if (event.type === HttpEventType.Response) {
          this.updateRow(row.id, { status: 'done', progress: 100 });
        }
      }),
      catchError(err => {
        this.updateRow(row.id, {
          status: 'error',
          error: err?.error?.message ?? err?.message ?? 'Error de subida',
        });
        return of(null);
      }),
    );
  }

  private updateRow(rowId: string, patch: Partial<BulkRow>) {
    this.rows.update(rs => rs.map(r => r.id === rowId ? { ...r, ...patch } : r));
  }

  iconForConfidence(c: MatchConfidence): string {
    return c === 'high' ? 'check_circle' :
      c === 'medium' ? 'help' : 'cancel';
  }

  classForConfidence(c: MatchConfidence): string {
    return `conf-${c}`;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  cancel() {
    if (this.isSubmitting()) return;
    this.dialogRef.close();
  }
}