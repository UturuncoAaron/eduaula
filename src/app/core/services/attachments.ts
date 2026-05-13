import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response';

// Backend enforces the same set via a CHECK on attachments.owner_type.
// 'message' fue eliminado al sacar el módulo de mensajería.
export type AttachmentOwnerType = 'forum_post' | 'announcement';

export interface AttachmentDto {
  id: string;
  owner_type: AttachmentOwnerType;
  owner_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
  preview_url: string | null;
  download_url: string;
}

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class AttachmentsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /** Sube 1 archivo asociado a un owner (forum_post, message, announcement). */
  upload(file: File, owner_type: AttachmentOwnerType, owner_id: string): Observable<AttachmentDto | null> {
    if (file.size > ATTACHMENT_MAX_BYTES) return of(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('owner_type', owner_type);
    fd.append('owner_id', owner_id);
    return this.http.post<ApiResponse<AttachmentDto>>(`${this.base}/attachments`, fd).pipe(
      map(r => r.data),
      catchError(() => of(null)),
    );
  }

  list(owner_type: AttachmentOwnerType, owner_id: string): Observable<AttachmentDto[]> {
    return this.http
      .get<ApiResponse<AttachmentDto[]>>(`${this.base}/attachments?owner_type=${owner_type}&owner_id=${owner_id}`)
      .pipe(map(r => r.data ?? []), catchError(() => of([])));
  }

  remove(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/attachments/${id}`).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }
}
