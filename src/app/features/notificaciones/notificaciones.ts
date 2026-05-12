import { Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { TimeAgoPipe } from '../../shared/pipes/time-ago-pipe';
import {
    NotificationsStore,
    NotificationItem,
} from '../../core/services/notifications-store';
import {
    iconForType,
    colorForType,
} from '../../shared/utils/notifications-helpers';

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

    /** Getter heredado por compatibilidad con tu plantilla actual. */
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
        queueMicrotask(() => this.marking.set(false));
    }

    // Delegamos a los helpers compartidos para mantener UNA fuente de verdad.
    iconForType = iconForType;
    colorForType = colorForType;
}