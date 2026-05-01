import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import {
  User, LoginPayload, LoginResponse, ChangePasswordPayload,
} from '../models/user';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = environment.apiUrl;

  private _user = signal<User | null>(this.loadUser());
  private _token = signal<string | null>(localStorage.getItem('token'));
  private _passwordChanged = signal<boolean>(this.loadPasswordChanged());

  // ── Readonly signals ──────────────────────────────────────────
  readonly currentUser = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly passwordChanged = this._passwordChanged.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());
  readonly isAlumno = computed(() => this._user()?.rol === 'alumno');
  readonly isDocente = computed(() => this._user()?.rol === 'docente');
  readonly isAdmin = computed(() => this._user()?.rol === 'admin');
  readonly isPadre = computed(() => this._user()?.rol === 'padre');
  readonly isPsicologa = computed(() => this._user()?.rol === 'psicologa');
  readonly needsPasswordChange = computed(() => !this._passwordChanged());

  readonly fullName = computed(() => {
    const u = this._user();
    return u ? `${u.nombre} ${u.apellido_paterno}` : '';
  });

  readonly avatarInitials = computed(() => {
    const u = this._user();
    return u ? `${u.nombre[0]}${u.apellido_paterno[0]}`.toUpperCase() : '?';
  });

  // ── Login ─────────────────────────────────────────────────────
  login(payload: LoginPayload) {
    return this.http.post<LoginResponse>(`${this.api}/auth/login`, payload).pipe(
      tap(res => {
        const { token, user, password_changed } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('password_changed', String(password_changed));
        this._token.set(token);
        this._user.set(user);
        this._passwordChanged.set(password_changed);
      }),
      catchError(err => {
        const body = err.error;
        const msg =
          (typeof body?.message === 'object'
            ? body?.message?.message
            : body?.message)
          ?? 'Error al conectar con el servidor';
        return throwError(() => msg);
      }),
    );
  }

  // ── Cambiar contraseña ────────────────────────────────────────
  changePassword(payload: ChangePasswordPayload) {
    return this.http
      .patch<{ success: boolean; data: { message: string } }>(
        `${this.api}/auth/change-password`,
        payload,
      )
      .pipe(
        tap(() => {
          // Marcar como cambiada en memoria y localStorage
          localStorage.setItem('password_changed', 'true');
          this._passwordChanged.set(true);

          // Actualizar el user en localStorage también
          const user = this._user();
          if (user) {
            const updated = { ...user, password_changed: true };
            localStorage.setItem('user', JSON.stringify(updated));
            this._user.set(updated);
          }
        }),
        catchError(err => {
          const body = err.error;
          const msg =
            (typeof body?.message === 'object'
              ? body?.message?.message
              : body?.message)
            ?? 'Error al cambiar la contraseña';
          return throwError(() => msg);
        }),
      );
  }

  // ── Logout ────────────────────────────────────────────────────
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('password_changed');
    this._token.set(null);
    this._user.set(null);
    this._passwordChanged.set(false);
    this.router.navigate(['/auth/login']);
  }

  // ── Helpers privados ──────────────────────────────────────────
  private loadUser(): User | null {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }

  private loadPasswordChanged(): boolean {
    return localStorage.getItem('password_changed') === 'true';
  }
}