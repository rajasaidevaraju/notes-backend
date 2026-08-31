import { dbQuery, dbRun, dbGet } from '../database';
import { NoteRow } from '../types/notes';
import { CLIPBOARD_NOTE_TITLE } from '../constants';
import { badRequest, forbidden, notFound } from '../errors';

const NOTE_COLUMNS = 'id, title, content, createdAt, updatedAt, pinned, hidden, archived';

export function getAllVisibleNotes(): NoteRow[] {
    return dbQuery(`SELECT ${NOTE_COLUMNS} FROM notes WHERE hidden = 0 AND archived = 0`);
}

export function getHiddenNotes(): NoteRow[] {
    return dbQuery(`SELECT ${NOTE_COLUMNS} FROM notes WHERE hidden = 1`);
}

export function getArchivedNotes(): NoteRow[] {
    return dbQuery(`SELECT ${NOTE_COLUMNS} FROM notes WHERE archived = 1`);
}

export function createNote(title: string, content: string, pinned: boolean, hidden: boolean): NoteRow {
    if (title === CLIPBOARD_NOTE_TITLE) {
        throw badRequest(`Cannot create a note with the reserved title "${CLIPBOARD_NOTE_TITLE}".`);
    }

    const now = new Date().toISOString();

    const result = dbRun(
        'INSERT INTO notes (title, content, pinned, hidden, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [title, content, pinned ? 1 : 0, hidden ? 1 : 0, now, now]
    );

    return dbGet(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`, [result.lastID]);
}

export function updateNote(
    id: string | number,
    title: string,
    content: string,
    pinned: boolean | undefined,
    hidden: boolean | undefined,
    archived: boolean | undefined,
    isAuthenticated: boolean
): NoteRow {
    const existingNote = dbGet('SELECT title, hidden FROM notes WHERE id = ?', [id]);

    if (!existingNote) {
        throw notFound('Note');
    }

    if (existingNote.hidden === 1 && !isAuthenticated) {
        throw forbidden('Unauthorized. Valid PIN required to modify a hidden note.');
    }

    const now = new Date().toISOString();

    if (existingNote.title === CLIPBOARD_NOTE_TITLE) {
        if (
            title !== CLIPBOARD_NOTE_TITLE ||
            (typeof pinned !== 'undefined' && Number(pinned) !== 1) ||
            (typeof archived !== 'undefined' && Number(archived) === 1)
        ) {
            throw forbidden('Cannot change title, unpin, or archive the special clipboard note.');
        }
        dbRun('UPDATE notes SET content = ?, updatedAt = ? WHERE id = ?', [content, now, id]);
    } else {
        if (title === CLIPBOARD_NOTE_TITLE) {
            throw forbidden(`Cannot change note title to the reserved title "${CLIPBOARD_NOTE_TITLE}".`);
        }

        let query = 'UPDATE notes SET title = ?, content = ?, updatedAt = ?';
        const params: (string | number | boolean | null)[] = [title, content, now];

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
    }

    return dbGet(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`, [id]);
}

export function deleteNote(id: string | number, isAuthenticated: boolean): void {
    const existingNote = dbGet('SELECT title, hidden FROM notes WHERE id = ?', [id]);

    if (!existingNote) {
        throw notFound('Note');
    }

    if (existingNote.hidden === 1 && !isAuthenticated) {
        throw forbidden('Unauthorized. Valid PIN required to delete a hidden note.');
    }

    if (existingNote.title === CLIPBOARD_NOTE_TITLE) {
        throw forbidden('Cannot delete the special clipboard note.');
    }

    dbRun('DELETE FROM notes WHERE id = ?', [id]);
}

export function deleteBatchNotes(ids: (string | number)[]): number {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');
    const notes = dbQuery(`SELECT id, title, hidden FROM notes WHERE id IN (${placeholders})`, ids);

    const clipboardNote = notes.find(row => row.title === CLIPBOARD_NOTE_TITLE);
    if (clipboardNote) {
        throw forbidden(`Cannot delete the special clipboard note (ID: ${clipboardNote.id}).`);
    }

    const result = dbRun(`DELETE FROM notes WHERE id IN (${placeholders})`, ids);
    return result.changes;
}

export function initializeClipboardNote(): void {
    try {
        const row = dbGet('SELECT id FROM notes WHERE title = ?', [CLIPBOARD_NOTE_TITLE]) as NoteRow;
        if (!row) {
            console.log(`Creating special clipboard note: "${CLIPBOARD_NOTE_TITLE}"`);
            const now = new Date().toISOString();
            dbRun('INSERT INTO notes (title, content, pinned, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)', [CLIPBOARD_NOTE_TITLE, '', 1, now, now]);
        }
    } catch (err: any) {
        console.error('Error checking/creating clipboard note:', err.message);
    }
}
