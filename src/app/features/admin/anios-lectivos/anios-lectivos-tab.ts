import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../core/services/api';
import {
    ConfirmDialog,
    ConfirmData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import { parseApiError } from '../../../shared/utils/api-errors';
import type {
    AcademicYear,
    AcademicYearStatus,
    CreateAcademicYearPayload,
    EgresadoDeactivationResult,
    PromotionPreview,
    PromotionResult,
} from '../../../core/models/academic-year';

interface EstadoChip {
    label: string;
    icon: string;
    classMod: string;
}

const ESTADO_CHIP: Record<AcademicYearStatus, EstadoChip> = {
    planificado: { label: 'Planificado', icon: 'event', classMod: 'is-plan' },
    en_curso: { label: 'En curso', icon: 'play_circle', classMod: 'is-live' },
    cerrado: { label: 'Cerrado', icon: 'lock', classMod: 'is-closed' },
    archivado: {
        label: 'Archivado',
        icon: 'inventory_2',
        classMod: 'is-archived',
    },
};

@Component({
    selector: 'app-anios-lectivos-tab',
    standalone: true,
    imports: [
        DatePipe,
        FormsModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatChipsModule,
    ],
    templateUrl: './anios-lectivos-tab.html',
    styleUrl: './anios-lectivos-tab.scss',
})
export class AniosLectivosTab implements OnInit {
    private api = inject(ApiService);
    private toastr = inject(ToastService);
    private dialog = inject(MatDialog);

    readonly anios = signal<AcademicYear[]>([]);
    readonly loading = signal(true);
    readonly busyId = signal<string | null>(null);
    readonly preview = signal<PromotionPreview | null>(null);
    readonly previewLoading = signal(false);

    readonly nuevoAnio = signal<number | null>(null);
    readonly nuevaFechaInicio = signal<string>('');
    readonly nuevaFechaFin = signal<string>('');
    readonly creating = signal(false);

    readonly anioEnCurso = computed<AcademicYear | null>(
        () => this.anios().find((a) => a.estado === 'en_curso') ?? null,
    );

    estadoChip(estado: AcademicYearStatus): EstadoChip {
        return ESTADO_CHIP[estado];
    }

    async ngOnInit(): Promise<void> {
        await this.refresh();
    }

    async refresh(): Promise<void> {
        this.loading.set(true);
        try {
            const res = await firstValueFrom(
                this.api.get<AcademicYear[]>('academic-years'),
            );
            this.anios.set(res.data ?? []);
        } catch (err) {
            this.toastr.error(
                parseApiError(err, 'Error al cargar años lectivos'),
                'Error',
            );
        } finally {
            this.loading.set(false);
        }
    }

    // ── Crear ─────────────────────────────────────────────────────
    async createAnio(): Promise<void> {
        const anio = this.nuevoAnio();
        const fechaInicio = this.nuevaFechaInicio();
        const fechaFin = this.nuevaFechaFin();
        if (!anio || !fechaInicio || !fechaFin) {
            this.toastr.warning(
                'Completa año, fecha de inicio y fecha de fin.',
                'Faltan datos',
            );
            return;
        }
        if (new Date(fechaInicio).getTime() >= new Date(fechaFin).getTime()) {
            this.toastr.warning(
                'La fecha de inicio debe ser anterior a la fecha de fin.',
                'Fechas inválidas',
            );
            return;
        }
        this.creating.set(true);
        try {
            const payload: CreateAcademicYearPayload = {
                anio,
                fechaInicio,
                fechaFin,
            };
            await firstValueFrom(
                this.api.post<AcademicYear>('academic-years', payload),
            );
            this.toastr.success(`Año ${anio} creado como planificado.`, 'Listo');
            this.nuevoAnio.set(null);
            this.nuevaFechaInicio.set('');
            this.nuevaFechaFin.set('');
            await this.refresh();
        } catch (err) {
            this.toastr.error(
                parseApiError(err, 'No se pudo crear el año lectivo'),
                'Error',
            );
        } finally {
            this.creating.set(false);
        }
    }

    // ── Activar ───────────────────────────────────────────────────
    async activarAnio(a: AcademicYear): Promise<void> {
        if (a.estado !== 'planificado') return;
        const enCurso = this.anioEnCurso();
        const aviso = enCurso
            ? `Esto pondrá el año ${a.anio} EN CURSO. El año ${enCurso.anio} (en curso) se mantendrá hasta que lo cierres manualmente.`
            : `El año ${a.anio} pasará a EN CURSO. Las matrículas creadas a partir de ahora estarán vinculadas a este año.`;
        const ok = await this.confirm({
            title: `¿Activar año ${a.anio}?`,
            message: aviso,
            confirm: 'Activar',
        });
        if (!ok) return;
        this.busyId.set(a.id);
        try {
            await firstValueFrom(
                this.api.patch<AcademicYear>(
                    `academic-years/${a.anio}/activate`,
                    {},
                ),
            );
            this.toastr.success(`Año ${a.anio} activado.`, 'Listo');
            await this.refresh();
        } catch (err) {
            this.toastr.error(
                parseApiError(err, 'No se pudo activar el año'),
                'Error',
            );
        } finally {
            this.busyId.set(null);
        }
    }

    // ── Promoción: preview ───────────────────────────────────────
    async cargarPreview(a: AcademicYear): Promise<void> {
        this.previewLoading.set(true);
        this.preview.set(null);
        try {
            const res = await firstValueFrom(
                this.api.get<PromotionPreview>(
                    `academic-years/${a.anio}/promotion/preview`,
                ),
            );
            this.preview.set(res.data ?? null);
        } catch (err) {
            this.toastr.error(
                parseApiError(err, 'No se pudo cargar el preview'),
                'Error',
            );
        } finally {
            this.previewLoading.set(false);
        }
    }

    cerrarPreview(): void {
        this.preview.set(null);
    }

    // ── Promoción: ejecutar ──────────────────────────────────────
    async ejecutarPromocion(a: AcademicYear): Promise<void> {
        if (a.promocionEjecutadaAt) {
            this.toastr.info(
                'La promoción de este año ya fue ejecutada.',
                'Idempotente',
            );
            return;
        }
        const ok = await this.confirm({
            title: `¿Ejecutar promoción ${a.anio} → ${a.anio + 1}?`,
            message:
                `Al confirmar, el sistema generará automáticamente las matrículas del año ${a.anio + 1} para todos los alumnos con condición final registrada:\n\n` +
                `• Alumnos de 1ro a 4to marcados como aprobados pasarán al grado siguiente.\n` +
                `• Alumnos marcados como desaprobados repetirán el mismo grado.\n` +
                `• Alumnos de 5to de Secundaria aprobados serán registrados como egresados y no tendrán matrícula para ${a.anio + 1}.\n` +
                `• Las matrículas del año ${a.anio} quedarán inactivas. El historial académico no se elimina y seguirá disponible desde el módulo de reportes.\n\n` +
                `Los alumnos que aún figuren sin condición final serán omitidos y podrán procesarse de forma individual después de ejecutar esta acción.\n\n` +
                `Esta operación no puede deshacerse. Asegúrate de haber revisado la vista previa antes de continuar.`,
            confirm: 'Ejecutar promoción',
            danger: true,
        });
        if (!ok) return;
        this.busyId.set(a.id);
        try {
            const res = await firstValueFrom(
                this.api.post<PromotionResult>(
                    `academic-years/${a.anio}/promotion/run`,
                    {},
                ),
            );
            const r = res.data;
            this.toastr.success(
                `Promoción ${a.anio} → ${a.anio + 1}: ${r.creadas} matrículas creadas (${r.repetidores} repetidores, ${r.egresados} egresados).`,
                'Listo',
            );
            this.preview.set(null);
            await this.refresh();
        } catch (err) {
            this.toastr.error(
                parseApiError(err, 'No se pudo ejecutar la promoción'),
                'Error',
            );
        } finally {
            this.busyId.set(null);
        }
    }

    // ── Desactivación de egresados ───────────────────────────────
    async desactivarEgresados(a: AcademicYear): Promise<void> {
        if (a.estado !== 'cerrado') {
            this.toastr.warning(
                'El año debe estar cerrado (con promoción ejecutada) antes de desactivar egresados.',
                'Aviso',
            );
            return;
        }
        if (a.egresadosDesactivadosAt) {
            this.toastr.info(
                'La desactivación de egresados de este año ya fue ejecutada.',
                'Idempotente',
            );
            return;
        }
        const ok = await this.confirm({
            title: `¿Desactivar egresados ${a.anio}?`,
            message:
                'Las cuentas de los alumnos que terminaron 5to de Sec. quedarán INACTIVAS (login bloqueado). NO se elimina ningún dato: historial académico, informes psicológicos y libretas siguen consultables por admin/director.\n\n' +
                'Normalmente el sistema hace esto automáticamente 30 días después del cierre del año. Usa este botón solo si necesitas adelantarlo.',
            confirm: 'Desactivar egresados',
            danger: true,
        });
        if (!ok) return;
        this.busyId.set(a.id);
        try {
            const res = await firstValueFrom(
                this.api.post<EgresadoDeactivationResult>(
                    `academic-years/${a.anio}/egresados/deactivate`,
                    {},
                ),
            );
            const n = res.data?.desactivados ?? 0;
            this.toastr.success(
                `Se desactivaron ${n} cuenta(s) de egresados.`,
                'Listo',
            );
            await this.refresh();
        } catch (err) {
            this.toastr.error(
                parseApiError(err, 'No se pudo desactivar egresados'),
                'Error',
            );
        } finally {
            this.busyId.set(null);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────
    private async confirm(opts: {
        title: string;
        message: string;
        confirm: string;
        danger?: boolean;
    }): Promise<boolean> {
        const ref = this.dialog.open<ConfirmDialog, ConfirmData, boolean>(
            ConfirmDialog,
            {
                width: '460px',
                data: {
                    title: opts.title,
                    message: opts.message,
                    confirm: opts.confirm,
                    cancel: 'Cancelar',
                    danger: opts.danger ?? false,
                },
            },
        );
        return (await firstValueFrom(ref.afterClosed())) === true;
    }

    isBusy(a: AcademicYear): boolean {
        return this.busyId() === a.id;
    }

    trackById = (_: number, a: AcademicYear): string => a.id;
}