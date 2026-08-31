import { Request, Response } from 'express';
import * as TrackerService from '../services/tracker';
import { ImportEntry } from '../services/tracker';
import { LIMITS } from '../constants';
import { firstLengthError, requireIdParam } from '../validation';
import { badRequest, forbidden } from '../errors';
import { isAuthenticated } from '../middleware/auth';

export const getAllVisibleTrackers = (req: Request, res: Response) => {
    res.json(TrackerService.getAllVisibleTrackers());
};

export const getHiddenTrackers = (req: Request, res: Response) => {
    res.json(TrackerService.getHiddenTrackers());
};

export const getArchivedTrackers = (req: Request, res: Response) => {
    res.json(TrackerService.getArchivedTrackers());
};

const validateTrackerMeta = (title: unknown, unit: unknown) => {
    const lengthError = firstLengthError([
        [title, LIMITS.TITLE, 'Title'],
        [unit, LIMITS.TRACKER_UNIT, 'Unit'],
    ]);
    if (lengthError) throw badRequest(lengthError);
};

const requireValue = (value: unknown): string => {
    if (typeof value !== 'string' || !value.trim()) throw badRequest('Value is required');

    const trimmed = value.trim();
    const lengthError = firstLengthError([[trimmed, LIMITS.TRACKER_VALUE, 'Value']]);
    if (lengthError) throw badRequest(lengthError);

    return trimmed;
};

const isPositiveInteger = (value: unknown): boolean =>
    Number.isInteger(Number(value)) && Number(value) > 0;

export const createTracker = (req: Request, res: Response) => {
    const { title, unit, pinned, hidden } = req.body;

    if (!title) throw badRequest('Title is required');
    validateTrackerMeta(title, unit);

    res.status(201).json(TrackerService.createTracker(title, unit, pinned, hidden));
};

export const updateTracker = (req: Request, res: Response) => {
    const id = requireIdParam(req.params.id, 'Tracker');
    const { title, unit, pinned, hidden, archived, deletedEntryIds } = req.body;
    validateTrackerMeta(title, unit);

    if (typeof deletedEntryIds !== 'undefined') {
        if (!Array.isArray(deletedEntryIds) || deletedEntryIds.some((entryId) => !isPositiveInteger(entryId))) {
            throw badRequest('deletedEntryIds must be an array of positive integers.');
        }
    }

    res.json(TrackerService.updateTracker(
        id, title, unit, pinned, hidden, archived, isAuthenticated(req),
        typeof deletedEntryIds !== 'undefined' ? deletedEntryIds.map(Number) : undefined
    ));
};

export const deleteTracker = (req: Request, res: Response) => {
    const id = requireIdParam(req.params.id, 'Tracker');

    TrackerService.deleteTracker(id, isAuthenticated(req));
    res.status(204).send();
};

export const addEntry = (req: Request, res: Response) => {
    const id = requireIdParam(req.params.id, 'Tracker');
    const value = requireValue(req.body.value);

    res.status(201).json(TrackerService.addEntry(id, value, isAuthenticated(req)));
};

export const updateEntry = (req: Request, res: Response) => {
    const entryId = requireIdParam(req.params.entryId, 'Entry');
    const value = requireValue(req.body.value);

    res.json(TrackerService.updateEntry(entryId, value, isAuthenticated(req)));
};

export const importTracker = (req: Request, res: Response) => {
    if (!isAuthenticated(req)) {
        throw forbidden('Unauthorized. Valid PIN required to import tracker data.');
    }

    const { title, unit, trackerId, entries } = req.body;

    if (typeof trackerId === 'undefined' && (typeof title !== 'string' || !title.trim())) {
        throw badRequest('Either title (new tracker) or trackerId (existing) is required.');
    }

    if (typeof trackerId !== 'undefined' && !isPositiveInteger(trackerId)) {
        throw badRequest('trackerId must be a positive integer.');
    }

    if (typeof unit !== 'undefined' && unit !== null && typeof unit !== 'string') {
        throw badRequest('unit must be a string.');
    }

    validateTrackerMeta(title, unit);

    if (!Array.isArray(entries) || entries.length === 0) {
        throw badRequest('A non-empty entries array is required.');
    }

    const cleaned: ImportEntry[] = entries.map((entry: any, i: number) => {
        const value = typeof entry?.value === 'string' ? entry.value.trim() : String(entry?.value ?? '').trim();
        if (!value) throw badRequest(`Entry ${i}: value is required.`);
        if (value.length > LIMITS.TRACKER_VALUE) {
            throw badRequest(`Entry ${i}: value must be at most ${LIMITS.TRACKER_VALUE} characters.`);
        }

        const parsed = new Date(entry?.recordedAt);
        if (!entry?.recordedAt || isNaN(parsed.getTime())) {
            throw badRequest(`Entry ${i}: recordedAt is missing or not a valid date ("${entry?.recordedAt}").`);
        }

        return { value, recordedAt: parsed.toISOString() };
    });

    res.status(201).json(TrackerService.importTracker(
        typeof title === 'string' ? title.trim() : undefined,
        unit || null,
        typeof trackerId !== 'undefined' ? Number(trackerId) : undefined,
        cleaned,
        isAuthenticated(req)
    ));
};
