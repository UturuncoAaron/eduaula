import { Component, inject, input, signal, computed, OnInit } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from 'ngx-toastr-notifier';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../core/auth/auth';
import { CourseService } from '../../../stores/course';
import { Material } from '../../../../../core/models/course';
import { RouterLink } from '@angular/router';

interface MaterialGroup {
  bimestre: number | null;
  semana: number | null;
  label: string;
  materials: Material[];
}

@Component({
  selector: 'app-tab-materiales',
  imports: [
    FormsModule,
    MatIconModule, MatButtonModule, MatExpansionModule,
    MatFormFieldModule, MatInputModule, MatChipsModule,
    MatMenuModule, MatTooltipModule, DatePipe, UpperCasePipe,
  ],
  templateUrl: './tab-materiales.html',
  styleUrl: './tab-materiales.scss',
})
export class TabMateriales implements OnInit {
  readonly auth = inject(AuthService);
  private csSvc = inject(CourseService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastService);

  courseId = input.required<string>();

  materials = signal<Material[]>([]);
  loadingMaterials = signal(true);
  searchTerm = signal('');
  filtroBimestre = signal<number | 'todos'>('todos');

  readonly materialIcons: Record<string, string> = {
    pdf: 'picture_as_pdf', video: 'smart_display',
    link: 'link', grabacion: 'videocam', otro: 'attach_file',
  };
  readonly materialColors: Record<string, string> = {
    pdf: '#dc2626', video: '#2563eb',
    link: '#16a34a', grabacion: '#9333ea', otro: '#4b5563',
  };

  filteredMaterials = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const bim = this.filtroBimestre();
    return this.materials().filter(m => {
      if (bim !== 'todos' && (m.bimestre ?? 0) !== bim) return false;
      if (!term) return true;
      return `${m.titulo} ${m.descripcion ?? ''}`.toLowerCase().includes(term);
    });
  });

  groupedMaterials = computed<MaterialGroup[]>(() => {
    const groups = new Map<string, MaterialGroup>();
    for (const m of this.filteredMaterials()) {
      const key = `${m.bimestre ?? 'x'}-${m.semana ?? 'x'}`;
      if (!groups.has(key)) {
        groups.set(key, {
          bimestre: m.bimestre ?? null,
          semana: m.semana ?? null,
          label: this.buildLabel(m.bimestre ?? null, m.semana ?? null),
          materials: [],
        });
      }
      groups.get(key)!.materials.push(m);
    }
    return [...groups.values()].sort((a, b) => {
      const ab = a.bimestre ?? 99, bb = b.bimestre ?? 99;
      if (ab !== bb) return ab - bb;
      return (a.semana ?? 99) - (b.semana ?? 99);
    });
  });

  bimestresDisponibles = computed(() => {
    const set = new Set<number>();
    this.materials().forEach(m => { if (m.bimestre) set.add(m.bimestre); });
    return [...set].sort((a, b) => a - b);
  });

  ngOnInit() { this.loadMaterials(); }

  loadMaterials() {
    this.loadingMaterials.set(true);
    this.csSvc.getMaterials(this.courseId()).subscribe({
      next: r => { this.materials.set(r.data ?? []); this.loadingMaterials.set(false); },
      error: () => { this.materials.set([]); this.loadingMaterials.set(false); },
    });
  }

  private buildLabel(b: number | null, s: number | null): string {
    if (!b && !s) return 'Sin clasificar';
    const parts: string[] = [];
    if (b) parts.push(`Bimestre ${b}`);
    if (s) parts.push(`Semana ${s}`);
    return parts.join(' · ');
  }

  esNuevo(m: Material): boolean {
    return (Date.now() - new Date(m.created_at).getTime()) / 86_400_000 <= 7;
  }

  formatSize(bytes?: number | null): string {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  esArchivo(m: Material): boolean {
    return !!(m.storage_key || (m.url && !m.url.startsWith('http')));
  }

  async abrirPreview(m: Material) {
    const { MaterialPreview } = await import(
      '../../../material-preview/material-preview'
    );
    this.dialog.open(MaterialPreview, {
      data: { courseId: this.courseId(), material: m },
      width: '92vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh',
      position: { right: '0', top: '0' },
      panelClass: 'material-preview-pane',
      enterAnimationDuration: 0, exitAnimationDuration: 0,
    });
    this.markVisto(m.id);
  }

  descargar(m: Material) {
    this.csSvc.getMaterialDownload(this.courseId(), m.id).subscribe({
      next: r => { window.open(r.data.url, '_blank'); this.markVisto(m.id); },
      error: () => window.open(m.url, '_blank'),
    });
  }

  private markVisto(id: string) {
    if (!this.auth.isAlumno()) return;
    if (this.materials().find(m => m.id === id)?.visto) return;
    this.csSvc.markMaterialViewed(this.courseId(), id).subscribe({
      next: () => this.materials.update(list =>
        list.map(m => m.id === id ? { ...m, visto: true } : m)
      ),
      error: () => { },
    });
  }

  async openUploadDialog() {
    const { MaterialUpload } = await import(
      '../../../material-upload/material-upload/material-upload'
    );
    const ref = this.dialog.open(MaterialUpload, {
      data: this.courseId(), width: '560px', maxHeight: '90vh',
    });
    ref.afterClosed().subscribe(r => { if (r) this.loadMaterials(); });
  }

  async openEditDialog(m: Material) {
    const { MaterialEdit } = await import('../../../material-edit/material-edit');
    const ref = this.dialog.open(MaterialEdit, {
      data: { courseId: this.courseId(), material: m },
      width: '560px', maxHeight: '90vh',
    });
    ref.afterClosed().subscribe(r => { if (r) this.loadMaterials(); });
  }

  confirmDelete(m: Material) {
    if (!confirm(`¿Eliminar "${m.titulo}"?`)) return;
    this.csSvc.deleteMaterial(this.courseId(), m.id).subscribe({
      next: () => {
        this.materials.update(list => list.filter(x => x.id !== m.id));
        this.toastr.success('Material eliminado', 'Error');
      },
      error: err => this.toastr.error(err?.error?.message ?? 'Error', 'Error'),
    });
  }
}