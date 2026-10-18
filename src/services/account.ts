import { dbQuery, dbRun, dbGet, updateRow } from '../database';
import { AccountGroupRow, AccountRow, AccountView } from '../types/accounts';
import { badRequest, forbidden, notFound } from '../errors';

const ACCOUNT_COLUMNS = 'id, groupId, identifier, password, notes, createdAt, updatedAt, pinned';

export interface AccountInput {
    groupId: number | null;
    identifier: string;
    password: string | null;
    notes: string | null;
    pinned: boolean;
}

export type AccountChanges = Partial<AccountInput>;

const hasSecrets = (row: Pick<AccountRow, 'password' | 'notes'>): boolean => Boolean(row.password || row.notes);

// Secrets only leave the server for a PIN-authenticated client.
const toView = (row: AccountRow, isAuthenticated: boolean): AccountView =>
    isAuthenticated || !hasSecrets(row)
        ? { ...row, locked: false }
        : { ...row, password: null, notes: null, locked: true };

const getById = (id: number, isAuthenticated: boolean): AccountView =>
    toView(dbGet(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = ?`, [id]), isAuthenticated);

const requireGroup = (groupId: number | null | undefined): void => {
    if (groupId && !dbGet('SELECT 1 FROM account_groups WHERE id = ?', [groupId])) {
        throw badRequest('Group does not exist.');
    }
};

export function getAccounts(isAuthenticated: boolean): { groups: AccountGroupRow[]; accounts: AccountView[] } {
    const accounts: AccountRow[] = dbQuery(`SELECT ${ACCOUNT_COLUMNS} FROM accounts ORDER BY pinned DESC, createdAt DESC`);
    return {
        groups: dbQuery('SELECT id, name, createdAt FROM account_groups ORDER BY name COLLATE NOCASE'),
        accounts: accounts.map((row) => toView(row, isAuthenticated)),
    };
}

export function createAccount(input: AccountInput, isAuthenticated: boolean): AccountView {
    requireGroup(input.groupId);
    const now = new Date().toISOString();

    const result = dbRun(
        'INSERT INTO accounts (groupId, identifier, password, notes, pinned, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [input.groupId, input.identifier, input.password, input.notes, input.pinned ? 1 : 0, now, now]
    );

    return getById(result.lastID, isAuthenticated);
}

export function updateAccount(id: number, changes: AccountChanges, isAuthenticated: boolean): AccountView {
    const existing = dbGet('SELECT password, notes FROM accounts WHERE id = ?', [id]);

    if (!existing) {
        throw notFound('Account');
    }

    const changesSecrets = typeof changes.password !== 'undefined' || typeof changes.notes !== 'undefined';
    if (changesSecrets && hasSecrets(existing) && !isAuthenticated) {
        throw forbidden('Unauthorized. Valid PIN required to change the password or notes.');
    }

    requireGroup(changes.groupId);
    updateRow('accounts', id, { ...changes });

    return getById(id, isAuthenticated);
}

export function countAccounts(): number {
    return dbGet('SELECT COUNT(*) AS count FROM accounts').count;
}

export function deleteAccount(id: number): void {
    if (dbRun('DELETE FROM accounts WHERE id = ?', [id]).changes === 0) {
        throw notFound('Account');
    }
}

export function deleteBatchAccounts(ids: number[]): number {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');
    return dbRun(`DELETE FROM accounts WHERE id IN (${placeholders})`, ids).changes;
}

const requireUniqueName = (name: string, exceptId = 0): void => {
    if (dbGet('SELECT 1 FROM account_groups WHERE name = ? COLLATE NOCASE AND id != ?', [name, exceptId])) {
        throw badRequest(`A group named "${name}" already exists.`);
    }
};

export function createGroup(name: string): AccountGroupRow {
    requireUniqueName(name);
    const result = dbRun('INSERT INTO account_groups (name, createdAt) VALUES (?, ?)', [name, new Date().toISOString()]);
    return dbGet('SELECT id, name, createdAt FROM account_groups WHERE id = ?', [result.lastID]);
}

export function renameGroup(id: number, name: string): AccountGroupRow {
    requireUniqueName(name, id);
    if (dbRun('UPDATE account_groups SET name = ? WHERE id = ?', [name, id]).changes === 0) {
        throw notFound('Group');
    }
    return dbGet('SELECT id, name, createdAt FROM account_groups WHERE id = ?', [id]);
}

export function deleteGroup(id: number): void {
    if (dbRun('DELETE FROM account_groups WHERE id = ?', [id]).changes === 0) {
        throw notFound('Group');
    }
}
