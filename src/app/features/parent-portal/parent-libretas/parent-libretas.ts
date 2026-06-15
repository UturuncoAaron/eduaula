import { Component, inject, signal, OnInit, computed, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ApiService } from '../../../core/services/api';
import { PageHeader } from '../../../shared/components/page-header/page-header';

interface Libreta {
  id: string;
  periodo_id: string;
  nombre_archivo: string | null;
  observaciones: string | null;
  url: string;
  created_at: string;
  leida?: boolean;
  periodo: {
    id: string;
    nombre: string;
    bimestre: number;
    anio: number;
  } | null;
}

interface YearGroup {
  anio: number;
  items: Libreta[];
}

@Component({
  selector: 'app-parent-libretas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatIconModule, MatButtonModule, MatTooltipModule, PageHeader],
  templateUrl: './parent-libretas.html',
  styleUrl: './parent-libretas.scss',
})
export class ParentLibretas implements OnInit {
  private api = inject(ApiService);
  private sanitizer = inject(DomSanitizer);

  readonly libretas = signal<Libreta[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly preview = signal<Libreta | null>(null);
  readonly previewUrl = computed<SafeResourceUrl | null>(() => {
    const lb = this.preview();
    if (!lb?.url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(`${lb.url}#toolbar=1&view=FitH`);
  });

  readonly total = computed(() => this.libretas().length);

  readonly nuevas = computed(() =>
    this.libretas().filter(l => l.leida === false).length
  );

  readonly ultima = computed(() => {
    const list = this.libretas();
    if (list.length === 0) return null;
    return [...list].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  });

  readonly grupos = computed<YearGroup[]>(() => {
    const map = new Map<number, Libreta[]>();
    for (const lb of this.libretas()) {
      const anio = lb.periodo?.anio ?? new Date(lb.created_at).getFullYear();
      const arr = map.get(anio) ?? [];
      arr.push(lb);
      map.set(anio, arr);
    }
    return [...map.entries()]
      .map(([anio, items]) => ({
        anio,
        items: items.sort((a, b) => (b.periodo?.bimestre ?? 0) - (a.periodo?.bimestre ?? 0)),
      }))
      .sort((a, b) => b.anio - a.anio);
  });

  ngOnInit() {
    this.api.get<Libreta[]>('libretas/me').subscribe({
      next: r => {
        this.libretas.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  private marcarVista(lb: Libreta) {
    this.api.post(`libretas/${lb.id}/marcar-vista`, {}).subscribe({
      next: () => {
        this.libretas.update(list =>
          list.map(item => item.id === lb.id ? { ...item, leida: true } : item)
        );
      },
      error: () => undefined,
    });
  }

  ver(lb: Libreta) {
    if (!lb.url) return;
    this.marcarVista(lb);
    this.preview.set(lb);
  }

  abrirExterno(lb: Libreta) {
    if (!lb.url) return;
    this.marcarVista(lb);
    window.open(lb.url, '_blank', 'noopener');
  }

  cerrarPreview() {
    this.preview.set(null);
  }
}