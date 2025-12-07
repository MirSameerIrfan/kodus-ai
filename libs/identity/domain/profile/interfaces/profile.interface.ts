import { IUser } from '@libs/identity/domain/user/interfaces/user.interface';

export interface IProfile {
    uuid: string;
    name: string;
    phone?: string;
    img?: string;
    status: boolean;
    position?: string;
    user?: Partial<IUser>;
}
