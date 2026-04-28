import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { DatePipe, UpperCasePipe, Location } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth';
import { CourseService } from '../../stores/course';
import { ApiService } from '../../../../core/services/api';
import { Course, Material } from '../../../../core/models/course';
import { Task, Submission } from '../../../../core/models/task';
import { Exam } from '../../../../core/models/exam';
import { Forum } from '../../../../core/models/forum';
import { MaterialUpload } from '../../material-upload/material-upload/material-upload';
import { MaterialEdit } from '../../material-edit/material-edit';
import { MaterialPreview } from '../../material-preview/material-preview';
import { TaskCreate } from '../../../tasks/task-create/task-create';
import { ExamCreate } from '../../../exams/exam-create/exam-create/exam-create';
import { ForumCreate } from '../../../forum/forum-create/forum-create';
import { TaskSubmissionsPane } from '../../../tasks/task-submissions-pane/task-submissions-pane';
import { MySubmissionView } from '../../../tasks/my-submission-view/my-submission-view';

interface MaterialGroup {
  bimestre: number | null;
  semana: number | null;
  label: string;
  materials: Material[];
}

@Component({
  selector: 'app-course-detail',
  imports: [
    MatCardModule, MatIconModule, MatButtonModule, MatTabsModule,
    MatChipsModule, MatDividerModule, MatExpansionModule,
    MatFormFieldModule, MatInputModule, MatMenuModule, MatTooltipModule,
    UpperCasePipe, DatePipe, RouterLink, FormsModule,
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
  private snack = inject(MatSnackBar);

  course = signal<Course | null>(null);
  materials = signal<Material[]>([]);
  tasks = signal<Task[]>([]);
  exams = signal<Exam[]>([]);
  forums = signal<Forum[]>([]);
  submissionByTask = signal<Record<string, Submission>>({});

  loadingMaterials = signal(true);
  loadingTasks = signal(true);
  loadingExams = signal(true);
  loadingForums = signal(true);

  searchTerm = signal('');
  filtroBimestre = signal<number | 'todos'>('todos');

  courseId = '';

  readonly materialIcons: Record<string, string> = {
    pdf: 'picture_as_pdf', video: 'smart_display',
    link: 'link', grabacion: 'videocam', otro: 'attach_file',
  };

  readonly materialColors: Record<string, string> = {
    pdf: '#dc2626', video: '#2563eb',
    link: '#16a34a', grabacion: '#9333ea', otro: '#4b5563',
  };

  /** Materiales filtrados por buscador y bimestre. */
  filteredMaterials = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const bim = this.filtroBimestre();
    return this.materials().filter(m => {
      if (bim !== 'todos' && (m.bimestre ?? 0) !== bim) return false;
      if (!term) return true;
      const haystack = `${m.titulo} ${m.descripcion ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  });

  /** Materiales agrupados por (bimestre, semana). */
  groupedMaterials = computed<MaterialGroup[]>(() => {
    const groups = new Map<string, MaterialGroup>();
    for (const m of this.filteredMaterials()) {
      const key = `${m.bimestre ?? 'x'}-${m.semana ?? 'x'}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          bimestre: m.bimestre ?? null,
          semana: m.semana ?? null,
          label: this.buildGroupLabel(m.bimestre ?? null, m.semana ?? null),
          materials: [],
        };
        groups.set(key, g);
      }
      g.materials.push(m);
    }
    return [...groups.values()].sort((a, b) => {
      const ab = a.bimestre ?? 99;
      const bb = b.bimestre ?? 99;
      if (ab !== bb) return ab - bb;
      const as = a.semana ?? 99;
      const bs = b.semana ?? 99;
      return as - bs;
    });
  });

  bimestresDisponibles = computed(() => {
    const set = new Set<number>();
    for (const m of this.materials()) if (m.bimestre) set.add(m.bimestre);
    return [...set].sort((a, b) => a - b);
  });

  readonly semanasRange = Array.from({ length: 16 }, (_, i) => i + 1);

  /** Map de semana -> materiales para la vista de Contenido. */
  materialsPorSemana = computed(() => {
    const map = new Map<number, Material[]>();
    for (const m of this.materials()) {
      const s = m.semana ?? 0;
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(m);
    }
    return map;
  });

  materialesEnSemana(n: number): Material[] {
    return this.materialsPorSemana().get(n) ?? [];
  }

  bimestreDeSemana(n: number): number {
    return Math.ceil(n / 4);
  }

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
      next: res => {
        const byId = new Map<string, Task>();
        for (const t of res.data) if (!byId.has(t.id)) byId.set(t.id, t);
        this.tasks.set([...byId.values()]);
        this.loadingTasks.set(false);
        if (this.auth.isAlumno()) this.loadMySubmissions();
      },
      error: () => { this.tasks.set([]); this.loadingTasks.set(false); }
    });
  }

  private loadMySubmissions() {
    this.api.get<Submission[]>('my-submissions').subscribe({
      next: res => {
        const map: Record<string, Submission> = {};
        for (const s of res.data ?? []) map[s.tarea_id] = s;
        this.submissionByTask.set(map);
      },
      error: () => this.submissionByTask.set({}),
    });
  }

  miEntrega(t: Task): Submission | undefined {
    return this.submissionByTask()[t.id];
  }

  estadoAlumno(t: Task): 'pendiente' | 'vencida' | 'entregada' | 'calificada' {
    const s = this.miEntrega(t);
    if (s) return s.calificacion_final != null ? 'calificada' : 'entregada';
    return this.isPending(t.fecha_limite) ? 'pendiente' : 'vencida';
  }

  estadoLabel(t: Task): string {
    switch (this.estadoAlumno(t)) {
      case 'calificada':
        return `Calificada ${this.miEntrega(t)!.calificacion_final}/${t.puntos_max}`;
      case 'entregada': return 'Entregada';
      case 'pendiente': return 'Pendiente';
      case 'vencida': return 'Vencida';
    }
  }

  abrirEntregasDocente(t: Task) {
    this.dialog.open(TaskSubmissionsPane, {
      data: { task: { ...t, curso: this.course()?.nombre } },
      width: '92vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh',
      position: { right: '0', top: '0' },
      panelClass: 'material-preview-pane',
      enterAnimationDuration: 0, exitAnimationDuration: 0,
    });
  }

  abrirMiEntrega(t: Task) {
    const ref = this.dialog.open(MySubmissionView, {
      data: {
        task: { ...t, curso: this.course()?.nombre },
        submission: this.miEntrega(t) ?? null,
      },
      width: '92vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh',
      position: { right: '0', top: '0' },
      panelClass: 'material-preview-pane',
      enterAnimationDuration: 0, exitAnimationDuration: 0,
    });
    ref.afterClosed().subscribe(() => this.loadMySubmissions());
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
      data: this.courseId, width: '560px', maxHeight: '90vh',
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.loadMaterials();
    });
  }

  openEditDialog(material: Material) {
    const ref = this.dialog.open(MaterialEdit, {
      data: { courseId: this.courseId, material },
      width: '560px', maxHeight: '90vh',
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.loadMaterials();
    });
  }

  confirmDelete(material: Material) {
    const ok = window.confirm(`¿Eliminar "${material.titulo}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    this.csSvc.deleteMaterial(this.courseId, material.id).subscribe({
      next: () => {
        this.snack.open('Material eliminado', 'OK', { duration: 3000 });
        this.materials.update(list => list.filter(m => m.id !== material.id));
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'No se pudo eliminar';
        this.snack.open(msg, 'Cerrar', { duration: 4000 });
      },
    });
  }

  descargar(material: Material) {
    this.csSvc.getMaterialDownload(this.courseId, material.id).subscribe({
      next: res => window.open(res.data.url, '_blank'),
      error: () => window.open(material.url, '_blank'),
    });
  }

  abrir(material: Material) {
    window.open(material.url, '_blank');
  }

  abrirPreview(material: Material) {
    this.dialog.open(MaterialPreview, {
      data: { courseId: this.courseId, material },
      width: '92vw',
      maxWidth: '100vw',
      height: '100vh',
      maxHeight: '100vh',
      position: { right: '0', top: '0' },
      panelClass: 'material-preview-pane',
      enterAnimationDuration: 0,
      exitAnimationDuration: 0,
    });
  }

  esNuevo(material: Material): boolean {
    if (!material.created_at) return false;
    const days = (Date.now() - new Date(material.created_at).getTime()) / 86_400_000;
    return days <= 7;
  }

  formatSize(bytes?: number | null): string {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  esArchivo(material: Material): boolean {
    if (material.storage_key) return true;
    return !!(material.url && !material.url.startsWith('http'));
  }

  openCreateTask() {
    const ref = this.dialog.open(TaskCreate, { data: this.courseId, width: '500px' });
    ref.afterClosed().subscribe(r => { if (r) this.loadTasks(); });
  }

  openCreateExam() {
    const ref = this.dialog.open(ExamCreate, {
      data: this.courseId, width: '620px', maxHeight: '90vh',
    });
    ref.afterClosed().subscribe(r => { if (r) this.loadExams(); });
  }

  openCreateForum() {
    const ref = this.dialog.open(ForumCreate, { data: this.courseId, width: '500px' });
    ref.afterClosed().subscribe(r => { if (r) this.loadForums(); });
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

  private buildGroupLabel(bimestre: number | null, semana: number | null): string {
    if (bimestre == null && semana == null) return 'Sin clasificar';
    const parts: string[] = [];
    if (bimestre != null) parts.push(`Bimestre ${bimestre}`);
    if (semana != null) parts.push(`Semana ${semana}`);
    return parts.join(' · ');
  }
}
