import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api';
import {
  Appointment,
  AssignedStudent,
  CancelAppointmentPayload,
  CreateAppointmentPayload,
  CreateAvailabilityPayload,
  CreateBlockPayload,
  CreateRecordPayload,
  ParentOfStudent,
  PsychologistAvailability,
  PsychologistBlock,
  PsychologyRecord,
  UpdateAppointmentPayload,
  UpdateRecordPayload,
} from '../../../core/models/psychology';

/**
 * Algunos endpoints devuelven el array directamente (ej. /psychology/blocks),
 * y otros lo envuelven en un objeto paginado { data, total, page, limit, totalPages }
 * (ej. /appointments/mine). Este helper soporta ambos casos.
 */
function unwrapList<T>(payload: T[] | { data?: T[] } | null | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray((payload as { data?: T[] }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

@Injectable({ providedIn: 'root' })
export class PsychologyStore {
  private api = inject(ApiService);

  // ── Estado ────────────────────────────────────────────────────
  readonly appointments          = signal<Appointment[]>([]);
  readonly myStudents            = signal<AssignedStudent[]>([]);
  readonly currentStudent        = signal<AssignedStudent | null>(null);
  readonly currentStudentRecords = signal<PsychologyRecord[]>([]);
  readonly availability          = signal<PsychologistAvailability[]>([]);
  readonly blocks                = signal<PsychologistBlock[]>([]);

  readonly loadingStudents     = signal(false);
  readonly loadingRecords      = signal(false);
  readonly loadingAppointments = signal(false);
  readonly loadingAvailability = signal(false);
  readonly loadingBlocks       = signal(false);
  readonly error               = signal<string | null>(null);

  reset(): void {
    this.appointments.set([]);
    this.myStudents.set([]);
    this.currentStudent.set(null);
    this.currentStudentRecords.set([]);
    this.availability.set([]);
    this.blocks.set([]);
    this.error.set(null);
  }

  // ── APPOINTMENTS ──────────────────────────────────────────────
  // Backend: @Controller('appointments') — sin prefijo "psychology/"

  async loadMyAppointments(): Promise<void> {
    this.loadingAppointments.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.api.get<Appointment[] | { data: Appointment[] }>('appointments/mine'),
      );
      this.appointments.set(unwrapList<Appointment>(res.data));
    } catch {
      this.error.set('Error al cargar las citas');
    } finally {
      this.loadingAppointments.set(false);
    }
  }

  async createAppointment(payload: CreateAppointmentPayload): Promise<Appointment> {
    const res = await firstValueFrom(
      this.api.post<Appointment>('appointments', payload),
    );
    await this.loadMyAppointments();
    return res.data;
  }

  async updateAppointment(id: string, payload: UpdateAppointmentPayload): Promise<Appointment> {
    const res = await firstValueFrom(
      this.api.patch<Appointment>(`appointments/${id}`, payload),
    );
    await this.loadMyAppointments();
    return res.data;
  }

  async cancelAppointment(id: string, payload: CancelAppointmentPayload): Promise<void> {
    await firstValueFrom(this.api.delete(`appointments/${id}`, payload));
    await this.loadMyAppointments();
  }

  // ── MY STUDENTS ───────────────────────────────────────────────

  async loadMyStudents(): Promise<void> {
    this.loadingStudents.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.api.get<AssignedStudent[] | { data: AssignedStudent[] }>('psychology/my-students'),
      );
      this.myStudents.set(unwrapList<AssignedStudent>(res.data));
    } catch {
      this.error.set('Error al cargar los alumnos asignados');
    } finally {
      this.loadingStudents.set(false);
    }
  }

  async getStudentParents(studentId: string): Promise<ParentOfStudent[]> {
    const res = await firstValueFrom(
      this.api.get<ParentOfStudent[] | { data: ParentOfStudent[] }>(
        `psychology/directory/students/${studentId}/parents`,
      ),
    );
    return unwrapList<ParentOfStudent>(res.data);
  }

  // ── RECORDS ───────────────────────────────────────────────────

  async loadStudentDetailAndRecords(studentId: string): Promise<void> {
    this.loadingRecords.set(true);
    this.error.set(null);
    try {
      const [studentRes, recordsRes] = await Promise.all([
        firstValueFrom(this.api.get<AssignedStudent>(`users/alumnos/${studentId}`)),
        firstValueFrom(
          this.api.get<PsychologyRecord[] | { data: PsychologyRecord[] }>(
            `psychology/records/student/${studentId}`,
          ),
        ),
      ]);
      this.currentStudent.set(studentRes.data ?? null);
      this.currentStudentRecords.set(unwrapList<PsychologyRecord>(recordsRes.data));
    } catch {
      this.error.set('Error al cargar la ficha del alumno');
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

  // ── AVAILABILITY ──────────────────────────────────────────────

  async loadAvailability(psychologistId: string): Promise<void> {
    this.loadingAvailability.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.api.get<PsychologistAvailability[] | { data: PsychologistAvailability[] }>(
          `psychology/availability/${psychologistId}`,
        ),
      );
      this.availability.set(unwrapList<PsychologistAvailability>(res.data));
    } catch {
      this.error.set('Error al cargar la disponibilidad');
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

  // ── BLOCKS ────────────────────────────────────────────────────

  async loadBlocks(): Promise<void> {
    this.loadingBlocks.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.api.get<PsychologistBlock[] | { data: PsychologistBlock[] }>('psychology/blocks'),
      );
      this.blocks.set(unwrapList<PsychologistBlock>(res.data));
    } catch {
      this.error.set('Error al cargar los bloqueos');
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