import {
    ChangeDetectionStrategy, Component, OnInit,
    inject, signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { StudentPortalStore, StudentInforme } from '../data-access/student-portal.store';
import type { ArchivoPsicologico } from '../../../core/models/psychology';

type Tab = 'documentos' | 'informes';

@Component({
    selector: 'app-mi-psicologia',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatRippleModule,
        MatTooltipModule,
        PageHeader,
        EmptyState,
    ],
    templateUrl: './mi-psicologia.html',
    styleUrl: './mi-psicologia.scss',
})
export class MiPsicologia implements OnInit {
    private readonly store = inject(StudentPortalStore);

    readonly activeTab = signal<Tab>('documentos');

    readonly archivos = signal<ArchivoPsicologico[]>([]);
    readonly informes = signal<StudentInforme[]>([]);

    readonly loadingArchivos = signal(true);
    readonly loadingInformes = signal(false);
    readonly loadedInformes = signal(false);
    readonly downloadingId = signal<string | null>(null);

    readonly tabs: { id: Tab; label: string; icon: string }[] = [
        { id: 'documentos', label: 'Documentos', icon: 'folder_open' },
        { id: 'informes', label: 'Informes', icon: 'description' },
    ];

    readonly categoriaLabel: Record<string, string> = {
        ficha: 'Ficha',
        test: 'Test',
        informe: 'Informe',
    };

    readonly tipoLabel: Record<string, string> = {
        evaluacion: 'Evaluación psicológica',
        seguimiento: 'Seguimiento',
        derivacion_familia: 'Derivación a familia',
        derivacion_externa: 'Derivación externa',
    };

    ngOnInit() {
        this.loadArchivos();
    }

    selectTab(tab: Tab) {
        this.activeTab.set(tab);
        if (tab === 'informes' && !this.loadedInformes()) {
            this.loadInformes();
        }
    }

    private loadArchivos() {
        this.loadingArchivos.set(true);
        this.store.getArchivos().subscribe({
            next: data => { this.archivos.set(data); this.loadingArchivos.set(false); },
            error: () => { this.archivos.set([]); this.loadingArchivos.set(false); },
        });
    }

    private loadInformes() {
        this.loadingInformes.set(true);
        this.store.getInformes().subscribe({
            next: data => {
                this.informes.set(data);
                this.loadingInformes.set(false);
                this.loadedInformes.set(true);
            },
            error: () => {
                this.informes.set([]);
                this.loadingInformes.set(false);
                this.loadedInformes.set(true);
            },
        });
    }

    descargarArchivo(archivo: ArchivoPsicologico) {
        if (this.downloadingId()) return;
        this.downloadingId.set(archivo.id);
        this.store.getArchivoUrl(archivo.id).subscribe({
            next: ({ url }) => { window.open(url, '_blank'); this.downloadingId.set(null); },
            error: () => this.downloadingId.set(null),
        });
    }

    verInformePdf(informe: StudentInforme) {
        window.open(this.store.getInformePdfUrl(informe.id), '_blank');
    }

    formatBytes(bytes: number | null): string {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

    mimeIcon(mime: string | null): string {
        if (!mime) return 'insert_drive_file';
        if (mime.includes('pdf')) return 'picture_as_pdf';
        if (mime.includes('image')) return 'image';
        if (mime.includes('word') || mime.includes('document')) return 'description';
        return 'insert_drive_file';
    }

    mimeColor(mime: string | null): string {
        if (!mime) return '#64748b';
        if (mime.includes('pdf')) return '#ef4444';
        if (mime.includes('image')) return '#8b5cf6';
        if (mime.includes('word') || mime.includes('document')) return '#2563eb';
        return '#64748b';
    }

    trackById(_: number, item: { id: string }) { return item.id; }
}