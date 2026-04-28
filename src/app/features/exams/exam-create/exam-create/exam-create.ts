import { Component, inject, signal, OnInit, Optional } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
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
import { ApiService } from '../../../../core/services/api';
import { Course } from '../../../../core/models/course';

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
  private dialogRef = inject(MatDialogRef<ExamCreate>, { optional: true });
  private dialogData = inject<string | null>(MAT_DIALOG_DATA, { optional: true });
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  loading = signal(false);
  courses = signal<Course[]>([]);
  courseId = '';

  form = this.fb.group({
    curso_id: ['', Validators.required],
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    fecha_inicio: [null as Date | null, Validators.required],
    hora_inicio: ['08:00', Validators.required],
    fecha_fin: [null as Date | null, Validators.required],
    hora_fin: ['10:00', Validators.required],
    puntos_total: [20, [Validators.required, Validators.min(1), Validators.max(20)]],
    preguntas: this.fb.array([]),
  });

  ngOnInit() {
    if (this.dialogData) {
      this.courseId = this.dialogData;
      this.form.patchValue({ curso_id: this.courseId });
    } else {
      this.api.get<Course[]>('courses').subscribe({
        next: r => this.courses.set(r.data),
        error: () => this.courses.set([]),
      });
    }
  }

  get isDialog(): boolean { return !!this.dialogRef; }

  get preguntasArray(): FormArray {
    return this.form.get('preguntas') as FormArray;
  }

  getPreguntaGroup(i: number): FormGroup | null {
    const c = this.preguntasArray.at(i);
    return (c as FormGroup) ?? null;
  }

  getOpcionesArray(i: number): FormArray | null {
    const g = this.getPreguntaGroup(i);
    return g ? (g.get('opciones') as FormArray) : null;
  }

  getOpcionGroup(pi: number, oi: number): FormGroup | null {
    const arr = this.getOpcionesArray(pi);
    if (!arr) return null;
    const c = arr.at(oi);
    return (c as FormGroup) ?? null;
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
    this.getOpcionesArray(pi)?.push(this.newOpcion(''));
  }

  removeOpcion(pi: number, oi: number) {
    this.getOpcionesArray(pi)?.removeAt(oi);
  }

  onTipoChange(pi: number) {
    const grupo = this.getPreguntaGroup(pi);
    const opciones = this.getOpcionesArray(pi);
    if (!grupo || !opciones) return;
    const tipo = grupo.value.tipo;
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
      instrucciones: v.descripcion || undefined,
      fecha_limite: this.buildDateTime(v.fecha_fin!, v.hora_fin!),
      puntos_max: v.puntos_total,
      permite_alternativas: true,
      preguntas: v.preguntas!.map((p: any, i: number) => ({
        enunciado: p.enunciado,
        puntos: p.puntos,
        orden: i,
        opciones: p.opciones.map((o: any, j: number) => ({
          texto: o.texto,
          es_correcta: o.es_correcta,
          orden: j,
        })),
      })),
    };

    const cursoId = this.dialogData ?? this.form.value.curso_id ?? '';
    this.examSvc.createExam(cursoId, payload).subscribe({
      next: () => {
        this.snack.open('Examen creado correctamente', 'OK', { duration: 3000 });
        if (this.dialogRef) {
          this.dialogRef.close(true);
        } else {
          this.router.navigate(['/examenes']);
        }
      },
      error: () => {
        this.snack.open('Error al crear el examen', 'OK', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }

  cancel() {
    if (this.dialogRef) this.dialogRef.close(false);
    else this.location.back();
  }
}
