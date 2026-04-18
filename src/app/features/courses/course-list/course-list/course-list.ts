import { Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth';
import { CourseService } from '../../stores/course';
import { Course } from '../../../../core/models/course';

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
export class CourseListComponent implements OnInit {
  readonly auth = inject(AuthService);
  private csSvc = inject(CourseService);

  courses = this.csSvc.courses;
  loading = this.csSvc.loading;

  readonly courseColors = ['#1565C0', '#2E7D32', '#6A1B9A', '#E65100', '#00838F'];

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