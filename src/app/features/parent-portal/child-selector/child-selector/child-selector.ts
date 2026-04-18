import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';

interface Child {
  id: string;
  nombre: string;
  apellido_paterno: string;
  grado: string;
  seccion: string;
  tiene_libreta: boolean;
}

@Component({
  selector: 'app-child-selector',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, RouterLink, PageHeader, EmptyState],
  templateUrl: './child-selector.html',
  styleUrl: './child-selector.scss',
})
export class ChildSelector implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  children = signal<Child[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.get<Child[]>('parent/children').subscribe({
      next: r => { this.children.set(r.data); this.loading.set(false); },
      error: () => {
        this.children.set([
          { id: '1', nombre: 'Carlos', apellido_paterno: 'García', grado: '3ro de Secundaria', seccion: 'A', tiene_libreta: true },
        ]);
        this.loading.set(false);
      },
    });
  }
}