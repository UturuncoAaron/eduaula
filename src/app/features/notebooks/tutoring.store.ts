import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { TutoriaData, AlumnoTutoria, NotebookItem } from './tutoring.types';


@Injectable()
export class TutoringStore {
    private http = inject(HttpClient);

    readonly data = signal<TutoriaData | null>(null);
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);
    readonly periodoSeleccionadoId = signal<number | null>(null);

    readonly periodoActivo = computed(() => this.data()?.periodo_activo ?? null);
    readonly bimestresHasta = computed(() => this.periodoActivo()?.bimestre ?? 0);

    readonly progreso = computed(() => {
        const pid = this.periodoSeleccionadoId();
        const alumnos = this.data()?.alumnos ?? [];
        if (!pid) return { cargadas: 0, total: alumnos.length };
        const cargadas = alumnos.filter(a =>
            a.libretas.some(l => l.periodo_id === pid),
        ).length;
        return { cargadas, total: alumnos.length };
    });

    private loadedOnce = false;

    async load(force = false): Promise<void> {
        if (this.loadedOnce && !force) return;
        this.loading.set(true);
        this.error.set(null);
        try {
            const response: any = await firstValueFrom(
                this.http.get(`${environment.apiUrl}/academic/tutoria/me`),
            );
            const d: TutoriaData | null = response?.data ?? response ?? null;
            this.data.set(d);
            if (d?.periodo_activo) {
                this.periodoSeleccionadoId.set(d.periodo_activo.id);
            }
            this.loadedOnce = true;
        } catch (e: any) {
            this.error.set(e?.error?.message ?? 'No se pudo cargar la tutoría');
        } finally {
            this.loading.set(false);
        }
    }

    refresh(): Promise<void> {
        return this.load(true);
    }

    libretaDe(
        a: AlumnoTutoria,
        periodoId: number | null = this.periodoSeleccionadoId(),
    ): NotebookItem | null {
        if (!periodoId) return null;
        return a.libretas.find(l => l.periodo_id === periodoId) ?? null;
    }
}
