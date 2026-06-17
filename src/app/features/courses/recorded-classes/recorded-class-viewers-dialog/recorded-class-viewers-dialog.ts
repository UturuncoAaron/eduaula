import {
  ChangeDetectionStrategy, Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CourseService } from '../../data-access/course.store';
import { RecordedClass, RecordedClassViewer } from '../../../../core/models/course';

interface DialogData {
  courseId: string;
  grabada: RecordedClass;
}

@Component({
  selector: 'app-recorded-class-viewers-dialog',
  standalone: true,
  imports: [
    DatePipe, MatDialogModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  templateUrl: './recorded-class-viewers-dialog.html',
  styleUrl: './recorded-class-viewers-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordedClassViewersDialog implements OnInit {
  private readonly ref = inject(MatDialogRef<RecordedClassViewersDialog>);
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);
  private readonly csSvc = inject(CourseService);

  readonly viewers = signal<RecordedClassViewer[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly total = computed(() => this.viewers().length);
  readonly vistos = computed(() => this.viewers().filter(v => v.visto).length);

  /** Carga la lista de cuentas que han visto la grabación. */
  ngOnInit(): void {
    this.csSvc.getRecordedClassViewers(this.data.courseId, this.data.grabada.id)
      .subscribe({
        next: r => {
          this.viewers.set(r.data ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  /** Nombre completo (apellidos + nombre) o un texto por defecto si falta. */
  nombreCompleto(v: RecordedClassViewer): string {
    const full = `${v.apellido_paterno ?? ''} ${v.apellido_materno ?? ''}, ${v.nombre ?? ''}`.trim();
    return full === ',' ? 'Usuario' : full;
  }

  /** Iniciales para el avatar a partir del nombre y apellido. */
  initials(v: RecordedClassViewer): string {
    return `${v.nombre?.[0] ?? ''}${v.apellido_paterno?.[0] ?? ''}`.toUpperCase() || '?';
  }

  /** Cierra el diálogo. */
  cerrar(): void {
    this.ref.close();
  }
}
