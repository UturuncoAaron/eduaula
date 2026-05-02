import {
    Component, ChangeDetectionStrategy,
    inject, signal, computed,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
    MAT_DIALOG_DATA, MatDialogRef, MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { ToastService } from 'ngx-toastr-notifier';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../../../../../../core/services/api';

export interface AssignStudentsDialogData {
    psicologaId: string;
    psicologaNombre: string;
}

interface AlumnoRow {
    id: string;
    codigo_estudiante?: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno?: string | null;
    apellidos?: string;
}

function fullName(a: AlumnoRow): string {
    const ap = a.apellidos
        ?? `${a.apellido_paterno}${a.apellido_materno ? ' ' + a.apellido_materno : ''}`;
    return `${ap}, ${a.nombre}`;
}

@Component({
    selector: 'app-assign-students-dialog',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatChipsModule,
        MatDividerModule,
    ],
    templateUrl: './assign-students-dialog.html',
    styleUrl: './assign-students-dialog.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignStudentsDialog {
    private api = inject(ApiService);
    private toastr = inject(ToastService);
    private dialogRef = inject(MatDialogRef<AssignStudentsDialog>);

    data: AssignStudentsDialogData = inject(MAT_DIALOG_DATA);

    loading = signal(true);
    saving = signal<string | null>(null);
    allStudents = signal<AlumnoRow[]>([]);
    assignedIds = signal<Set<string>>(new Set());

    searchControl = new FormControl<string>('', { nonNullable: true });
    searchTerm = toSignal(this.searchControl.valueChanges, { initialValue: '' });

    assignedStudents = computed(() => {
        const ids = this.assignedIds();
        return this.allStudents().filter((a) => ids.has(a.id));
    });

    availableStudents = computed(() => {
        const ids = this.assignedIds();
        const term = (this.searchTerm() ?? '').trim().toLowerCase();
        let list = this.allStudents().filter((a) => !ids.has(a.id));
        if (term) {
            list = list.filter((a) => {
                const haystack = [
                    a.codigo_estudiante ?? '',
                    a.nombre,
                    a.apellido_paterno,
                    a.apellido_materno ?? '',
                ].join(' ').toLowerCase();
                return haystack.includes(term);
            });
        }
        return list;
    });

    constructor() {
        this.loadInitial();
    }

    fullName = fullName;

    private loadInitial(): void {
        this.loading.set(true);

        forkJoin({
            todos: this.api.get<any>('admin/users/alumnos'),
            asignados: this.api.get<any>(
                `psychology/assignments/${this.data.psicologaId}/students`,
            ),
        }).subscribe({
            next: ({ todos, asignados }) => {
                const all: AlumnoRow[] = (todos?.data ?? todos ?? []) as AlumnoRow[];
                const ass: AlumnoRow[] = (asignados?.data ?? asignados ?? []) as AlumnoRow[];
                this.allStudents.set(all);
                this.assignedIds.set(new Set(ass.map((a) => a.id)));
                this.loading.set(false);
            },
            error: () => {
                this.toastr.error('No se pudo cargar la lista de alumnos', 'Error');
                this.loading.set(false);
            },
        });
    }

    assign(student: AlumnoRow): void {
        if (this.saving()) return;
        this.saving.set(student.id);
        this.api
            .post(
                `psychology/assignments/${this.data.psicologaId}/${student.id}`,
                {},
            )
            .subscribe({
                next: () => {
                    const next = new Set(this.assignedIds());
                    next.add(student.id);
                    this.assignedIds.set(next);
                    this.saving.set(null);
                    this.toastr.success(
                        `Alumno asignado a ${this.data.psicologaNombre}`,
                        'Éxito',
                    );
                },
                error: () => {
                    this.saving.set(null);
                    this.toastr.error('No se pudo asignar el alumno', 'Error');
                },
            });
    }

    unassign(student: AlumnoRow): void {
        if (this.saving()) return;
        this.saving.set(student.id);
        this.api
            .delete(
                `psychology/assignments/${this.data.psicologaId}/${student.id}`,
            )
            .subscribe({
                next: () => {
                    const next = new Set(this.assignedIds());
                    next.delete(student.id);
                    this.assignedIds.set(next);
                    this.saving.set(null);
                    this.toastr.success('Alumno desasignado', 'Éxito');
                },
                error: () => {
                    this.saving.set(null);
                    this.toastr.error('No se pudo desasignar el alumno', 'Error');
                },
            });
    }

    close(): void {
        this.dialogRef.close(true);
    }
}
