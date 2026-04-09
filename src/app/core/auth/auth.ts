import { Injectable, signal } from '@angular/core';

export interface CurrentUser {
  id: string;
  name: string;
  role: 'alumno' | 'docente' | 'admin' | 'padre';
  token: string;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private user = signal<CurrentUser | null>(null);

  currentUser() {
    return this.user();
  }

  isAuthenticated(): boolean {
    return this.user() !== null;
  }

  login(userData: CurrentUser) {
    this.user.set(userData);
  }

  logout() {
    this.user.set(null);
  }
}