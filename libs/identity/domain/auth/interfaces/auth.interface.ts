import { AuthProvider } from '@shared/domain/enums/auth-provider.enum';
import { IUser } from '@libs/identity/domain/user/interfaces/user.interface';

export interface IAuth {
    uuid: string;
    user?: IUser;
    refreshToken: string;
    used: boolean;
    expiryDate: Date;
    authDetails?: any;
    authProvider: AuthProvider;
}
