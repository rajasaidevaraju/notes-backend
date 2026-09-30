import { Request, Response } from 'express';
import * as TrackerService from '../services/tracker';
import { ImportEntry } from '../services/tracker';
import { LIMITS } from '../constants';
import {
    isPositiveInteger,
    optionalFlag,
    optionalNullableString,
    optionalString,
    optionalTitle,
    requireIdParam,
    requireString,
} from '../validation';
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

const requireValue = (value: unknown): string => {
    const trimmed = requireString(value, 'Value', Infinity).trim();
    if (trimmed.length > LIMITS.TRACKER_VALUE) {
        throw badRequest(`Value must be at most ${LIMITS.TRACKER_VALUE} characters.`);
    }
    return trimmed;
};

export const createTracker = (req: Request, res: Response) => {
    const { title, unit, pinned, hidden } = req.body;

    res.status(201).json(TrackerService.createTracker(
        requireString(title, 'Title', LIMITS.TITLE),
        optionalNullableString(unit, 'Unit', LIMITS.TRACKER_UNIT) ?? null,
        optionalFlag(pinned, 'pinned') ?? false,
        optionalFlag(hidden, 'hidden') ?? false
    ));
};

export const updateTracker = (req: Request, res: Response) => {
    const id = requireIdParam(req.params.id, 'Tracker');
    const { title, unit, pinned, hidden, archived, deletedEntryIds } = req.body;

    if (typeof deletedEntryIds !== 'undefined') {
        if (!Array.isArray(deletedEntryIds) || deletedEntryIds.some((entryId) => !isPositiveInteger(entryId))) {
            throw badRequest('deletedEntryIds must be an array of positive integers.');
        }
    }

    res.json(TrackerService.updateTracker(id, {
        title: optionalTitle(title, LIMITS.TITLE),
        unit: optionalNullableString(unit, 'Unit', LIMITS.TRACKER_UNIT),
        pinned: optionalFlag(pinned, 'pinned'),
        hidden: optionalFlag(hidden, 'hidden'),
        archived: optionalFlag(archived, 'archived'),
        deletedEntryIds: deletedEntryIds?.map(Number),
    }, isAuthenticated(req)));
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

    optionalString(title, 'Title', LIMITS.TITLE);
    optionalNullableString(unit, 'Unit', LIMITS.TRACKER_UNIT);

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
