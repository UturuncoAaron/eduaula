import {
    ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AppointmentsStore } from '../../data-access/appointments.store';
import type {
    DayBlocksResponse, DaySubSlot,
} from '../../../../core/models/appointments';

export interface DayBlocksDrawerData {
    cuentaId: string;
    /** YYYY-MM-DD */
    date: string;
    /** Etiqueta legible del día, ej. "Martes 11 de junio". */
    dateLabel: string;
    /** Etiqueta de la persona dueña de la agenda. */
    ownerLabel?: string;
}

export interface DayBlocksDrawerResult {
    /** Sub-slot elegido para agendar (si el flujo lo permite). */
    pickedStart?: string;
    pickedEnd?: string;
}

/**
 * Drawer / slide-over con el detalle de un día: bloques generales (45 min
 * docente, etc.) y, dentro de cada uno, los sub-slots reservables de 15/30
 * min con su estado libre/ocupado. Evita saturar el calendario macro con los
 * micro-slots de 15 min.
 */
@Component({
    selector: 'app-day-blocks-drawer',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatTooltipModule,
    ],
    templateUrl: './day-blocks-drawer.html',
    styleUrl: './day-blocks-drawer.scss',
})
export class DayBlocksDrawer {
    private readonly ref = inject(
        MatDialogRef<DayBlocksDrawer, DayBlocksDrawerResult>,
    );
    private readonly store = inject(AppointmentsStore);
    readonly data: DayBlocksDrawerData = inject(MAT_DIALOG_DATA);

    readonly loading = signal(true);
    readonly response = signal<DayBlocksResponse | null>(null);

    readonly blocks = computed(() => this.response()?.blocks ?? []);
    readonly slotMinutes = computed(() => this.response()?.slotMinutes ?? 30);
    readonly totalFree = computed(() =>
        this.blocks().reduce((acc, b) => acc + b.freeCount, 0),
    );

    constructor() {
        void this.load();
    }

    private async load(): Promise<void> {
        this.loading.set(true);
        const res = await this.store.getDayBlocks(this.data.cuentaId, this.data.date);
        this.response.set(res);
        this.loading.set(false);
    }

    pick(slot: DaySubSlot): void {
        if (!slot.available) return;
        this.ref.close({ pickedStart: slot.start, pickedEnd: slot.end });
    }

    close(): void {
        this.ref.close();
    }
}
