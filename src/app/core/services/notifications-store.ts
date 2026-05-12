/**
 * NotificationsStore
 *
 * Almacén global de notificaciones del usuario actual.
 *
 * Diseño:
 *   - Una sola conexión `EventSource` (SSE) por sesión (no por componente),
 *     iniciada por `MainLayout` justo después del login.
 *   - El backend hace push de cada notificación nueva por el stream
 *     `GET /notifications/stream` (autenticado vía `?token=…`, porque el
 *     navegador no permite mandar cabeceras custom en `EventSource`).
 *   - Reconexión automática con backoff exponencial si el navegador no la
 *     hace solo (cierre HTTP/2, balanceadores, etc.).
 *   - Auto-limpieza del lado del backend: notificaciones >14 días expiran.
 *
 * NO se hace polling — todo es push.
 */
import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { ApiService } from './api';
import { AuthService } from '../auth/auth';
import { environment } from '../../../environments/environment';

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
    readonly unreadCount = computed(() => this._items().filter(n => !n.read).length);

    private es: EventSource | null = null;
    private reconnectAttempt = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private destroyed = false;
    private loadingInitial = false;

    constructor() {
        this.destroyRef.onDestroy(() => {
            this.destroyed = true;
            this.disconnect();
        });
    }

    /** Idempotente — se puede llamar varias veces al cambiar de ruta. */
    connect(): void {
        if (this.es || this.destroyed) return;
        if (!this.auth.isLoggedIn()) return;

        // Carga inicial: estado actual + lo que ya estaba antes de abrir el stream.
        if (!this.loadingInitial) {
            this.loadingInitial = true;
            this.api.get<NotificationItem[]>('notifications').subscribe({
                next: r => {
                    this._items.set(r.data ?? []);
                    this.loadingInitial = false;
                },
                error: () => { this.loadingInitial = false; },
            });
        }

        const token = this.auth.token();
        if (!token) return;

        // El stream se autentica con ?token=... porque EventSource nativo no
        // permite headers custom. El backend acepta el token como query param
        // en este endpoint.
        const url = `${environment.apiUrl}/notifications/stream?token=${encodeURIComponent(token)}`;
        try {
            this.es = new EventSource(url);
        } catch {
            this.scheduleReconnect();
            return;
        }

        // Mensaje sin tipo = data por defecto, no lo usamos.
        // Solo escuchamos eventos nombrados ("connected", "notification", "ping").
        this.es.addEventListener('connected', () => {
            this.reconnectAttempt = 0;
        });

        this.es.addEventListener('notification', (ev: MessageEvent) => {
            try {
                const payload = JSON.parse(ev.data) as NotificationItem;
                this.upsert(payload);
            } catch { /* ignore malformed frame */ }
        });

        // Heartbeat — silencioso, solo evita timeouts de proxies.
        this.es.addEventListener('ping', () => { });

        this.es.onerror = () => {
            // El navegador intentará reconectar solo; si la conexión queda
            // marcada como CLOSED forzamos un reintento programado.
            if (this.es && this.es.readyState === EventSource.CLOSED) {
                this.disconnect();
                this.scheduleReconnect();
            }
        };
    }

    disconnect(): void {
        if (this.es) {
            this.es.close();
            this.es = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private scheduleReconnect(): void {
        if (this.destroyed) return;
        const delay = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempt);
        this.reconnectAttempt += 1;
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }

    // ── Mutaciones expuestas a la UI ─────────────────────────────────

    private upsert(n: NotificationItem) {
        this._items.update(list => {
            const idx = list.findIndex(x => x.id === n.id);
            if (idx === -1) return [n, ...list];
            const next = list.slice();
            next[idx] = { ...next[idx], ...n };
            return next;
        });
    }

    markOneAsRead(id: string) {
        // Optimistic update.
        this._items.update(list =>
            list.map(n => n.id === id ? { ...n, read: true } : n),
        );
        this.api.patch(`notifications/${id}/read`, {}).subscribe({
            error: () => {
                // rollback si falla
                this._items.update(list =>
                    list.map(n => n.id === id ? { ...n, read: false } : n),
                );
            },
        });
    }

    markAllAsRead() {
        const previous = this._items();
        this._items.update(list => list.map(n => ({ ...n, read: true })));
        this.api.patch('notifications/read-all', {}).subscribe({
            error: () => { this._items.set(previous); },
        });
    }

    refresh() {
        this.api.get<NotificationItem[]>('notifications').subscribe({
            next: r => this._items.set(r.data ?? []),
        });
    }
}
