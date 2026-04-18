import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ExamService } from '../../stores/exam';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-exam-create',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSelectModule,
    MatCheckboxModule, MatCardModule, MatSnackBarModule,
    RouterLink, PageHeader,
  ],
  templateUrl: './exam-create.html',
  styleUrl: './exam-create.scss',
})
export class ExamCreate {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  loading = signal(false);

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    curso_id: ['', Validators.required],
    fecha_inicio: ['', Validators.required],
    fecha_fin: ['', Validators.required],
    puntos_total: [20, [Validators.required, Validators.min(1)]],
  });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    // TODO: conectar con examSvc.createExam()
    this.snack.open('Examen creado correctamente', 'OK', { duration: 3000 });
    this.router.navigate(['/examenes']);
  }
}