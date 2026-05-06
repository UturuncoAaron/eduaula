import { Component, inject, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth';
import { CourseService } from '../../stores/course';

@Component({
  selector: 'app-course-list',
  standalone: true,
  imports: [
    MatCardModule, MatIconModule, MatButtonModule,
    MatChipsModule, MatProgressSpinnerModule, RouterLink,
  ],
  templateUrl: './course-list.html',
  styleUrl: './course-list.scss'
})
export class CourseList implements OnInit {
  readonly auth = inject(AuthService);
  private csSvc = inject(CourseService);

  courses = this.csSvc.courses;
  loading = this.csSvc.loading;

  readonly gradients = [
    'linear-gradient(135deg, #1565C0, #42A5F5)',
    'linear-gradient(135deg, #2E7D32, #66BB6A)',
    'linear-gradient(135deg, #6A1B9A, #AB47BC)',
    'linear-gradient(135deg, #E65100, #FFA726)',
    'linear-gradient(135deg, #00838F, #26C6DA)',
    'linear-gradient(135deg, #AD1457, #EC407A)',
  ];

  getInitials(nombre: string): string {
    return nombre.split(' ')
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }

  ngOnInit() {
    this.csSvc.loadMyCourses().subscribe({
      error: () => {
        this.csSvc.courses.set([
          { id: '1', nombre: 'Matemáticas', descripcion: '3ro Secundaria · Sección A', docente_id: '', seccion_id: 1, periodo_id: 1, activo: true },
          { id: '2', nombre: 'Comunicación', descripcion: '3ro Secundaria · Sección A', docente_id: '', seccion_id: 1, periodo_id: 1, activo: true },
          { id: '3', nombre: 'Historia del Perú', descripcion: '3ro Secundaria · Sección A', docente_id: '', seccion_id: 1, periodo_id: 1, activo: true },
          { id: '4', nombre: 'Inglés', descripcion: '3ro Secundaria · Sección A', docente_id: '', seccion_id: 1, periodo_id: 1, activo: true },
          { id: '5', nombre: 'Ciencias', descripcion: '3ro Secundaria · Sección A', docente_id: '', seccion_id: 1, periodo_id: 1, activo: true },
        ]);
      }
    });
  }
}