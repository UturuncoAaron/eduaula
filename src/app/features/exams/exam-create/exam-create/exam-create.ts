import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormArray, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { ExamService } from '../../stores/exam';

@Component({
  selector: 'app-exam-create',
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSelectModule,
    MatCheckboxModule, MatDatepickerModule, MatNativeDateModule,
    MatSnackBarModule, MatDialogModule,
  ],
  templateUrl: './exam-create.html',
  styleUrl: './exam-create.scss',
})
export class ExamCreate {
  private fb = inject(FormBuilder);
  private examSvc = inject(ExamService);
  private snack = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<ExamCreate>);
  private courseId = inject<string>(MAT_DIALOG_DATA);

  loading = signal(false);

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    fecha_inicio: [null as Date | null, Validators.required],
    hora_inicio: ['08:00', Validators.required],
    fecha_fin: [null as Date | null, Validators.required],
    hora_fin: ['10:00', Validators.required],
    puntos_total: [20, [Validators.required, Validators.min(1), Validators.max(20)]],
    preguntas: this.fb.array([]),
  });

  get preguntasArray(): FormArray {
    return this.form.get('preguntas') as FormArray;
  }

  getPreguntaGroup(i: number): FormGroup {
    return this.preguntasArray.at(i) as FormGroup;
  }

  getOpcionesArray(i: number): FormArray {
    return this.getPreguntaGroup(i).get('opciones') as FormArray;
  }

  getOpcionGroup(pi: number, oi: number): FormGroup {
    return this.getOpcionesArray(pi).at(oi) as FormGroup;
  }

  addPregunta() {
    const pregunta = this.fb.group({
      enunciado: ['', Validators.required],
      tipo: ['multiple'],
      puntos: [1, [Validators.required, Validators.min(1)]],
      opciones: this.fb.array([
        this.newOpcion(''),
        this.newOpcion(''),
        this.newOpcion(''),
        this.newOpcion(''),
      ]),
    });
    this.preguntasArray.push(pregunta);
  }

  removePregunta(i: number) {
    this.preguntasArray.removeAt(i);
  }

  addOpcion(pi: number) {
    this.getOpcionesArray(pi).push(this.newOpcion(''));
  }

  removeOpcion(pi: number, oi: number) {
    this.getOpcionesArray(pi).removeAt(oi);
  }

  onTipoChange(pi: number) {
    const grupo = this.getPreguntaGroup(pi);
    const tipo = grupo.value.tipo;
    const opciones = this.getOpcionesArray(pi);
    opciones.clear();
    if (tipo === 'verdadero_falso') {
      opciones.push(this.newOpcion('Verdadero', true));
      opciones.push(this.newOpcion('Falso', false));
    } else {
      opciones.push(this.newOpcion(''));
      opciones.push(this.newOpcion(''));
      opciones.push(this.newOpcion(''));
      opciones.push(this.newOpcion(''));
    }
  }

  private newOpcion(texto: string, esCorrecta = false): FormGroup {
    return this.fb.group({
      texto: [texto, Validators.required],
      es_correcta: [esCorrecta],
    });
  }

  private buildDateTime(fecha: Date, hora: string): string {
    const [h, m] = hora.split(':');
    const d = new Date(fecha);
    d.setHours(+h, +m, 0, 0);
    return d.toISOString();
  }

  submit() {
    if (this.form.invalid || this.preguntasArray.length === 0) {
      this.form.markAllAsTouched();
      if (this.preguntasArray.length === 0) {
        this.snack.open('Agrega al menos una pregunta', 'OK', { duration: 3000 });
      }
      return;
    }

    this.loading.set(true);

    const v = this.form.value;
    const payload = {
      titulo: v.titulo,
      descripcion: v.descripcion,
      fecha_inicio: this.buildDateTime(v.fecha_inicio!, v.hora_inicio!),
      fecha_fin: this.buildDateTime(v.fecha_fin!, v.hora_fin!),
      puntos_total: v.puntos_total,
      preguntas: v.preguntas!.map((p: any, i: number) => ({
        enunciado: p.enunciado,
        tipo: p.tipo,
        puntos: p.puntos,
        orden: i,
        opciones: p.opciones.map((o: any, j: number) => ({
          texto: o.texto,
          es_correcta: o.es_correcta,
          orden: j,
        })),
      })),
    };

    this.examSvc.createExam(this.courseId, payload).subscribe({
      next: () => {
        this.snack.open('Examen creado correctamente', 'OK', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: () => {
        this.snack.open('Error al crear el examen', 'OK', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }
}