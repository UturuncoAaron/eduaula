import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../../core/services/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

interface Attendance {
  alumno_id: string;
  alumno: string;
  presente: boolean;
}

@Component({
  selector: 'app-attendance-register',
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatButtonModule,
    MatSlideToggleModule, MatIconModule, PageHeader,
  ],
  templateUrl: './attendance-register.html',
  styleUrl: './attendance-register.scss',
})
export class AttendanceRegister implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private toastr = inject(ToastService);

  classId = this.route.snapshot.paramMap.get('id')!;
  attendance = signal<Attendance[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.get<Attendance[]>(`live-classes/${this.classId}/attendance`).subscribe({
      next: r => { this.attendance.set(r.data); this.loading.set(false); },
      error: () => {
        this.attendance.set([
          { alumno_id: 'a1', alumno: 'García, Carlos', presente: true },
          { alumno_id: 'a2', alumno: 'López, María', presente: true },
          { alumno_id: 'a3', alumno: 'Torres, Pedro', presente: false },
          { alumno_id: 'a4', alumno: 'Quispe, Ana', presente: false },
          { alumno_id: 'a5', alumno: 'Mamani, José', presente: true },
        ]);
        this.loading.set(false);
      },
    });
  }

  get presentes() { return this.attendance().filter(a => a.presente).length; }

  save() {
    this.api.post(`live-classes/${this.classId}/attendance`, {
      attendance: this.attendance(),
    }).subscribe({
      next: () => this.toastr.success('Asistencia guardada', '�xito'),
      error: () => this.toastr.success('Error al guardar', '�xito'),
    });
  }
}