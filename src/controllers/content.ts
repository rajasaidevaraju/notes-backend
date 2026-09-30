import { Request, Response } from 'express';
import { NoteRow } from '../types/notes';
import { ChecklistRow } from '../types/checklists';
import { TrackerRow } from '../types/trackers';
import * as NoteService from '../services/note';
import * as ChecklistService from '../services/checklist';
import * as TrackerService from '../services/tracker';
import { badRequest } from '../errors';
import { tx, ContentCounts } from '../database';
import { isAuthenticated } from '../middleware/auth';

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
        return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
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

export const getContentCounts = (req: Request, res: Response) => {
    const counts = tx(() => [
        NoteService.countNotes(),
        ChecklistService.countChecklists(),
        TrackerService.countTrackers(),
    ]);
    const sum = (key: keyof ContentCounts) => counts.reduce((total, c) => total + c[key], 0);

    res.json({
        archived: sum('archived'),
        ...(isAuthenticated(req) && { hidden: sum('hidden') }),
    });
};

const CONTENT_TYPES = ['note', 'checklist', 'tracker'] as const;
type ContentType = typeof CONTENT_TYPES[number];

export const deleteBatchContent = (req: Request, res: Response) => {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        throw badRequest('An array of items (id, type) is required.');
    }

    for (const item of items) {
        if (!CONTENT_TYPES.includes(item?.type) || !Number.isInteger(item?.id) || item.id <= 0) {
            throw badRequest('Each item needs a positive integer id and a type of note, checklist or tracker.');
        }
    }

    const idsOfType = (type: ContentType): number[] =>
        items.filter((item) => item.type === type).map((item) => item.id);
    const authenticated = isAuthenticated(req);

    const deleted = tx(() =>
        NoteService.deleteBatchNotes(idsOfType('note'), authenticated) +
        ChecklistService.deleteBatchChecklists(idsOfType('checklist'), authenticated) +
        TrackerService.deleteBatchTrackers(idsOfType('tracker'), authenticated)
    );

    res.status(200).json({ message: `Successfully deleted ${deleted} items.` });
};
