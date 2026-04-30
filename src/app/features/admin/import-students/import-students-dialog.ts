import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { environment } from '../../../../environments/environment';

interface Seccion { id: number; nombre: string; grado?: { nombre: string } }
interface Periodo { id: number; nombre: string; activo: boolean }
interface ImportError { fila: number; numero_documento: string; motivo: string }
interface ImportResult {
  total: number;
  creados: number;
  matriculados: number;
  omitidos: number;
  errores: ImportError[];
}

@Component({
  selector: 'app-import-students-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule,  MatFormFieldModule,
    MatSelectModule, MatProgressBarModule, MatChipsModule, MatTooltipModule,MatIcon
  ],
  templateUrl: './import-students-dialog.html',
  styleUrl: './import-students-dialog.scss',
})
export class ImportStudentsDialog implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private ref = inject(MatDialogRef<ImportStudentsDialog>);

  secciones = signal<Seccion[]>([]);
  periodos = signal<Periodo[]>([]);
  archivo = signal<File | null>(null);
  uploading = signal(false);
  resultado = signal<ImportResult | null>(null);

  form = this.fb.group({
    seccion_id: [null as number | null, Validators.required],
    periodo_id: [null as number | null, Validators.required],
  });

  ngOnInit(): void {
    this.api.get<Seccion[]>('academic/secciones').subscribe({
      next: r => this.secciones.set((r as any).data ?? []),
      error: () => this.secciones.set([]),
    });
    this.api.get<Periodo[]>('academic/periodos').subscribe({
      next: r => {
        const data: Periodo[] = (r as any).data ?? [];
        this.periodos.set(data);
        const activo = data.find(p => p.activo);
        if (activo) this.form.patchValue({ periodo_id: activo.id });
      },
      error: () => this.periodos.set([]),
    });
  }

  pickFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (f && !f.name.toLowerCase().endsWith('.csv')) {
      this.toastr.error('El archivo debe ser .csv', 'Error');
      input.value = '';
      return;
    }
    this.archivo.set(f);
    this.resultado.set(null);
  }

  importar(): void {
    if (this.form.invalid || !this.archivo()) {
      this.form.markAllAsTouched();
      if (!this.archivo()) this.toastr.error('Selecciona un archivo CSV', 'Error');
      return;
    }

    const { seccion_id, periodo_id } = this.form.value;
    const fd = new FormData();
    fd.append('file', this.archivo()!);

    this.uploading.set(true);
    this.resultado.set(null);

    this.api.postForm<ImportResult>(
      `admin/import/students?seccion_id=${seccion_id}&periodo_id=${periodo_id}`,
      fd,
    ).subscribe({
      next: r => {
        const data: ImportResult = (r as any).data;
        this.resultado.set(data);
        this.uploading.set(false);
        this.toastr.success(
          `${data.creados} creados · ${data.matriculados} matriculados`,
          'Importación completada',
        );
      },
      error: e => {
        this.uploading.set(false);
        this.toastr.error(e?.error?.message ?? 'Error en la importación', 'Error');
      },
    });
  }

  descargarPlantilla(): void {
    window.open(`${environment.apiUrl}/admin/import/students/template`, '_blank');
  }

  cerrar(): void {
    // Si hubo importación exitosa, cierra con `true` para que
    // el padre pueda recargar la lista de matrículas.
    this.ref.close(this.resultado() !== null);
  }
}