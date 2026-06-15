import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ParentPortalService } from '../data-access/parent-portal.store';
import { ChildLibreta as ChildLibretaModel } from '../../../core/models/parent-portal';

@Component({
    selector: 'app-child-libreta',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatTooltipModule,
        PageHeader, EmptyState,
    ],
    templateUrl: './child-libreta.html',
    styleUrl: './child-libreta.scss',
})
export class ChildLibreta implements OnInit {
    private route = inject(ActivatedRoute);
    private store = inject(ParentPortalService);
    private sanitizer = inject(DomSanitizer);

    readonly libretas = signal<ChildLibretaModel[]>([]);
    readonly loading = signal(true);
    readonly preview = signal<ChildLibretaModel | null>(null);

    readonly childId = computed<string>(() =>
        this.route.snapshot.paramMap.get('childId') ?? '',
    );

    readonly previewUrl = computed<SafeResourceUrl | null>(() => {
        const l = this.preview();
        if (!l?.url) return null;
        return this.sanitizer.bypassSecurityTrustResourceUrl(`${l.url}#toolbar=1&view=FitH`);
    });

    ngOnInit() {
        const id = this.childId();
        if (!id) { this.loading.set(false); return; }

        this.store.getChildLibretas(id).subscribe({
            next: r => {
                this.libretas.set(r.data ?? []);
                this.loading.set(false);
            },
            error: () => {
                // No reventamos la UI: lista vacía + empty state.
                this.libretas.set([]);
                this.loading.set(false);
            },
        });
    }

    /** True si la libreta tiene URL firmada lista para descarga. */
    hasUrl(l: ChildLibretaModel): boolean {
        return typeof l.url === 'string' && l.url.length > 0;
    }

    ver(l: ChildLibretaModel) {
        if (!this.hasUrl(l)) return;
        this.preview.set(l);
    }

    abrirExterno(l: ChildLibretaModel) {
        if (!this.hasUrl(l)) return;
        window.open(l.url!, '_blank', 'noopener');
    }

    cerrarPreview() {
        this.preview.set(null);
    }
}