import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api';
import { Period } from '../models/academic';

@Injectable({ providedIn: 'root' })
export class PeriodoService {
    private api = inject(ApiService);

    private _all = signal<Period[]>([]);
    private _loaded = signal(false);
    private _loading = signal(false);
    readonly all = this._all.asReadonly();
    readonly loading = this._loading.asReadonly();
    readonly loaded = this._loaded.asReadonly();
    readonly activos = computed(() =>
        this._all()
            .filter(p => p.activo)
            .sort((a, b) => a.bimestre - b.bimestre),
    );
    readonly activo = computed<Period | null>(() => this.activos()[0] ?? null);
    readonly anioActual = computed<number>(
        () => this.activo()?.anio ?? new Date().getFullYear(),
    );
    readonly delAnio = computed(() => {
        const a = this.anioActual();
        return this._all()
            .filter(p => p.anio === a)
            .sort((x, y) => x.bimestre - y.bimestre);
    });
    loadAll(force = false): void {
        if ((this._loaded() && !force) || this._loading()) return;

        this._loading.set(true);
        this.api.get<Period[]>('academic/periodos').subscribe({
            next: r => {
                const data = (r as any).data;
                const all: Period[] = Array.isArray(data)
                    ? data
                    : (data?.data ?? []);
                this._all.set(all);
                this._loaded.set(true);
                this._loading.set(false);
            },
            error: () => {
                this._all.set([]);
                this._loaded.set(true);
                this._loading.set(false);
            },
        });
    }
    porId(id: number): Period | undefined {
        return this._all().find(p => p.id === id);
    }
    porBimestre(bimestre: number, anio?: number): Period | undefined {
        const a = anio ?? this.anioActual();
        return this._all().find(p => p.bimestre === bimestre && p.anio === a);
    }
}