import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from '../../../core/services/api';
import { Course, Material } from '../../../core/models/course';

@Injectable({ providedIn: 'root' })
export class CourseService {
  private api = inject(ApiService);

  courses = signal<Course[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  loadMyCourses() {
    this.loading.set(true);
    this.error.set(null);

    return this.api.get<Course[]>('courses').pipe(
      tap({
        next: (res) => {
          this.courses.set(res.data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Error al cargar cursos');
          this.loading.set(false);
        }
      })
    );
  }

  getCourse(id: string) {
    return this.api.get<Course>(`courses/${id}`);
  }

  getMaterials(courseId: string) {
    return this.api.get<Material[]>(`courses/${courseId}/materials`);
  }

  uploadMaterial(courseId: string, data: Partial<Material>) {
    return this.api.post<Material>(`courses/${courseId}/materials`, data);
  }

  addMaterial(id: string, d: Partial<Material>) {
    return this.api.post<Material>(`courses/${id}/materials`, d);
  }

  deleteMaterial(materialId: string) {
    return this.api.delete<void>(`materials/${materialId}`);
  }
}