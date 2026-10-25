import { dbQuery, dbRun, dbGet } from '../database';
import { TagRow } from '../types/tags';
import { badRequest, notFound } from '../errors';

const getById = (id: number): TagRow => dbGet('SELECT id, name FROM tags WHERE id = ?', [id]);

const requireUniqueName = (name: string, exceptId = 0): void => {
    if (dbGet('SELECT 1 FROM tags WHERE name = ? AND id != ?', [name, exceptId])) {
        throw badRequest(`A tag named "${name}" already exists.`);
    }
};

export function requireTagsExist(ids: number[] | undefined): void {
    if (!ids?.length) return;

    const placeholders = ids.map(() => '?').join(',');
    const { count } = dbGet(`SELECT COUNT(*) AS count FROM tags WHERE id IN (${placeholders})`, ids);
    if (count !== ids.length) {
        throw badRequest('One or more tags do not exist.');
    }
}

export function getTags(): TagRow[] {
    return dbQuery('SELECT id, name FROM tags ORDER BY name COLLATE NOCASE');
}

export function createTag(name: string): TagRow {
    requireUniqueName(name);
    return getById(dbRun('INSERT INTO tags (name, createdAt) VALUES (?, ?)', [name, new Date().toISOString()]).lastID);
}

export function renameTag(id: number, name: string): TagRow {
    requireUniqueName(name, id);
    if (dbRun('UPDATE tags SET name = ? WHERE id = ?', [name, id]).changes === 0) {
        throw notFound('Tag');
    }
    return getById(id);
}

export function deleteTag(id: number): void {
    if (dbRun('DELETE FROM tags WHERE id = ?', [id]).changes === 0) {
        throw notFound('Tag');
    }
}
