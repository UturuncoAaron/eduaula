import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../../core/auth/auth';
import { CourseService } from '../../stores/course';
import { Course } from '../../../../core/models/course';

import { TabContenido } from '../tabs/tab-contenido/tab-contenido';

@Component({
  selector: 'app-course-detail',
  imports: [
    MatIconModule, MatButtonModule,
    TabContenido,
  ],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss',
})
export class CourseDetail implements OnInit {
  readonly auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private csSvc = inject(CourseService);
  private location = inject(Location);

  course = signal<Course | null>(null);
  courseId = '';

  ngOnInit() {
    this.courseId = this.route.snapshot.paramMap.get('id')!;
    this.loadCourse();
  }

  loadCourse() {
    this.csSvc.getCourse(this.courseId).subscribe({
      next: res => this.course.set(res.data),
      error: () => { },
    });
  }

  iniciales(d?: { nombre?: string; apellido_paterno?: string } | null): string {
    if (!d) return 'D';
    return ((d.nombre?.[0] ?? '') + (d.apellido_paterno?.[0] ?? '')).toUpperCase() || 'D';
  }

  goBack() { this.location.back(); }
}
