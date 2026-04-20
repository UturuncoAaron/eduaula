import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, UpperCasePipe, Location } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../../core/auth/auth';
import { CourseService } from '../../stores/course';
import { ApiService } from '../../../../core/services/api';
import { Course, Material } from '../../../../core/models/course';
import { Task } from '../../../../core/models/task';
import { Exam } from '../../../../core/models/exam';
import { MaterialUpload } from '../../material-upload/material-upload/material-upload';
import { TaskCreate } from '../../../tasks/task-create/task-create';
import { ExamCreate } from '../../../exams/exam-create/exam-create/exam-create';
import { ForumCreate } from '../../../forum/forum-create/forum-create';
import { Router } from '@angular/router';
import { Forum } from '../../../../core/models/forum';


@Component({
  selector: 'app-course-detail',
  imports: [
    MatCardModule, MatIconModule, MatButtonModule, MatTabsModule,
    MatChipsModule, MatDividerModule, UpperCasePipe, DatePipe, RouterLink,
  ],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss'
})
export class CourseDetail implements OnInit {
  readonly auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private csSvc = inject(CourseService);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private location = inject(Location);
  private router = inject(Router);

  course = signal<Course | null>(null);
  materials = signal<Material[]>([]);
  tasks = signal<Task[]>([]);
  exams = signal<Exam[]>([]);
  forums = signal<Forum[]>([]);
  loadingForums = signal(true);

  loadingMaterials = signal(true);
  loadingTasks = signal(true);
  loadingExams = signal(true);

  courseId = '';

  readonly materialIcons: Record<string, string> = {
    pdf: 'picture_as_pdf', video: 'smart_display',
    link: 'link', grabacion: 'videocam', otro: 'attach_file',
  };

  readonly materialColors: Record<string, string> = {
    pdf: '#dc2626', video: '#2563eb',
    link: '#16a34a', grabacion: '#9333ea', otro: '#4b5563',
  };

  ngOnInit() {
    this.courseId = this.route.snapshot.paramMap.get('id')!;
    this.loadCourse();
    this.loadMaterials();
    this.loadTasks();
    this.loadExams();
    this.loadForums();
  }

  loadCourse() {
    this.csSvc.getCourse(this.courseId).subscribe({
      next: res => this.course.set(res.data),
      error: () => this.course.set({
        id: this.courseId, nombre: 'Matemáticas',
        descripcion: 'Curso de álgebra y geometría',
        docente_id: '', seccion_id: 1, periodo_id: 1, activo: true,
      })
    });
  }

  loadMaterials() {
    this.loadingMaterials.set(true);
    this.csSvc.getMaterials(this.courseId).subscribe({
      next: res => { this.materials.set(res.data); this.loadingMaterials.set(false); },
      error: () => { this.materials.set([]); this.loadingMaterials.set(false); }
    });
  }

  loadTasks() {
    this.loadingTasks.set(true);
    this.api.get<Task[]>(`courses/${this.courseId}/tasks`).subscribe({
      next: res => { this.tasks.set(res.data); this.loadingTasks.set(false); },
      error: () => { this.tasks.set([]); this.loadingTasks.set(false); }
    });
  }

  loadExams() {
    this.loadingExams.set(true);
    this.api.get<Exam[]>(`courses/${this.courseId}/exams`).subscribe({
      next: res => { this.exams.set(res.data); this.loadingExams.set(false); },
      error: () => { this.exams.set([]); this.loadingExams.set(false); }
    });
  }
  loadForums() {
    this.loadingForums.set(true);
    this.api.get<Forum[]>(`courses/${this.courseId}/forums`).subscribe({
      next: res => { this.forums.set(res.data); this.loadingForums.set(false); },
      error: () => { this.forums.set([]); this.loadingForums.set(false); }
    });
  }

  openUploadDialog() {
    const ref = this.dialog.open(MaterialUpload, {
      data: this.courseId, width: '500px',
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.loadMaterials();
    });
  }

  openCreateTask() {
    const ref = this.dialog.open(TaskCreate, {
      data: this.courseId, width: '500px',
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.loadTasks();
    });
  }

  openCreateExam() {
    const ref = this.dialog.open(ExamCreate, {
      data: this.courseId,
      width: '620px',
      maxHeight: '90vh',
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.loadExams();
    });
  }



  openCreateForum() {
    const ref = this.dialog.open(ForumCreate, {
      data: this.courseId,
      width: '500px',
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.loadForums();
    });
  }

  isPending(fecha: string): boolean {
    return new Date(fecha) > new Date();
  }

  openMaterial(url: string) {
    window.open(url, '_blank');
  }

  goBack() {
    this.location.back();
  }
}