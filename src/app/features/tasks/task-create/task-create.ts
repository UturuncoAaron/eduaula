import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ToastService } from 'ngx-toastr-notifier';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api';
import { Course } from '../../../core/models/course';
import { TaskService, CreateTaskPayload } from '../stores/task';

type TaskKind = 'archivo' | 'interactiva';

export interface TaskCreateData {
  courseId: string;
  bimestre?: number | null;
  semana?: number | null;
}

type TaskCreateInput = string | TaskCreateData | null;

@Component({
  selector: 'app-task-create',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule,
    MatSelectModule, MatCheckboxModule, MatButtonToggleModule,
    MatButtonModule, MatIconModule,
    MatDialogModule,
    MatDatepickerModule, MatNativeDateModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './task-create.html',
  styleUrl: './task-create.scss',
})
export class TaskCreate implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private taskSvc = inject(TaskService);
  private toastr = inject(ToastService);
  private router = inject(Router);
  private location = inject(Location);
  private dialogRef = inject(MatDialogRef<TaskCreate>, { optional: true });
  private dialogData = inject<TaskCreateInput>(MAT_DIALOG_DATA, { optional: true });

  private get prefillCourseId(): string | null {
    if (!this.dialogData) return null;
    return typeof this.dialogData === 'string' ? this.dialogData : this.dialogData.courseId;
  }

  private get prefillBimestre(): number | null {
    return this.dialogData && typeof this.dialogData !== 'string'
      ? this.dialogData.bimestre ?? null : null;
  }

  private get prefillSemana(): number | null {
    return this.dialogData && typeof this.dialogData !== 'string'
      ? this.dialogData.semana ?? null : null;
  }

  loading = signal(false);
  uploading = signal(false);
  courses = signal<Course[]>([]);

  kind = signal<TaskKind>('archivo');
  archivoReferencia = signal<File | null>(null);

  form = this.fb.group({
    curso_id: ['', Validators.required],
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    fecha_entrega: [null as Date | null, Validators.required],
    hora_entrega: ['23:59', Validators.required],
    puntos_max: [20, [Validators.required, Validators.min(1), Validators.max(20)]],
    permite_archivo: [true],
    permite_texto: [true],
    bimestre: [null as number | null],
    semana: [null as number | null],
    preguntas: this.fb.array([]),
  });

  ngOnInit() {
    const cursoId = this.prefillCourseId;
    if (cursoId) {
      this.form.patchValue({
        curso_id: cursoId,
        bimestre: this.prefillBimestre,
        semana: this.prefillSemana,
      });
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
    return (this.preguntasArray.at(i) as FormGroup) ?? null;
  }

  getOpcionesArray(i: number): FormArray | null {
    const g = this.getPreguntaGroup(i);
    return g ? (g.get('opciones') as FormArray) : null;
  }

  getOpcionGroup(pi: number, oi: number): FormGroup | null {
    const arr = this.getOpcionesArray(pi);
    return arr ? ((arr.at(oi) as FormGroup) ?? null) : null;
  }

  selectKind(k: TaskKind) {
    this.kind.set(k);
    if (k === 'interactiva' && this.preguntasArray.length === 0) {
      this.addPregunta();
    }
  }

  addPregunta() {
    this.preguntasArray.push(this.fb.group({
      enunciado: ['', Validators.required],
      tipo: ['multiple'],
      puntos: [1, [Validators.required, Validators.min(1)]],
      opciones: this.fb.array([
        this.newOpcion(''),
        this.newOpcion(''),
        this.newOpcion(''),
        this.newOpcion(''),
      ]),
    }));
  }

  removePregunta(i: number) { this.preguntasArray.removeAt(i); }
  addOpcion(pi: number) { this.getOpcionesArray(pi)?.push(this.newOpcion('')); }
  removeOpcion(pi: number, oi: number) { this.getOpcionesArray(pi)?.removeAt(oi); }

  onTipoChange(pi: number) {
    const grupo = this.getPreguntaGroup(pi);
    const opciones = this.getOpcionesArray(pi);
    if (!grupo || !opciones) return;
    const tipo = grupo.value.tipo;
    opciones.clear();
    if (tipo === 'verdadero_falso') {
      opciones.push(this.newOpcion('Verdadero', true));
      opciones.push(this.newOpcion('Falso', false));
    } else if (tipo === 'corta') {
      opciones.push(this.newOpcion('', true));
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

  onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.archivoReferencia.set(input.files?.[0] ?? null);
  }

  clearFile() {
    this.archivoReferencia.set(null);
  }

  private buildDateTime(fecha: Date, hora: string): string {
    const [h, m] = hora.split(':');
    const d = new Date(fecha);
    d.setHours(+h, +m, 0, 0);
    return d.toISOString();
  }

  cancel() {
    if (this.dialogRef) this.dialogRef.close(false);
    else this.location.back();
  }

  submit() {
    if (this.loading()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.value;

    const isInteractiva = this.kind() === 'interactiva';

    if (isInteractiva && this.preguntasArray.length === 0) {
      this.toastr.success('Agrega al menos una pregunta', '…xito');
      return;
    }
    if (!isInteractiva && !v.permite_archivo && !v.permite_texto) {
      this.toastr.success('Selecciona al menos un m√©todo de entrega (archivo o texto)', '…xito');
      return;
    }

    this.loading.set(true);

    const payload: CreateTaskPayload = {
      titulo: v.titulo!,
      instrucciones: (v.descripcion ?? '').trim() || undefined,
      fecha_limite: this.buildDateTime(v.fecha_entrega!, v.hora_entrega!),
      puntos_max: v.puntos_max!,
      permite_alternativas: isInteractiva,
      permite_archivo: isInteractiva ? false : !!v.permite_archivo,
      permite_texto: isInteractiva ? false : !!v.permite_texto,
      bimestre: v.bimestre ?? null,
      semana: v.semana ?? null,
    };

    if (isInteractiva) {
      payload.preguntas = this.preguntasArray.controls.map((g, i) => {
        const pv = (g as FormGroup).value;
        return {
          enunciado: pv.enunciado,
          puntos: pv.puntos,
          orden: i,
          opciones: pv.opciones.map((o: { texto: string; es_correcta: boolean }, j: number) => ({
            texto: o.texto,
            es_correcta: !!o.es_correcta,
            orden: j,
          })),
        };
      });
    }

    const cursoId = this.prefillCourseId ?? v.curso_id ?? '';

    this.taskSvc.createTask(cursoId, payload).subscribe({
      next: r => {
        const task = r.data;
        const file = this.archivoReferencia();
        if (!isInteractiva && file && task?.id) {
          this.uploadReferenceFile(task.id, file);
        } else {
          this.finishSuccess();
        }
      },
      error: () => {
        this.toastr.success('Error al crear la tarea', '…xito');
        this.loading.set(false);
      },
    });
  }

  private uploadReferenceFile(taskId: string, file: File) {
    this.uploading.set(true);
    this.taskSvc.uploadEnunciado(taskId, file).subscribe({
      next: () => {
        this.uploading.set(false);
        this.finishSuccess();
      },
      error: () => {
        this.uploading.set(false);
        this.toastr.success('Tarea creada, pero fall√≥ la subida del archivo de referencia', '…xito');
        this.finishSuccess();
      },
    });
  }

  private finishSuccess() {
    this.loading.set(false);
    this.toastr.success('Tarea creada correctamente', '…xito');
    if (this.dialogRef) this.dialogRef.close(true);
    else this.router.navigate(['/tareas']);
  }
}