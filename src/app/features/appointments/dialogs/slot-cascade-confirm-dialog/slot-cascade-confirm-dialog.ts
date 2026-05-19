import {
    ChangeDetectionStrategy, Component, computed, inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import {
    MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AffectedAppointment } from '../../../../core/models/appointments';

export interface SlotCascadeDialogData {
    /** Texto descriptivo del bloque a eliminar (ej. "Martes 10:00 – 11:00"). */
    slotLabel: string;
    affected: AffectedAppointment[];
}

/**
 * Confirmación de cascada al eliminar un slot de disponibilidad con citas
 * activas adentro. Muestra la lista de citas que serían canceladas y exige
 * confirmación explícita antes de reintentar el DELETE con `confirm=true`.
 */
@Component({
    selector: 'app-slot-cascade-confirm-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, MatDialogModule, MatButtonModule, MatIconModule],
    templateUrl: './slot-cascade-confirm-dialog.html',
    styleUrl: './slot-cascade-confirm-dialog.scss',
})
export class SlotCascadeConfirmDialog {
    private ref = inject(MatDialogRef<SlotCascadeConfirmDialog, boolean>);
    readonly data: SlotCascadeDialogData = inject(MAT_DIALOG_DATA);

    readonly count = computed(() => this.data.affected.length);

    cancel(): void { this.ref.close(false); }
    confirm(): void { this.ref.close(true); }

    /** Nombre legible de la "parte" implicada (alumno/padre/quien sea). */
    partyLabel(a: AffectedAppointment): string {
        const s = a.student;
        if (s) return `${s.nombre} ${s.apellido_paterno}`.trim();
        const p = a.convocadoA ?? a.convocadoPor;
        if (p) return `${p.nombre} ${p.apellido_paterno}`.trim();
        return '—';
    }
}
