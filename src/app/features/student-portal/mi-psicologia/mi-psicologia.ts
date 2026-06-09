import {
    ChangeDetectionStrategy, Component, OnInit,
    inject, signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { StudentPortalStore, StudentInforme } from '../data-access/student-portal.store';
import type { ArchivoPsicologico } from '../../../core/models/psychology';

type Tab = 'fichas' | 'tests' | 'informes';

interface ArchivoConPreview extends ArchivoPsicologico {
    expandido: boolean;
    loadingPreview: boolean;
}

@Component({
    selector: 'app-mi-psicologia',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
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
    private readonly sanitizer = inject(DomSanitizer);

    readonly activeTab = signal<Tab>('fichas');
    readonly fichas = signal<ArchivoConPreview[]>([]);
    readonly tests = signal<ArchivoConPreview[]>([]);
    readonly informes = signal<StudentInforme[]>([]);

    readonly loadingFichas = signal(true);
    readonly loadingTests = signal(false);
    readonly loadedTests = signal(false);
    readonly loadingInformes = signal(false);
    readonly loadedInformes = signal(false);
    readonly downloadingId = signal<string | null>(null);

    private readonly previewUrls = new Map<string, SafeResourceUrl | string>();

    readonly tabs: { id: Tab; label: string; icon: string }[] = [
        { id: 'fichas', label: 'Fichas', icon: 'folder_special' },
        { id: 'tests', label: 'Tests', icon: 'science' },
        { id: 'informes', label: 'Informes', icon: 'description' },
    ];

    ngOnInit() { this.loadFichas(); }

    selectTab(tab: Tab) {
        this.activeTab.set(tab);
        if (tab === 'tests' && !this.loadedTests()) this.loadTests();
        if (tab === 'informes' && !this.loadedInformes()) this.loadInformes();
    }

    private toConPreview(a: ArchivoPsicologico): ArchivoConPreview {
        return { ...a, expandido: false, loadingPreview: false };
    }

    private loadFichas() {
        this.loadingFichas.set(true);
        this.store.getArchivos('ficha').subscribe({
            next: data => { this.fichas.set(data.map(a => this.toConPreview(a))); this.loadingFichas.set(false); },
            error: () => { this.fichas.set([]); this.loadingFichas.set(false); },
        });
    }

    private loadTests() {
        this.loadingTests.set(true);
        this.store.getArchivos('test').subscribe({
            next: data => {
                this.tests.set(data.map(a => this.toConPreview(a)));
                this.loadingTests.set(false);
                this.loadedTests.set(true);
            },
            error: () => { this.tests.set([]); this.loadingTests.set(false); this.loadedTests.set(true); },
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
            error: () => { this.informes.set([]); this.loadingInformes.set(false); this.loadedInformes.set(true); },
        });
    }

    toggleArchivo(archivo: ArchivoConPreview, lista: 'fichas' | 'tests') {
        const expandido = !archivo.expandido;
        this.updateArchivo(lista, archivo.id, { expandido });

        if (expandido && !this.previewUrls.has(archivo.id) && this.esPrevisualizble(archivo.mimeType)) {
            this.updateArchivo(lista, archivo.id, { loadingPreview: true });
            this.store.getArchivoPreviewUrl(archivo.id).subscribe({
                next: ({ url }) => {
                    const previewUrl = archivo.mimeType?.includes('pdf')
                        ? this.sanitizer.bypassSecurityTrustResourceUrl(url)
                        : url;
                    this.previewUrls.set(archivo.id, previewUrl);
                    this.updateArchivo(lista, archivo.id, { loadingPreview: false });
                },
                error: () => this.updateArchivo(lista, archivo.id, { loadingPreview: false }),
            });
        }
    }

    getPreviewUrl(id: string): SafeResourceUrl | string | null {
        return this.previewUrls.get(id) ?? null;
    }

    private updateArchivo(lista: 'fichas' | 'tests', id: string, patch: Partial<ArchivoConPreview>) {
        const sig = lista === 'fichas' ? this.fichas : this.tests;
        sig.update(arr => arr.map(a => a.id === id ? { ...a, ...patch } : a));
    }

    esPrevisualizble(mime: string | null): boolean {
        return !!mime && (mime.includes('pdf') || mime.includes('image'));
    }

    esPdf(mime: string | null): boolean {
        return !!mime?.includes('pdf');
    }

    esImagen(mime: string | null): boolean {
        return !!mime?.includes('image');
    }

    descargarArchivo(archivo: ArchivoConPreview) {
        if (this.downloadingId()) return;
        this.downloadingId.set(archivo.id);
        this.store.getArchivoUrl(archivo.id).subscribe({
            next: ({ url }) => {
                const a = document.createElement('a');
                a.href = url;
                a.download = archivo.nombreOriginal ?? archivo.nombre;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                this.downloadingId.set(null);
            },
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
        if (mime.includes('pdf')) return '#dc2626';
        if (mime.includes('image')) return '#7e22ce';
        if (mime.includes('word') || mime.includes('document')) return '#2563eb';
        return '#64748b';
    }

    mimeBgColor(mime: string | null): string {
        if (!mime) return '#f1f5f9';
        if (mime.includes('pdf')) return '#fee2e2';
        if (mime.includes('image')) return '#f3e8ff';
        if (mime.includes('word') || mime.includes('document')) return '#dbeafe';
        return '#f1f5f9';
    }

    trackById(_: number, item: { id: string }) { return item.id; }
}