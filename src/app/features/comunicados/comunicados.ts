import { Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../core/services/api';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { TimeAgoPipe } from '../../shared/pipes/time-ago-pipe';

interface Announcement {
    id: string;
    titulo: string;
    contenido: string;
    destinatario: 'todos' | 'alumnos' | 'docentes' | 'padres';
    created_at: string;
    autor?: { nombre?: string; email?: string };
}

@Component({
    selector: 'app-comunicados',
    standalone: true,
    imports: [
        MatCardModule, MatIconModule, MatButtonModule,
        PageHeader, EmptyState, TimeAgoPipe,
    ],
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
        const map: Record<string, string> = {
            todos: 'Todos', alumnos: 'Alumnos',
            docentes: 'Docentes', padres: 'Padres',
        };
        return map[d] ?? d;
    }

    destinatarioColor(d: string): string {
        const map: Record<string, string> = {
            todos: '#1A3A6B', alumnos: '#10b981',
            docentes: '#f59e0b', padres: '#8b5cf6',
        };
        return map[d] ?? '#64748b';
    }

    open(item: Announcement) { this.selected.set(item); }
    close() { this.selected.set(null); }
}