import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../../core/services/api';
import { Course } from '../../../../core/models/course';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-live-class-create',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatCardModule,
    RouterLink, PageHeader,
  ],
  templateUrl: './live-class-create.html',
  styleUrl: './live-class-create.scss',
})
export class LiveClassCreate implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  loading = signal(false);
  cursos = signal<Course[]>([]);

  form = this.fb.group({
    curso_id: ['', Validators.required],
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    fecha_hora: ['', Validators.required],
    duracion_min: [60, [Validators.required, Validators.min(10)]],
    link_reunion: ['', [Validators.required, Validators.pattern('https?://.+')]],
  });

  ngOnInit() {
    this.api.get<Course[]>('courses').subscribe({
      next: r => this.cursos.set(r.data),
      error: () => this.cursos.set([]),
    });
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.api.post('live-classes', this.form.value).subscribe({
      next: () => {
        this.toastr.success('Clase programada correctamente', 'Éxito');
        this.router.navigate(['/clases-vivo']);
      },
      error: () => {
        this.toastr.success('Error al programar la clase', 'Éxito');
        this.loading.set(false);
      },
    });
  }
}
