import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'app-dashboard-redirect',
  template: '',
})
export class DashboardRedirect implements OnInit {
  private auth = inject(Auth);
  private router = inject(Router);

  ngOnInit() {
    const role = this.auth.currentUser()?.role;
    const map: Record<string, string> = {
      alumno: '/dashboard/alumno',
      docente: '/dashboard/docente',
      admin: '/dashboard/admin',
      padre: '/dashboard/padre',
    };
    this.router.navigate([map[role ?? ''] ?? '/auth/login']);
  }
}