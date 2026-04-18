import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../core/services/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-live-class-create',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatCardModule,
    MatSnackBarModule, RouterLink, PageHeader,
  ],
  templateUrl: './live-class-create.html',
  styleUrl: './live-class-create.scss',
})
export class LiveClassCreate {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  loading = signal(false);

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    fecha_hora: ['', Validators.required],
    duracion_min: [60, [Validators.required, Validators.min(10)]],
    link_reunion: ['', [Validators.required, Validators.pattern('https?://.+')]],
  });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.api.post('live-classes', this.form.value).subscribe({
      next: () => {
        this.snack.open('Clase programada correctamente', 'OK', { duration: 3000 });
        this.router.navigate(['/clases-vivo']);
      },
      error: () => {
        this.snack.open('Error al programar la clase', 'OK', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }
}