export interface AccountRow {
    id: number;
    groupId: number | null;
    identifier: string;
    password: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    pinned: number;
}

export interface AccountView extends AccountRow {
    locked: boolean;
}

export interface AccountGroupRow {
    id: number;
    name: string;
    createdAt: string;
}
