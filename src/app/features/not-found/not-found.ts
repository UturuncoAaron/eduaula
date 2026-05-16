import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-not-found',
    standalone: true,
    imports: [MatIconModule],
    templateUrl: './not-found.html',
    styleUrl: './not-found.scss',
})
export class NotFound {
    private router = inject(Router);

    goHome(): void {
        this.router.navigate(['/dashboard']);
    }

    goBack(): void {
        if (history.length > 1) {
            history.back();
        } else {
            this.router.navigate(['/dashboard']);
        }
    }
}