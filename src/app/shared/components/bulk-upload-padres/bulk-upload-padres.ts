import {
  ChangeDetectionStrategy, Component, computed,
  inject, OnInit, signal,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../../core/services/api';
import type { BulkUploadPadresData, PadreLibretaItem } from '../libretas-padres-page/libretas-padres-page';

// ── Tipos ────────────────────────────────────────────────────────────────────

type FileStatus = 'idle' | 'uploading' | 'done' | 'error' | 'skipped';

interface FileEntry {
  file: File;
  padreId: string | null;
  padreLabel: string | null;
  status: FileStatus;
  error: string | null;
  reemplaza: boolean;
}

interface BulkPadreResultItem {
  filename: string;
  padre_id: string | null;
  padre_nombre: string | null;
  status: 'uploaded' | 'skipped' | 'error';
  libreta_id?: string;
  error?: string;
}

interface BulkPadreResult {
  total: number; uploaded: number; skipped: number; errors: number;
  items: BulkPadreResultItem[];
}

// ── Matching ─────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toUpperCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function matchearPadre(nombreArchivo: string, padres: PadreLibretaItem[]): PadreLibretaItem | null {
  const archivo = norm(nombreArchivo.replace(/\.[^.]+$/, ''));
  let mejor: PadreLibretaItem | null = null;
  let mejorScore = 0;

  for (const p of padres) {
    for (const variante of [
      norm(`${p.apellido_paterno} ${p.apellido_materno ?? ''} ${p.nombre}`),
      norm(`${p.apellido_paterno} ${p.nombre}`),
      norm(`${p.nombre} ${p.apellido_paterno}`),
    ]) {
      const palabras = variante.split(' ').filter(Boolean);
      const score = palabras.filter(w => archivo.includes(w)).length / palabras.length;
      if (score > mejorScore) { mejorScore = score; mejor = p; }
    }
  }
  return mejorScore >= 0.6 ? mejor : null;
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}

// ── Componente ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-bulk-upload-padres',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatTooltipModule, MatProgressBarModule,
    MatSelectModule, MatFormFieldModule,
  ],
  templateUrl: './bulk-upload-padres.html',
  styleUrl: './bulk-upload-padres.scss',
})
export class BulkUploadPadres implements OnInit {
  readonly data = inject<BulkUploadPadresData>(MAT_DIALOG_DATA);
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef<BulkUploadPadres>);

  readonly files = signal<FileEntry[]>([]);
  readonly dragging = signal(false);
  readonly uploading = signal(false);
  readonly fase = signal<'pick' | 'review' | 'done'>('pick');

  readonly matched = computed(() => this.files().filter(f => f.padreId !== null && f.status === 'idle'));
  readonly unmatched = computed(() => this.files().filter(f => f.padreId === null && f.status === 'idle'));
  readonly listos = computed(() => this.matched());
  readonly doneCount = computed(() => this.files().filter(f => f.status === 'done').length);
  readonly errorCount = computed(() => this.files().filter(f => f.status === 'error').length);

  readonly uploadPct = computed(() => {
    const t = this.files().length;
    return t === 0 ? 0 : Math.round(
      this.files().filter(f => ['done', 'error', 'skipped'].includes(f.status)).length / t * 100,
    );
  });

  readonly padresDisponibles = computed(() => this.data.padres);

  ngOnInit(): void { }

  // ── Drag & drop ───────────────────────────────────────────────────────────

  onDragOver(e: DragEvent): void { e.preventDefault(); this.dragging.set(true); }
  onDragLeave(): void { this.dragging.set(false); }

  onDrop(e: DragEvent): void {
    e.preventDefault(); this.dragging.set(false);
    this.procesarArchivos(Array.from(e.dataTransfer?.files ?? []).filter(f => f.type === 'application/pdf'));
  }

  onFileInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.procesarArchivos(Array.from(input.files ?? []).filter(f => f.type === 'application/pdf'));
    input.value = '';
  }

  triggerInput(): void { document.getElementById('bu-file-input')?.click(); }

  private procesarArchivos(archivos: File[]): void {
    if (!archivos.length) return;
    const presentes = new Set(this.files().map(f => f.file.name));
    const nuevos = archivos.filter(f => !presentes.has(f.name)).map(f => {
      const padre = matchearPadre(f.name, this.data.padres);
      return {
        file: f, padreId: padre?.id ?? null,
        padreLabel: padre ? this.labelPadre(padre) : null,
        status: 'idle' as FileStatus, error: null,
        reemplaza: padre ? this.data.existentes.has(padre.id) : false,
      };
    });
    this.files.update(list => [...list, ...nuevos]);
    this.fase.set('review');
  }

  // ── Asignación manual ─────────────────────────────────────────────────────

  asignarPadre(entry: FileEntry, padreId: string | null): void {
    this.files.update(list => list.map(f => {
      if (f !== entry) return f;
      const padre = this.data.padres.find(p => p.id === padreId) ?? null;
      return {
        ...f, padreId: padre?.id ?? null, padreLabel: padre ? this.labelPadre(padre) : null,
        reemplaza: padre ? this.data.existentes.has(padre.id) : false
      };
    }));
  }

  eliminarArchivo(entry: FileEntry): void {
    this.files.update(list => list.filter(f => f !== entry));
    if (!this.files().length) this.fase.set('pick');
  }

  // ── Upload: envía TODO en una sola petición a POST /libretas/bulk-padre ──

  async subirTodo(): Promise<void> {
    const pendientes = this.files().filter(f => f.padreId !== null && f.status === 'idle');
    if (!pendientes.length) return;

    this.uploading.set(true);
    // Marcar como uploading
    this.files.update(list => list.map(f =>
      pendientes.includes(f) ? { ...f, status: 'uploading' as FileStatus } : f,
    ));

    try {
      const formData = new FormData();
      formData.append('periodo_id', String(this.data.periodo_id));

      const assignments: { filename: string; padre_id: string }[] = [];
      for (const entry of pendientes) {
        formData.append('files', entry.file, entry.file.name);
        assignments.push({ filename: entry.file.name, padre_id: entry.padreId! });
      }
      formData.append('assignments', JSON.stringify(assignments));

      const r = await this.api.post<BulkPadreResult>('libretas/bulk-padre', formData).toPromise();
      const result = (r as any)?.data as BulkPadreResult;

      // Actualizar estado por archivo
      this.files.update(list => list.map(f => {
        const item = result?.items?.find(i => i.filename === f.file.name);
        if (!item) return f;
        return {
          ...f,
          status: item.status === 'uploaded' ? 'done'
            : item.status === 'error' ? 'error'
              : 'skipped' as FileStatus,
          error: item.error ?? null,
        };
      }));

    } catch (err: any) {
      const msg = err?.error?.message ?? err?.message ?? 'Error al subir';
      this.files.update(list => list.map(f =>
        pendientes.includes(f) ? { ...f, status: 'error' as FileStatus, error: msg } : f,
      ));
    }

    // Sin padre → skipped
    this.files.update(list => list.map(f =>
      f.padreId === null && f.status === 'idle' ? { ...f, status: 'skipped' as FileStatus } : f,
    ));

    this.uploading.set(false);
    this.fase.set('done');
  }

  // ── Cerrar / resetear ─────────────────────────────────────────────────────

  cerrar(): void { this.dialogRef.close({ uploaded: this.doneCount() }); }
  cancelar(): void { if (!this.uploading()) this.dialogRef.close({ uploaded: 0 }); }
  reset(): void { this.files.set([]); this.fase.set('pick'); }

  // ── Helpers ───────────────────────────────────────────────────────────────

  labelPadre(p: PadreLibretaItem): string {
    return `${p.apellido_paterno}${p.apellido_materno ? ' ' + p.apellido_materno : ''}, ${p.nombre}`;
  }

  formatBytes = fmtBytes;
  trackFile = (_: number, f: FileEntry): string => f.file.name;
}