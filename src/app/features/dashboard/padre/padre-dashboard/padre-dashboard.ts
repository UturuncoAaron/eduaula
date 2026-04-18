import { Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';

interface Child {
  id: string;
  nombre: string;
  apellido_paterno: string;
  grado: string;
  seccion: string;
}

@Component({
  selector: 'app-padre-dashboard',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './padre-dashboard.html',
  styleUrl: './padre-dashboard.scss'
})
export class PadreDashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  children = signal<Child[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.get<Child[]>('parent/children').subscribe({
      next: res => { this.children.set(res.data); this.loading.set(false); },
      error: () => {
        this.children.set([
          { id: '1', nombre: 'Carlos', apellido_paterno: 'García', grado: '3ro de Secundaria', seccion: 'A' }
        ]);
        this.loading.set(false);
      }
    });
  }
}