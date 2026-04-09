import { Routes } from '@angular/router';

export const FORUM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./forum-list/forum-list/forum-list').then(c => c.ForumList),
  },
  {
    path: ':id',
    loadComponent: () => import('./forum-thread/forum-thread/forum-thread').then(c => c.ForumThread),
  },
];