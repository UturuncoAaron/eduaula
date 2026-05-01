import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api';

// Tipos basados en tus DTOs del backend
export interface PsychologyRecord {
    id: string;
    studentId: string;
    categoria: 'conductual' | 'academico' | 'familiar' | 'emocional' | 'otro';
    contenido: string;
    createdAt: string;
}

export interface Appointment {
    id: string;
    studentId: string;
    parentId: string;
    tipo: string;
    modalidad: string;
    motivo: string;
    scheduledAt: string;
    durationMin: number;
    estado: string;
    // + relaciones (student, parent) que devuelve tu backend
    student?: any;
    parent?: any;
}

@Injectable({
    providedIn: 'root'
})
export class PsychologyStore {
    private api = inject(ApiService);

    // Signals para el estado
    readonly appointments = signal<Appointment[]>([]);
    readonly myStudents = signal<any[]>([]); // Alumnos asignados
    readonly currentStudentRecords = signal<PsychologyRecord[]>([]); // Fichas del alumno seleccionado
    readonly selectedStudent = signal<any | null>(null);

    readonly isLoading = signal<boolean>(false);
    readonly error = signal<string | null>(null);

    // ── APPOINTMENTS ────────────────────────────────────────────────────────

    async loadMyAppointments() {
        this.isLoading.set(true);
        this.error.set(null);
        try {
            // Coincide con: @Get('appointments/mine')
            const response = await firstValueFrom(this.api.get('/psychology/appointments/mine')) as any;
            this.appointments.set(response.data || response); // Depende de si tu interceptor desenvuelve el 'data'
        } catch (err: any) {
            this.error.set('Error al cargar mis citas');
            console.error(err);
        } finally {
            this.isLoading.set(false);
        }
    }

    // ── ASSIGNMENTS / STUDENTS ──────────────────────────────────────────────

    async loadMyStudents() {
        this.isLoading.set(true);
        this.error.set(null);
        try {
            // Coincide con: @Get('my-students')
            const response = await firstValueFrom(this.api.get('/psychology/my-students')) as any;
            // Tu backend devuelve PsychologistStudent[], mapeamos para extraer el student
            const assignments = response.data || response;
            this.myStudents.set(assignments.map((a: any) => a.student));
        } catch (err: any) {
            this.error.set('Error al cargar mis alumnos asignados');
            console.error(err);
        } finally {
            this.isLoading.set(false);
        }
    }

    // ── RECORDS ─────────────────────────────────────────────────────────────

    async loadStudentDetailAndRecords(studentId: string) {
        this.isLoading.set(true);
        this.error.set(null);
        try {
            // 1. Obtener la información general del alumno (Si tienes un endpoint en users/alumnos)
            const studentRes = await firstValueFrom(this.api.get(`/users/student/${studentId}`)) as any;
            this.selectedStudent.set(studentRes.data || studentRes);

            // 2. Obtener los registros psicológicos (Coincide con: @Get('records/student/:studentId'))
            const recordsRes = await firstValueFrom(this.api.get(`/psychology/records/student/${studentId}`)) as any;
            this.currentStudentRecords.set(recordsRes.data || recordsRes);

        } catch (err: any) {
            this.error.set('Error al cargar la ficha del alumno');
            console.error(err);
        } finally {
            this.isLoading.set(false);
        }
    }

    async createRecord(studentId: string, categoria: string, contenido: string) {
        try {
            // Coincide con: @Post('records') y CreateRecordDto
            await firstValueFrom(this.api.post('/psychology/records', { studentId, categoria, contenido }));
            // Recargamos los registros para ver el nuevo
            await this.loadStudentDetailAndRecords(studentId);
        } catch (error) {
            console.error('Error al crear registro:', error);
            throw error;
        }
    }
}