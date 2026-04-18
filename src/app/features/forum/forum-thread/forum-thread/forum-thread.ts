import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago-pipe';

interface ThreadPost {
  id: string;
  usuario: string;
  rol: string;
  contenido: string;
  created_at: string;
}

@Component({
  selector: 'app-forum-thread',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatCardModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatIconModule,
    MatSnackBarModule, PageHeader, TimeAgoPipe,
  ],
  templateUrl: './forum-thread.html',
  styleUrl: './forum-thread.scss',
})
export class ForumThread implements OnInit {
  readonly auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  threadId = this.route.snapshot.paramMap.get('id')!;
  posts = signal<ThreadPost[]>([]);
  form = this.fb.group({
    contenido: ['', [Validators.required, Validators.minLength(5)]],
  });

  ngOnInit() { this.loadPosts(); }

  loadPosts() {
    this.api.get<ThreadPost[]>(`forum/${this.threadId}/posts`).subscribe({
      next: r => this.posts.set(r.data),
      error: () => this.posts.set([
        { id: '1', usuario: 'García, Carlos', rol: 'alumno', contenido: '¿Cómo resuelvo el ejercicio 5? No entiendo la fórmula que debemos aplicar.', created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: '2', usuario: 'Prof. Quispe', rol: 'docente', contenido: 'Para resolver el ejercicio 5 debes aplicar la fórmula del área del triángulo. Primero identifica la base y la altura del triángulo en el gráfico, luego aplica A = (b × h) / 2.', created_at: new Date(Date.now() - 1800000).toISOString() },
      ]),
    });
  }

  reply() {
    if (this.form.invalid) return;
    this.api.post(`forum/${this.threadId}/posts`, this.form.value).subscribe({
      next: () => {
        this.snack.open('Respuesta publicada', 'OK', { duration: 2000 });
        this.form.reset();
        this.loadPosts();
      },
      error: () => this.snack.open('Error al publicar', 'OK', { duration: 2000 }),
    });
  }
}