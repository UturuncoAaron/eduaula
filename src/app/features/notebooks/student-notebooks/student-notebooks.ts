import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
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
  imports: [DatePipe, MatIconModule, MatButtonModule, MatTooltipModule, PageHeader],
  templateUrl: './student-notebooks.html',
  styleUrl: './student-notebooks.scss',
})
export class StudentNotebooks implements OnInit {
  private api = inject(ApiService);
  private sanitizer = inject(DomSanitizer);

  notebooks = signal<Libreta[]>([]);
  loading = signal(true);
  error = signal(false);

  preview = signal<Libreta | null>(null);
  readonly previewUrl = computed<SafeResourceUrl | null>(() => {
    const nb = this.preview();
    if (!nb) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(`${nb.url}#toolbar=1&view=FitH`);
  });

  ngOnInit() {
    this.api.get<Libreta[]>('libretas/me').subscribe({
      next: r => { this.notebooks.set(r.data ?? []); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  private marcarVista(libretaId: string) {
    this.api.post(`libretas/${libretaId}/marcar-vista`, {}).subscribe({
      next: () => undefined,
      error: () => undefined,
    });
  }

  ver(nb: Libreta) {
    this.marcarVista(nb.id);
    this.preview.set(nb);
  }

  abrirExterno(nb: Libreta) {
    this.marcarVista(nb.id);
    window.open(nb.url, '_blank', 'noopener');
  }

  cerrarPreview() {
    this.preview.set(null);
  }
}