import { Component, OnInit, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../../../../environments/environment';

@Component({
    selector: 'app-brand-panel',
    imports: [MatIconModule],
    templateUrl: './brand-panel.html',
    styleUrl: './brand-panel.scss',
})
export class BrandPanel implements OnInit {
    private http = inject(HttpClient);

    nombreColegio = signal('IE Juan Pablo Vizcardo y Guzmán');
    ugel = signal('UGEL 04 · Comas, Lima · Perú');
    anioEscolar = signal('2026');
    director = signal('');

    stats = signal([
        { label: 'Alumnos', value: '—', icon: 'school' },
        { label: 'Docentes', value: '—', icon: 'person' },
        { label: 'Cursos', value: '—', icon: 'menu_book' },
    ]);

    ngOnInit() {
        this.http
            .get<{ success: boolean; data: { clave: string; valor: string }[] }>(
                `${environment.apiUrl}/configuracion`,
            )
            .subscribe({
                next: res => {
                    const get = (k: string) =>
                        res.data?.find(c => c.clave === k)?.valor ?? '';
                    if (get('nombre_colegio')) this.nombreColegio.set(get('nombre_colegio'));
                    if (get('ugel')) this.ugel.set(get('ugel'));
                    if (get('anio_escolar')) this.anioEscolar.set(get('anio_escolar'));
                    if (get('director')) this.director.set(get('director'));
                },
                error: () => { },
            });

        this.http
            .get<{ success: boolean; data: any }>(
                `${environment.apiUrl}/admin/users/stats`,
            )
            .subscribe({
                next: res => {
                    const d = res.data;
                    if (!d) return;
                    this.stats.set([
                        { label: 'Alumnos', value: d.alumnos ?? '—', icon: 'school' },
                        { label: 'Docentes', value: d.docentes ?? '—', icon: 'person' },
                        { label: 'Cursos', value: d.cursos ?? '—', icon: 'menu_book' },
                    ]);
                },
                error: () => { },
            });
    }
}