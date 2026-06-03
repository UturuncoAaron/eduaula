import {
    Component, OnInit, signal, inject, DestroyRef, ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { distinctUntilChanged, filter } from 'rxjs';
import { DatePipe } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../core/services/api';

export interface AsistenciaPersonalRow {
    id: string;
    cuenta_id: string;
    nombre_completo: string;
    rol: string;
    codigo_acceso: string;
    fecha: string;
    estado: 'presente' | 'tardanza' | 'falto' | 'justificado';
    hora_entrada: string | null;
    hora_salida: string | null;
    hora_entrada_esperada: string | null;
    hora_salida_esperada: string | null;
    motivo_justificacion: string | null;
    observacion: string | null;
    editado_por: string | null;
    editado_at: string | null;
}

const ESTADO_LABEL: Record<string, string> = {
    presente: 'Presente',
    tardanza: 'Tardanza',
    falto: 'Falta',
    justificado: 'Justificado',
};

const ESTADO_COLOR: Record<string, string> = {
    presente: '#10b981',
    tardanza: '#f59e0b',
    falto: '#ef4444',
    justificado: '#3b82f6',
};

@Component({
    selector: 'app-asistencia-personal',
    standalone: true,
    imports: [
        ReactiveFormsModule, DatePipe,
        MatTableModule, MatPaginatorModule, MatIconModule,
        MatButtonModule, MatMenuModule, MatDialogModule, MatDividerModule,
        MatFormFieldModule, MatInputModule, MatSelectModule,
        MatDatepickerModule, MatNativeDateModule,
        MatTooltipModule, MatChipsModule,
    ],
    templateUrl: './asistencia-personal.html',
    styleUrl: './asistencia-personal.scss',
})
export class AsistenciaPersonal implements OnInit {
    private api = inject(ApiService);
    private dialog = inject(MatDialog);
    private toastr = inject(ToastService);
    private destroyRef = inject(DestroyRef);

    readonly estadoLabel = ESTADO_LABEL;
    readonly estadoColor = ESTADO_COLOR;

    fechaFiltro = new FormControl<Date | null>(new Date());
    estadoFiltro = new FormControl<string>('');

    loading = signal(true);
    total = signal(0);
    page = signal(1);
    pageSize = signal(20);

    dataSource = new MatTableDataSource<AsistenciaPersonalRow>([]);
    displayedColumns = ['nombre', 'rol', 'fecha', 'entrada', 'salida', 'estado', 'acciones'];

    @ViewChild(MatPaginator) paginator!: MatPaginator;

    ngOnInit(): void {
        this.loadData();

        this.fechaFiltro.valueChanges.pipe(
            distinctUntilChanged(),
            takeUntilDestroyed(this.destroyRef),
        ).subscribe(() => { this.page.set(1); this.loadData(); });

        this.estadoFiltro.valueChanges.pipe(
            distinctUntilChanged(),
            takeUntilDestroyed(this.destroyRef),
        ).subscribe(() => { this.page.set(1); this.loadData(); });
    }

    loadData(): void {
        const params = new URLSearchParams({
            page: String(this.page()),
            limit: String(this.pageSize()),
        });

        const fecha = this.fechaFiltro.value;
        if (fecha) params.set('fecha', fecha.toLocaleDateString('en-CA'));

        const estado = this.estadoFiltro.value;
        if (estado) params.set('estado', estado);

        this.loading.set(true);
        this.api.get<any>(`fichaje?${params.toString()}`).pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe({
            next: (res) => {
                const body = res?.data ?? res;
                this.dataSource.data = Array.isArray(body) ? body : (body.data ?? []);
                this.total.set(Array.isArray(body) ? body.length : (body.total ?? 0));
                this.loading.set(false);
            },
            error: () => {
                this.toastr.error('Error al cargar asistencias del personal', 'Error');
                this.loading.set(false);
            },
        });
    }

    onPageChange(e: PageEvent): void {
        this.page.set(e.pageIndex + 1);
        this.pageSize.set(e.pageSize);
        this.loadData();
    }

    limpiarFiltros(): void {
        this.fechaFiltro.setValue(new Date());
        this.estadoFiltro.setValue('');
        this.page.set(1);
        this.loadData();
    }

    hayFiltrosActivos(): boolean {
        const hoy = new Date().toLocaleDateString('en-CA');
        const fecha = this.fechaFiltro.value?.toLocaleDateString('en-CA');
        return fecha !== hoy || !!this.estadoFiltro.value;
    }

    async editarEstado(row: AsistenciaPersonalRow): Promise<void> {
        const { EditarAsistenciaDialog } = await import('./editar-asistencia-dialog/editar-asistencia-dialog');
        this.dialog.open(EditarAsistenciaDialog, {
            width: '100%',
            maxWidth: '480px',
            disableClose: true,
            data: row,
        }).afterClosed().pipe(filter(Boolean)).subscribe(() => this.loadData());
    }

    rolLabel(rol: string): string {
        const map: Record<string, string> = {
            docente: 'Docente',
            admin: 'Admin',
            psicologa: 'Psicóloga',
            staff: 'Staff',
        };
        return map[rol] ?? rol;
    }
}