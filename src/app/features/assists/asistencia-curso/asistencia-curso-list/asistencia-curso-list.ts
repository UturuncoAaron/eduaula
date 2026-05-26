import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { CourseService } from '../../../courses/data-access/course.store';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';

@Component({
    selector: 'app-asistencia-curso-list',
    standalone: true,
    imports: [
        RouterLink,
        MatIconModule, MatButtonModule, MatProgressSpinnerModule,
        PageHeader, EmptyState,
    ],
    templateUrl: './asistencia-curso-list.html',
    styleUrl: './asistencia-curso-list.scss',
})
export class AsistenciaCursoList implements OnInit {
    private courseService = inject(CourseService);

    readonly courses = this.courseService.courses;
    readonly loading = this.courseService.loading;
    readonly cursosActivos = computed(() => this.courses().filter(c => c.activo));

    ngOnInit() {
        this.courseService.loadMyCourses().subscribe({

            error: () => { /* noop */ },
        });
    }
}
