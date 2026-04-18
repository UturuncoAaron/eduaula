import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UpperCasePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../../core/auth/auth';
import { CourseService } from '../../stores/course';
import { Course, Material } from '../../../../core/models/course';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [
    MatCardModule, MatIconModule, MatButtonModule, MatTabsModule,
    MatChipsModule, MatProgressSpinnerModule, MatDividerModule,
    RouterLink, UpperCasePipe,
  ],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss'
})
export class CourseDetailComponent implements OnInit {
  readonly auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private csSvc = inject(CourseService);

  course = signal<Course | null>(null);
  materials = signal<Material[]>([]);
  loading = signal(true);

  readonly materialIcons: Record<string, string> = {
    pdf: 'picture_as_pdf', video: 'smart_display',
    link: 'link', grabacion: 'videocam', otro: 'attach_file',
  };

  readonly materialColors: Record<string, string> = {
    pdf: '#C62828', video: '#1565C0',
    link: '#2E7D32', grabacion: '#6A1B9A', otro: '#555',
  };

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;

    this.csSvc.getCourse(id).subscribe({
      next: res => this.course.set(res.data),
      error: () => this.course.set({
        id, nombre: 'Matemáticas', descripcion: '3ro de Secundaria',
        docente_id: '', seccion_id: 1, periodo_id: 1, activo: true,
      })
    });

    this.csSvc.getMaterials(id).subscribe({
      next: res => { this.materials.set(res.data); this.loading.set(false); },
      error: () => {
        this.materials.set([
          { id: '1', curso_id: id, titulo: 'Semana 1 — Introducción', tipo: 'pdf', url: 'https://cloudinary.com/...', orden: 1, created_at: new Date().toISOString() },
          { id: '2', curso_id: id, titulo: 'Grabación clase 05/04', tipo: 'grabacion', url: 'https://youtube.com/...', orden: 2, created_at: new Date().toISOString() },
          { id: '3', curso_id: id, titulo: 'Recursos adicionales', tipo: 'link', url: 'https://khan.academy', orden: 3, created_at: new Date().toISOString() },
        ]);
        this.loading.set(false);
      }
    });
  }

  openMaterial(url: string) { window.open(url, '_blank'); }
}