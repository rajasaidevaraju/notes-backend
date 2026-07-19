import { Request, Response } from 'express';
import { TrackerService, ImportEntry } from '../services/trackerService';
import { LIMITS } from '../constants';
import { firstLengthError } from '../validation';

const correctPin = process.env.HIDDEN_NOTES_PIN;

// A missing HIDDEN_NOTES_PIN must never authenticate (undefined === undefined)
const isAuthenticated = (req: Request): boolean =>
    Boolean(correctPin) && req.cookies?.auth_pin === correctPin;

export const getAllVisibleTrackers = async (req: Request, res: Response) => {
    try {
        const trackers = await TrackerService.getAllVisibleTrackers();
        res.json(trackers);
    } catch (err: any) {
        console.error('Error fetching trackers:', err.message);
        res.status(500).json({ error: 'Failed to fetch trackers' });
    }
};

export const getHiddenTrackers = async (req: Request, res: Response) => {
    try {
        const trackers = await TrackerService.getHiddenTrackers();
        res.json(trackers);
    } catch (err: any) {
        if (err.message === 'Unauthorized') {
            res.status(403).json({ error: 'Unauthorized' });
        } else {
            console.error('Error fetching hidden trackers:', err.message);
            res.status(500).json({ error: 'Failed to fetch hidden trackers' });
        }
    }
};

export const createTracker = async (req: Request, res: Response) => {
    const { title, unit, pinned, hidden } = req.body;

    if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
    }

    const lengthError = firstLengthError([
        [title, LIMITS.TITLE, 'Title'],
        [unit, LIMITS.TRACKER_UNIT, 'Unit'],
    ]);
    if (lengthError) {
        res.status(400).json({ error: lengthError });
        return;
    }

    try {
        const newTracker = await TrackerService.createTracker(title, unit, pinned, hidden);
        res.status(201).json(newTracker);
    } catch (err: any) {
        console.error('Error creating tracker:', err.message);
        res.status(500).json({ error: 'Failed to create tracker' });
    }
};

export const updateTracker = async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'Invalid Tracker ID' });
        return;
    }
    const { title, unit, pinned, hidden, deletedEntryIds } = req.body;

    const lengthError = firstLengthError([
        [title, LIMITS.TITLE, 'Title'],
        [unit, LIMITS.TRACKER_UNIT, 'Unit'],
    ]);
    if (lengthError) {
        res.status(400).json({ error: lengthError });
        return;
    }

    if (typeof deletedEntryIds !== 'undefined') {
        if (!Array.isArray(deletedEntryIds) || deletedEntryIds.some((entryId) => !Number.isInteger(Number(entryId)) || Number(entryId) <= 0)) {
            res.status(400).json({ error: 'deletedEntryIds must be an array of positive integers.' });
            return;
        }
    }

    try {
        const updatedTracker = await TrackerService.updateTracker(
            id, title, unit, pinned, hidden, isAuthenticated(req),
            typeof deletedEntryIds !== 'undefined' ? deletedEntryIds.map(Number) : undefined
        );
        res.json(updatedTracker);
    } catch (err: any) {
        if (err.message === 'Tracker not found') {
            res.status(404).json({ error: err.message });
        } else if (err.message.startsWith('Unauthorized')) {
            res.status(403).json({ error: err.message });
        } else {
            console.error('Error updating tracker:', err.message);
            res.status(500).json({ error: 'Failed to update tracker' });
        }
    }
};

export const deleteTracker = async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'Invalid Tracker ID' });
        return;
    }

    try {
        await TrackerService.deleteTracker(id, isAuthenticated(req));
        res.status(204).send();
    } catch (err: any) {
        if (err.message === 'Tracker not found') {
            res.status(404).json({ error: err.message });
        } else if (err.message.startsWith('Unauthorized')) {
            res.status(403).json({ error: err.message });
        } else {
            console.error('Error deleting tracker:', err.message);
            res.status(500).json({ error: 'Failed to delete tracker' });
        }
    }
};

export const addEntry = async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'Invalid Tracker ID' });
        return;
    }
    const { value } = req.body;

    if (typeof value !== 'string' || !value.trim()) {
        res.status(400).json({ error: 'Value is required' });
        return;
    }

    const lengthError = firstLengthError([[value.trim(), LIMITS.TRACKER_VALUE, 'Value']]);
    if (lengthError) {
        res.status(400).json({ error: lengthError });
        return;
    }

    try {
        const newEntry = await TrackerService.addEntry(id, value.trim(), isAuthenticated(req));
        res.status(201).json(newEntry);
    } catch (err: any) {
        if (err.message === 'Tracker not found') {
            res.status(404).json({ error: err.message });
        } else if (err.message.startsWith('Unauthorized')) {
            res.status(403).json({ error: err.message });
        } else {
            console.error('Error adding entry:', err.message);
            res.status(500).json({ error: 'Failed to add entry' });
        }
    }
};

export const updateEntry = async (req: Request, res: Response) => {
    const { entryId } = req.params;
    if (!entryId || typeof entryId !== 'string') {
        res.status(400).json({ error: 'Invalid Entry ID' });
        return;
    }
    const { value } = req.body;

    if (typeof value !== 'string' || !value.trim()) {
        res.status(400).json({ error: 'Value is required' });
        return;
    }

    const lengthError = firstLengthError([[value.trim(), LIMITS.TRACKER_VALUE, 'Value']]);
    if (lengthError) {
        res.status(400).json({ error: lengthError });
        return;
    }

    try {
        const updatedEntry = await TrackerService.updateEntry(entryId, value.trim(), isAuthenticated(req));
        res.json(updatedEntry);
    } catch (err: any) {
        if (err.message === 'Entry not found' || err.message === 'Tracker not found') {
            res.status(404).json({ error: err.message });
        } else if (err.message.startsWith('Unauthorized')) {
            res.status(403).json({ error: err.message });
        } else {
            console.error('Error updating entry:', err.message);
            res.status(500).json({ error: 'Failed to update entry' });
        }
    }
};

/**
 * Bulk import for migrating existing time-series data. Unlike the regular
 * add-entry endpoint, entries here carry their own recordedAt dates.
 *
 * Body: { title, unit?, entries: [{ value, recordedAt }] }  → creates a tracker
 *   or: { trackerId, entries: [...] }                       → appends to one
 *
 * Bulk import always requires a valid PIN, not just for hidden trackers.
 */
export const importTracker = async (req: Request, res: Response) => {
    if (!isAuthenticated(req)) {
        res.status(403).json({ error: 'Unauthorized. Valid PIN required to import tracker data.' });
        return;
    }

    const { title, unit, trackerId, entries } = req.body;

    if (typeof trackerId === 'undefined' && (typeof title !== 'string' || !title.trim())) {
        res.status(400).json({ error: 'Either title (new tracker) or trackerId (existing) is required.' });
        return;
    }

    if (typeof trackerId !== 'undefined' && (!Number.isInteger(Number(trackerId)) || Number(trackerId) <= 0)) {
        res.status(400).json({ error: 'trackerId must be a positive integer.' });
        return;
    }

    if (typeof unit !== 'undefined' && unit !== null && typeof unit !== 'string') {
        res.status(400).json({ error: 'unit must be a string.' });
        return;
    }

    const metaLengthError = firstLengthError([
        [title, LIMITS.TITLE, 'Title'],
        [unit, LIMITS.TRACKER_UNIT, 'Unit'],
    ]);
    if (metaLengthError) {
        res.status(400).json({ error: metaLengthError });
        return;
    }

    if (!Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: 'A non-empty entries array is required.' });
        return;
    }

    const cleaned: ImportEntry[] = [];
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const value = typeof entry?.value === 'string' ? entry.value.trim() : String(entry?.value ?? '').trim();
        if (!value) {
            res.status(400).json({ error: `Entry ${i}: value is required.` });
            return;
        }
        if (value.length > LIMITS.TRACKER_VALUE) {
            res.status(400).json({ error: `Entry ${i}: value must be at most ${LIMITS.TRACKER_VALUE} characters.` });
            return;
        }

        const parsed = new Date(entry?.recordedAt);
        if (!entry?.recordedAt || isNaN(parsed.getTime())) {
            res.status(400).json({ error: `Entry ${i}: recordedAt is missing or not a valid date ("${entry?.recordedAt}").` });
            return;
        }

        cleaned.push({ value, recordedAt: parsed.toISOString() });
    }

    try {
        const tracker = await TrackerService.importTracker(
            typeof title === 'string' ? title.trim() : undefined,
            unit || null,
            typeof trackerId !== 'undefined' ? Number(trackerId) : undefined,
            cleaned,
            isAuthenticated(req)
        );
        res.status(201).json(tracker);
    } catch (err: any) {
        if (err.message === 'Tracker not found') {
            res.status(404).json({ error: err.message });
        } else if (err.message.startsWith('Unauthorized')) {
            res.status(403).json({ error: err.message });
        } else if (err.message === 'Title is required') {
            res.status(400).json({ error: err.message });
        } else {
            console.error('Error importing tracker:', err.message);
            res.status(500).json({ error: 'Failed to import tracker' });
        }
    }
};
