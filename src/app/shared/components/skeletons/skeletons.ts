import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Skeleton para el header del detalle de curso.
 * Reemplaza title/subtitle mientras `course()` aún es null.
 */
@Component({
  selector: 'app-course-header-skeleton',
  standalone: true,
  template: `
    <div class="sk-block">
      <div class="sk-line sk-line--badge"></div>
      <div class="sk-line sk-line--title"></div>
      <div class="sk-line sk-line--subtitle"></div>
    </div>
  `,
  styleUrl: './skeletons.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseHeaderSkeleton {}

/**
 * Skeleton para la tarjeta del docente (aside de tab-contenido).
 * Avatar circular + 2 líneas (nombre + título profesional).
 */
@Component({
  selector: 'app-teacher-card-skeleton',
  standalone: true,
  template: `
    <div class="sk-teacher">
      <div class="sk-avatar"></div>
      <div class="sk-teacher-text">
        <div class="sk-line sk-line--name"></div>
        <div class="sk-line sk-line--meta"></div>
      </div>
    </div>
  `,
  styleUrl: './skeletons.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherCardSkeleton {}

/**
 * Skeleton para los items dentro de una semana expandida.
 * Render de N filas (default 3) con icono + 2 líneas.
 */
@Component({
  selector: 'app-week-content-skeleton',
  standalone: true,
  template: `
    <div class="sk-week">
      @for (_ of rows(); track $index) {
        <div class="sk-row">
          <div class="sk-icon"></div>
          <div class="sk-row-text">
            <div class="sk-line sk-line--row-title"></div>
            <div class="sk-line sk-line--row-meta"></div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './skeletons.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekContentSkeleton {
  /** Cantidad de filas placeholder a renderizar. */
  count = input<number>(3);

  rows() {
    return Array.from({ length: this.count() });
  }
}
