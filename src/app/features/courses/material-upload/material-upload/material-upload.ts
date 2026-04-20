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
  private courseId = inject<string>(MAT_DIALOG_DATA);

  loading = signal(false);
  modoSubida = signal<'archivo' | 'url'>('archivo');
  archivoSeleccionado = signal<File | null>(null);

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    tipo: ['pdf', Validators.required],
    url: [''],
    descripcion: [''],
  });

  // Conectar form reactivo a signals
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
      : '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
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

    const tipo = val.tipo ?? '';
    const tipoArchivo = tipo === 'pdf' || tipo === 'otro';

    if (tipoArchivo && this.modoSubida() === 'archivo') {
      return this.archivoSeleccionado() !== null;
    }

    const url = val.url ?? '';
    return url.startsWith('https://');
  });

  onTipoChange() {
    this.archivoSeleccionado.set(null);
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
    this.form.controls.url.setValue('');
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.archivoSeleccionado.set(file);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.archivoSeleccionado.set(file);
  }

  removeFile(event: Event) {
    event.stopPropagation();
    this.archivoSeleccionado.set(null);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  submit() {
    if (!this.puedeEnviar()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const archivo = this.archivoSeleccionado();

    if (archivo && this.modoSubida() === 'archivo') {
      const formData = new FormData();
      formData.append('titulo', this.form.value.titulo!);
      formData.append('tipo', this.form.value.tipo!);
      formData.append('file', archivo);
      if (this.form.value.descripcion) {
        formData.append('descripcion', this.form.value.descripcion);
      }

      this.csSvc.addMaterialFile(this.courseId, formData).subscribe({
        next: () => this.onSuccess(),
        error: () => this.onError(),
      });
    } else {
      this.csSvc.addMaterial(this.courseId, this.form.value as any).subscribe({
        next: () => this.onSuccess(),
        error: () => this.onError(),
      });
    }
  }

  private onSuccess() {
    this.snack.open('Material subido correctamente', 'OK', { duration: 3000 });
    this.dialogRef.close(true);
  }

  private onError() {
    this.snack.open('Error al subir el material', 'OK', { duration: 3000 });
    this.loading.set(false);
  }
}