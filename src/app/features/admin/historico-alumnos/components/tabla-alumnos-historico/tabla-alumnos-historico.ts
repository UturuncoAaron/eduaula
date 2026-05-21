import {
    Component, Input, OnChanges, SimpleChanges,
    inject, signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';

import { ApiService } from '../../../../../core/services/api';
import { UserAvatar } from '../../../../../shared/components/user-avatar/user-avatar';

export interface HistoricoFiltros {
    grado_id: string | null;
    seccion_id: string | null;
}

interface AlumnoHistoricoRow {
    id: string;
    codigo_estudiante: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    inclusivo: boolean | null;
    foto_url: string | null;
    numero_documento: string | null;
    tipo_documento: string | null;
    anio_ingreso: number | null;
    grado: string | null;
    seccion: string | null;
    condicion_final: 'pendiente' | 'aprobado' | 'desaprobado' | 'retirado' | null;
    periodo_anio: number | null;
}

interface HistoricoAlumnosResponse {
    data: AlumnoHistoricoRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

type CondicionKey = 'pendiente' | 'aprobado' | 'desaprobado' | 'retirado';

const CONDICION_CONFIG: Record<CondicionKey, { label: string; css: string; icon: string }> = {
    pendiente: { label: 'Pendiente', css: 'chip-pendiente', icon: 'schedule' },
    aprobado: { label: 'Aprobado', css: 'chip-aprobado', icon: 'check_circle' },
    desaprobado: { label: 'Desaprobado', css: 'chip-desaprobado', icon: 'cancel' },
    retirado: { label: 'Retirado', css: 'chip-retirado', icon: 'person_remove' },
};

@Component({
    selector: 'app-tabla-alumnos-historico',
    standalone: true,
    imports: [
        MatTableModule, MatPaginatorModule,
        MatIconModule, MatTooltipModule, MatButtonModule,
        UserAvatar,
    ],
    templateUrl: './tabla-alumnos-historico.html',
    styleUrl: './tabla-alumnos-historico.scss',
})
export class TablaAlumnosHistorico implements OnChanges {
    private readonly api = inject(ApiService);
    private readonly router = inject(Router);

    @Input() anio: number | null = null;
    @Input() filtros: HistoricoFiltros = { grado_id: null, seccion_id: null };

    loading = signal(false);
    total = signal(0);
    page = signal(1);
    pageSize = signal(20);

    dataSource = new MatTableDataSource<AlumnoHistoricoRow>([]);
    displayedColumns = [
        'codigo', 'documento', 'nombre',
        'grado', 'condicion', 'ingreso', 'acciones',
    ];

    // ── Helpers de condición ──────────────────────────────────
    readonly condicionConfig = CONDICION_CONFIG;

    getCondicion(key: string | null) {
        return key ? (CONDICION_CONFIG[key as CondicionKey] ?? null) : null;
    }

    // ── Lifecycle ─────────────────────────────────────────────
    ngOnChanges(changes: SimpleChanges): void {
        if (changes['anio'] || changes['filtros']) {
            this.page.set(1);
            if (this.anio != null) this.load();
            else this.reset();
        }
    }

    // ── Paginación ────────────────────────────────────────────
    onPageChange(e: PageEvent): void {
        this.page.set(e.pageIndex + 1);
        this.pageSize.set(e.pageSize);
        this.load();
    }

    // ── Navegación ────────────────────────────────────────────
    verReporte(row: AlumnoHistoricoRow): void {
        this.router.navigate(
            ['/admin/historico/reporte', row.id],
            { queryParams: this.anio ? { anio: this.anio } : undefined },
        );
    }

    // ── Carga ─────────────────────────────────────────────────
    private load(): void {
        if (this.anio == null) return;

        const params = new URLSearchParams({
            anio: String(this.anio),
            page: String(this.page()),
            limit: String(this.pageSize()),
        });
        if (this.filtros.seccion_id) params.set('seccion_id', this.filtros.seccion_id);
        else if (this.filtros.grado_id) params.set('grado_id', this.filtros.grado_id);

        this.loading.set(true);
        this.api.get<HistoricoAlumnosResponse>(
            `admin/historico/alumnos?${params.toString()}`
        ).subscribe({
            next: (res) => {
                const body = res.data;
                this.dataSource.data = body?.data ?? [];
                this.total.set(body?.total ?? 0);
                this.loading.set(false);
            },
            error: () => {
                this.reset();
                this.loading.set(false);
            },
        });
    }

    private reset(): void {
        this.dataSource.data = [];
        this.total.set(0);
    }
}