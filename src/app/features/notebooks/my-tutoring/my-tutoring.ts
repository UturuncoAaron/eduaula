import {
  Component, ChangeDetectionStrategy, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TutoringStore } from '../tutoring.store';

@Component({
  selector: 'app-my-tutoring',
  imports: [
    CommonModule,
    RouterLink, RouterLinkActive, RouterOutlet,
    MatTabsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  providers: [TutoringStore],
  templateUrl: './my-tutoring.html',
  styleUrl: './my-tutoring.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyTutoring implements OnInit {
  readonly store = inject(TutoringStore);

  readonly tabs = [
    { path: 'alumnos', label: 'Alumnos', icon: 'group' },
    { path: 'padres', label: 'Padres', icon: 'family_restroom' },
    { path: 'libretas', label: 'Libretas', icon: 'description' },
  ];

  ngOnInit(): void {
    this.store.load();
  }
}