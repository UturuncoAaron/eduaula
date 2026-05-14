import {
    Injectable,
    inject,
    signal,
    computed,
    DestroyRef,
} from '@angular/core';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { environment } from '../../../environments/environment';
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

@Injectable({ providedIn: 'root' })
export class NotificationsStore {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly destroyRef = inject(DestroyRef);

    private _items = signal<NotificationItem[]>([]);
    readonly items = this._items.asReadonly();
    readonly unreadCount = computed(
        () => this._items().filter((n) => !n.read).length,
    );

    private booted = false;
    private eventSource: EventSourcePolyfill | null = null;
    private lastRefreshAt = 0;
    /**
     * Throttle del REST refresh. Tener SSE abierto ya garantiza updates en
     * tiempo real, así que estos refresh REST son sólo "safety nets" cuando
     * el browser cambia de visibility/focus tras un sleep o reconexión.
     * Reducir la frecuencia mínima a 15s evita que un usuario activo (que
     * cambia de pestaña constantemente) inunde el backend con peticiones
     * 304 — clave para escalar a 600 alumnos concurrentes.
     */
    private static readonly REFRESH_MIN_INTERVAL_MS = 15_000;

    private onFocus = () => {
        if (this.auth.isLoggedIn()) this.refresh();
    };
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
        this.refresh(true);
        this.openSseStream();
        window.addEventListener('focus', this.onFocus);
        document.addEventListener('visibilitychange', this.onVisibility);
    }

    disconnect(): void {
        this.teardown();
    }

    /**
     * Hace un GET /notifications para resincronizar el estado. Se llama
     * en boot, cuando vuelve foco/visibilidad, y como retry tras errores
     * de mutación. Throttled: si se llamó hace menos de
     * `REFRESH_MIN_INTERVAL_MS`, se descarta para evitar burst de
     * peticiones cuando el usuario alterna pestañas rápido.
     */
    refresh(force = false): void {
        if (!this.auth.isLoggedIn()) return;
        const now = Date.now();
        if (
            !force &&
            now - this.lastRefreshAt < NotificationsStore.REFRESH_MIN_INTERVAL_MS
        ) {
            return;
        }
        this.lastRefreshAt = now;
        this.api.get<NotificationItem[]>('notifications').subscribe({
            next: (r) => this._items.set(r.data ?? []),
            error: () => {
                /* mantenemos el último valor conocido */
            },
        });
    }

    markOneAsRead(id: string) {
        this._items.update((list) =>
            list.map((n) => (n.id === id ? { ...n, read: true } : n)),
        );
        this.api.patch(`notifications/${id}/read`, {}).subscribe({
            error: () => this.refresh(true),
        });
    }

    markAllAsRead() {
        const prev = this._items();
        this._items.update((list) => list.map((n) => ({ ...n, read: true })));
        this.api.patch('notifications/read-all', {}).subscribe({
            error: () => this._items.set(prev),
        });
    }

    // ── SSE ──────────────────────────────────────────────────────────

    /**
     * Devuelve el JWT del usuario. Si tu AuthService tiene un método
     * `getToken()` lo usa; sino, lee de `localStorage` probando los
     * nombres de clave más comunes.
     */
    private resolveJwt(): string | null {
        const fromAuth = (this.auth as unknown as {
            getToken?: () => string | null;
        }).getToken?.();
        if (fromAuth) return fromAuth;

        return (
            localStorage.getItem('token') ??
            localStorage.getItem('access_token') ??
            localStorage.getItem('jwt') ??
            localStorage.getItem('auth_token') ??
            null
        );
    }

    private openSseStream(): void {
        const token = this.resolveJwt();
        if (!token) return;

        this.eventSource = new EventSourcePolyfill(
            `${environment.apiUrl}/notifications/stream`,
            {
                headers: { Authorization: `Bearer ${token}` },
                heartbeatTimeout: 60_000,
            },
        );

        // El polyfill define un tipo `EventListener` propio que choca con el
        // del DOM. Casteamos a `any` para evitar el conflicto — el runtime
        // funciona igual.
        this.eventSource.addEventListener(
            'notification',
            ((ev: { data: string }) => {
                try {
                    const notif: NotificationItem = JSON.parse(ev.data);
                    this._items.update((list) => {
                        // Evitar duplicado si llegan REST refresh + SSE casi simultáneos.
                        if (list.some((n) => n.id === notif.id)) return list;
                        return [notif, ...list];
                    });
                } catch {
                    /* payload mal formado, ignorar */
                }
            }) as any,
        );

        this.eventSource.onerror = () => {
            // El polyfill maneja reconexión automática.
        };
    }

    private closeSseStream(): void {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    private teardown(): void {
        this.closeSseStream();
        window.removeEventListener('focus', this.onFocus);
        document.removeEventListener('visibilitychange', this.onVisibility);
        this.booted = false;
    }
}