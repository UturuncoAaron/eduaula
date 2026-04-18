import { Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss'
})
export class AdminDashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  stats = signal({ alumnos: 0, docentes: 0, cursos: 0, padres: 0 });

  ngOnInit() {
    this.stats.set({ alumnos: 1000, docentes: 45, cursos: 120, padres: 820 });
  }

  readonly quickAccess = [
    { label: 'Gestionar usuarios', icon: 'people', route: '/admin/usuarios' },
    { label: 'Estructura académica', icon: 'account_tree', route: '/admin/academico' },
    { label: 'Vincular padre-hijo', icon: 'family_restroom', route: '/admin/padre-hijo' },
    { label: 'Exportar reportes', icon: 'download', route: '/admin/reportes' },
  ];
}