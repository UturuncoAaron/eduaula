import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PageHeader } from '../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago-pipe';
import { ParentPortalService } from '../stores/parent-portal.store';
import { Announcement } from '../../../core/models/parent-portal';

@Component({
  selector: 'app-announcements',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule, MatIconModule, MatProgressSpinnerModule,
    PageHeader, EmptyState, TimeAgoPipe,
  ],
  templateUrl: './announcements.html',
  styleUrl: './announcements.scss',
})
export class Announcements implements OnInit {
  private store = inject(ParentPortalService);

  readonly items = signal<Announcement[]>([]);
  readonly loading = signal(true);

  /** Solo comunicados destinados a padres o a todos. */
  readonly visible = computed<Announcement[]>(() =>
    this.items().filter(a => a.destinatario === 'padres' || a.destinatario === 'todos'),
  );

  ngOnInit() {
    this.store.getAnnouncementsForParent().subscribe({
      next: r => {
        this.items.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.loading.set(false);
      },
    });
  }
}
