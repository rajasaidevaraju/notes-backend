import { dbQuery, dbRun, dbGet, updateRow, COUNT_COLUMNS, ContentCounts } from '../database';
import { NoteRow } from '../types/notes';
import { CLIPBOARD_NOTE_TITLE } from '../constants';
import { badRequest, forbidden, notFound } from '../errors';

const NOTE_COLUMNS = 'id, title, content, createdAt, updatedAt, pinned, hidden, archived';
const NOTE_ORDER = 'ORDER BY pinned DESC, createdAt DESC';

export interface NoteChanges {
    title?: string;
    content?: string | null;
    pinned?: boolean;
    hidden?: boolean;
    archived?: boolean;
}

export function getAllVisibleNotes(): NoteRow[] {
    return dbQuery(`SELECT ${NOTE_COLUMNS} FROM notes WHERE hidden = 0 AND archived = 0 ${NOTE_ORDER}`);
}

export function getHiddenNotes(): NoteRow[] {
    return dbQuery(`SELECT ${NOTE_COLUMNS} FROM notes WHERE hidden = 1 AND archived = 0 ${NOTE_ORDER}`);
}

export function getArchivedNotes(): NoteRow[] {
    return dbQuery(`SELECT ${NOTE_COLUMNS} FROM notes WHERE archived = 1 ${NOTE_ORDER}`);
}

export function countNotes(): ContentCounts {
    return dbGet(`SELECT ${COUNT_COLUMNS} FROM notes`);
}

export function createNote(title: string, content: string | null, pinned: boolean, hidden: boolean): NoteRow {
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

/** Partial update: every field left undefined keeps its current value. */
export function updateNote(id: number, changes: NoteChanges, isAuthenticated: boolean): NoteRow {
    const existingNote = dbGet('SELECT title, hidden FROM notes WHERE id = ?', [id]);

    if (!existingNote) {
        throw notFound('Note');
    }

    if (existingNote.hidden === 1 && !isAuthenticated) {
        throw forbidden('Unauthorized. Valid PIN required to modify a hidden note.');
    }

    const { title, pinned, hidden, archived } = changes;

    if (existingNote.title === CLIPBOARD_NOTE_TITLE) {
        if (
            (typeof title !== 'undefined' && title !== CLIPBOARD_NOTE_TITLE) ||
            pinned === false ||
            hidden === true ||
            archived === true
        ) {
            throw forbidden('Cannot change title, unpin, hide, or archive the special clipboard note.');
        }
    } else if (title === CLIPBOARD_NOTE_TITLE) {
        throw forbidden(`Cannot change note title to the reserved title "${CLIPBOARD_NOTE_TITLE}".`);
    }

    updateRow('notes', id, { ...changes });

    return dbGet(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`, [id]);
}

export function deleteNote(id: number, isAuthenticated: boolean): void {
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

export function deleteBatchNotes(ids: number[], isAuthenticated: boolean): number {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');
    const notes = dbQuery(`SELECT id, title, hidden FROM notes WHERE id IN (${placeholders})`, ids);

    if (!isAuthenticated && notes.some(row => row.hidden === 1)) {
        throw forbidden('Unauthorized. Valid PIN required to delete hidden notes.');
    }

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
