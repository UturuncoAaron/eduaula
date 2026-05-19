import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api';
import {
  AssignedStudent,
  ParentOfStudent,
  PsychologyRecord,
  SearchableParent,
  CreateRecordPayload,
  UpdateRecordPayload,
  Psicologa,
  InformePsicologico,
  CreateInformePayload,
  UpdateInformePayload,
  ArchivoPsicologico,
  UploadArchivoPayload,
} from '../../../core/models/psychology';
import { AccountAvailability } from '../../../core/models/appointments';

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

  // ── Estado ──────────────────────────────────────────────────
  readonly myStudents = signal<AssignedStudent[]>([]);
  readonly currentStudent = signal<AssignedStudent | null>(null);
  readonly currentStudentRecords = signal<PsychologyRecord[]>([]);
  readonly currentStudentInformes = signal<InformePsicologico[]>([]);
  readonly currentStudentArchivos = signal<ArchivoPsicologico[]>([]);

  readonly loadingStudents = signal(false);
  readonly loadingRecords = signal(false);
  readonly loadingInformes = signal(false);
  readonly loadingArchivos = signal(false);
  readonly error = signal<string | null>(null);

  // ── Derivados ───────────────────────────────────────────────
  readonly currentStudentFichas = computed(
    () => this.currentStudentArchivos().filter(a => a.categoria === 'ficha'),
  );
  readonly currentStudentTests = computed(
    () => this.currentStudentArchivos().filter(a => a.categoria === 'test'),
  );

  reset(): void {
    this.myStudents.set([]);
    this.currentStudent.set(null);
    this.currentStudentRecords.set([]);
    this.currentStudentInformes.set([]);
    this.currentStudentArchivos.set([]);
    this.error.set(null);
  }

  // ════════════════════════════════════════════════════════════
  // MIS ALUMNOS
  // ════════════════════════════════════════════════════════════

  async loadMyStudents(): Promise<void> {
    this.loadingStudents.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.api.get<AssignedStudent[] | { data: AssignedStudent[] }>(
          'psychology/my-students',
        ),
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

  // ════════════════════════════════════════════════════════════
  // FICHAS (notas de texto)
  // ════════════════════════════════════════════════════════════

  async loadStudentDetailAndRecords(studentId: string): Promise<void> {
    this.loadingRecords.set(true);
    this.error.set(null);
    try {
      const [studentRes, recordsRes] = await Promise.all([
        firstValueFrom(
          // Usamos el endpoint del directorio de psicología (accesible para
          // psicóloga / docente / auxiliar / admin). El endpoint antiguo
          // `users/alumnos/:id` vivía bajo el controller admin y devolvía
          // 404 para todos los demás roles.
          this.api.get<AssignedStudent>(
            `psychology/directory/students/${studentId}`,
          ),
        ),
        firstValueFrom(
          this.api.get<PsychologyRecord[] | { data: PsychologyRecord[] }>(
            `psychology/records/student/${studentId}`,
          ),
        ),
      ]);
      this.currentStudent.set(studentRes.data ?? null);
      this.currentStudentRecords.set(
        unwrapList<PsychologyRecord>(recordsRes.data),
      );
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
      this.api.patch<PsychologyRecord>(
        `psychology/records/${recordId}`,
        payload,
      ),
    );
    await this.loadStudentDetailAndRecords(studentId);
    return res.data;
  }

  async deleteRecord(recordId: string, studentId: string): Promise<void> {
    await firstValueFrom(
      this.api.delete(`psychology/records/${recordId}`),
    );
    await this.loadStudentDetailAndRecords(studentId);
  }

  // ════════════════════════════════════════════════════════════
  // DIRECTORIO
  // ════════════════════════════════════════════════════════════

  async searchAllParents(query: string): Promise<SearchableParent[]> {
    const term = (query ?? '').trim();
    if (!term) return [];
    const res = await firstValueFrom(
      this.api.get<SearchableParent[] | { data: SearchableParent[] }>(
        'psychology/directory/parents/search',
        { q: term },
      ),
    );
    return unwrapList<SearchableParent>(res.data);
  }

  async searchAllStudents(query: string): Promise<AssignedStudent[]> {
    const term = (query ?? '').trim();
    if (!term) return [];
    const res = await firstValueFrom(
      this.api.get<AssignedStudent[] | { data: AssignedStudent[] }>(
        'psychology/directory/students/search',
        { q: term },
      ),
    );
    return unwrapList<AssignedStudent>(res.data);
  }

  async listStudents(q?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: AssignedStudent[]; total: number }> {
    const params: Record<string, string> = {};
    if (q?.search) params['q'] = q.search;
    if (q?.page) params['page'] = String(q.page);
    if (q?.limit) params['limit'] = String(q.limit);
    const res = await firstValueFrom(
      this.api.get<{ data: AssignedStudent[]; total: number }>(
        'psychology/directory/students',
        params,
      ),
    );
    return res.data;
  }

  async listActivePsicologas(query?: string): Promise<Psicologa[]> {
    const params = query ? { q: query } : undefined;
    const res = await firstValueFrom(
      this.api.get<Psicologa[] | { data: Psicologa[] }>(
        'psychology/psicologas',
        params,
      ),
    );
    return unwrapList<Psicologa>(res.data);
  }

  async getMyAvailability(): Promise<AccountAvailability[]> {
    const res = await firstValueFrom(
      this.api.get<AccountAvailability[] | { data: AccountAvailability[] }>(
        'appointments/availability/mine',
      ),
    );
    return unwrapList<AccountAvailability>(res.data);
  }

  // ════════════════════════════════════════════════════════════
  // INFORMES PSICOLÓGICOS
  // ════════════════════════════════════════════════════════════

  async loadStudentInformes(studentId: string): Promise<void> {
    this.loadingInformes.set(true);
    try {
      const res = await firstValueFrom(
        this.api.get<
          InformePsicologico[] | { data: InformePsicologico[] }
        >(`psychology/informes/student/${studentId}`),
      );
      this.currentStudentInformes.set(unwrapList<InformePsicologico>(res.data));
    } catch {
      this.error.set('Error al cargar los informes del alumno');
    } finally {
      this.loadingInformes.set(false);
    }
  }

  async createInforme(payload: CreateInformePayload): Promise<InformePsicologico> {
    const res = await firstValueFrom(
      this.api.post<InformePsicologico>('psychology/informes', payload),
    );
    await this.loadStudentInformes(payload.studentId);
    return res.data;
  }

  async updateInforme(
    informeId: string,
    studentId: string,
    payload: UpdateInformePayload,
  ): Promise<InformePsicologico> {
    const res = await firstValueFrom(
      this.api.patch<InformePsicologico>(
        `psychology/informes/${informeId}`,
        payload,
      ),
    );
    await this.loadStudentInformes(studentId);
    return res.data;
  }

  async finalizeInforme(
    informeId: string,
    studentId: string,
  ): Promise<InformePsicologico> {
    const res = await firstValueFrom(
      this.api.post<InformePsicologico>(
        `psychology/informes/${informeId}/finalizar`,
        {},
      ),
    );
    await this.loadStudentInformes(studentId);
    return res.data;
  }

  async deleteInforme(informeId: string, studentId: string): Promise<void> {
    await firstValueFrom(
      this.api.delete(`psychology/informes/${informeId}`),
    );
    await this.loadStudentInformes(studentId);
  }

  async getInformeById(informeId: string): Promise<InformePsicologico> {
    const res = await firstValueFrom(
      this.api.get<InformePsicologico>(`psychology/informes/${informeId}`),
    );
    return res.data;
  }

  /**
   * Descarga el PDF del informe (server-side rendered) y dispara la
   * descarga del navegador sin abrir el diálogo de impresión. El nombre
   * del archivo viene en el header `Content-Disposition`; si no lo
   * encuentra, usa el título del informe como fallback.
   */
  async downloadInformePdf(informeId: string, fallbackName: string): Promise<void> {
    const blob = await firstValueFrom(
      this.api.getBlob(`reports/psychology/informes/${informeId}/pdf`),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fallbackName}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ════════════════════════════════════════════════════════════
  // ARCHIVOS (fichas y tests subidos a R2)
  // ════════════════════════════════════════════════════════════
  //
  // Endpoints en el backend:
  //   POST   /psychology/archivos/student/:studentId      (multipart)
  //   GET    /psychology/archivos/student/:studentId
  //   GET    /psychology/archivos/:id/url                 (URL firmada 1h)
  //   DELETE /psychology/archivos/:id
  //
  // El estado se separa en derivados (`currentStudentFichas` y
  // `currentStudentTests`) para que el template no tenga que filtrar.

  async loadStudentArchivos(studentId: string): Promise<void> {
    this.loadingArchivos.set(true);
    try {
      const res = await firstValueFrom(
        this.api.get<
          ArchivoPsicologico[] | { data: ArchivoPsicologico[] }
        >(`psychology/archivos/student/${studentId}`),
      );
      this.currentStudentArchivos.set(
        unwrapList<ArchivoPsicologico>(res.data),
      );
    } catch {
      this.error.set('Error al cargar archivos del alumno');
    } finally {
      this.loadingArchivos.set(false);
    }
  }

  async uploadArchivo(payload: UploadArchivoPayload): Promise<ArchivoPsicologico> {
    const fd = new FormData();
    fd.append('file', payload.file);
    fd.append('categoria', payload.categoria);
    fd.append('nombre', payload.nombre);
    if (payload.descripcion) fd.append('descripcion', payload.descripcion);
    fd.append('confidencial', String(payload.confidencial));

    const res = await firstValueFrom(
      this.api.post<ArchivoPsicologico>(
        `psychology/archivos/student/${payload.studentId}`,
        fd,
      ),
    );
    // Refresca toda la lista (consistente con record/informe)
    await this.loadStudentArchivos(payload.studentId);
    return res.data;
  }

  async getArchivoDownloadUrl(archivoId: string): Promise<string> {
    const res = await firstValueFrom(
      this.api.get<{ url: string }>(`psychology/archivos/${archivoId}/url`),
    );
    return res.data.url;
  }

  async deleteArchivo(archivoId: string, studentId: string): Promise<void> {
    await firstValueFrom(
      this.api.delete(`psychology/archivos/${archivoId}`),
    );
    await this.loadStudentArchivos(studentId);
  }
}