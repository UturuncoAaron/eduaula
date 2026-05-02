import { Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../core/services/api';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { TimeAgoPipe } from '../../shared/pipes/time-ago-pipe';

interface Notif {
    id: string;
    tipo: string;
    titulo: string;
    cuerpo: string;
    read: boolean;
    referenceType?: string;
    referenceId?: string;
    createdAt: string;
}

@Component({
    selector: 'app-notificaciones',
    standalone: true,
    imports: [
        MatCardModule, MatIconModule, MatButtonModule,
        PageHeader, EmptyState, TimeAgoPipe,
    ],
    templateUrl: './notificaciones.html',
    styleUrl: './notificaciones.scss',
})
export class Notificaciones implements OnInit {
    private api = inject(ApiService);

    items = signal<Notif[]>([]);
    loading = signal(true);
    marking = signal(false);

    get unreadCount() { return this.items().filter(n => !n.read).length; }

    ngOnInit() { this.load(); }

    load() {
        this.loading.set(true);
        this.api.get<Notif[]>('notifications').subscribe({
            next: r => { this.items.set(r.data ?? []); this.loading.set(false); },
            error: () => { this.items.set([]); this.loading.set(false); },
        });
    }

    markOne(n: Notif) {
        if (n.read) return;
        this.api.patch(`notifications/${n.id}/read`, {}).subscribe({
            next: () => this.items.update(list =>
                list.map(x => x.id === n.id ? { ...x, read: true } : x)
            ),
        });
    }

    markAll() {
        this.marking.set(true);
        this.api.patch('notifications/read-all', {}).subscribe({
            next: () => {
                this.items.update(list => list.map(x => ({ ...x, read: true })));
                this.marking.set(false);
            },
            error: () => this.marking.set(false),
        });
    }

    iconForType(tipo: string): string {
        const map: Record<string, string> = {
            tarea: 'assignment', examen: 'quiz', nota: 'grade',
            comunicado: 'campaign', clase: 'videocam',
            libreta: 'menu_book', foro: 'forum',
        };
        return map[tipo] ?? 'notifications';
    }

    colorForType(tipo: string): string {
        const map: Record<string, string> = {
            tarea: '#f59e0b', examen: '#ef4444', nota: '#10b981',
            comunicado: '#1A3A6B', clase: '#3b82f6',
            libreta: '#8b5cf6', foro: '#0ea5e9',
        };
        return map[tipo] ?? '#64748b';
    }
}