import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { EditProfileDialog } from '../../shared/components/edit-profile-dialog/edit-profile-dialog';
import { User } from '../models/user';
import { AvatarRole } from '../../shared/components/user-avatar/user-avatar';

@Injectable({ providedIn: 'root' })
export class UserEditService {
    private dialog = inject(MatDialog);
    async openEdit(row: Partial<User> & { id: string }, rol: AvatarRole): Promise<boolean> {
        const user: User = { ...row, rol } as User;
        const ref = this.dialog.open(EditProfileDialog, {
            width: '620px',
            maxHeight: '90vh',
            disableClose: true,
            data: { user, isSelf: false },
        });
        const result = await firstValueFrom(ref.afterClosed());
        return !!result?.updated;
    }
}