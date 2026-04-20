import { Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';
import { Course } from '../../../../core/models/course';

@Component({
  selector: 'app-alumno-dashboard',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatButtonModule, MatChipsModule, RouterLink],
  templateUrl: './alumno-dashboard.html',
  styleUrl: './alumno-dashboard.scss'
})
export class AlumnoDashboard implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  courses = signal<Course[]>([]);
  loading = signal(true);
  stats = signal({ cursos: 0, tareasP: 0, examenesP: 0, promedio: 0 });

  ngOnInit() {
    this.api.get<Course[]>('courses').subscribe({
      next: res => {
        this.courses.set(res.data);
        this.stats.set({ cursos: res.data.length, tareasP: 3, examenesP: 1, promedio: 15.4 });
        this.loading.set(false);
      },
      error: () => {
        this.courses.set([
          { id: '1', nombre: 'Matemáticas', descripcion: '3ro de Secundaria', docente_id: '', seccion_id: 1, periodo_id: 1, activo: true },
          { id: '2', nombre: 'Comunicación', descripcion: '3ro de Secundaria', docente_id: '', seccion_id: 1, periodo_id: 1, activo: true },
          { id: '3', nombre: 'Historia', descripcion: '3ro de Secundaria', docente_id: '', seccion_id: 1, periodo_id: 1, activo: true },
        ]);
        this.stats.set({ cursos: 3, tareasP: 3, examenesP: 1, promedio: 15.4 });
        this.loading.set(false);
      }
    });
  }
}