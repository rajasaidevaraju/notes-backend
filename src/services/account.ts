import { dbQuery, dbRun, dbGet, updateRow, tx } from '../database';
import { AccountRow, AccountView } from '../types/accounts';
import { requireTagsExist } from './tag';
import { forbidden, notFound } from '../errors';

const ACCOUNT_COLUMNS = 'id, identifier, password, notes, createdAt, updatedAt, pinned';

export interface AccountInput {
    tagIds: number[];
    identifier: string;
    password: string | null;
    notes: string | null;
    pinned: boolean;
}

export type AccountChanges = Partial<AccountInput>;

const hasSecrets = (row: Pick<AccountRow, 'password' | 'notes'>): boolean => Boolean(row.password || row.notes);

// Secrets only leave the server for a PIN-authenticated client.
const toView = (row: AccountRow, tagIds: number[], isAuthenticated: boolean): AccountView =>
    isAuthenticated || !hasSecrets(row)
        ? { ...row, tagIds, locked: false }
        : { ...row, tagIds, password: null, notes: null, locked: true };

const tagIdsOf = (accountId: number): number[] =>
    dbQuery('SELECT tagId FROM account_tag_links WHERE accountId = ?', [accountId]).map((row) => row.tagId);

const getById = (id: number, isAuthenticated: boolean): AccountView =>
    toView(dbGet(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = ?`, [id]), tagIdsOf(id), isAuthenticated);

const setTags = (accountId: number, tagIds: number[]): void => {
    dbRun('DELETE FROM account_tag_links WHERE accountId = ?', [accountId]);
    for (const tagId of tagIds) {
        dbRun('INSERT INTO account_tag_links (accountId, tagId) VALUES (?, ?)', [accountId, tagId]);
    }
};

export function getAccounts(isAuthenticated: boolean): AccountView[] {
    return tx(() => {
        const accounts: AccountRow[] = dbQuery(`SELECT ${ACCOUNT_COLUMNS} FROM accounts ORDER BY pinned DESC, createdAt DESC`);
        const tagIds = new Map<number, number[]>();
        for (const { accountId, tagId } of dbQuery('SELECT accountId, tagId FROM account_tag_links')) {
            tagIds.set(accountId, [...(tagIds.get(accountId) ?? []), tagId]);
        }

        return accounts.map((row) => toView(row, tagIds.get(row.id) ?? [], isAuthenticated));
    });
}

export function createAccount(input: AccountInput, isAuthenticated: boolean): AccountView {
    requireTagsExist(input.tagIds);
    const now = new Date().toISOString();

    return tx(() => {
        const result = dbRun(
            'INSERT INTO accounts (identifier, password, notes, pinned, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
            [input.identifier, input.password, input.notes, input.pinned ? 1 : 0, now, now]
        );
        setTags(result.lastID, input.tagIds);
        return getById(result.lastID, isAuthenticated);
    });
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

    requireTagsExist(changes.tagIds);
    const { tagIds, ...columns } = changes;
    return tx(() => {
        updateRow('accounts', id, columns);
        if (tagIds) setTags(id, tagIds);
        return getById(id, isAuthenticated);
    });
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
