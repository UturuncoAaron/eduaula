import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth';

@Component({ selector: 'app-dashboard-redirect', standalone: true, template: '' })
export class DashboardRedirect implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit() {
    const map: Record<string, string> = {
      alumno: '/dashboard/alumno',
      docente: '/dashboard/docente',
      admin: '/dashboard/admin',
      padre: '/dashboard/padre',
      psicologa: '/dashboard/psicologa',
    };
    const rol = this.auth.currentUser()?.rol ?? '';
    this.router.navigate([map[rol] ?? '/auth/login']);
  }
}