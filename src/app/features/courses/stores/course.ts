import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from '../../../core/services/api';
import { Course, Material, MaterialDownload, MaterialPreviewInfo } from '../../../core/models/course';

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

  addMaterial(courseId: string, body: Partial<Material>) {
    return this.api.post<Material>(`courses/${courseId}/materials`, body);
  }

  addMaterialFile(courseId: string, formData: FormData) {
    return this.api.postForm<Material>(`courses/${courseId}/materials`, formData);
  }

  updateMaterial(courseId: string, materialId: string, body: Partial<Material>) {
    return this.api.patch<Material>(`courses/${courseId}/materials/${materialId}`, body);
  }

  deleteMaterial(courseId: string, materialId: string) {
    return this.api.delete<{ message: string }>(`courses/${courseId}/materials/${materialId}`);
  }

  getMaterialDownload(courseId: string, materialId: string) {
    return this.api.get<MaterialDownload>(`courses/${courseId}/materials/${materialId}/download`);
  }

  getMaterialPreview(courseId: string, materialId: string) {
    return this.api.get<MaterialPreviewInfo>(`courses/${courseId}/materials/${materialId}/preview`);
  }
}
