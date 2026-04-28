import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { LoadingSkeleton } from '../../../../shared/components/loading-skeleton/loading-skeleton';
import { DatePipe, TitleCasePipe } from '@angular/common';

interface LiveClass {
  id: string;
  curso?: { id: string; nombre: string } | null;
  titulo: string;
  descripcion?: string;
  fecha_hora: string;
  duracion_min: number;
  link_reunion: string;
  estado: 'programada' | 'activa' | 'finalizada' | 'cancelada';
}

@Component({
  selector: 'app-live-class-list',
  standalone: true,
  imports: [
    MatCardModule, MatButtonModule, MatIconModule, MatChipsModule,
    DatePipe, TitleCasePipe,RouterLink, PageHeader, EmptyState, LoadingSkeleton,
  ],
  templateUrl: './live-class-list.html',
  styleUrl: './live-class-list.scss',
})
export class LiveClassList implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  classes = signal<LiveClass[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.get<LiveClass[]>('live-classes').subscribe({
      next: r => { this.classes.set(r.data); this.loading.set(false); },
      error: () => {
        const d1 = new Date(); d1.setDate(d1.getDate() + 1);
        this.classes.set([
          { id: '1', curso: { id: '1', nombre: 'Matemáticas' }, titulo: 'Clase: Funciones cuadráticas', descripcion: 'Veremos gráficas e interpretación', fecha_hora: d1.toISOString(), duracion_min: 60, link_reunion: 'https://meet.google.com/abc-def-ghi', estado: 'programada' },
        ]);
        this.loading.set(false);
      },
    });
  }

  join(link: string) { window.open(link, '_blank'); }
}