import {
  ChangeDetectionStrategy, Component, computed, DestroyRef,
  inject, input, OnInit, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastService } from 'ngx-toastr-notifier';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../core/auth/auth';
import { BimestreFilterService } from '@core/models/bimestre-filter';
import { CourseService } from '../data-access/course.store';
import { LazyCourseStore } from '../data-access/lazy-course.store';
import { RecordedClass } from '../../../core/models/course';

@Component({
  selector: 'app-recorded-classes',
  standalone: true,
  imports: [
    DatePipe, MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatMenuModule, MatTooltipModule,
  ],
  templateUrl: './recorded-classes.html',
  styleUrl: './recorded-classes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordedClasses implements OnInit {
  readonly auth = inject(AuthService);
  readonly bimFiltro = inject(BimestreFilterService);
  private readonly store = inject(LazyCourseStore);
  private readonly csSvc = inject(CourseService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toastr = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  courseId = input.required<string>({ alias: 'id' });

  readonly grabadas = signal<RecordedClass[] | null>(null);
  readonly loading = signal(true);
  readonly selected = signal<RecordedClass | null>(null);

  readonly grabadasFiltradas = computed(() => {
    const all = this.grabadas() ?? [];
    if (this.auth.isAlumno() || this.auth.isPadre?.()) {
      return all.filter(g => !g.oculto);
    }
    return all;
  });

  readonly embedUrl = computed<SafeResourceUrl | null>(() => {
    const sel = this.selected();
    if (!sel) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(sel.embed_url);
  });

  ngOnInit(): void {
    this.store.recordedClasses$(this.courseId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(list => {
        this.grabadas.set(list);
        this.loading.set(false);
        if (list.length > 0 && !this.selected()) {
          this.selected.set(list[0]);
          this.registrarVista(list[0]);
        }
      });
  }

  seleccionar(g: RecordedClass): void {
    this.selected.set(g);
    this.registrarVista(g);
  }

  private registrarVista(g: RecordedClass): void {
    if (!this.auth.isAlumno() && !this.auth.isPadre?.()) return;
    this.csSvc.markRecordedClassViewed(this.courseId(), g.id).subscribe();
  }

  private refresh(): void {
    this.store.invalidateRecordedClasses(this.courseId());
    this.grabadas.set(null);
    this.loading.set(true);
    this.store.recordedClasses$(this.courseId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(list => {
        this.grabadas.set(list);
        this.loading.set(false);
        if (list.length > 0) {
          const selId = this.selected()?.id;
          const updated = list.find(g => g.id === selId) ?? list[0];
          this.selected.set(updated);
        }
      });
  }

  async abrirCrear(): Promise<void> {
    const { RecordedClassForm } = await import('./recorded-class-form/recorded-class-form');
    const ref = this.dialog.open(RecordedClassForm, {
      data: { courseId: this.courseId() },
      width: '480px',
      maxWidth: '95vw',
      autoFocus: false,
    });
    ref.afterClosed().subscribe(r => { if (r) this.refresh(); });
  }

  async abrirEditar(g: RecordedClass): Promise<void> {
    const { RecordedClassForm } = await import('./recorded-class-form/recorded-class-form');
    const ref = this.dialog.open(RecordedClassForm, {
      data: { courseId: this.courseId(), grabada: g },
      width: '480px',
      maxWidth: '95vw',
      autoFocus: false,
    });
    ref.afterClosed().subscribe(r => { if (r) this.refresh(); });
  }

  async eliminar(g: RecordedClass): Promise<void> {
    const { ConfirmDialog } = await import('../../../shared/components/confirm-dialog/confirm-dialog');
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Eliminar grabación',
        message: `¿Estás seguro de eliminar "${g.titulo}"? Esta acción no se puede deshacer.`,
        confirm: 'Eliminar',
        cancel: 'Cancelar',
        danger: true,
      },
      width: '400px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.csSvc.deleteRecordedClass(this.courseId(), g.id).subscribe({
        next: () => {
          this.toastr.success('Grabación eliminada correctamente', 'Éxito');
          if (this.selected()?.id === g.id) this.selected.set(null);
          this.refresh();
        },
        error: () => this.toastr.error('No se pudo eliminar la grabación', 'Error'),
      });
    });
  }

  toggleOculto(g: RecordedClass): void {
    this.csSvc.toggleRecordedClass(this.courseId(), g.id, !g.oculto).subscribe({
      next: () => {
        this.toastr.success(g.oculto ? 'Grabación visible' : 'Grabación oculta', 'Éxito');
        this.refresh();
      },
      error: () => this.toastr.error('No se pudo actualizar', 'Error'),
    });
  }
}