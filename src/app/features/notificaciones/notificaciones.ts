import { Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { TimeAgoPipe } from '../../shared/pipes/time-ago-pipe';
import { NotificationsStore, NotificationItem } from '../../core/services/notifications-store';

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
    private store = inject(NotificationsStore);

    items = this.store.items;
    private _loading = signal(true);
    loading = this._loading.asReadonly();
    marking = signal(false);

    // Getter para que la plantilla pueda usar `unreadCount > 0`
    // (formato heredado del componente anterior).
    get unreadCount() { return this.store.unreadCount(); }

    ngOnInit() {
        // Asegura conexión SSE en caso de deep-link directo a /notificaciones.
        this.store.connect();
        // Refresca el listado desde la API por si veníamos de otra sesión.
        this.store.refresh();
        this._loading.set(false);
    }

    markOne(n: NotificationItem) {
        if (n.read) return;
        this.store.markOneAsRead(n.id);
    }

    markAll() {
        this.marking.set(true);
        this.store.markAllAsRead();
        // El store ya hace optimistic update; bajamos el flag al siguiente tick.
        queueMicrotask(() => this.marking.set(false));
    }

    iconForType(tipo: string): string {
        const map: Record<string, string> = {
            cita_agendada: 'event',
            cita_confirmada: 'event_available',
            cita_cancelada: 'event_busy',
            cita_rechazada: 'event_busy',
            comunicado_nuevo: 'campaign',
            tarea_nueva: 'assignment',
            tarea: 'assignment',
            nota: 'grade',
            comunicado: 'campaign',
            clase: 'videocam',
            libreta: 'menu_book',
            foro: 'forum',
        };
        return map[tipo] ?? 'notifications';
    }

    colorForType(tipo: string): string {
        const map: Record<string, string> = {
            cita_agendada: '#3b82f6',
            cita_confirmada: '#10b981',
            cita_cancelada: '#ef4444',
            cita_rechazada: '#ef4444',
            comunicado_nuevo: '#1A3A6B',
            tarea_nueva: '#f59e0b',
            tarea: '#f59e0b',
            nota: '#10b981',
            comunicado: '#1A3A6B',
            clase: '#3b82f6',
            libreta: '#8b5cf6',
            foro: '#0ea5e9',
        };
        return map[tipo] ?? '#64748b';
    }
}
