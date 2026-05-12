import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../core/services/api';
import { SelectorAnio } from './components/selector-anio/selector-anio';
import {
    TablaAlumnosHistorico, HistoricoFiltros,
} from './components/tabla-alumnos-historico/tabla-alumnos-historico';

interface GradoFiltro { id: string; nombre: string; orden: number }
interface SeccionFiltro {
    id: string; nombre: string; grado_id: string; grado_nombre: string;
}
interface FiltrosResponse { grados: GradoFiltro[]; secciones: SeccionFiltro[] }

/**
 * Página: Histórico de Alumnos.
 *
 * UX intencionalmente "step by step" para no llamar al endpoint de
 * alumnos sin un filtro fuerte (escalabilidad: con 600+ alumnos, jamás
 * cargamos todos de una). Flujo:
 *
 *   1. Año académico (carga `/anios`)
 *   2. Grado          (se habilita al elegir año, carga `/filtros?anio=`)
 *   3. Sección        (se habilita al elegir grado)
 *   4. Botón "Consultar"  (sólo activo con año + sección)
 *
 * Recién al pulsar "Consultar" se setea la consulta vigente y la
 * tabla histórica hace su fetch (paginado server-side, máx ~35
 * alumnos por sección). Cambiar los selects no dispara llamadas a
 * `/alumnos`; sólo invalida el resultado vigente.
 */
@Component({
    selector: 'app-historico-alumnos',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule, MatSelectModule, MatIconModule,
        MatButtonModule, MatTooltipModule, MatProgressSpinnerModule,
        SelectorAnio, TablaAlumnosHistorico,
    ],
    templateUrl: './historico-alumnos.html',
    styleUrl: './historico-alumnos.scss',
})
export class HistoricoAlumnos {
    private api = inject(ApiService);
    private toastr = inject(ToastService);

    // ── Selección en curso (todavía no aplicada) ────────────────
    // Los FormControl viven SIEMPRE habilitados. El bloqueo visual
    // de los pasos no aplicables se hace por CSS (clase `step--disabled`
    // con `pointer-events: none`). Esto evita el bug donde mat-select
    // no abría tras un enable() dinámico de un control inicialmente
    // creado en estado disabled.
    anio = signal<number | null>(null);
    gradoCtrl = new FormControl<string | null>(null);
    seccionCtrl = new FormControl<string | null>(null);

    /**
     * Espejo del valor de `gradoCtrl` en signal — necesario para que
     * los `computed()` reaccionen (FormControl.valueChanges no es un
     * signal, así que un computed que lo lea no se re-evalúa).
     */
    gradoSel = signal<string | null>(null);
    seccionSel = signal<string | null>(null);

    loadingFiltros = signal(false);
    grados = signal<GradoFiltro[]>([]);
    secciones = signal<SeccionFiltro[]>([]);

    /**
     * Secciones disponibles según el grado elegido. Si todavía no se
     * elige grado, devolvemos TODAS las secciones del año cargadas
     * (para que el dropdown de sección siempre tenga opciones).
     */
    seccionesFiltradas = computed(() => {
        const gid = this.gradoSel();
        const all = this.secciones();
        return gid ? all.filter((s) => s.grado_id === gid) : all;
    });

    /**
     * Texto descriptivo de la consulta en curso para mostrar en la
     * barra de resultados. Se calcula sobre `consultaFiltros()`
     * (no sobre los selects, que pueden haber cambiado tras consultar).
     */
    etiquetaConsulta = computed(() => {
        const f = this.consultaFiltros();
        if (!f.seccion_id) return '';
        const s = this.secciones().find((x) => x.id === f.seccion_id);
        return s ? `${s.grado_nombre} — Sección ${s.nombre}` : '';
    });

    // ── Consulta efectivamente lanzada (la tabla la observa) ────
    consultaAnio = signal<number | null>(null);
    consultaFiltros = signal<HistoricoFiltros>({ grado_id: null, seccion_id: null });

    constructor() {
        // Espejamos los valores de los FormControl en signals para que
        // los `computed()` (seccionesFiltradas, etiquetaConsulta) y el
        // estado del botón Consultar reaccionen al instante.
        this.gradoCtrl.valueChanges.subscribe((v) => {
            this.gradoSel.set(v);
            // Si la sección actual ya no pertenece al nuevo grado, la
            // limpiamos. Si no se eligió grado (Todos) la conservamos.
            const sId = this.seccionCtrl.value;
            if (v && sId) {
                const ok = this.secciones().some(
                    (s) => s.id === sId && s.grado_id === v,
                );
                if (!ok) this.seccionCtrl.setValue(null, { emitEvent: false });
            }
        });
        this.seccionCtrl.valueChanges.subscribe((v) => this.seccionSel.set(v));
    }

    // ── Handlers del flujo guiado ───────────────────────────────
    onAnioChange(anio: number | null): void {
        this.anio.set(anio);
        this.gradoCtrl.setValue(null, { emitEvent: false });
        this.seccionCtrl.setValue(null, { emitEvent: false });
        this.gradoSel.set(null);
        this.seccionSel.set(null);
        this.grados.set([]);
        this.secciones.set([]);
        // Invalida cualquier consulta previa al cambiar el año
        this.consultaAnio.set(null);
        if (anio !== null) this.cargarFiltrosDelAnio(anio);
    }

    private cargarFiltrosDelAnio(anio: number): void {
        this.loadingFiltros.set(true);
        this.api.get<FiltrosResponse>(`admin/historico/filtros?anio=${anio}`).subscribe({
            next: (res) => {
                const body = res.data;
                this.grados.set(body?.grados ?? []);
                this.secciones.set(body?.secciones ?? []);
                this.loadingFiltros.set(false);
                if (!body?.grados?.length) {
                    this.toastr.info(
                        `No hay matrículas registradas para ${anio}.`,
                        'Sin datos',
                    );
                }
            },
            error: () => {
                this.grados.set([]);
                this.secciones.set([]);
                this.loadingFiltros.set(false);
                this.toastr.error('No se pudieron cargar los filtros', 'Error');
            },
        });
    }

    // ── Estado de habilitación del botón "Consultar" ────────────
    // Reactivo a través del signal `seccionSel` para que el `[disabled]`
    // del botón se actualice al instante en cada cambio.
    puedeConsultar(): boolean {
        return this.anio() != null && !!this.seccionSel();
    }

    // ── Submit ──────────────────────────────────────────────────
    consultar(): void {
        if (!this.puedeConsultar()) return;
        this.consultaAnio.set(this.anio());
        this.consultaFiltros.set({
            grado_id: this.gradoCtrl.value,
            seccion_id: this.seccionCtrl.value,
        });
    }

    limpiar(): void {
        this.anio.set(null);
        this.gradoCtrl.setValue(null, { emitEvent: false });
        this.seccionCtrl.setValue(null, { emitEvent: false });
        this.gradoSel.set(null);
        this.seccionSel.set(null);
        this.grados.set([]);
        this.secciones.set([]);
        this.consultaAnio.set(null);
        this.consultaFiltros.set({ grado_id: null, seccion_id: null });
    }
}
