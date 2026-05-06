import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api';
import {
    Appointment,
    AssignedStudent,
    CreateAppointmentPayload,
    CreateAvailabilityPayload,
    CreateBlockPayload,
    CreateRecordPayload,
    ParentOfStudent,
    PsychologistAvailability,
    PsychologistBlock,
    PsychologistStudentAssignment,
    PsychologyRecord,
    UpdateAppointmentPayload,
    UpdateRecordPayload,
} from '../../../core/models/psychology';

@Injectable({ providedIn: 'root' })
export class PsychologyStore {
    private api = inject(ApiService);

    // ── Estado compartido (signals) ─────────────────────────────────────────
    readonly appointments = signal<Appointment[]>([]);
    readonly myStudents = signal<AssignedStudent[]>([]);
    readonly currentStudent = signal<AssignedStudent | null>(null);
    readonly currentStudentRecords = signal<PsychologyRecord[]>([]);
    readonly availability = signal<PsychologistAvailability[]>([]);
    readonly blocks = signal<PsychologistBlock[]>([]);

    readonly loadingStudents = signal(false);
    readonly loadingRecords = signal(false);
    readonly loadingAppointments = signal(false);
    readonly loadingAvailability = signal(false);
    readonly loadingBlocks = signal(false);

    readonly error = signal<string | null>(null);

    // ── APPOINTMENTS ────────────────────────────────────────────────────────

    async loadMyAppointments() {
        this.loadingAppointments.set(true);
        this.error.set(null);
        try {
            const res = await firstValueFrom(
                this.api.get<Appointment[]>('psychology/appointments/mine'),
            );
            this.appointments.set(res.data ?? []);
        } catch (err) {
            this.error.set('Error al cargar mis citas');
            console.error(err);
        } finally {
            this.loadingAppointments.set(false);
        }
    }

    async createAppointment(payload: CreateAppointmentPayload): Promise<Appointment> {
        const res = await firstValueFrom(
            this.api.post<Appointment>('psychology/appointments', payload),
        );
        await this.loadMyAppointments();
        return res.data;
    }

    async updateAppointment(id: string, payload: UpdateAppointmentPayload): Promise<Appointment> {
        const res = await firstValueFrom(
            this.api.patch<Appointment>(`psychology/appointments/${id}`, payload),
        );
        await this.loadMyAppointments();
        return res.data;
    }

    // ── MY STUDENTS ─────────────────────────────────────────────────────────

    async loadMyStudents() {
        this.loadingStudents.set(true);
        this.error.set(null);
        try {
            const res = await firstValueFrom(
                this.api.get<PsychologistStudentAssignment[]>('psychology/my-students'),
            );
            const list = (res.data ?? [])
                .filter(a => !!a.student)
                .map(a => a.student);
            this.myStudents.set(list);
        } catch (err) {
            this.error.set('Error al cargar mis alumnos asignados');
            console.error(err);
        } finally {
            this.loadingStudents.set(false);
        }
    }

    async getStudentParents(studentId: string): Promise<ParentOfStudent[]> {
        const res = await firstValueFrom(
            this.api.get<ParentOfStudent[]>(`psychology/students/${studentId}/parents`),
        );
        return res.data ?? [];
    }

    // ── RECORDS ─────────────────────────────────────────────────────────────

    async loadStudentDetailAndRecords(studentId: string) {
        this.loadingRecords.set(true);
        this.error.set(null);
        try {
            const [studentRes, recordsRes] = await Promise.all([
                firstValueFrom(this.api.get<AssignedStudent>(`users/alumnos/${studentId}`)),
                firstValueFrom(this.api.get<PsychologyRecord[]>(`psychology/records/student/${studentId}`)),
            ]);
            this.currentStudent.set(studentRes.data ?? null);
            this.currentStudentRecords.set(recordsRes.data ?? []);
        } catch (err) {
            this.error.set('Error al cargar la ficha del alumno');
            console.error(err);
        } finally {
            this.loadingRecords.set(false);
        }
    }

    async createRecord(payload: CreateRecordPayload): Promise<PsychologyRecord> {
        const res = await firstValueFrom(
            this.api.post<PsychologyRecord>('psychology/records', payload),
        );
        await this.loadStudentDetailAndRecords(payload.studentId);
        return res.data;
    }

    async updateRecord(
        recordId: string,
        studentId: string,
        payload: UpdateRecordPayload,
    ): Promise<PsychologyRecord> {
        const res = await firstValueFrom(
            this.api.patch<PsychologyRecord>(`psychology/records/${recordId}`, payload),
        );
        await this.loadStudentDetailAndRecords(studentId);
        return res.data;
    }

    async deleteRecord(recordId: string, studentId: string): Promise<void> {
        await firstValueFrom(this.api.delete(`psychology/records/${recordId}`));
        await this.loadStudentDetailAndRecords(studentId);
    }

    // ── AVAILABILITY ────────────────────────────────────────────────────────

    async loadAvailability(psychologistId: string) {
        this.loadingAvailability.set(true);
        this.error.set(null);
        try {
            const res = await firstValueFrom(
                this.api.get<PsychologistAvailability[]>(`psychology/availability/${psychologistId}`),
            );
            this.availability.set(res.data ?? []);
        } catch (err) {
            this.error.set('Error al cargar disponibilidad');
            console.error(err);
        } finally {
            this.loadingAvailability.set(false);
        }
    }

    async setAvailability(payload: CreateAvailabilityPayload): Promise<PsychologistAvailability> {
        const res = await firstValueFrom(
            this.api.post<PsychologistAvailability>('psychology/availability', payload),
        );
        return res.data;
    }

    async removeAvailability(id: string): Promise<void> {
        await firstValueFrom(this.api.delete(`psychology/availability/${id}`));
    }

    // ── BLOCKS ──────────────────────────────────────────────────────────────

    async loadBlocks() {
        this.loadingBlocks.set(true);
        this.error.set(null);
        try {
            const res = await firstValueFrom(
                this.api.get<PsychologistBlock[]>('psychology/blocks'),
            );
            this.blocks.set(res.data ?? []);
        } catch (err) {
            this.error.set('Error al cargar bloqueos');
            console.error(err);
        } finally {
            this.loadingBlocks.set(false);
        }
    }

    async createBlock(payload: CreateBlockPayload): Promise<PsychologistBlock> {
        const res = await firstValueFrom(
            this.api.post<PsychologistBlock>('psychology/blocks', payload),
        );
        await this.loadBlocks();
        return res.data;
    }

    async removeBlock(id: string): Promise<void> {
        await firstValueFrom(this.api.delete(`psychology/blocks/${id}`));
        await this.loadBlocks();
    }
}
