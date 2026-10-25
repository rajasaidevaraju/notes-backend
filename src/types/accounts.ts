export interface AccountRow {
    id: number;
    name: string | null;
    identifier: string;
    password: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    pinned: number;
}

export interface AccountView extends AccountRow {
    tagIds: number[];
    locked: boolean;
}
