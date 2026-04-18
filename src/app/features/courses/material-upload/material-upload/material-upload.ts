import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CourseService } from '../../stores/course';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { MatCard, MatCardContent } from "@angular/material/card";

@Component({
  selector: 'app-material-upload',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatSnackBarModule, RouterLink, PageHeader,
    MatCard,
    MatCardContent
],
  templateUrl: './material-upload.html',
  styleUrl: './material-upload.scss',
})
export class MaterialUpload {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private csSvc = inject(CourseService);
  private snack = inject(MatSnackBar);

  loading = signal(false);
  courseId = this.route.snapshot.paramMap.get('id')!;

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    tipo: ['pdf', Validators.required],
    url: ['', [Validators.required, Validators.pattern('https?://.+')]],
    descripcion: [''],
  });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.csSvc.addMaterial(this.courseId, this.form.value as any).subscribe({
      next: () => {
        this.snack.open('Material subido correctamente', 'OK', { duration: 3000 });
        this.router.navigate(['/cursos', this.courseId]);
      },
      error: () => {
        this.snack.open('Error al subir el material', 'OK', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }
}