import { dbQuery, dbRun, dbGet, tx, updateRow, COUNT_COLUMNS, ContentCounts } from '../database';
import { TrackerRow, TrackerEntryRow } from '../types/trackers';
import { badRequest, forbidden, internal, notFound } from '../errors';

export interface ImportEntry {
    value: string;
    recordedAt: string;
}

export interface TrackerChanges {
    title?: string;
    unit?: string | null;
    pinned?: boolean;
    hidden?: boolean;
    archived?: boolean;
    deletedEntryIds?: number[];
}

const TRACKER_SELECT = `
    SELECT t.*, e.id as entryId, e.value as entryValue, e.recordedAt
    FROM trackers t
    LEFT JOIN tracker_entries e ON t.id = e.trackerId
`;

const TRACKER_ORDER = 'ORDER BY t.pinned DESC, t.createdAt DESC, e.recordedAt DESC, e.id DESC';

export function getAllVisibleTrackers(): TrackerRow[] {
    return formatTrackerRows(dbQuery(`${TRACKER_SELECT} WHERE t.hidden = 0 AND t.archived = 0 ${TRACKER_ORDER}`));
}

export function getHiddenTrackers(): TrackerRow[] {
    return formatTrackerRows(dbQuery(`${TRACKER_SELECT} WHERE t.hidden = 1 AND t.archived = 0 ${TRACKER_ORDER}`));
}

export function getArchivedTrackers(): TrackerRow[] {
    return formatTrackerRows(dbQuery(`${TRACKER_SELECT} WHERE t.archived = 1 ${TRACKER_ORDER}`));
}

export function countTrackers(): ContentCounts {
    return dbGet(`SELECT ${COUNT_COLUMNS} FROM trackers`);
}

export function getTrackerById(id: number): TrackerRow | null {
    const rows = dbQuery(`${TRACKER_SELECT} WHERE t.id = ? ORDER BY e.recordedAt DESC, e.id DESC`, [id]);
    if (rows.length === 0) return null;
    return formatTrackerRows(rows)[0] || null;
}

/**
 * Loads a tracker for writing, enforcing the hidden-tracker PIN rule.
 * `action` completes the message, e.g. "modify" / "delete".
 */
function requireTracker(id: number, isAuthenticated: boolean, action: string): void {
    const row = dbGet('SELECT hidden FROM trackers WHERE id = ?', [id]);
    if (!row) throw notFound('Tracker');

    if (row.hidden === 1 && !isAuthenticated) {
        throw forbidden(`Unauthorized. Valid PIN required to ${action} a hidden tracker.`);
    }
}

function touchTracker(trackerId: number, at: string): void {
    dbRun('UPDATE trackers SET updatedAt = ? WHERE id = ?', [at, trackerId]);
}

export function createTracker(title: string, unit: string | null, pinned: boolean, hidden: boolean): TrackerRow {
    return tx(() => {
        const now = new Date().toISOString();
        const result = dbRun(
            'INSERT INTO trackers (title, unit, pinned, hidden, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
            [title, unit || null, pinned ? 1 : 0, hidden ? 1 : 0, now, now]
        );

        const tracker = getTrackerById(result.lastID);
        if (!tracker) throw internal('Failed to retrieve created tracker');
        return tracker;
    });
}

/** Partial update: every field left undefined keeps its current value. */
export function updateTracker(id: number, changes: TrackerChanges, isAuthenticated: boolean): TrackerRow {
    requireTracker(id, isAuthenticated, 'modify');

    const { deletedEntryIds, ...columns } = changes;

    return tx(() => {
        updateRow('trackers', id, columns);

        if (deletedEntryIds && deletedEntryIds.length > 0) {
            const placeholders = deletedEntryIds.map(() => '?').join(',');
            dbRun(
                `DELETE FROM tracker_entries WHERE trackerId = ? AND id IN (${placeholders})`,
                [id, ...deletedEntryIds]
            );
        }

        const updated = getTrackerById(id);
        if (!updated) throw internal('Failed to retrieve updated tracker');
        return updated;
    });
}

export function deleteTracker(id: number, isAuthenticated: boolean): void {
    requireTracker(id, isAuthenticated, 'delete');
    dbRun('DELETE FROM trackers WHERE id = ?', [id]);
}

export function deleteBatchTrackers(ids: number[], isAuthenticated: boolean): number {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');

    if (!isAuthenticated && dbGet(`SELECT 1 FROM trackers WHERE hidden = 1 AND id IN (${placeholders})`, ids)) {
        throw forbidden('Unauthorized. Valid PIN required to delete hidden trackers.');
    }

    return dbRun(`DELETE FROM trackers WHERE id IN (${placeholders})`, ids).changes;
}

export function addEntry(trackerId: number, value: string, isAuthenticated: boolean): TrackerEntryRow {
    requireTracker(trackerId, isAuthenticated, 'modify');

    return tx(() => {
        // recordedAt is always server time — clients never send timestamps here
        const now = new Date().toISOString();
        const result = dbRun(
            'INSERT INTO tracker_entries (trackerId, value, recordedAt) VALUES (?, ?, ?)',
            [trackerId, value, now]
        );

        touchTracker(trackerId, now);
        return dbGet('SELECT * FROM tracker_entries WHERE id = ?', [result.lastID]);
    });
}

export function updateEntry(entryId: number, value: string, isAuthenticated: boolean): TrackerEntryRow {
    const entry = dbGet('SELECT trackerId FROM tracker_entries WHERE id = ?', [entryId]);
    if (!entry) throw notFound('Entry');

    requireTracker(entry.trackerId, isAuthenticated, 'modify');

    return tx(() => {
        dbRun('UPDATE tracker_entries SET value = ? WHERE id = ?', [value, entryId]);
        touchTracker(entry.trackerId, new Date().toISOString());
        return dbGet('SELECT * FROM tracker_entries WHERE id = ?', [entryId]);
    });
}

/**
 * Bulk import for migrating existing data. Entries carry their own
 * recordedAt dates. Creates a new tracker unless trackerId is given,
 * in which case entries are appended to it.
 */
export function importTracker(
    title: string | undefined,
    unit: string | null,
    trackerId: number | undefined,
    entries: ImportEntry[],
    isAuthenticated: boolean
): TrackerRow {
    return tx(() => {
        const now = new Date().toISOString();
        let targetId: number;

        if (typeof trackerId !== 'undefined') {
            requireTracker(trackerId, isAuthenticated, 'modify');
            targetId = trackerId;
        } else {
            if (!title) throw badRequest('Title is required');
            const result = dbRun(
                'INSERT INTO trackers (title, unit, pinned, hidden, createdAt, updatedAt) VALUES (?, ?, 0, 0, ?, ?)',
                [title, unit || null, now, now]
            );
            targetId = result.lastID;
        }

        if (entries.length > 0) {
            const placeholders = entries.map(() => '(?, ?, ?)').join(',');
            const params: any[] = [];
            entries.forEach((entry) => {
                params.push(targetId, entry.value, entry.recordedAt);
            });
            dbRun(`INSERT INTO tracker_entries (trackerId, value, recordedAt) VALUES ${placeholders}`, params);
        }

        touchTracker(targetId, now);

        const tracker = getTrackerById(targetId);
        if (!tracker) throw internal('Failed to retrieve imported tracker');
        return tracker;
    });
}

function formatTrackerRows(rows: any[]): TrackerRow[] {
    const trackerMap = new Map<number, TrackerRow>();

    rows.forEach((row) => {
        if (!trackerMap.has(row.id)) {
            trackerMap.set(row.id, {
                id: row.id,
                title: row.title,
                unit: row.unit,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                pinned: row.pinned,
                hidden: row.hidden,
                archived: row.archived,
                entries: [],
            });
        }

        if (row.entryId) {
            trackerMap.get(row.id)!.entries!.push({
                id: row.entryId,
                trackerId: row.id,
                value: row.entryValue,
                recordedAt: row.recordedAt,
            });
        }
    });

    return Array.from(trackerMap.values());
}
