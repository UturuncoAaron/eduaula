import {
    ChangeDetectionStrategy, Component, OnInit,
    computed, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';

import { AppointmentsStore } from '../../data-access/appointments.store';
import {
    DayBlocksDrawer, DayBlocksDrawerData,
} from '../../dialogs/day-blocks-drawer/day-blocks-drawer';
import {
    WeeklyAvailability, WeeklyAvailabilitySlot, DiaSemana,
} from '../../../../core/models/appointments';
import { WeekGrid } from '../../../../shared/components/week-grid/week-grid';
import {
    WeekSlot, WeekDia, isWeekDia,
} from '../../../../shared/components/week-grid/week-grid.types';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';

type Rol = 'psicologa' | 'docente';

function toHHMM(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isoDay(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + days);
    return isoDay(d);
}

function startOfWeekIso(d: Date): string {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    // Lunes como inicio.
    const dow = r.getDay() === 0 ? 7 : r.getDay();
    r.setDate(r.getDate() - (dow - 1));
    return isoDay(r);
}

/**
 * Vista pública de disponibilidad semanal de una psicóloga o docente.
 * Renderiza la grilla L–V con bloques libres/ocupados consumiendo
 * `GET /psicologas/:id/disponibilidad` o `GET /docentes/:id/disponibilidad`.
 *
 * No deja agendar desde aquí — es solo lectura. La idea es que cualquier
 * usuario autenticado pueda revisar la agenda de un profesional antes de
 * pedir cita desde el flujo correspondiente.
 */
@Component({
    selector: 'app-public-availability',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule, DatePipe,
        MatButtonModule, MatIconModule, MatProgressSpinnerModule,
        WeekGrid, EmptyState,
    ],
    templateUrl: './public-availability.html',
    styleUrl: './public-availability.scss',
})
export class PublicAvailability implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly store = inject(AppointmentsStore);
    private readonly dialog = inject(MatDialog);

    readonly loading = signal(true);
    readonly data = signal<WeeklyAvailability | null>(null);
    readonly cuentaId = signal<string>('');
    readonly rol = signal<Rol>('psicologa');
    readonly weekStart = signal<string>(startOfWeekIso(new Date()));

    readonly weekRangeLabel = computed(() => {
        const w = this.weekStart();
        if (!w) return '';
        const start = new Date(`${w}T00:00:00`);
        const end = new Date(`${addDays(w, 4)}T00:00:00`);
        const f = (d: Date) =>
            d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
        return `${f(start)} – ${f(end)}`;
    });

    /** Horario inicial / final calculado a partir de los slots devueltos. */
    readonly bounds = computed<{ startHour: number; endHour: number }>(() => {
        const d = this.data();
        if (!d || d.days.length === 0) return { startHour: 7, endHour: 18 };
        let min = 24 * 60;
        let max = 0;
        for (const day of d.days) {
            for (const s of day.slots) {
                const ds = new Date(s.start);
                const de = new Date(s.end);
                const mi = ds.getHours() * 60 + ds.getMinutes();
                const ma = de.getHours() * 60 + de.getMinutes();
                if (mi < min) min = mi;
                if (ma > max) max = ma;
            }
        }
        if (max <= min) return { startHour: 7, endHour: 18 };
        return {
            startHour: Math.max(0, Math.floor(min / 60)),
            endHour: Math.min(24, Math.ceil(max / 60)),
        };
    });

    readonly slotMinutes = computed<number>(() => this.data()?.slotMinutes ?? 30);

    /** Lista de WeekSlots para renderizar en `<app-week-grid mode="schedule">`. */
    readonly weekSlots = computed<WeekSlot[]>(() => {
        const d = this.data();
        if (!d) return [];
        const out: WeekSlot[] = [];
        for (const day of d.days) {
            if (!this.isWeekDia(day.diaSemana)) continue;
            const dia: WeekDia = day.diaSemana;
            for (const s of day.slots) {
                out.push(this.toWeekSlot(s, dia));
            }
        }
        return out;
    });

    readonly hasData = computed(() => (this.data()?.days?.length ?? 0) > 0);

    /** Días (lun–vie) de la semana visible, para abrir el detalle de sub-slots. */
    readonly weekDays = computed<{ date: string; label: string }[]>(() => {
        const w = this.weekStart();
        if (!w) return [];
        const out: { date: string; label: string }[] = [];
        for (let i = 0; i < 5; i++) {
            const iso = addDays(w, i);
            const d = new Date(`${iso}T00:00:00`);
            out.push({
                date: iso,
                label: d.toLocaleDateString('es-PE', {
                    weekday: 'short', day: '2-digit', month: 'short',
                }),
            });
        }
        return out;
    });

    /** Abre el drawer con los bloques + sub-slots del día seleccionado. */
    openDay(date: string): void {
        const d = new Date(`${date}T00:00:00`);
        const dateLabel = d.toLocaleDateString('es-PE', {
            weekday: 'long', day: '2-digit', month: 'long',
        });
        const data: DayBlocksDrawerData = {
            cuentaId: this.cuentaId(),
            date,
            dateLabel,
            ownerLabel: `${this.rolLabel()} · agenda`,
        };
        this.dialog.open(DayBlocksDrawer, {
            data,
            width: '460px',
            maxWidth: '96vw',
            height: '100vh',
            position: { right: '0', top: '0' },
            panelClass: 'form-drawer-pane',
            autoFocus: false,
        });
    }

    async ngOnInit(): Promise<void> {
        const id = this.route.snapshot.paramMap.get('id') ?? '';
        const rol = this.detectRol();
        this.cuentaId.set(id);
        this.rol.set(rol);
        await this.fetch();
    }

    async prevWeek(): Promise<void> {
        this.weekStart.set(addDays(this.weekStart(), -7));
        await this.fetch();
    }

    async nextWeek(): Promise<void> {
        this.weekStart.set(addDays(this.weekStart(), 7));
        await this.fetch();
    }

    async resetWeek(): Promise<void> {
        this.weekStart.set(startOfWeekIso(new Date()));
        await this.fetch();
    }

    goBack(): void {
        this.router.navigate(['/dashboard']);
    }

    rolLabel(): string {
        return this.rol() === 'psicologa' ? 'Psicóloga' : 'Docente';
    }

    private async fetch(): Promise<void> {
        const id = this.cuentaId();
        const rol = this.rol();
        if (!id) {
            this.loading.set(false);
            this.data.set(null);
            return;
        }
        this.loading.set(true);
        try {
            const res = await this.store.getPublicWeeklyAvailability(
                id, rol, this.weekStart(),
            );
            this.data.set(res);
        } finally {
            this.loading.set(false);
        }
    }

    private detectRol(): Rol {
        // El path es `/psicologas/:id/disponibilidad` o `/docentes/:id/disponibilidad`.
        const url = this.router.url || '';
        if (url.startsWith('/docentes')) return 'docente';
        return 'psicologa';
    }

    private isWeekDia(d: DiaSemana): d is WeekDia {
        return isWeekDia(d);
    }

    private toWeekSlot(s: WeeklyAvailabilitySlot, dia: WeekDia): WeekSlot {
        const start = new Date(s.start);
        const end = new Date(s.end);
        const horaInicio = toHHMM(start);
        const horaFin = toHHMM(end);
        const kind = s.available ? 'available' : 'taken';
        return {
            id: `${dia}-${horaInicio}-${horaFin}-${kind}`,
            dia,
            horaInicio,
            horaFin,
            title: s.available ? 'Disponible' : 'Ocupado',
            kind,
        };
    }
}
