import { Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';
import { Course } from '../../../../core/models/course';

@Component({
  selector: 'app-docente-dashboard',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatButtonModule, MatBadgeModule, RouterLink],
  templateUrl: './docente-dashboard.html',
  styleUrl: './docente-dashboard.scss'
})
export class DocenteDashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  courses = signal<Course[]>([]);
  loading = signal(true);
  alerts = signal({ sinCalificar: 5, notasPendientes: 2, examenes: 1 });

  ngOnInit() {
    this.api.get<Course[]>('courses').subscribe({
      next: res => { this.courses.set(res.data); this.loading.set(false); },
      error: () => {
        this.courses.set([
          { id: '1', nombre: 'Matemáticas 3A', descripcion: 'Sección A', docente_id: '', seccion_id: 1, periodo_id: 1, activo: true },
          { id: '2', nombre: 'Matemáticas 3B', descripcion: 'Sección B', docente_id: '', seccion_id: 2, periodo_id: 1, activo: true },
        ]);
        this.loading.set(false);
      }
    });
  }
}