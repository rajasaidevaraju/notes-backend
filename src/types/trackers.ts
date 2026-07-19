export interface TrackerRow {
    id: number;
    title: string;
    unit: string | null;
    createdAt: string;
    updatedAt: string;
    hidden: number;
    pinned: number;
    entries?: TrackerEntryRow[];
}

export interface TrackerEntryRow {
    id: number;
    trackerId: number;
    value: string;
    recordedAt: string;
}
