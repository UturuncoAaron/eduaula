import {
    ChangeDetectionStrategy, Component, inject, OnInit, signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';
import { CourseService } from '../../data-access/course.store';
import { RecordedClass } from '../../../../core/models/course';

interface DialogData {
    courseId: string;
    grabada?: RecordedClass;
}

function detectProveedor(url: string): 'youtube' | 'drive' | null {
    if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
    if (/drive\.google\.com/.test(url)) return 'drive';
    return null;
}

@Component({
    selector: 'app-recorded-class-form',
    standalone: true,
    imports: [
        ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
        MatInputModule, MatButtonModule,
        MatIconModule, MatProgressSpinnerModule,
    ],
    templateUrl: './recorded-class-form.html',
    styleUrl: './recorded-class-form.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordedClassForm implements OnInit {
    private readonly ref = inject(MatDialogRef<RecordedClassForm>);
    readonly data = inject<DialogData>(MAT_DIALOG_DATA);
    private readonly csSvc = inject(CourseService);
    private readonly toastr = inject(ToastService);

    readonly saving = signal(false);
    readonly isEdit = signal(false);
    readonly urlError = signal<string | null>(null);
    readonly proveedorDetectado = signal<'youtube' | 'drive' | null>(null);

    readonly form = new FormGroup({
        url_original: new FormControl('', Validators.required),
        titulo: new FormControl('', [Validators.required, Validators.maxLength(200)]),
        descripcion: new FormControl(''),
    });

    ngOnInit(): void {
        const g = this.data.grabada;
        if (g) {
            this.isEdit.set(true);
            this.proveedorDetectado.set(g.proveedor);
            this.form.patchValue({
                titulo: g.titulo,
                descripcion: g.descripcion ?? '',
                url_original: g.url_original,
            });
            this.form.get('url_original')?.disable();
        }
    }

    onUrlChange(): void {
        const url = this.form.get('url_original')?.value ?? '';
        if (!url) {
            this.urlError.set(null);
            this.proveedorDetectado.set(null);
            return;
        }
        const proveedor = detectProveedor(url);
        if (!proveedor) {
            this.urlError.set('Solo se aceptan enlaces de YouTube o Google Drive');
            this.proveedorDetectado.set(null);
        } else {
            this.urlError.set(null);
            this.proveedorDetectado.set(proveedor);
        }
    }

    guardar(): void {
        if (this.form.invalid || this.saving()) return;
        const v = this.form.getRawValue();

        if (!this.isEdit()) {
            const proveedor = detectProveedor(v.url_original ?? '');
            if (!proveedor) {
                this.urlError.set('Solo se aceptan enlaces de YouTube o Google Drive');
                return;
            }
        }

        this.saving.set(true);

        if (this.isEdit()) {
            this.csSvc.updateRecordedClass(this.data.courseId, this.data.grabada!.id, {
                titulo: v.titulo!,
                descripcion: v.descripcion ?? undefined,
            }).subscribe({
                next: () => {
                    this.toastr.success('Grabación actualizada', 'Éxito');
                    this.ref.close(true);
                },
                error: err => {
                    this.saving.set(false);
                    this.toastr.error(err?.error?.message ?? 'Error al actualizar', 'Error');
                },
            });
        } else {
            this.csSvc.createRecordedClass(this.data.courseId, {
                url_original: v.url_original!,
                titulo: v.titulo!,
                descripcion: v.descripcion ?? undefined,
            }).subscribe({
                next: () => {
                    this.toastr.success('Clase grabada agregada correctamente', 'Éxito');
                    this.ref.close(true);
                },
                error: err => {
                    this.saving.set(false);
                    this.toastr.error(
                        err?.error?.message ?? 'URL no válida o sin periodo activo',
                        'Error',
                    );
                },
            });
        }
    }

    cerrar(): void { this.ref.close(false); }
}