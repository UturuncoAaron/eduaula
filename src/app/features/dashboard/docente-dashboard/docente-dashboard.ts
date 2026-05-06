import { Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth';
import { ApiService } from '../../../core/services/api';
import { Course } from '../../../core/models/course';

@Component({
  selector: 'app-docente-dashboard',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './docente-dashboard.html',
  styleUrl: './docente-dashboard.scss',
})
export class DocenteDashboard implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  courses = signal<Course[]>([]);
  loading = signal(true);
  alerts = signal({ sinCalificar: 0, notasPendientes: 0 });

  ngOnInit() {
    this.api.get<any>('courses').subscribe({
      next: res => {
        const body = res?.data ?? res ?? [];
        const list = Array.isArray(body) ? body : (body.data ?? []);
        this.courses.set(list);
        this.loading.set(false);
        // TODO: reemplazar por endpoint real cuando exista
        // this.api.get('docentes/me/alertas').subscribe(r => this.alerts.set(r.data))
      },
      error: () => {
        this.courses.set([]);
        this.loading.set(false);
      },
    });
  }
}