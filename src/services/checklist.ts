import { dbQuery, dbRun, dbGet, tx, updateRow, COUNT_COLUMNS, ContentCounts } from '../database';
import { ChecklistRow, ChecklistItemRow } from '../types/checklists';
import { badRequest, forbidden, internal, notFound } from '../errors';
import { ChecklistItemInput } from '../validation';

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
    return formatChecklistRows(dbQuery(`${CHECKLIST_SELECT} WHERE c.hidden = 1 AND c.archived = 0 ${CHECKLIST_ORDER}`));
}

export function getArchivedChecklists(): ChecklistRow[] {
    return formatChecklistRows(dbQuery(`${CHECKLIST_SELECT} WHERE c.archived = 1 ${CHECKLIST_ORDER}`));
}

export function countChecklists(): ContentCounts {
    return dbGet(`SELECT ${COUNT_COLUMNS} FROM checklists`);
}

export function getChecklistById(id: number): ChecklistRow | null {
    const rows = dbQuery(`${CHECKLIST_SELECT} WHERE c.id = ? ORDER BY ci.position ASC`, [id]);
    if (rows.length === 0) return null;
    return formatChecklistRows(rows)[0] || null;
}

/** Bulk-inserts items for a checklist. No-op for an empty list. */
function insertItems(checklistId: number, items: ChecklistItemInput[]): void {
    if (items.length === 0) return;

    const placeholders = items.map(() => '(?, ?, ?, ?)').join(',');
    const params: any[] = [];
    items.forEach((item, index) => {
        params.push(checklistId, item.content, item.checked ? 1 : 0, item.position ?? index);
    });

    dbRun(`INSERT INTO checklist_items (checklistId, content, checked, position) VALUES ${placeholders}`, params);
}

export interface ChecklistChanges {
    title?: string;
    items?: ChecklistItemInput[];
    pinned?: boolean;
    hidden?: boolean;
    archived?: boolean;
}

export function createChecklist(
    title: string,
    items: ChecklistItemInput[] | undefined,
    pinned: boolean,
    hidden: boolean
): ChecklistRow {
    return tx(() => {
        const now = new Date().toISOString();

        const result = dbRun(
            'INSERT INTO checklists (title, pinned, hidden, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
            [title, pinned ? 1 : 0, hidden ? 1 : 0, now, now]
        );

        if (items) insertItems(result.lastID, items);

        const checklist = getChecklistById(result.lastID);
        if (!checklist) throw internal('Failed to retrieve created checklist');
        return checklist;
    });
}

/** Partial update: every field left undefined keeps its current value. */
export function updateChecklist(id: number, changes: ChecklistChanges, isAuthenticated: boolean): ChecklistRow {
    requireChecklist(id, isAuthenticated);

    const { items, ...columns } = changes;

    return tx(() => {
        updateRow('checklists', id, columns);

        // An items array replaces the whole set; omitting it leaves items alone.
        if (items) {
            dbRun('DELETE FROM checklist_items WHERE checklistId = ?', [id]);
            insertItems(id, items);
        }

        const updated = getChecklistById(id);
        if (!updated) throw internal('Failed to retrieve updated checklist');
        return updated;
    });
}

export function deleteChecklist(id: number, isAuthenticated: boolean): void {
    requireChecklist(id, isAuthenticated, 'delete');
    dbRun('DELETE FROM checklists WHERE id = ?', [id]);
}

export function deleteBatchChecklists(ids: number[], isAuthenticated: boolean): number {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');

    if (!isAuthenticated && dbGet(`SELECT 1 FROM checklists WHERE hidden = 1 AND id IN (${placeholders})`, ids)) {
        throw forbidden('Unauthorized. Valid PIN required to delete hidden checklists.');
    }

    return dbRun(`DELETE FROM checklists WHERE id IN (${placeholders})`, ids).changes;
}

/**
 * Loads a checklist for writing, enforcing the hidden-checklist PIN rule.
 * `action` completes the message, e.g. "modify" / "delete".
 */
function requireChecklist(checklistId: number, isAuthenticated: boolean, action = 'modify'): void {
    const row = dbGet('SELECT hidden FROM checklists WHERE id = ?', [checklistId]);
    if (!row) throw notFound('Checklist');

    if (row.hidden === 1 && !isAuthenticated) {
        throw forbidden(`Unauthorized. Valid PIN required to ${action} a hidden checklist.`);
    }
}

/**
 * Resolves the checklist an item belongs to, enforcing the hidden-checklist
 * PIN rule. Throws if either the item or its checklist is missing.
 */
function requireItemChecklist(itemId: number, isAuthenticated: boolean): number {
    const item = dbGet('SELECT checklistId FROM checklist_items WHERE id = ?', [itemId]);
    if (!item) throw notFound('Item');

    requireChecklist(item.checklistId, isAuthenticated);
    return item.checklistId;
}

function touchChecklist(checklistId: number): void {
    dbRun('UPDATE checklists SET updatedAt = ? WHERE id = ?', [new Date().toISOString(), checklistId]);
}

export function addItem(
    checklistId: number,
    content: string,
    checked: boolean | undefined,
    position: number | undefined,
    isAuthenticated: boolean
): ChecklistItemRow {
    requireChecklist(checklistId, isAuthenticated);

    return tx(() => {
        const result = dbRun(
            'INSERT INTO checklist_items (checklistId, content, checked, position) VALUES (?, ?, ?, ?)',
            [checklistId, content, checked ? 1 : 0, position ?? 0]
        );

        touchChecklist(checklistId);
        return dbGet('SELECT * FROM checklist_items WHERE id = ?', [result.lastID]);
    });
}

export function updateItem(
    itemId: number,
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

export function deleteItem(itemId: number, isAuthenticated: boolean): void {
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
