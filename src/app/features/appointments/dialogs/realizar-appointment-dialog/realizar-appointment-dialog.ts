import {
    ChangeDetectionStrategy, Component, inject, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface RealizarDialogData {
    /** Texto descriptivo de la cita (ej. "13/05 a las 10:30 con Juan Pérez"). */
    contextLabel: string;
}

export interface RealizarDialogResult {
    notasPosteriores?: string;
}

/**
 * Marca una cita como `realizada`. Notas posteriores son opcionales —
 * van directo al campo `follow_up_notes` de la cita y son visibles para
 * la psicóloga en futuras consultas.
 */
@Component({
    selector: 'app-realizar-appointment-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatDialogModule, MatFormFieldModule, MatInputModule,
        MatButtonModule, MatIconModule,
    ],
    templateUrl: './realizar-appointment-dialog.html',
    styleUrl: './realizar-appointment-dialog.scss',
})
export class RealizarAppointmentDialog {
    private ref = inject(MatDialogRef<RealizarAppointmentDialog, RealizarDialogResult>);
    readonly data: RealizarDialogData = inject(MAT_DIALOG_DATA);

    readonly notas = signal('');
    readonly maxLength = 1000;

    get trimmedLength(): number {
        return this.notas().trim().length;
    }

    cancel(): void {
        this.ref.close();
    }

    submit(): void {
        const notas = this.notas().trim();
        this.ref.close({
            notasPosteriores: notas.length > 0 ? notas : undefined,
        });
    }
}
