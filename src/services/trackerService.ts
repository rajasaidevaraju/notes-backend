import { dbQuery, dbRun, dbGet } from '../database';
import { TrackerRow, TrackerEntryRow } from '../types/trackers';

export interface ImportEntry {
    value: string;
    recordedAt: string;
}

export class TrackerService {

    static async getAllVisibleTrackers(): Promise<TrackerRow[]> {
        const query = `
            SELECT t.*, e.id as entryId, e.value as entryValue, e.recordedAt
            FROM trackers t
            LEFT JOIN tracker_entries e ON t.id = e.trackerId
            WHERE t.hidden = 0
            ORDER BY t.pinned DESC, t.createdAt DESC, e.recordedAt DESC, e.id DESC
        `;
        const rows = await dbQuery(query);
        return TrackerService.formatTrackerRows(rows);
    }

    static async getHiddenTrackers(): Promise<TrackerRow[]> {
        const query = `
            SELECT t.*, e.id as entryId, e.value as entryValue, e.recordedAt
            FROM trackers t
            LEFT JOIN tracker_entries e ON t.id = e.trackerId
            WHERE t.hidden = 1
            ORDER BY t.pinned DESC, t.createdAt DESC, e.recordedAt DESC, e.id DESC
        `;
        const rows = await dbQuery(query);
        return TrackerService.formatTrackerRows(rows);
    }

    static async getTrackerById(id: number): Promise<TrackerRow | null> {
        const query = `
            SELECT t.*, e.id as entryId, e.value as entryValue, e.recordedAt
            FROM trackers t
            LEFT JOIN tracker_entries e ON t.id = e.trackerId
            WHERE t.id = ?
            ORDER BY e.recordedAt DESC, e.id DESC
        `;
        const rows = await dbQuery(query, [id]);
        if (rows.length === 0) return null;
        const formatted = TrackerService.formatTrackerRows(rows);
        return formatted[0] || null;
    }

    static async createTracker(title: string, unit: string | null, pinned: boolean, hidden: boolean): Promise<TrackerRow> {
        const now = new Date().toISOString();
        const result = await dbRun(
            'INSERT INTO trackers (title, unit, pinned, hidden, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
            [title, unit || null, pinned ? 1 : 0, hidden ? 1 : 0, now, now]
        );
        const tracker = await TrackerService.getTrackerById(result.lastID);
        if (!tracker) throw new Error('Failed to retrieve created tracker');
        return tracker;
    }

    static async updateTracker(id: string | number, title: string | undefined, unit: string | null | undefined, pinned: boolean | undefined, hidden: boolean | undefined, isAuthenticated: boolean, deletedEntryIds?: number[]): Promise<TrackerRow> {
        const row = await dbGet('SELECT hidden FROM trackers WHERE id = ?', [id]);
        if (!row) throw new Error('Tracker not found');

        if (row.hidden === 1 && !isAuthenticated) {
            throw new Error('Unauthorized. Valid PIN required to modify a hidden tracker.');
        }

        const now = new Date().toISOString();

        let query = 'UPDATE trackers SET updatedAt = ?';
        let params: any[] = [now];

        if (typeof title !== 'undefined') {
            query += ', title = ?';
            params.push(title);
        }
        if (typeof unit !== 'undefined') {
            query += ', unit = ?';
            params.push(unit);
        }
        if (typeof pinned !== 'undefined') {
            query += ', pinned = ?';
            params.push(pinned ? 1 : 0);
        }
        if (typeof hidden !== 'undefined') {
            query += ', hidden = ?';
            params.push(hidden ? 1 : 0);
        }
        query += ' WHERE id = ?';
        params.push(id);

        await dbRun(query, params);

        if (deletedEntryIds && deletedEntryIds.length > 0) {
            const placeholders = deletedEntryIds.map(() => '?').join(',');
            await dbRun(
                `DELETE FROM tracker_entries WHERE trackerId = ? AND id IN (${placeholders})`,
                [id, ...deletedEntryIds]
            );
        }

        const updated = await TrackerService.getTrackerById(Number(id));
        if (!updated) throw new Error('Failed to retrieve updated tracker');
        return updated;
    }

    static async deleteTracker(id: string | number, isAuthenticated: boolean): Promise<void> {
        const row = await dbGet('SELECT hidden FROM trackers WHERE id = ?', [id]);
        if (!row) throw new Error('Tracker not found');

        if (row.hidden === 1 && !isAuthenticated) {
            throw new Error('Unauthorized. Valid PIN required to delete a hidden tracker.');
        }

        await dbRun('DELETE FROM trackers WHERE id = ?', [id]);
    }

    static async deleteBatchTrackers(ids: (string | number)[]): Promise<number> {
        if (ids.length === 0) return 0;

        const placeholders = ids.map(() => '?').join(',');

        const result = await dbRun(`DELETE FROM trackers WHERE id IN (${placeholders})`, ids);
        return result.changes;
    }

    static async addEntry(trackerId: string | number, value: string, isAuthenticated: boolean): Promise<TrackerEntryRow> {
        const row = await dbGet('SELECT hidden FROM trackers WHERE id = ?', [trackerId]);
        if (!row) throw new Error('Tracker not found');

        if (row.hidden === 1 && !isAuthenticated) {
            throw new Error('Unauthorized. Valid PIN required to modify a hidden tracker.');
        }

        // recordedAt is always server time — clients never send timestamps here
        const now = new Date().toISOString();
        const result = await dbRun(
            'INSERT INTO tracker_entries (trackerId, value, recordedAt) VALUES (?, ?, ?)',
            [trackerId, value, now]
        );

        await dbRun('UPDATE trackers SET updatedAt = ? WHERE id = ?', [now, trackerId]);

        return dbGet('SELECT * FROM tracker_entries WHERE id = ?', [result.lastID]);
    }

    static async updateEntry(entryId: string | number, value: string, isAuthenticated: boolean): Promise<TrackerEntryRow> {
        const entry = await dbGet('SELECT trackerId FROM tracker_entries WHERE id = ?', [entryId]);
        if (!entry) throw new Error('Entry not found');

        const row = await dbGet('SELECT hidden FROM trackers WHERE id = ?', [entry.trackerId]);
        if (!row) throw new Error('Tracker not found');

        if (row.hidden === 1 && !isAuthenticated) {
            throw new Error('Unauthorized. Valid PIN required to modify a hidden tracker.');
        }

        await dbRun('UPDATE tracker_entries SET value = ? WHERE id = ?', [value, entryId]);

        const now = new Date().toISOString();
        await dbRun('UPDATE trackers SET updatedAt = ? WHERE id = ?', [now, entry.trackerId]);

        return dbGet('SELECT * FROM tracker_entries WHERE id = ?', [entryId]);
    }

    /**
     * Bulk import for migrating existing data. Entries carry their own
     * recordedAt dates. Creates a new tracker unless trackerId is given,
     * in which case entries are appended to it.
     */
    static async importTracker(
        title: string | undefined,
        unit: string | null,
        trackerId: number | undefined,
        entries: ImportEntry[],
        isAuthenticated: boolean
    ): Promise<TrackerRow> {
        try {
            await dbRun('BEGIN TRANSACTION');

            const now = new Date().toISOString();
            let targetId: number;

            if (typeof trackerId !== 'undefined') {
                const row = await dbGet('SELECT hidden FROM trackers WHERE id = ?', [trackerId]);
                if (!row) throw new Error('Tracker not found');
                if (row.hidden === 1 && !isAuthenticated) {
                    throw new Error('Unauthorized. Valid PIN required to modify a hidden tracker.');
                }
                targetId = trackerId;
            } else {
                if (!title) throw new Error('Title is required');
                const result = await dbRun(
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
                await dbRun(`INSERT INTO tracker_entries (trackerId, value, recordedAt) VALUES ${placeholders}`, params);
            }

            await dbRun('UPDATE trackers SET updatedAt = ? WHERE id = ?', [now, targetId]);

            await dbRun('COMMIT');

            const tracker = await TrackerService.getTrackerById(targetId);
            if (!tracker) throw new Error('Failed to retrieve imported tracker');
            return tracker;

        } catch (err) {
            await dbRun('ROLLBACK');
            throw err;
        }
    }

    private static formatTrackerRows(rows: any[]): TrackerRow[] {
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
}
