import { dbQuery, dbRun, dbGet, db } from '../database';
import { ChecklistRow, ChecklistItemRow } from '../types/checklists';

export class ChecklistService {

    static async getAllVisibleChecklists(): Promise<ChecklistRow[]> {
        const query = `
      SELECT c.*, ci.id as itemId, ci.content as itemContent, ci.checked, ci.position
      FROM checklists c
      LEFT JOIN checklist_items ci ON c.id = ci.checklistId
      WHERE c.hidden = 0
      ORDER BY c.pinned DESC, c.createdAt DESC, ci.position ASC
    `;
        const rows = await dbQuery(query);
        return ChecklistService.formatChecklistRows(rows);
    }

    static async getHiddenChecklists(): Promise<ChecklistRow[]> {
        const query = `
      SELECT c.*, ci.id as itemId, ci.content as itemContent, ci.checked, ci.position
      FROM checklists c
      LEFT JOIN checklist_items ci ON c.id = ci.checklistId
      WHERE c.hidden = 1
      ORDER BY c.pinned DESC, c.createdAt DESC, ci.position ASC
    `;
        const rows = await dbQuery(query);
        return ChecklistService.formatChecklistRows(rows);
    }

    static async getChecklistById(id: number): Promise<ChecklistRow | null> {
        const query = `
      SELECT c.*, ci.id as itemId, ci.content as itemContent, ci.checked, ci.position
      FROM checklists c
      LEFT JOIN checklist_items ci ON c.id = ci.checklistId
      WHERE c.id = ?
      ORDER BY ci.position ASC
    `;
        const rows = await dbQuery(query, [id]);
        if (rows.length === 0) return null;
        const formatted = ChecklistService.formatChecklistRows(rows);
        return formatted[0] || null;
    }

    static async createChecklist(title: string, items: any[], pinned: boolean, hidden: boolean): Promise<ChecklistRow> {
        try {
            await dbRun('BEGIN TRANSACTION');

            const pinnedValue = pinned ? 1 : 0;
            const hiddenValue = hidden ? 1 : 0;
            const now = new Date().toISOString();

            const result = await dbRun(
                'INSERT INTO checklists (title, pinned, hidden, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
                [title, pinnedValue, hiddenValue, now, now]
            );
            const checklistId = result.lastID;

            if (items && Array.isArray(items) && items.length > 0) {
                const placeholders = items.map(() => '(?, ?, ?, ?)').join(',');
                const params: any[] = [];
                items.forEach((item, index) => {
                    params.push(checklistId, item.content || '', item.checked ? 1 : 0, item.position || index);
                });

                await dbRun(`INSERT INTO checklist_items (checklistId, content, checked, position) VALUES ${placeholders}`, params);
            }

            await dbRun('COMMIT');
            const checklist = await ChecklistService.getChecklistById(checklistId);
            if (!checklist) throw new Error("Failed to retrieve created checklist");
            return checklist;

        } catch (err) {
            await dbRun('ROLLBACK');
            throw err;
        }
    }

    static async updateChecklist(id: string | number, title: string | undefined, items: any[] | undefined, pinned: boolean | undefined, hidden: boolean | undefined, isAuthenticated: boolean): Promise<ChecklistRow> {
        const row = await dbGet('SELECT hidden FROM checklists WHERE id = ?', [id]);
        if (!row) throw new Error('Checklist not found');

        if (row.hidden === 1 && !isAuthenticated) {
            throw new Error('Unauthorized. Valid PIN required to modify a hidden checklist.');
        }

        const now = new Date().toISOString();

        try {
            await dbRun('BEGIN TRANSACTION');

            let query = 'UPDATE checklists SET updatedAt = ?';
            let params: any[] = [now];

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
            query += ' WHERE id = ?';
            params.push(id);

            await dbRun(query, params);

            if (items && Array.isArray(items)) {
                await dbRun('DELETE FROM checklist_items WHERE checklistId = ?', [id]);

                if (items.length > 0) {
                    const placeholders = items.map(() => '(?, ?, ?, ?)').join(',');
                    const itemParams: any[] = [];
                    items.forEach((item, index) => {
                        itemParams.push(id, item.content || '', item.checked ? 1 : 0, item.position ?? index);
                    });
                    await dbRun(`INSERT INTO checklist_items (checklistId, content, checked, position) VALUES ${placeholders}`, itemParams);
                }
            }

            await dbRun('COMMIT');
            const updated = await ChecklistService.getChecklistById(Number(id));
            if (!updated) throw new Error('Failed to retrieve updated checklist');
            return updated;

        } catch (err) {
            await dbRun('ROLLBACK');
            throw err;
        }
    }

    static async deleteChecklist(id: string | number): Promise<void> {
        const row = await dbGet('SELECT hidden FROM checklists WHERE id = ?', [id]);
        if (!row) throw new Error('Checklist not found');

        await dbRun('DELETE FROM checklists WHERE id = ?', [id]);
    }

    static async deleteBatchChecklists(ids: (string | number)[]): Promise<number> {
        if (ids.length === 0) return 0;

        const placeholders = ids.map(() => '?').join(',');

        const result = await dbRun(`DELETE FROM checklists WHERE id IN (${placeholders})`, ids);
        return result.changes;
    }

    static async addItem(checklistId: string | number, content: string, checked: boolean, position: number): Promise<ChecklistItemRow> {
        const checkedVal = checked ? 1 : 0;
        const posVal = position || 0;

        const result = await dbRun(
            'INSERT INTO checklist_items (checklistId, content, checked, position) VALUES (?, ?, ?, ?)',
            [checklistId, content, checkedVal, posVal]
        );

        const now = new Date().toISOString();
        await dbRun('UPDATE checklists SET updatedAt = ? WHERE id = ?', [now, checklistId]);

        return dbGet('SELECT * FROM checklist_items WHERE id = ?', [result.lastID]);
    }

    static async updateItem(itemId: string | number, content: string | undefined, checked: boolean | undefined, position: number | undefined): Promise<ChecklistItemRow> {
        let query = 'UPDATE checklist_items SET ';
        let params: any[] = [];
        let updates: string[] = [];

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

        if (updates.length === 0) throw new Error('No fields to update');

        query += updates.join(', ') + ' WHERE id = ?';
        params.push(itemId);

        const result = await dbRun(query, params);
        if (result.changes === 0) throw new Error('Item not found');

        const item = await dbGet('SELECT checklistId FROM checklist_items WHERE id = ?', [itemId]);
        if (item) {
            const now = new Date().toISOString();
            await dbRun('UPDATE checklists SET updatedAt = ? WHERE id = ?', [now, item.checklistId]);
        }

        return dbGet('SELECT * FROM checklist_items WHERE id = ?', [itemId]);
    }

    static async deleteItem(itemId: string | number): Promise<void> {
        const item = await dbGet('SELECT checklistId FROM checklist_items WHERE id = ?', [itemId]);
        if (!item) throw new Error('Item not found');

        await dbRun('DELETE FROM checklist_items WHERE id = ?', [itemId]);

        const now = new Date().toISOString();
        await dbRun('UPDATE checklists SET updatedAt = ? WHERE id = ?', [now, item.checklistId]);
    }

    private static formatChecklistRows(rows: any[]): ChecklistRow[] {
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
}
