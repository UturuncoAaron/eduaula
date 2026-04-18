import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../core/services/api';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

interface Libreta {
    id: string;
    nombre: string;
    url_pdf: string;
    periodo: string;
    created_at: string;
}

@Component({
    selector: 'app-child-libreta',
    standalone: true,
    imports: [MatCardModule, MatButtonModule, MatIconModule, PageHeader, EmptyState],
    templateUrl: './child-libreta.html',
    styleUrl: './child-libreta.scss',
})
export class ChildLibreta implements OnInit {
    private route = inject(ActivatedRoute);
    private api = inject(ApiService);

    childId = this.route.snapshot.paramMap.get('childId')!;
    libretas = signal<Libreta[]>([]);
    loading = signal(true);

    ngOnInit() {
        this.api.get<Libreta[]>(`parent/children/${this.childId}/libretas`).subscribe({
            next: r => { this.libretas.set(r.data); this.loading.set(false); },
            error: () => {
                // Si el backend devuelve error (ej: no tiene libreta asignada), mostrar vacío
                this.libretas.set([]);
                this.loading.set(false);
            },
        });
    }

    open(url: string) { window.open(url, '_blank'); }
}