import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../core/services/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-parent-child-link',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatCardModule, MatIconModule, MatSnackBarModule, PageHeader,
  ],
  templateUrl: './parent-child-link.html',
  styleUrl: './parent-child-link.scss',
})
export class ParentChildLink {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  loading = signal(false);

  form = this.fb.group({
    padre_doc: ['', [Validators.required, Validators.minLength(6)]],
    alumno_doc: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.api.post('admin/parent-child', this.form.value).subscribe({
      next: () => {
        this.snack.open('Vínculo creado correctamente', 'OK', { duration: 3000 });
        this.form.reset();
        this.loading.set(false);
      },
      error: () => {
        this.snack.open('Error. Verifica los documentos.', 'OK', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }
}