import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/services/api';
import {
    Task,
    Submission,
    RespuestaAlternativa,
} from '../../../core/models/task';

export interface CreateTaskPayload {
    titulo: string;
    instrucciones?: string;
    fecha_limite: string;
    puntos_max: number;
    permite_alternativas?: boolean;
    permite_archivo?: boolean;
    permite_texto?: boolean;
    bimestre?: number | null;
    semana?: number | null;
    preguntas?: {
        enunciado: string;
        puntos: number;
        orden?: number;
        opciones: { texto: string; es_correcta: boolean; orden?: number }[];
    }[];
}

export interface GradePayload {
    calificacion_manual: number;
    comentario_docente?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
    private api = inject(ApiService);

    // Docente: listar y crear
    getTasks(courseId: string) {
        return this.api.get<Task[]>(`courses/${courseId}/tasks`);
    }

    getTask(taskId: string) {
        return this.api.get<Task>(`tasks/${taskId}`);
    }

    createTask(courseId: string, payload: CreateTaskPayload) {
        return this.api.post<Task>(`courses/${courseId}/tasks`, payload);
    }

    toggleTask(taskId: string, activo: boolean) {
        return this.api.patch<Task>(`tasks/${taskId}/toggle`, { activo });
    }

    // Docente: archivo enunciado
    uploadEnunciado(taskId: string, file: File) {
        const fd = new FormData();
        fd.append('file', file);
        return this.api.postForm<Task>(`tasks/${taskId}/enunciado`, fd);
    }

    getEnunciadoUrl(taskId: string) {
        return this.api.get<{ url: string; nombre?: string | null }>(
            `tasks/${taskId}/enunciado-url`,
        );
    }

    // Docente: entregas
    getSubmissions(taskId: string) {
        return this.api.get<Submission[]>(`tasks/${taskId}/submissions`);
    }

    getSubmission(submissionId: string) {
        return this.api.get<Submission>(`submissions/${submissionId}`);
    }

    gradeSubmission(submissionId: string, payload: GradePayload) {
        return this.api.patch<Submission>(`submissions/${submissionId}/grade`, payload);
    }

    getSubmissionFileUrl(submissionId: string) {
        return this.api.get<{ url: string; nombre?: string | null }>(
            `submissions/${submissionId}/file-url`,
        );
    }

    // Alumno: ver y entregar
    getMySubmissions() {
        return this.api.get<Submission[]>('my-submissions');
    }

    getMySubmission(taskId: string) {
        return this.api.get<Submission | null>(`tasks/${taskId}/my-submission`);
    }

    submitFile(taskId: string, file: File) {
        const fd = new FormData();
        fd.append('file', file);
        return this.api.postForm<Submission>(`tasks/${taskId}/submit-file`, fd);
    }

    submitText(taskId: string, respuesta_texto: string, storage_key?: string, nombre_archivo?: string) {
        const payload: Record<string, unknown> = {};
        if (respuesta_texto) payload['respuesta_texto'] = respuesta_texto;
        if (storage_key) payload['storage_key'] = storage_key;
        if (nombre_archivo) payload['nombre_archivo'] = nombre_archivo;
        return this.api.post<Submission>(`tasks/${taskId}/submit`, payload);
    }

    submitAlternativas(taskId: string, respuestas: Pick<RespuestaAlternativa, 'pregunta_id' | 'opcion_id'>[]) {
        return this.api.post<{ submission: Submission; calificacion_auto: number }>(
            `tasks/${taskId}/submit-alternativas`,
            { respuestas },
        );
    }
}