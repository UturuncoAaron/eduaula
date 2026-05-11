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

export interface RejectDialogData {
    /** Texto descriptivo de la cita (p.ej. "13/05 a las 10:30 con Profesor García"). */
    contextLabel: string;
}

export interface RejectDialogResult {
    motivo: string;
}

/**
 * Dialog para rechazar una cita pendiente con motivo obligatorio.
 * El convocado (padre / alumno) lo abre desde el menú de acciones de la cita.
 */
@Component({
    selector: 'app-reject-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatDialogModule, MatFormFieldModule, MatInputModule,
        MatButtonModule, MatIconModule,
    ],
    templateUrl: './reject-dialog.html',
    styleUrl: './reject-dialog.scss',
})
export class RejectDialog {
    private ref = inject(MatDialogRef<RejectDialog, RejectDialogResult>);
    readonly data: RejectDialogData = inject(MAT_DIALOG_DATA);

    readonly motivo = signal('');

    readonly minLength = 3;
    readonly maxLength = 500;

    get trimmedLength(): number {
        return this.motivo().trim().length;
    }

    get canSubmit(): boolean {
        const n = this.trimmedLength;
        return n >= this.minLength && n <= this.maxLength;
    }

    cancel(): void {
        this.ref.close();
    }

    submit(): void {
        if (!this.canSubmit) return;
        this.ref.close({ motivo: this.motivo().trim() });
    }
}
