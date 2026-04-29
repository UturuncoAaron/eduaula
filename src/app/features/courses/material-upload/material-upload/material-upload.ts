import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CourseService } from '../../stores/course';
import { TipoMaterial } from '../../../../core/models/course';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const MIME_PERMITIDOS = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/plain',
];

export interface MaterialUploadData {
  courseId: string;
  bimestre?: number | null;
  semana?: number | null;
}

@Component({
  selector: 'app-material-upload',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './material-upload.html',
  styleUrl: './material-upload.scss',
})
export class MaterialUpload {
  private fb = inject(FormBuilder);
  private csSvc = inject(CourseService);
  private snack = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<MaterialUpload>);
  private dialogData = inject<string | MaterialUploadData>(MAT_DIALOG_DATA);

  private get courseId(): string {
    return typeof this.dialogData === 'string' ? this.dialogData : this.dialogData.courseId;
  }

  private get defaultBimestre(): number | null {
    return typeof this.dialogData === 'string' ? null : this.dialogData.bimestre ?? null;
  }

  private get defaultSemana(): number | null {
    return typeof this.dialogData === 'string' ? null : this.dialogData.semana ?? null;
  }

  readonly bimestres = [1, 2, 3, 4];
  readonly semanas = Array.from({ length: 16 }, (_, i) => i + 1);

  loading = signal(false);
  modoSubida = signal<'archivo' | 'url'>('archivo');
  archivoSeleccionado = signal<File | null>(null);
  archivoError = signal<string | null>(null);

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    tipo: ['pdf' as TipoMaterial, Validators.required],
    url: [''],
    descripcion: ['', Validators.maxLength(500)],
    bimestre: [this.defaultBimestre as number | null],
    semana: [this.defaultSemana as number | null],
  });

  private formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.value,
  });

  tipoAceptaArchivo = computed(() => {
    const tipo = this.formValue().tipo;
    return tipo === 'pdf' || tipo === 'otro';
  });

  acceptedTypes = computed(() => {
    return this.formValue().tipo === 'pdf'
      ? '.pdf'
      : '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt';
  });

  urlHint = computed(() => {
    const tipo = this.formValue().tipo;
    if (tipo === 'video' || tipo === 'grabacion') return 'Pega el link de YouTube o Google Drive';
    if (tipo === 'pdf') return 'Sube tu PDF a Google Drive y pega el enlace aquí';
    return 'Pega la URL completa del recurso externo';
  });

  puedeEnviar = computed(() => {
    const val = this.formValue();
    const titulo = val.titulo ?? '';
    if (titulo.length < 3) return false;

    if (this.tipoAceptaArchivo() && this.modoSubida() === 'archivo') {
      return this.archivoSeleccionado() !== null && !this.archivoError();
    }

    const url = val.url ?? '';
    return url.startsWith('https://') || url.startsWith('http://');
  });

  onTipoChange() {
    this.archivoSeleccionado.set(null);
    this.archivoError.set(null);
    this.form.controls.url.setValue('');
    const tipo = this.form.value.tipo;
    if (tipo !== 'pdf' && tipo !== 'otro') {
      this.modoSubida.set('url');
    } else {
      this.modoSubida.set('archivo');
    }
  }

  setModo(modo: 'archivo' | 'url') {
    this.modoSubida.set(modo);
    this.archivoSeleccionado.set(null);
    this.archivoError.set(null);
    this.form.controls.url.setValue('');
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleFile(file);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.handleFile(file);
  }

  removeFile(event: Event) {
    event.stopPropagation();
    this.archivoSeleccionado.set(null);
    this.archivoError.set(null);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  cancelar() {
    this.dialogRef.close(false);
  }

  submit() {
    if (!this.puedeEnviar()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const archivo = this.archivoSeleccionado();
    const v = this.form.value;

    if (archivo && this.modoSubida() === 'archivo') {
      const fd = new FormData();
      fd.append('titulo', v.titulo!);
      fd.append('tipo', v.tipo!);
      fd.append('file', archivo);
      if (v.descripcion) fd.append('descripcion', v.descripcion);
      if (v.bimestre != null) fd.append('bimestre', String(v.bimestre));
      if (v.semana != null) fd.append('semana', String(v.semana));

      this.csSvc.addMaterialFile(this.courseId, fd).subscribe({
        next: () => this.onSuccess(),
        error: (err) => this.onError(err),
      });
    } else {
      const body: Record<string, unknown> = {
        titulo: v.titulo,
        tipo: v.tipo,
        url: v.url,
      };
      if (v.descripcion) body['descripcion'] = v.descripcion;
      if (v.bimestre != null) body['bimestre'] = v.bimestre;
      if (v.semana != null) body['semana'] = v.semana;

      this.csSvc.addMaterial(this.courseId, body).subscribe({
        next: () => this.onSuccess(),
        error: (err) => this.onError(err),
      });
    }
  }

  private handleFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      this.archivoError.set('El archivo supera 10 MB');
      this.archivoSeleccionado.set(null);
      return;
    }
    if (file.type && !MIME_PERMITIDOS.includes(file.type)) {
      this.archivoError.set('Formato no permitido');
      this.archivoSeleccionado.set(null);
      return;
    }
    this.archivoError.set(null);
    this.archivoSeleccionado.set(file);
  }

  private onSuccess() {
    this.snack.open('Material subido correctamente', 'OK', { duration: 3000 });
    this.dialogRef.close(true);
  }

  private onError(err: unknown) {
    this.loading.set(false);
    const msg = (err as { error?: { message?: string } })?.error?.message
      ?? 'No se pudo subir el material';
    this.snack.open(msg, 'Cerrar', { duration: 4000 });
  }
}
