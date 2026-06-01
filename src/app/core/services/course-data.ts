import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { ApiService } from './api';

interface ColorOption {
    label: string;
    value: string;
}

@Injectable({
    providedIn: 'root' // Disponible en toda la aplicación como Singleton
})
export class CourseDataService {
    private readonly api = inject(ApiService);

    // Caché en memoria usando shareReplay(1)
    private colorsCache$?: Observable<ColorOption[]>;
    private areasCache$?: Observable<string[]>;

    getAvailableColors(): Observable<ColorOption[]> {
        if (!this.colorsCache$) {
            this.colorsCache$ = this.api.get<ColorOption[]>('courses/colors').pipe(
                map((res: any) => res?.data ?? []),
                shareReplay(1) // Guarda el último resultado y lo comparte a los nuevos suscriptores
            );
        }
        return this.colorsCache$;
    }

    getAvailableAreas(): Observable<string[]> {
        if (!this.areasCache$) {
            this.areasCache$ = this.api.get<string[]>('courses/areas').pipe(
                map((res: any) => res?.data ?? res ?? []),
                shareReplay(1) // Evita que se vuelva a disparar la petición HTTP
            );
        }
        return this.areasCache$;
    }

    // Método opcional por si alguna vez necesitas forzar la limpieza del caché
    clearCache(): void {
        this.colorsCache$ = undefined;
        this.areasCache$ = undefined;
    }
}