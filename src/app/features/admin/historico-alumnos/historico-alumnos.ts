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
import { TablaAlumnosHistorico, HistoricoFiltros } from './components/tabla-alumnos-historico/tabla-alumnos-historico';

interface GradoFiltro { id: string; nombre: string; orden: number }
interface SeccionFiltro { id: string; nombre: string; grado_id: string; grado_nombre: string }
interface PeriodoFiltro { id: string; nombre: string; bimestre: number; fecha_inicio: string; fecha_fin: string }
interface FiltrosResponse { grados: GradoFiltro[]; secciones: SeccionFiltro[]; periodos: PeriodoFiltro[] }

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

    anio = signal<number | null>(null);
    gradoCtrl = new FormControl<string | null>(null);
    seccionCtrl = new FormControl<string | null>(null);
    periodoCtrl = new FormControl<string | null>(null);

    gradoSel = signal<string | null>(null);
    seccionSel = signal<string | null>(null);
    periodoSel = signal<string | null>(null);

    loadingFiltros = signal(false);
    grados = signal<GradoFiltro[]>([]);
    secciones = signal<SeccionFiltro[]>([]);
    periodos = signal<PeriodoFiltro[]>([]);

    seccionesFiltradas = computed(() => {
        const gid = this.gradoSel();
        const all = this.secciones();
        return gid ? all.filter((s) => s.grado_id === gid) : all;
    });

    etiquetaConsulta = computed(() => {
        const f = this.consultaFiltros();
        if (!f.seccion_id) return '';
        const s = this.secciones().find((x) => x.id === f.seccion_id);
        const p = f.periodo_id ? this.periodos().find((x) => x.id === f.periodo_id) : null;
        const seccionLabel = s ? `${s.grado_nombre} — Sección ${s.nombre}` : '';
        return p ? `${seccionLabel} · ${p.nombre}` : seccionLabel;
    });

    consultaAnio = signal<number | null>(null);
    consultaFiltros = signal<HistoricoFiltros>({ grado_id: null, seccion_id: null, periodo_id: null });

    constructor() {
        this.gradoCtrl.valueChanges.subscribe((v) => {
            this.gradoSel.set(v);
            const sId = this.seccionCtrl.value;
            if (v && sId) {
                const ok = this.secciones().some((s) => s.id === sId && s.grado_id === v);
                if (!ok) this.seccionCtrl.setValue(null, { emitEvent: false });
            }
        });
        this.seccionCtrl.valueChanges.subscribe((v) => this.seccionSel.set(v));
        this.periodoCtrl.valueChanges.subscribe((v) => this.periodoSel.set(v));
    }

    onAnioChange(anio: number | null): void {
        this.anio.set(anio);
        this.gradoCtrl.setValue(null, { emitEvent: false });
        this.seccionCtrl.setValue(null, { emitEvent: false });
        this.periodoCtrl.setValue(null, { emitEvent: false });
        this.gradoSel.set(null);
        this.seccionSel.set(null);
        this.periodoSel.set(null);
        this.grados.set([]);
        this.secciones.set([]);
        this.periodos.set([]);
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
                this.periodos.set(body?.periodos ?? []);
                this.loadingFiltros.set(false);
                if (!body?.grados?.length) {
                    this.toastr.info(`No hay matrículas registradas para ${anio}.`, 'Sin datos');
                }
            },
            error: () => {
                this.grados.set([]); this.secciones.set([]); this.periodos.set([]);
                this.loadingFiltros.set(false);
                this.toastr.error('No se pudieron cargar los filtros', 'Error');
            },
        });
    }

    puedeConsultar(): boolean {
        return this.anio() != null && !!this.seccionSel();
    }

    consultar(): void {
        if (!this.puedeConsultar()) return;
        this.consultaAnio.set(this.anio());
        this.consultaFiltros.set({
            grado_id: this.gradoCtrl.value,
            seccion_id: this.seccionCtrl.value,
            periodo_id: this.periodoCtrl.value,
        });
    }

    limpiar(): void {
        this.anio.set(null);
        this.gradoCtrl.setValue(null, { emitEvent: false });
        this.seccionCtrl.setValue(null, { emitEvent: false });
        this.periodoCtrl.setValue(null, { emitEvent: false });
        this.gradoSel.set(null); this.seccionSel.set(null); this.periodoSel.set(null);
        this.grados.set([]); this.secciones.set([]); this.periodos.set([]);
        this.consultaAnio.set(null);
        this.consultaFiltros.set({ grado_id: null, seccion_id: null, periodo_id: null });
    }
}