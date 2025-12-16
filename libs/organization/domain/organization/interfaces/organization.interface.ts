export interface IOrganization<TUser = any, TTeam = any> {
    uuid: string;
    name: string;
    tenantName: string;
    status: boolean;
    users?: Partial<TUser>[] | null;
    teams?: Partial<TTeam>[] | null;
}
