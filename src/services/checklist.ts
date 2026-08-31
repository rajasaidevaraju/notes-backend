import { dbQuery, dbRun, dbGet, tx } from '../database';
import { ChecklistRow, ChecklistItemRow } from '../types/checklists';
import { badRequest, forbidden, internal, notFound } from '../errors';

const CHECKLIST_SELECT = `
    SELECT c.*, ci.id as itemId, ci.content as itemContent, ci.checked, ci.position
    FROM checklists c
    LEFT JOIN checklist_items ci ON c.id = ci.checklistId
`;

const CHECKLIST_ORDER = 'ORDER BY c.pinned DESC, c.createdAt DESC, ci.position ASC';

export function getAllVisibleChecklists(): ChecklistRow[] {
    return formatChecklistRows(dbQuery(`${CHECKLIST_SELECT} WHERE c.hidden = 0 AND c.archived = 0 ${CHECKLIST_ORDER}`));
}

export function getHiddenChecklists(): ChecklistRow[] {
    return formatChecklistRows(dbQuery(`${CHECKLIST_SELECT} WHERE c.hidden = 1 ${CHECKLIST_ORDER}`));
}

export function getArchivedChecklists(): ChecklistRow[] {
    return formatChecklistRows(dbQuery(`${CHECKLIST_SELECT} WHERE c.archived = 1 ${CHECKLIST_ORDER}`));
}

export function getChecklistById(id: number): ChecklistRow | null {
    const rows = dbQuery(`${CHECKLIST_SELECT} WHERE c.id = ? ORDER BY ci.position ASC`, [id]);
    if (rows.length === 0) return null;
    return formatChecklistRows(rows)[0] || null;
}

/** Bulk-inserts items for a checklist. No-op for an empty list. */
function insertItems(checklistId: string | number, items: any[]): void {
    if (items.length === 0) return;

    const placeholders = items.map(() => '(?, ?, ?, ?)').join(',');
    const params: any[] = [];
    items.forEach((item, index) => {
        params.push(checklistId, item.content || '', item.checked ? 1 : 0, item.position ?? index);
    });

    dbRun(`INSERT INTO checklist_items (checklistId, content, checked, position) VALUES ${placeholders}`, params);
}

export function createChecklist(title: string, items: any[], pinned: boolean, hidden: boolean): ChecklistRow {
    return tx(() => {
        const now = new Date().toISOString();

        const result = dbRun(
            'INSERT INTO checklists (title, pinned, hidden, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
            [title, pinned ? 1 : 0, hidden ? 1 : 0, now, now]
        );

        if (Array.isArray(items)) insertItems(result.lastID, items);

        const checklist = getChecklistById(result.lastID);
        if (!checklist) throw internal('Failed to retrieve created checklist');
        return checklist;
    });
}

export function updateChecklist(
    id: string | number,
    title: string | undefined,
    items: any[] | undefined,
    pinned: boolean | undefined,
    hidden: boolean | undefined,
    archived: boolean | undefined,
    isAuthenticated: boolean
): ChecklistRow {
    const row = dbGet('SELECT hidden FROM checklists WHERE id = ?', [id]);
    if (!row) throw notFound('Checklist');

    if (row.hidden === 1 && !isAuthenticated) {
        throw forbidden('Unauthorized. Valid PIN required to modify a hidden checklist.');
    }

    return tx(() => {
        let query = 'UPDATE checklists SET updatedAt = ?';
        const params: any[] = [new Date().toISOString()];

        if (typeof title !== 'undefined') {
            query += ', title = ?';
            params.push(title);
        }
        if (typeof pinned !== 'undefined') {
            query += ', pinned = ?';
            params.push(pinned ? 1 : 0);
        }
        if (typeof hidden !== 'undefined') {
            query += ', hidden = ?';
            params.push(hidden ? 1 : 0);
        }
        if (typeof archived !== 'undefined') {
            query += ', archived = ?';
            params.push(archived ? 1 : 0);
        }
        query += ' WHERE id = ?';
        params.push(id);

        dbRun(query, params);

        // An items array replaces the whole set; omitting it leaves items alone.
        if (Array.isArray(items)) {
            dbRun('DELETE FROM checklist_items WHERE checklistId = ?', [id]);
            insertItems(id, items);
        }

        const updated = getChecklistById(Number(id));
        if (!updated) throw internal('Failed to retrieve updated checklist');
        return updated;
    });
}

export function deleteChecklist(id: string | number, isAuthenticated: boolean): void {
    const row = dbGet('SELECT hidden FROM checklists WHERE id = ?', [id]);
    if (!row) throw notFound('Checklist');

    if (row.hidden === 1 && !isAuthenticated) {
        throw forbidden('Unauthorized. Valid PIN required to delete a hidden checklist.');
    }

    dbRun('DELETE FROM checklists WHERE id = ?', [id]);
}

export function deleteBatchChecklists(ids: (string | number)[]): number {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');
    return dbRun(`DELETE FROM checklists WHERE id IN (${placeholders})`, ids).changes;
}

function requireChecklist(checklistId: string | number, isAuthenticated: boolean): void {
    const row = dbGet('SELECT hidden FROM checklists WHERE id = ?', [checklistId]);
    if (!row) throw notFound('Checklist');

    if (row.hidden === 1 && !isAuthenticated) {
        throw forbidden('Unauthorized. Valid PIN required to modify a hidden checklist.');
    }
}

/**
 * Resolves the checklist an item belongs to, enforcing the hidden-checklist
 * PIN rule. Throws if either the item or its checklist is missing.
 */
function requireItemChecklist(itemId: string | number, isAuthenticated: boolean): number {
    const item = dbGet('SELECT checklistId FROM checklist_items WHERE id = ?', [itemId]);
    if (!item) throw notFound('Item');

    requireChecklist(item.checklistId, isAuthenticated);
    return item.checklistId;
}

function touchChecklist(checklistId: string | number): void {
    dbRun('UPDATE checklists SET updatedAt = ? WHERE id = ?', [new Date().toISOString(), checklistId]);
}

export function addItem(
    checklistId: string | number,
    content: string,
    checked: boolean,
    position: number,
    isAuthenticated: boolean
): ChecklistItemRow {
    requireChecklist(checklistId, isAuthenticated);

    return tx(() => {
        const result = dbRun(
            'INSERT INTO checklist_items (checklistId, content, checked, position) VALUES (?, ?, ?, ?)',
            [checklistId, content, checked ? 1 : 0, position || 0]
        );

        touchChecklist(checklistId);
        return dbGet('SELECT * FROM checklist_items WHERE id = ?', [result.lastID]);
    });
}

export function updateItem(
    itemId: string | number,
    content: string | undefined,
    checked: boolean | undefined,
    position: number | undefined,
    isAuthenticated: boolean
): ChecklistItemRow {
    const checklistId = requireItemChecklist(itemId, isAuthenticated);

    const updates: string[] = [];
    const params: any[] = [];

    if (typeof content !== 'undefined') {
        updates.push('content = ?');
        params.push(content);
    }
    if (typeof checked !== 'undefined') {
        updates.push('checked = ?');
        params.push(checked ? 1 : 0);
    }
    if (typeof position !== 'undefined') {
        updates.push('position = ?');
        params.push(position);
    }

    if (updates.length === 0) throw badRequest('No fields to update');

    params.push(itemId);

    return tx(() => {
        dbRun(`UPDATE checklist_items SET ${updates.join(', ')} WHERE id = ?`, params);
        touchChecklist(checklistId);
        return dbGet('SELECT * FROM checklist_items WHERE id = ?', [itemId]);
    });
}

export function deleteItem(itemId: string | number, isAuthenticated: boolean): void {
    const checklistId = requireItemChecklist(itemId, isAuthenticated);

    tx(() => {
        dbRun('DELETE FROM checklist_items WHERE id = ?', [itemId]);
        touchChecklist(checklistId);
    });
}

function formatChecklistRows(rows: any[]): ChecklistRow[] {
    const checklistMap = new Map<number, ChecklistRow>();

    rows.forEach((row) => {
        if (!checklistMap.has(row.id)) {
            checklistMap.set(row.id, {
                id: row.id,
                title: row.title,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                pinned: row.pinned,
                hidden: row.hidden,
                archived: row.archived,
                items: [],
            });
        }

        if (row.itemId) {
            checklistMap.get(row.id)!.items!.push({
                id: row.itemId,
                checklistId: row.id,
                content: row.itemContent,
                checked: row.checked,
                position: row.position,
            });
        }
    });

    return Array.from(checklistMap.values());
}
