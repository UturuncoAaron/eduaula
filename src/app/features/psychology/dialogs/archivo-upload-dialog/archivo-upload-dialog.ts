import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastService } from 'ngx-toastr-notifier';

import { PsychologyStore } from '../../data-access/psychology.store';
import { ARCHIVO_MAX_BYTES, ArchivoCategoria } from '../../../../core/models/psychology';

export interface ArchivoUploadDialogData {
  studentId: string;
  studentName: string;
  categoria: ArchivoCategoria;
}

@Component({
  selector: 'app-archivo-upload-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule,
    MatSlideToggleModule, MatProgressBarModule, MatTooltipModule
  ],
  templateUrl: './archivo-upload-dialog.html',
  styleUrls: ['./archivo-upload-dialog.scss'],
})
export class ArchivoUploadDialog {
  private readonly ref = inject(MatDialogRef<ArchivoUploadDialog>);
  private readonly store = inject(PsychologyStore);
  private readonly toastr = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly data = inject<ArchivoUploadDialogData>(MAT_DIALOG_DATA);

  readonly file = signal<File | null>(null);
  readonly nombre = signal('');
  readonly descripcion = signal('');
  readonly confidencial = signal(true);
  readonly dragOver = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly previewObjectUrl = signal<string | null>(null);

  readonly maxBytes = ARCHIVO_MAX_BYTES;

  readonly tituloModal = computed(() => {
    const map: Record<string, string> = {
      ficha: 'Agregar ficha',
      test: 'Agregar test',
      informe: 'Agregar informe externo',
    };
    return map[this.data.categoria] ?? 'Agregar archivo';
  });

  readonly subtituloModal = computed(() => {
    const map: Record<string, string> = {
      ficha: 'Sube un documento de ficha clínica del alumno',
      test: 'Sube los resultados de un test aplicado al alumno',
      informe: 'Sube un informe externo de un especialista',
    };
    return map[this.data.categoria] ?? 'Sube un archivo';
  });

  readonly fileSizeLabel = computed(() => {
    const f = this.file();
    if (!f) return '';
    return this.formatBytes(f.size);
  });

  readonly fileIcon = computed(() => {
    const f = this.file();
    if (!f) return 'upload_file';
    return this.iconFor(f.type, f.name);
  });

  readonly isPreviewable = computed(() => {
    const f = this.file();
    if (!f) return false;
    const mime = f.type.toLowerCase();
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    return mime.startsWith('image/') || mime === 'application/pdf' || ext === 'pdf';
  });

  readonly isImagePreview = computed(() => {
    const f = this.file();
    return !!f && f.type.toLowerCase().startsWith('image/');
  });

  readonly safePdfUrl = computed((): SafeResourceUrl | null => {
    const url = this.previewObjectUrl();
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(`${url}#toolbar=0&navpanes=0&scrollbar=1`);
  });

  readonly canSubmit = computed(() =>
    !!this.file() && this.nombre().trim().length > 0 && !this.uploading(),
  );

  onDragEnter(e: DragEvent): void { e.preventDefault(); this.dragOver.set(true); }
  onDragOver(e: DragEvent): void { e.preventDefault(); this.dragOver.set(true); }
  onDragLeave(e: DragEvent): void { e.preventDefault(); this.dragOver.set(false); }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) this.setFile(f);
  }

  onFilePicked(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) this.setFile(f);
    input.value = '';
  }

  clearFile(): void {
    this.revokePreview();
    this.file.set(null);
    this.error.set(null);
  }

  private setFile(f: File): void {
    if (f.size > this.maxBytes) {
      this.error.set(`El archivo supera el tamaño máximo de ${this.formatBytes(this.maxBytes)}.`);
      return;
    }
    if (f.size === 0) { this.error.set('El archivo está vacío.'); return; }
    this.error.set(null);
    this.revokePreview();
    this.file.set(f);
    if (!this.nombre().trim()) this.nombre.set(this.stripExtension(f.name));

    const mime = f.type.toLowerCase();
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (mime.startsWith('image/') || mime === 'application/pdf' || ext === 'pdf') {
      this.previewObjectUrl.set(URL.createObjectURL(f));
    }
  }

  private revokePreview(): void {
    const url = this.previewObjectUrl();
    if (url) { URL.revokeObjectURL(url); this.previewObjectUrl.set(null); }
  }

  async submit(): Promise<void> {
    const f = this.file();
    if (!f) return;
    const nombre = this.nombre().trim();
    if (!nombre) { this.error.set('El nombre es obligatorio.'); return; }

    this.uploading.set(true);
    this.error.set(null);
    try {
      await this.store.uploadArchivo({
        studentId: this.data.studentId,
        categoria: this.data.categoria,
        nombre,
        descripcion: this.descripcion().trim() || undefined,
        confidencial: this.confidencial(),
        file: f,
      });
      this.toastr.success(
        this.data.categoria === 'ficha' ? 'Ficha agregada'
          : this.data.categoria === 'test' ? 'Test agregado'
            : 'Informe externo agregado',
      );
      this.revokePreview();
      this.ref.close(true);
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message
        ?? 'No se pudo subir el archivo';
      this.error.set(msg);
    } finally {
      this.uploading.set(false);
    }
  }

  cancel(): void {
    if (this.uploading()) return;
    this.revokePreview();
    this.ref.close(false);
  }

  private formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  }

  private stripExtension(name: string): string {
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(0, i) : name;
  }

  private iconFor(mime: string, name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (mime?.startsWith('image/')) return 'image';
    if (mime === 'application/pdf' || ext === 'pdf') return 'picture_as_pdf';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'table_chart';
    if (['doc', 'docx'].includes(ext)) return 'description';
    if (['zip', 'rar', '7z'].includes(ext)) return 'folder_zip';
    return 'insert_drive_file';
  }
}