import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, tap } from 'rxjs/operators';
import { User, LoginPayload, LoginResponse } from '../models/user';
import { environment } from '../../../environments/environment';
import { throwError } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = environment.apiUrl;

  private _user = signal<User | null>(this.loadUser());
  private _token = signal<string | null>(localStorage.getItem('token'));

  readonly currentUser = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());
  readonly isAlumno = computed(() => this._user()?.rol === 'alumno');
  readonly isDocente = computed(() => this._user()?.rol === 'docente');
  readonly isAdmin = computed(() => this._user()?.rol === 'admin');
  readonly isPadre = computed(() => this._user()?.rol === 'padre');
  readonly fullName = computed(() => {
    const u = this._user();
    return u ? `${u.nombre} ${u.apellido_paterno}` : '';
  });
  readonly avatarInitials = computed(() => {
    const u = this._user();
    return u ? `${u.nombre[0]}${u.apellido_paterno[0]}`.toUpperCase() : '?';
  });

  login(payload: LoginPayload) {
    return this.http.post<LoginResponse>(`${this.api}/auth/login`, payload).pipe(
      tap(res => {
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        this._token.set(token);
        this._user.set(user);
      }),
      catchError(err => {
        const msg = err.error?.message || 'Error al conectar con el servidor';
        return throwError(() => msg);
      })
    );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/auth/login']);
  }

  private loadUser(): User | null {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }
}