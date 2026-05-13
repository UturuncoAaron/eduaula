import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../../core/services/api';
import { PageHeader } from '../../../shared/components/page-header/page-header';

interface Libreta {
  id: string;
  periodo_id: number;
  nombre_archivo: string | null;
  observaciones: string | null;
  url: string;
  created_at: string;
  periodo: {
    id: number;
    nombre: string;
    bimestre: number;
    anio: number;
  };
}

@Component({
  selector: 'app-student-notebooks',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatButtonModule, PageHeader],
  templateUrl: './student-notebooks.html',
  styleUrl: './student-notebooks.scss',
})
export class StudentNotebooks implements OnInit {
  private api = inject(ApiService);

  notebooks = signal<Libreta[]>([]);
  loading = signal(true);
  error = signal(false);

  ngOnInit() {
    this.api.get<Libreta[]>('libretas/me').subscribe({
      next: r => { this.notebooks.set(r.data ?? []); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  open(libretaId: string, url: string) {
    // Marca la libreta como vista por el usuario actual (alumno/padre).
    // Endpoint idempotente, ignoramos errores para no bloquear la apertura.
    this.api.post(`libretas/${libretaId}/marcar-vista`, {}).subscribe({
      next: () => undefined,
      error: () => undefined,
    });
    window.open(url, '_blank');
  }
}