import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { environment } from '../../../../environments/environment';

interface Seccion { id: number; nombre: string; grado?: { nombre: string } }
interface Periodo { id: number; nombre: string; activo: boolean }
interface ImportError { fila: number; numero_documento: string; motivo: string }
interface ImportResult { total: number; creados: number; matriculados: number; omitidos: number; errores: ImportError[] }

@Component({
  selector: 'app-import-students',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatSelectModule, MatProgressBarModule, MatChipsModule,
    PageHeader,
  ],
  templateUrl: './import-students.html',
  styleUrl: './import-students.scss',
})
export class ImportStudents implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private toastr = inject(ToastService);

  secciones = signal<Seccion[]>([]);
  periodos = signal<Periodo[]>([]);
  archivo = signal<File | null>(null);
  uploading = signal(false);
  resultado = signal<ImportResult | null>(null);

  form = this.fb.group({
    seccion_id: [null as number | null, Validators.required],
    periodo_id: [null as number | null, Validators.required],
  });

  ngOnInit() {
    this.api.get<Seccion[]>('academic/secciones').subscribe({
      next: r => this.secciones.set(r.data),
      error: () => this.secciones.set([]),
    });
    this.api.get<Periodo[]>('academic/periodos').subscribe({
      next: r => {
        this.periodos.set(r.data);
        const activo = r.data.find(p => p.activo);
        if (activo) this.form.patchValue({ periodo_id: activo.id });
      },
      error: () => this.periodos.set([]),
    });
  }

  pickFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (f && !f.name.toLowerCase().endsWith('.csv')) {
      this.toastr.error('El archivo debe ser .csv', 'Error');
      input.value = '';
      return;
    }
    this.archivo.set(f);
  }

  importar() {
    if (this.form.invalid || !this.archivo()) {
      this.form.markAllAsTouched();
      if (!this.archivo()) this.toastr.error('Selecciona un CSV', 'Error');
      return;
    }
    const v = this.form.value;
    const fd = new FormData();
    fd.append('file', this.archivo()!);
    this.uploading.set(true);
    this.resultado.set(null);

    this.api.postForm<ImportResult>(
      `admin/import/students?seccion_id=${v.seccion_id}&periodo_id=${v.periodo_id}`,
      fd,
    ).subscribe({
      next: r => {
        this.resultado.set(r.data);
        this.uploading.set(false);
        this.toastr.error(`\$\{r.data.creados\} alumnos creados, \$\{r.data.matriculados\} matriculados`, 'Error');
      },
      error: e => {
        this.uploading.set(false);
        this.toastr.error(e?.error?.message || 'Error en la importación', 'Error');
      },
    });
  }

  descargarPlantilla() {
    window.open(`${environment.apiUrl}/admin/import/students/template`, '_blank');
  }
}
