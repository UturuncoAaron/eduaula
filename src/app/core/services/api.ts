import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly base = environment.apiUrl;

  get<T>(path: string, params?: Record<string, string>): Observable<ApiResponse<T>> {
    let p = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => p = p.set(k, v));
    return this.http.get<ApiResponse<T>>(`${this.base}/${path}`, { params: p });
  }

  post<T>(path: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.base}/${path}`, body);
  }

  put<T>(path: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(`${this.base}/${path}`, body);
  }

  patch<T>(path: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.patch<ApiResponse<T>>(`${this.base}/${path}`, body);
  }

  delete<T>(path: string): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(`${this.base}/${path}`);
  }

  postForm<T>(path: string, body: FormData): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.base}/${path}`, body);
  }
}