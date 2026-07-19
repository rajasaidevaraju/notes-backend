import { Request, Response } from 'express';
import { NoteRow } from '../types/notes';
import { ChecklistRow } from '../types/checklists';
import { TrackerRow } from '../types/trackers';
import { NoteService } from '../services/noteService';
import { ChecklistService } from '../services/checklistService';
import { TrackerService } from '../services/trackerService';

export type UnifiedItem =
    (NoteRow & { type: 'note' }) |
    (ChecklistRow & { type: 'checklist' }) |
    (TrackerRow & { type: 'tracker' });

export const getAllContent = async (req: Request, res: Response) => {
    try {
        const [notes, checklists, trackers] = await Promise.all([
            NoteService.getAllVisibleNotes(),
            ChecklistService.getAllVisibleChecklists(),
            TrackerService.getAllVisibleTrackers()
        ]);

        const mixed: UnifiedItem[] = [
            ...notes.map(n => ({ ...n, type: 'note' as const })),
            ...checklists.map(c => ({ ...c, type: 'checklist' as const })),
            ...trackers.map(t => ({ ...t, type: 'tracker' as const }))
        ];

        mixed.sort((a, b) => {
            if (a.pinned !== b.pinned) return (b.pinned || 0) - (a.pinned || 0);
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        res.json(mixed);
    } catch (err: any) {
        console.error('Error fetching content:', err.message);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
};

export const getHiddenContent = async (req: Request, res: Response) => {
    try {
        const [notes, checklists, trackers] = await Promise.all([
            NoteService.getHiddenNotes(),
            ChecklistService.getHiddenChecklists(),
            TrackerService.getHiddenTrackers()
        ]);

        const mixed: UnifiedItem[] = [
            ...notes.map(n => ({ ...n, type: 'note' as const })),
            ...checklists.map(c => ({ ...c, type: 'checklist' as const })),
            ...trackers.map(t => ({ ...t, type: 'tracker' as const }))
        ];

        mixed.sort((a, b) => {
            if (a.pinned !== b.pinned) return (b.pinned || 0) - (a.pinned || 0);
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        res.json(mixed);
    } catch (err: any) {
        if (err.message === 'Unauthorized') {
            res.status(403).json({ error: 'Unauthorized' });
        } else {
            console.error('Error fetching hidden content:', err.message);
            res.status(500).json({ error: 'Failed to fetch hidden content' });
        }
    }
};


export const deleteBatchContent = async (req: Request, res: Response) => {
    const { items } = req.body; // Expecting [{ id: 1, type: 'note' }, { id: 2, type: 'checklist' }]

    if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'An array of items (id, type) is required.' });
        return;
    }

    const noteIds = items.filter((item: any) => item.type === 'note').map((item: any) => item.id);
    const checklistIds = items.filter((item: any) => item.type === 'checklist').map((item: any) => item.id);
    const trackerIds = items.filter((item: any) => item.type === 'tracker').map((item: any) => item.id);

    try {
        let deletedNotesCount = 0;
        let deletedChecklistsCount = 0;
        let deletedTrackersCount = 0;

        if (noteIds.length > 0) {
            deletedNotesCount = await NoteService.deleteBatchNotes(noteIds);
        }

        if (checklistIds.length > 0) {
            deletedChecklistsCount = await ChecklistService.deleteBatchChecklists(checklistIds);
        }

        if (trackerIds.length > 0) {
            deletedTrackersCount = await TrackerService.deleteBatchTrackers(trackerIds);
        }

        res.status(200).json({ message: `Successfully deleted ${deletedNotesCount + deletedChecklistsCount + deletedTrackersCount} items.` });
    } catch (err: any) {
        if (err.message.startsWith('Unauthorized')) {
            res.status(403).json({ error: err.message });
        } else if (err.message.includes('Cannot delete')) {
            res.status(403).json({ error: err.message });
        } else {
            console.error('Error deleting batch content:', err.message);
            res.status(500).json({ error: 'Failed to delete content.' });
        }
    }
};

