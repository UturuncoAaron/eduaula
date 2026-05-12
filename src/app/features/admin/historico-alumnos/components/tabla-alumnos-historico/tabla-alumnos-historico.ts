import {
    Component, Input, OnChanges, SimpleChanges, ViewChild,
    inject, signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
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
    periodo_nombre: string | null;
    periodo_bimestre: number | null;
    periodo_anio: number | null;
}

interface HistoricoAlumnosResponse {
    data: AlumnoHistoricoRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

@Component({
    selector: 'app-tabla-alumnos-historico',
    standalone: true,
    imports: [
        MatTableModule, MatPaginatorModule, MatIconModule, MatTooltipModule,
        MatButtonModule,
        UserAvatar,
    ],
    templateUrl: './tabla-alumnos-historico.html',
    styleUrl: './tabla-alumnos-historico.scss',
})
export class TablaAlumnosHistorico implements OnChanges {
    private api = inject(ApiService);
    private router = inject(Router);

    @Input() anio: number | null = null;
    @Input() filtros: HistoricoFiltros = { grado_id: null, seccion_id: null };

    loading = signal(false);
    total = signal(0);
    page = signal(1);
    pageSize = signal(20);

    dataSource = new MatTableDataSource<AlumnoHistoricoRow>([]);
    displayedColumns = ['codigo', 'documento', 'nombre', 'grado', 'periodo', 'ingreso', 'acciones'];

    @ViewChild(MatPaginator) paginator!: MatPaginator;

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['anio'] || changes['filtros']) {
            this.page.set(1);
            if (this.anio != null) this.load();
            else {
                this.dataSource.data = [];
                this.total.set(0);
            }
        }
    }

    onPageChange(e: PageEvent): void {
        this.page.set(e.pageIndex + 1);
        this.pageSize.set(e.pageSize);
        this.load();
    }

    verReporte(row: AlumnoHistoricoRow): void {
        this.router.navigate(
            ['/admin/historico/reporte', row.id],
            { queryParams: this.anio ? { anio: this.anio } : undefined },
        );
    }

    private load(): void {
        if (this.anio == null) return;
        const params = new URLSearchParams();
        params.set('anio', String(this.anio));
        if (this.filtros.seccion_id) params.set('seccion_id', this.filtros.seccion_id);
        else if (this.filtros.grado_id) params.set('grado_id', this.filtros.grado_id);
        params.set('page', String(this.page()));
        params.set('limit', String(this.pageSize()));

        this.loading.set(true);
        this.api.get<HistoricoAlumnosResponse>(`admin/historico/alumnos?${params.toString()}`).subscribe({
            next: (res) => {
                const body = res.data;
                this.dataSource.data = body?.data ?? [];
                this.total.set(body?.total ?? 0);
                this.loading.set(false);
            },
            error: () => {
                this.dataSource.data = [];
                this.total.set(0);
                this.loading.set(false);
            },
        });
    }
}
