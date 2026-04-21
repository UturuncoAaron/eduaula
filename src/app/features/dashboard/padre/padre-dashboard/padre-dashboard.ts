import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';

interface Child {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  codigo_estudiante: string | null;
  foto_url: string | null;
  grado: string;
  seccion: string;
}

@Component({
  selector: 'app-padre-dashboard',
  imports: [RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './padre-dashboard.html',
  styleUrl: './padre-dashboard.scss',
})
export class PadreDashboard implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  children = signal<Child[]>([]);
  loading = signal(true);

  ngOnInit() {
    const padreId = this.auth.currentUser()?.id;
    if (!padreId) { this.loading.set(false); return; }

    // TODO: quitar ?padreId= cuando JWT esté activo
    this.api.get<Child[]>('parent/children', { padreId }).subscribe({
      next: r => { this.children.set(r.data); this.loading.set(false); },
      error: () => {
        // TODO: reemplazar con API real
        this.children.set([]);
        this.loading.set(false);
      },
    });
  }

  getInitials(child: Child): string {
    return `${child.nombre[0]}${child.apellido_paterno[0]}`.toUpperCase();
  }

  getFullName(child: Child): string {
    return `${child.nombre} ${child.apellido_paterno}${child.apellido_materno ? ' ' + child.apellido_materno : ''}`;
  }
}