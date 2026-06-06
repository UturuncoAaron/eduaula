import {
    Component, OnInit, signal, inject, DestroyRef, ViewChild, computed,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { distinctUntilChanged, filter, startWith } from 'rxjs';
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
import { MatTabsModule } from '@angular/material/tabs';
import { MatRadioModule } from '@angular/material/radio';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../core/services/api';
import { ReportsService } from '../../../core/services/reports';

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

type TipoRango = 'dia' | 'rango' | 'mes' | 'bimestre';

interface PeriodoOption {
    id: string;
    nombre: string;
    fecha_inicio: string;
    fecha_fin: string;
    bimestre: number;
}

@Component({
    selector: 'app-asistencia-personal',
    standalone: true,
    imports: [
        ReactiveFormsModule, DatePipe,
        MatTableModule, MatPaginatorModule, MatIconModule,
        MatButtonModule, MatMenuModule, MatDialogModule, MatDividerModule,
        MatFormFieldModule, MatInputModule, MatSelectModule,
        MatDatepickerModule, MatNativeDateModule,
        MatTooltipModule, MatChipsModule, MatTabsModule, MatRadioModule,
    ],
    templateUrl: './asistencia-personal.html',
    styleUrl: './asistencia-personal.scss',
})
export class AsistenciaPersonal implements OnInit {
    private api = inject(ApiService);
    private reportsService = inject(ReportsService);
    private dialog = inject(MatDialog);
    private toastr = inject(ToastService);
    private destroyRef = inject(DestroyRef);

    readonly estadoLabel = ESTADO_LABEL;
    readonly estadoColor = ESTADO_COLOR;

    // ── Tab 1: Asistencia Diaria ──────────────────────────────────────────────
    fechaFiltro = new FormControl<Date | null>(new Date());
    estadoFiltro = new FormControl<string>('');

    loading = signal(true);
    descargando = signal(false);
    total = signal(0);
    page = signal(1);
    pageSize = signal(20);

    dataSource = new MatTableDataSource<AsistenciaPersonalRow>([]);
    displayedColumns = ['nombre', 'rol', 'fecha', 'entrada', 'salida', 'estado', 'acciones'];

    @ViewChild(MatPaginator) paginator!: MatPaginator;

    // ── Tab 2: Reportes ───────────────────────────────────────────────────────
    tipoRango = new FormControl<TipoRango>('rango');
    rolFiltro = new FormControl<string>('todos');
    fechaInicio = new FormControl<Date | null>(new Date(), Validators.required);
    fechaFin = new FormControl<Date | null>(new Date(), Validators.required);
    mesSeleccionado = new FormControl<Date | null>(new Date());
    bimestreSeleccionado = new FormControl<string>('');

    generandoReporte = signal(false);
    periodos = signal<PeriodoOption[]>([]);
    loadingPeriodos = signal(false);

    // Convertir FormControls a señales para que computed() se reactive
    private tipoRangoSig = toSignal(this.tipoRango.valueChanges.pipe(startWith(this.tipoRango.value)));
    private fechaInicioSig = toSignal(this.fechaInicio.valueChanges.pipe(startWith(this.fechaInicio.value)));
    private fechaFinSig = toSignal(this.fechaFin.valueChanges.pipe(startWith(this.fechaFin.value)));
    private mesSig = toSignal(this.mesSeleccionado.valueChanges.pipe(startWith(this.mesSeleccionado.value)));
    private bimestreSig = toSignal(this.bimestreSeleccionado.valueChanges.pipe(startWith(this.bimestreSeleccionado.value)));
    private fechaFiltroSig = toSignal(this.fechaFiltro.valueChanges.pipe(startWith(this.fechaFiltro.value)));

    readonly tiposRango = [
        { value: 'dia', label: 'Día específico', icon: 'today' },
        { value: 'rango', label: 'Rango de fechas', icon: 'date_range' },
        { value: 'mes', label: 'Por mes', icon: 'calendar_month' },
        { value: 'bimestre', label: 'Por bimestre', icon: 'event_note' },
    ];

    readonly rolesDisponibles = [
        { value: 'todos', label: 'Todo el personal' },
        { value: 'docente', label: 'Solo docentes' },
        { value: 'staff', label: 'Solo staff' },
        { value: 'admin', label: 'Solo administración' },
        { value: 'psicologa', label: 'Solo psicóloga' },
    ];

    // computed() ahora lee señales → se recalcula al instante cuando cambia cualquier campo
    rangoResumen = computed(() => {
        const tipo = this.tipoRangoSig();
        const hoy = new Date();

        if (tipo === 'dia') {
            const f = this.fechaFiltroSig() ?? hoy;
            return { inicio: f, fin: f };
        }
        if (tipo === 'rango') {
            return {
                inicio: this.fechaInicioSig() ?? hoy,
                fin: this.fechaFinSig() ?? hoy,
            };
        }
        if (tipo === 'mes') {
            const m = this.mesSig() ?? hoy;
            const inicio = new Date(m.getFullYear(), m.getMonth(), 1);
            const fin = new Date(m.getFullYear(), m.getMonth() + 1, 0);
            return { inicio, fin };
        }
        const p = this.periodos().find(x => x.id === this.bimestreSig());
        if (p) {
            return {
                inicio: new Date(p.fecha_inicio + 'T00:00:00'),
                fin: new Date(p.fecha_fin + 'T00:00:00'),
            };
        }
        return { inicio: hoy, fin: hoy };
    });

    ngOnInit(): void {
        this.loadData();
        this.loadPeriodos();

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
        if (fecha) params.set('fecha', this.toISODate(fecha));

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

    private loadPeriodos(): void {
        this.loadingPeriodos.set(true);
        this.api.get<any>('academic/periodos').pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe({
            next: (res) => {
                const data = res?.data ?? res;
                this.periodos.set(Array.isArray(data) ? data : []);
                this.loadingPeriodos.set(false);
            },
            error: () => this.loadingPeriodos.set(false),
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
        const hoy = this.toISODate(new Date());
        const fecha = this.fechaFiltro.value ? this.toISODate(this.fechaFiltro.value) : undefined;
        return fecha !== hoy || !!this.estadoFiltro.value;
    }

    exportarReporte(): void {
        const rango = this.rangoResumen();
        if (!rango.inicio || !rango.fin) {
            this.toastr.error('Selecciona un rango de fechas válido', 'Error');
            return;
        }

        const fechaInicio = this.toISODate(rango.inicio);
        const fechaFin = this.toISODate(rango.fin);
        const rol = (this.rolFiltro.value && this.rolFiltro.value !== 'todos')
            ? this.rolFiltro.value
            : undefined;

        this.generandoReporte.set(true);
        this.reportsService.downloadPersonalReport(fechaInicio, fechaFin, rol).pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe({
            next: (blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Asistencia_Personal_${fechaInicio}_al_${fechaFin}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                this.generandoReporte.set(false);
                this.toastr.success('Reporte generado correctamente', 'Listo');
            },
            error: () => {
                this.toastr.error('Error al generar el reporte', 'Error');
                this.generandoReporte.set(false);
            },
        });
    }

    descargar(scope: 'teacher_attendance_range' | 'staff_attendance_range', formato: 'xlsx' | 'pdf'): void {
        const fecha = this.fechaFiltro.value
            ? this.toISODate(this.fechaFiltro.value)
            : this.toISODate(new Date());

        this.descargando.set(true);
        this.reportsService.downloadConsolidatedReport({
            scope,
            format: formato,
            fecha_inicio: fecha,
            fecha_fin: fecha,
        }).subscribe({
            next: (blob: Blob) => {
                const tipo = scope === 'teacher_attendance_range' ? 'docentes' : 'staff';
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `asistencia_${tipo}_${fecha}.${formato}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                this.descargando.set(false);
            },
            error: () => {
                this.toastr.error('Error al generar el reporte', 'Error');
                this.descargando.set(false);
            },
        });
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

    fmtFecha(d: Date): string {
        return d.toLocaleDateString('es-PE', {
            timeZone: 'America/Lima',
            day: '2-digit', month: 'short', year: 'numeric',
        });
    }

    toISODate(d: Date): string {
        return d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    }
}