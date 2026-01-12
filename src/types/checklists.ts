export interface ChecklistRow {
    id: number;
    title: string;
    createdAt: string;
    updatedAt: string;
    hidden: number;
    pinned: number;
    items?: ChecklistItemRow[];
}

export interface ChecklistItemRow {
    id: number;
    checklistId: number;
    content: string;
    checked: number;
    position: number;
}
