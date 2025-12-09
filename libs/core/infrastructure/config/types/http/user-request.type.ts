import { IUser } from '@libs/identity/domain/user/interfaces/user.interface';
import { Request } from 'express';

type User = Partial<Omit<IUser, 'password'>>;

export type UserRequest = Request & { user: User };
