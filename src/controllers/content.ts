import { Request, Response } from 'express';
import { NoteRow } from '../types/notes';
import { ChecklistRow } from '../types/checklists';
import { TrackerRow } from '../types/trackers';
import * as NoteService from '../services/note';
import * as ChecklistService from '../services/checklist';
import * as TrackerService from '../services/tracker';
import { badRequest } from '../errors';

export type UnifiedItem =
    (NoteRow & { type: 'note' }) |
    (ChecklistRow & { type: 'checklist' }) |
    (TrackerRow & { type: 'tracker' });

const merge = (notes: NoteRow[], checklists: ChecklistRow[], trackers: TrackerRow[]): UnifiedItem[] => {
    const mixed: UnifiedItem[] = [
        ...notes.map(n => ({ ...n, type: 'note' as const })),
        ...checklists.map(c => ({ ...c, type: 'checklist' as const })),
        ...trackers.map(t => ({ ...t, type: 'tracker' as const }))
    ];

    mixed.sort((a, b) => {
        if (a.pinned !== b.pinned) return (b.pinned || 0) - (a.pinned || 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return mixed;
};

export const getAllContent = (req: Request, res: Response) => {
    res.json(merge(
        NoteService.getAllVisibleNotes(),
        ChecklistService.getAllVisibleChecklists(),
        TrackerService.getAllVisibleTrackers()
    ));
};

export const getHiddenContent = (req: Request, res: Response) => {
    res.json(merge(
        NoteService.getHiddenNotes(),
        ChecklistService.getHiddenChecklists(),
        TrackerService.getHiddenTrackers()
    ));
};

export const getArchivedContent = (req: Request, res: Response) => {
    res.json(merge(
        NoteService.getArchivedNotes(),
        ChecklistService.getArchivedChecklists(),
        TrackerService.getArchivedTrackers()
    ));
};

export const deleteBatchContent = (req: Request, res: Response) => {
    const { items } = req.body; // Expecting [{ id: 1, type: 'note' }, { id: 2, type: 'checklist' }]

    if (!Array.isArray(items) || items.length === 0) {
        throw badRequest('An array of items (id, type) is required.');
    }

    const idsOfType = (type: string): number[] =>
        items.filter((item: any) => item.type === type).map((item: any) => item.id);

    const deleted =
        NoteService.deleteBatchNotes(idsOfType('note')) +
        ChecklistService.deleteBatchChecklists(idsOfType('checklist')) +
        TrackerService.deleteBatchTrackers(idsOfType('tracker'));

    res.status(200).json({ message: `Successfully deleted ${deleted} items.` });
};
