import { Component, inject, signal, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth';

interface AuxiliarStats {
  asistencias: number;
  tardanzas: number;
  total: number;
}

@Component({
  selector: 'app-auxiliar-dashboard',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './auxiliar-dashboard.html',
  styleUrl: './auxiliar-dashboard.scss',
})
export class AuxiliarDashboard implements OnInit {
  readonly auth = inject(AuthService);

  stats = signal<AuxiliarStats>({ asistencias: 0, tardanzas: 0, total: 0 });
  loading = signal(true);

  ngOnInit() {
    // TODO: reemplazar por endpoint real cuando exista
    // this.api.get<any>('asistencias/general/stats-hoy').subscribe({
    //   next: res => {
    //     const body = res?.data ?? res ?? {};
    //     this.stats.set({
    //       asistencias: body.asistencias ?? 0,
    //       tardanzas:   body.tardanzas   ?? 0,
    //       total:       body.total       ?? 0,
    //     });
    //     this.loading.set(false);
    //   },
    //   error: () => this.loading.set(false),
    // });
    this.loading.set(false);
  }
}