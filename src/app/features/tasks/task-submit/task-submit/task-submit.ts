import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../core/services/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-task-submit',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatCardModule,
    MatSnackBarModule, RouterLink, PageHeader,
  ],
  templateUrl: './task-submit.html',
  styleUrl: './task-submit.scss',
})
export class TaskSubmit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  loading = signal(false);
  taskId = this.route.snapshot.paramMap.get('id')!;

  form = this.fb.group({
    respuesta_texto: ['', Validators.required],
    url_archivo: [''],
  });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    const respuesta = (this.form.value.respuesta_texto ?? '').trim();
    const urlArchivo = (this.form.value.url_archivo ?? '').trim();
    const payload: Record<string, unknown> = {};
    if (respuesta) payload['respuesta_texto'] = respuesta;
    if (urlArchivo) payload['storage_key'] = urlArchivo;
    this.api.post(`tasks/${this.taskId}/submit`, payload).subscribe({
      next: () => {
        this.snack.open('Tarea entregada correctamente', 'OK', { duration: 3000 });
        this.router.navigate(['/tareas']);
      },
      error: () => {
        this.snack.open('Error al entregar la tarea', 'OK', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }
}
