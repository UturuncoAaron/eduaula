import {
    ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
    MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';

import { AppointmentsStore } from '../../data-access/appointments.store';
import type {
    Appointment, CloseSessionPayload, FichaCategoria, FollowUpSuggestion,
    FreeSlot,
} from '../../../../core/models/appointments';

export interface CloseSessionDialogData {
    appointment: Appointment;
    contextLabel: string;
}

const FICHA_CATEGORIAS: { value: FichaCategoria; label: string }[] = [
    { value: 'emocional', label: 'Emocional' },
    { value: 'conductual', label: 'Conductual' },
    { value: 'academico', label: 'Académico' },
    { value: 'familiar', label: 'Familiar' },
    { value: 'otro', label: 'Otro' },
];

/**
 * Panel de Cierre Clínico (slide-over). Tres secciones:
 *   1. Notas clínicas privadas → se guardan como ficha de psicología.
 *   2. Plan de seguimiento inteligente: fecha recomendada según el tipo de
 *      cita (recurrencia) ya pre-seleccionada.
 *   3. Selector de agenda integrado: slots libres de la psicóloga en la fecha
 *      elegida, resaltando los disponibles.
 *
 * Con un solo botón cierra la cita actual (realizada) y crea la cita de
 * seguimiento en una sola transacción del backend.
 */
@Component({
    selector: 'app-close-session-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule,
        MatButtonToggleModule, MatIconModule, MatSelectModule,
        MatSlideToggleModule, MatProgressSpinnerModule, MatChipsModule,
    ],
    templateUrl: './close-session-dialog.html',
    styleUrl: './close-session-dialog.scss',
})
export class CloseSessionDialog {
    private readonly ref = inject(
        MatDialogRef<CloseSessionDialog, CloseSessionPayload>,
    );
    private readonly store = inject(AppointmentsStore);
    readonly data: CloseSessionDialogData = inject(MAT_DIALOG_DATA);

    readonly categorias = FICHA_CATEGORIAS;

    // ── Sección 1: notas clínicas ────────────────────────────────
    readonly notasClinicas = signal('');
    readonly fichaCategoria = signal<FichaCategoria>('emocional');
    readonly notasPosteriores = signal('');
    readonly maxNotas = 5000;

    // ── Sección 2/3: seguimiento ─────────────────────────────────
    readonly programar = signal(true);
    readonly loadingSuggestion = signal(true);
    readonly suggestion = signal<FollowUpSuggestion | null>(null);

    readonly selectedDate = signal<string>('');
    readonly slots = signal<FreeSlot[]>([]);
    readonly loadingSlots = signal(false);
    readonly selectedSlotStart = signal<string | null>(null);
    readonly durationMin = signal<number>(30);

    readonly incluirPadre = signal(false);
    readonly parentId = signal<string>('');

    readonly submitting = signal(false);

    readonly availableSlots = computed(() =>
        this.slots().filter((s) => s.available),
    );
    readonly parents = computed(() => this.suggestion()?.parents ?? []);
    readonly minDate = computed(() => {
        const d = new Date();
        return d.toISOString().slice(0, 10);
    });

    constructor() {
        void this.loadSuggestion();
    }

    private async loadSuggestion(): Promise<void> {
        this.loadingSuggestion.set(true);
        const sug = await this.store.getFollowUpSuggestion(this.data.appointment.id);
        this.suggestion.set(sug);
        if (sug) {
            this.selectedDate.set(sug.suggestedDate);
            this.durationMin.set(sug.defaultDurationMin || sug.slotMinutes);
            this.slots.set(sug.slots);
            // Pre-selecciona el primer slot libre de la fecha recomendada.
            const firstFree = sug.slots.find((s) => s.available);
            this.selectedSlotStart.set(firstFree ? firstFree.start : null);
        }
        this.loadingSuggestion.set(false);
    }

    async onDateChange(date: string): Promise<void> {
        if (!date) return;
        this.selectedDate.set(date);
        this.selectedSlotStart.set(null);
        const sug = this.suggestion();
        if (!sug) return;
        this.loadingSlots.set(true);
        const slots = await this.store.getFreeSlots(sug.psychologistId, date);
        this.slots.set(slots);
        const firstFree = slots.find((s) => s.available);
        this.selectedSlotStart.set(firstFree ? firstFree.start : null);
        this.loadingSlots.set(false);
    }

    selectSlot(slot: FreeSlot): void {
        if (!slot.available) return;
        this.selectedSlotStart.set(slot.start);
    }

    get trimmedNotasLength(): number {
        return this.notasClinicas().trim().length;
    }

    /** Etiqueta legible de la recurrencia, ej. "cada 14 días (2 semanas)". */
    readonly intervalLabel = computed(() => {
        const days = this.suggestion()?.intervalDays ?? 0;
        if (!days) return '';
        const weeks = days % 7 === 0 ? days / 7 : null;
        return weeks
            ? `cada ${days} días (${weeks} ${weeks === 1 ? 'semana' : 'semanas'})`
            : `cada ${days} días`;
    });

    readonly canSubmit = computed(() => {
        if (this.submitting()) return false;
        if (!this.programar()) return true;
        return !!this.selectedDate() && !!this.selectedSlotStart();
    });

    cancel(): void {
        this.ref.close();
    }

    submit(): void {
        if (!this.canSubmit()) return;
        const notas = this.notasClinicas().trim();
        const posteriores = this.notasPosteriores().trim();

        const payload: CloseSessionPayload = {
            notasClinicas: notas.length > 0 ? notas : undefined,
            fichaCategoria: notas.length > 0 ? this.fichaCategoria() : undefined,
            notasPosteriores: posteriores.length > 0 ? posteriores : undefined,
        };

        if (this.programar() && this.selectedDate() && this.selectedSlotStart()) {
            payload.seguimiento = {
                scheduledAt: `${this.selectedDate()}T${this.selectedSlotStart()}:00`,
                durationMin: this.durationMin(),
                incluirPadre: this.incluirPadre(),
                parentId:
                    this.incluirPadre() && this.parentId()
                        ? this.parentId()
                        : undefined,
            };
        }

        this.ref.close(payload);
    }
}
