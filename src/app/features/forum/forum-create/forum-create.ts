import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../../core/services/api';

@Component({
  selector: 'app-forum-create',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './forum-create.html',
  styleUrl: './forum-create.scss',
})
export class ForumCreate {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<ForumCreate>);
  private courseId = inject<string>(MAT_DIALOG_DATA);

  loading = signal(false);

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
  });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.api.post(`courses/${this.courseId}/forums`, this.form.value).subscribe({
      next: () => {
        this.snack.open('Foro creado correctamente', 'OK', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: () => {
        this.snack.open('Error al crear el foro', 'OK', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }
}