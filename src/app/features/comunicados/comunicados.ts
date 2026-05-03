import { Component, inject, signal, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../core/services/api';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { TimeAgoPipe } from '../../shared/pipes/time-ago-pipe';

type Destinatario = 'todos' | 'alumnos' | 'docentes' | 'padres' | 'psicologas';

interface Announcement {
    id: string;
    titulo: string;
    contenido: string;
    destinatarios: Destinatario[];
    created_at: string;
    autor?: { nombre?: string; email?: string };
}

const DEST_LABELS: Record<Destinatario, string> = {
    todos: 'Todos',
    alumnos: 'Alumnos',
    docentes: 'Docentes',
    padres: 'Padres',
    psicologas: 'Psicólogas',
};

@Component({
    selector: 'app-comunicados',
    standalone: true,
    imports: [MatIconModule, PageHeader, EmptyState, TimeAgoPipe],
    templateUrl: './comunicados.html',
    styleUrl: './comunicados.scss',
})
export class Comunicados implements OnInit {
    private api = inject(ApiService);

    items = signal<Announcement[]>([]);
    loading = signal(true);
    selected = signal<Announcement | null>(null);

    ngOnInit() {
        this.api.get<Announcement[]>('announcements').subscribe({
            next: r => { this.items.set(r.data ?? []); this.loading.set(false); },
            error: () => { this.items.set([]); this.loading.set(false); },
        });
    }

    destinatarioLabel(d: string): string {
        return DEST_LABELS[d as Destinatario] ?? d;
    }

    open(item: Announcement) { this.selected.set(item); }
    close() { this.selected.set(null); }
}