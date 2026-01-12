import { dbQuery, dbRun, dbGet } from '../database';
import { NoteRow } from '../types/notes';
import { CLIPBOARD_NOTE_TITLE } from '../constants';

export class NoteService {
    static async getAllVisibleNotes(): Promise<NoteRow[]> {
        return dbQuery('SELECT id, title, content, createdAt, updatedAt, pinned, hidden FROM notes WHERE hidden = 0');
    }

    static async getHiddenNotes(): Promise<NoteRow[]> {
        return dbQuery('SELECT id, title, content, createdAt, updatedAt, pinned, hidden FROM notes WHERE hidden = 1');
    }

    static async createNote(title: string, content: string, pinned: boolean, hidden: boolean): Promise<NoteRow> {
        if (title === CLIPBOARD_NOTE_TITLE) {
            throw new Error(`Cannot create a note with the reserved title "${CLIPBOARD_NOTE_TITLE}".`);
        }

        const pinnedValue = pinned ? 1 : 0;
        const hiddenValue = hidden ? 1 : 0;
        const now = new Date().toISOString();

        const result = await dbRun(
            'INSERT INTO notes (title, content, pinned, hidden, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
            [title, content, pinnedValue, hiddenValue, now, now]
        );

        return dbGet('SELECT * FROM notes WHERE id = ?', [result.lastID]);
    }

    static async updateNote(id: string | number, title: string, content: string, pinned: boolean | undefined, hidden: boolean | undefined, isAuthenticated: boolean): Promise<NoteRow> {
        const existingNote = await dbGet('SELECT title, hidden FROM notes WHERE id = ?', [id]);

        if (!existingNote) {
            throw new Error('Note not found');
        }

        if (existingNote.hidden === 1 && !isAuthenticated) {
            throw new Error('Unauthorized. Valid PIN required to modify a hidden note.');
        }

        const now = new Date().toISOString();

        if (existingNote.title === CLIPBOARD_NOTE_TITLE) {
            if (title !== CLIPBOARD_NOTE_TITLE || (typeof pinned !== 'undefined' && Number(pinned) !== 1)) {
                throw new Error('Cannot change title or unpin the special clipboard note.');
            }
            await dbRun('UPDATE notes SET content = ?, updatedAt = ? WHERE id = ?', [content, now, id]);
        } else {
            if (title === CLIPBOARD_NOTE_TITLE) {
                throw new Error(`Cannot change note title to the reserved title "${CLIPBOARD_NOTE_TITLE}".`);
            }

            let query = 'UPDATE notes SET title = ?, content = ?, updatedAt = ?';
            let params: (string | number | boolean | null)[] = [title, content, now];

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
        }

        return dbGet('SELECT id, title, content, createdAt, updatedAt, pinned, hidden FROM notes WHERE id = ?', [id]);
    }

    static async deleteNote(id: string | number): Promise<void> {
        const existingNote = await dbGet('SELECT title, hidden FROM notes WHERE id = ?', [id]);

        if (!existingNote) {
            throw new Error('Note not found');
        }

        if (existingNote.title === CLIPBOARD_NOTE_TITLE) {
            throw new Error('Cannot delete the special clipboard note.');
        }

        await dbRun('DELETE FROM notes WHERE id = ?', [id]);
    }

    static async deleteBatchNotes(ids: (string | number)[]): Promise<number> {
        if (ids.length === 0) return 0;

        const placeholders = ids.map(() => '?').join(',');
        const notes = await dbQuery(`SELECT id, title, hidden FROM notes WHERE id IN (${placeholders})`, ids);

        const clipboardNote = notes.find(row => row.title === CLIPBOARD_NOTE_TITLE);
        if (clipboardNote) {
            throw new Error(`Cannot delete the special clipboard note (ID: ${clipboardNote.id}).`);
        }

        const result = await dbRun(`DELETE FROM notes WHERE id IN (${placeholders})`, ids);
        return result.changes;
    }
}
