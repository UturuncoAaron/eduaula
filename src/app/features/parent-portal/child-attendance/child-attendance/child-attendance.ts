import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../../core/services/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { DatePipe, DecimalPipe} from '@angular/common';

interface AttRecord {
  clase: string;
  fecha_hora: string;
  presente: boolean;
  justificacion?: string;
}

@Component({
  selector: 'app-child-attendance',
  standalone: true,
  imports: [DatePipe, DecimalPipe, MatTableModule, MatCardModule, MatIconModule, PageHeader, EmptyState],
  templateUrl: './child-attendance.html',
  styleUrl: './child-attendance.scss',
})
export class ChildAttendance implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);

  childId = this.route.snapshot.paramMap.get('childId')!;
  records = signal<AttRecord[]>([]);
  cols = ['fecha', 'clase', 'estado'];

  get presentes() { return this.records().filter(r => r.presente).length; }
  get total() { return this.records().length; }

  ngOnInit() {
    this.api.get<AttRecord[]>(`parent/children/${this.childId}/attendance`).subscribe({
      next: r => this.records.set(r.data),
      error: () => this.records.set([
        { clase: 'Matemáticas', fecha_hora: new Date().toISOString(), presente: true },
        { clase: 'Comunicación', fecha_hora: new Date(Date.now() - 86400000).toISOString(), presente: false, justificacion: 'Enfermedad' },
        { clase: 'Historia', fecha_hora: new Date(Date.now() - 172800000).toISOString(), presente: true },
      ]),
    });
  }
}