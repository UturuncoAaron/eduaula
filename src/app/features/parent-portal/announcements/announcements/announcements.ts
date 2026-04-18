import { Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../../core/services/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago-pipe';

interface Announcement {
  id: string;
  titulo: string;
  contenido: string;
  destinatario: string;
  created_at: string;
}

@Component({
  selector: 'app-announcements',
  standalone: true,
  imports: [MatCardModule, MatIconModule, PageHeader, EmptyState, TimeAgoPipe],
  templateUrl: './announcements.html',
  styleUrl: './announcements.scss',
})
export class Announcements implements OnInit {
  private api = inject(ApiService);
  items = signal<Announcement[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.get<Announcement[]>('announcements').subscribe({
      next: r => { this.items.set(r.data); this.loading.set(false); },
      error: () => {
        this.items.set([
          { id: '1', titulo: 'Inicio del segundo bimestre', contenido: 'El segundo bimestre inicia el lunes 5 de mayo. Los alumnos deben presentar sus materiales completos el primer día de clases.', destinatario: 'todos', created_at: new Date().toISOString() },
          { id: '2', titulo: 'Reunión de padres de familia', contenido: 'Se convoca a todos los padres a la reunión del viernes 18 de abril a las 4pm en el auditorio del colegio. Asistencia obligatoria.', destinatario: 'padres', created_at: new Date(Date.now() - 86400000).toISOString() },
        ]);
        this.loading.set(false);
      },
    });
  }
}