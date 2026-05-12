import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../../core/services/api';

interface AniosResponse { anios: number[] }

@Component({
    selector: 'app-selector-anio',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule, MatSelectModule, MatIconModule,
    ],
    template: `
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="selector-anio">
            <mat-icon matPrefix>event</mat-icon>
            <mat-label>Año académico</mat-label>
            @if (loading()) {
                <mat-select disabled>
                    <mat-option [value]="null">Cargando años...</mat-option>
                </mat-select>
            } @else {
                <mat-select [formControl]="control">
                    @for (a of anios(); track a) {
                        <mat-option [value]="a">{{ a }}</mat-option>
                    }
                </mat-select>
            }
        </mat-form-field>
    `,
    styles: [`
        .selector-anio { width: 200px; }
    `],
})
export class SelectorAnio implements OnInit {
    private api = inject(ApiService);
    private toastr = inject(ToastService);

    @Output() anioChange = new EventEmitter<number | null>();

    loading = signal(true);
    anios = signal<number[]>([]);
    control = new FormControl<number | null>(null);

    ngOnInit(): void {
        this.api.get<AniosResponse>('admin/historico/anios').subscribe({
            next: (res) => {
                const body = res.data;
                const lista = body?.anios ?? [];
                this.anios.set(lista);
                this.loading.set(false);
                // Selección automática del año más reciente
                if (lista.length > 0) {
                    this.control.setValue(lista[0]);
                    this.anioChange.emit(lista[0]);
                }
            },
            error: () => {
                this.loading.set(false);
                this.toastr.error('No se pudieron cargar los años', 'Error');
            },
        });

        this.control.valueChanges.subscribe((v) => this.anioChange.emit(v));
    }
}
