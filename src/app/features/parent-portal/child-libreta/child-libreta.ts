import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ParentPortalService } from '../stores/parent-portal.store';
import { ChildLibreta as ChildLibretaModel } from '../../../core/models/parent-portal';

@Component({
    selector: 'app-child-libreta',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        MatCardModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatTooltipModule,
        PageHeader, EmptyState,
    ],
    templateUrl: './child-libreta.html',
    styleUrl: './child-libreta.scss',
})
export class ChildLibreta implements OnInit {
    private route = inject(ActivatedRoute);
    private store = inject(ParentPortalService);

    readonly libretas = signal<ChildLibretaModel[]>([]);
    readonly loading = signal(true);

    readonly childId = computed<string>(() =>
        this.route.snapshot.paramMap.get('childId') ?? '',
    );

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

    open(url: string | null | undefined) {
        if (!url) return;
        window.open(url, '_blank', 'noopener');
    }

    /** True si la libreta tiene URL firmada lista para descarga. */
    hasUrl(l: ChildLibretaModel): boolean {
        return typeof l.url === 'string' && l.url.length > 0;
    }
}
