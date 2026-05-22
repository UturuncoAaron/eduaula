import {
    Component, inject, signal, computed, OnInit,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { ToastService } from 'ngx-toastr-notifier';

import { ApiService } from '../../../../core/services/api';
import type { GradeLevel, Section } from '../../../../core/models/academic';

@Component({
    selector: 'app-grados-tab',
    standalone: true,
    imports: [
        MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatTooltipModule,
    ],
    templateUrl: './grados-tab.html',
    styleUrl: './grados-tab.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GradosTab implements OnInit {
    private api = inject(ApiService);
    private toastr = inject(ToastService);
    private dialog = inject(MatDialog);
    private router = inject(Router);

    loading = signal(true);
    grados = signal<GradeLevel[]>([]);
    secciones = signal<Section[]>([]);
    selectedGrado = signal<GradeLevel | null>(null);

    seccionesDelGrado = computed(() =>
        this.secciones().filter(s => s.grado_id === this.selectedGrado()?.id),
    );

    seccionesPorGrado = computed(() => {
        const map = new Map<string, number>();
        this.secciones().forEach(s =>
            map.set(s.grado_id, (map.get(s.grado_id) ?? 0) + 1),
        );
        return map;
    });

    ngOnInit(): void {
        forkJoin({
            grados: this.api.get<GradeLevel[]>('academic/grados'),
            secciones: this.api.get<Section[]>('academic/secciones'),
        }).subscribe({
            next: ({ grados, secciones }) => {
                this.grados.set((grados as any).data ?? []);
                this.secciones.set((secciones as any).data ?? []);
                // Seleccionar el primero por defecto
                const lista = (grados as any).data ?? [];
                if (lista.length) this.selectedGrado.set(lista[0]);
                this.loading.set(false);
            },
            error: () => {
                this.toastr.error('Error al cargar datos académicos', 'Error');
                this.loading.set(false);
            },
        });
    }

    selectGrado(g: GradeLevel): void {
        this.selectedGrado.set(g);
    }

    getCount(gradoId: string): number {
        return this.seccionesPorGrado().get(gradoId) ?? 0;
    }

    openSeccion(s: Section): void {
        this.router.navigate(['/admin/secciones', s.id], {
            queryParams: {
                grado: this.selectedGrado()?.nombre,
                seccion: s.nombre,
            },
        });
    }

    async openCreateSeccion(): Promise<void> {
        const g = this.selectedGrado();
        if (!g) return;
        const { CreateSeccionDialog } = await import(
            '../../../../shared/components/create-seccion-dialog/create-seccion-dialog'
        );
        const ref = this.dialog.open(CreateSeccionDialog, {
            width: '480px',
            maxWidth: '95vw',
            panelClass: 'create-seccion-panel',
            data: { gradoId: g.id, gradoNombre: g.nombre },
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            this.api.post<any>('academic/secciones', {
                grado_id: g.id,
                nombre: result.nombre,
                capacidad: result.capacidad,
            }).subscribe({
                next: () => {
                    this.toastr.success(`Sección "${result.nombre}" creada`, 'Éxito');
                    this.reloadSecciones();
                },
                error: err =>
                    this.toastr.error(err.error?.message ?? 'Error al crear sección', 'Error'),
            });
        });
    }

    async openEditSeccion(s: Section, event: Event): Promise<void> {
        event.stopPropagation();
        const { CreateSeccionDialog } = await import(
            '../../../../shared/components/create-seccion-dialog/create-seccion-dialog'
        );
        const ref = this.dialog.open(CreateSeccionDialog, {
            width: '480px',
            maxWidth: '95vw',
            panelClass: 'create-seccion-panel',
            data: {
                gradoId: this.selectedGrado()!.id,
                gradoNombre: this.selectedGrado()!.nombre,
                seccionId: s.id,
                nombre: s.nombre,
                capacidad: s.capacidad,
            },
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            this.api.patch<any>(`academic/secciones/${s.id}`, {
                nombre: result.nombre,
                capacidad: result.capacidad,
            }).subscribe({
                next: () => {
                    this.toastr.success(`Sección "${result.nombre}" actualizada`, 'Éxito');
                    this.reloadSecciones();
                },
                error: err =>
                    this.toastr.error(err.error?.message ?? 'Error', 'Error'),
            });
        });
    }

    goToCatalogo(): void {
        this.router.navigate(['/admin/academico/cursos']);
    }

    private reloadSecciones(): void {
        this.api.get<Section[]>('academic/secciones').subscribe({
            next: r => this.secciones.set((r as any).data ?? []),
        });
    }
}