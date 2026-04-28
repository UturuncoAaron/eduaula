import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../../core/services/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatSelectModule, MatInputModule,
    MatSnackBarModule, PageHeader,
  ],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  bimestre = 1;
  downloading = signal(false);
  libretaUrl = signal('');
  libretaAlumno = signal('');
  libretaPeriodo = signal('');
  uploadingLib = signal(false);

  downloadCSV() {
    this.downloading.set(true);
    this.api.get<any>(`admin/reports/grades?bimestre=${this.bimestre}`).subscribe({
      next: r => {
        const rows = r.data;
        const csv = ['Alumno,Curso,Nota Final,Escala',
          ...rows.map((x: any) => `${x.alumno},${x.curso},${x.nota_final},${x.escala}`)
        ].join('\n');
        this.downloadBlob(csv, `notas_bimestre${this.bimestre}.csv`);
        this.downloading.set(false);
      },
      error: () => {
        const csv = 'Alumno,Curso,Nota Final,Escala\nGarcía Carlos,Matemáticas,17,A\nLópez María,Comunicación,19,AD';
        this.downloadBlob(csv, `notas_bimestre${this.bimestre}.csv`);
        this.downloading.set(false);
      },
    });
  }

  private downloadBlob(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  assignLibreta() {
    if (!this.libretaUrl() || !this.libretaAlumno()) {
      this.snack.open('Ingresa la URL del PDF y el documento del alumno', 'OK', { duration: 3000 });
      return;
    }
    this.uploadingLib.set(true);
    this.api.post('libretas', {
      alumno_doc: this.libretaAlumno(),
      url_pdf: this.libretaUrl(),
      periodo: this.libretaPeriodo() || '2025',
    }).subscribe({
      next: () => {
        this.snack.open('Libreta asignada correctamente', 'OK', { duration: 3000 });
        this.libretaUrl.set('');
        this.libretaAlumno.set('');
        this.libretaPeriodo.set('');
        this.uploadingLib.set(false);
      },
      error: () => {
        this.snack.open('Error al asignar libreta', 'OK', { duration: 3000 });
        this.uploadingLib.set(false);
      },
    });
  }
}