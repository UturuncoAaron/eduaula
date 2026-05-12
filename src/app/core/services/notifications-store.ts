import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { ApiService } from './api';
import { AuthService } from '../auth/auth';

export interface NotificationItem {
    id: string;
    tipo: string;
    titulo: string;
    cuerpo?: string | null;
    read: boolean;
    referenceId?: string | null;
    referenceType?: string | null;
    createdAt: string;
    expiresAt?: string | null;
}

/**
 * Store de notificaciones SIN streams ni polling.
 *
 * Estrategia:
 *  - Fetch único al login (lo arranca MainLayout).
 *  - Re-fetch cuando el usuario vuelve a la pestaña (focus / visibilitychange).
 *  - Optimistic updates al marcar leídas.
 *
 * Las notificaciones se generan en el backend (event-emitter + Cron de
 * limpieza); el FE simplemente las consulta cuando hay razón para hacerlo.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly destroyRef = inject(DestroyRef);

    private _items = signal<NotificationItem[]>([]);
    readonly items = this._items.asReadonly();
    readonly unreadCount = computed(() => this._items().filter(n => !n.read).length);

    private booted = false;
    private onFocus = () => { if (this.auth.isLoggedIn()) this.refresh(); };
    private onVisibility = () => {
        if (document.visibilityState === 'visible' && this.auth.isLoggedIn()) {
            this.refresh();
        }
    };

    constructor() {
        this.destroyRef.onDestroy(() => this.teardown());
    }

    /** Idempotente. La llama MainLayout al login y el navbar por si acaso. */
    connect(): void {
        if (this.booted || !this.auth.isLoggedIn()) return;
        this.booted = true;
        this.refresh();
        window.addEventListener('focus', this.onFocus);
        document.addEventListener('visibilitychange', this.onVisibility);
    }

    disconnect(): void { this.teardown(); }

    refresh(): void {
        if (!this.auth.isLoggedIn()) return;
        this.api.get<NotificationItem[]>('notifications').subscribe({
            next: r => this._items.set(r.data ?? []),
            error: () => { /* mantenemos el último valor conocido */ },
        });
    }

    markOneAsRead(id: string) {
        this._items.update(list =>
            list.map(n => n.id === id ? { ...n, read: true } : n),
        );
        this.api.patch(`notifications/${id}/read`, {}).subscribe({
            error: () => this.refresh(),
        });
    }

    markAllAsRead() {
        const prev = this._items();
        this._items.update(list => list.map(n => ({ ...n, read: true })));
        this.api.patch('notifications/read-all', {}).subscribe({
            error: () => this._items.set(prev),
        });
    }

    private teardown(): void {
        window.removeEventListener('focus', this.onFocus);
        document.removeEventListener('visibilitychange', this.onVisibility);
        this.booted = false;
    }
}