import { Request, Response } from 'express';
import * as AccountService from '../services/account';
import { LIMITS } from '../constants';
import {
    optionalFlag,
    optionalNonEmptyString,
    optionalNullableString,
    optionalIdList,
    requireIdParam,
    requireString,
} from '../validation';
import { isAuthenticated } from '../middleware/auth';

const parseTagIds = (value: unknown): number[] | undefined =>
    optionalIdList(value, 'tagIds', LIMITS.TAGS_PER_ITEM);

export const getAccounts = (req: Request, res: Response) => {
    res.json(AccountService.getAccounts(isAuthenticated(req)));
};

export const createAccount = (req: Request, res: Response) => {
    const { tagIds, identifier, password, notes, pinned } = req.body;

    res.status(201).json(AccountService.createAccount({
        tagIds: parseTagIds(tagIds) ?? [],
        identifier: requireString(identifier, 'Identifier', LIMITS.ACCOUNT_IDENTIFIER).trim(),
        password: optionalNullableString(password, 'Password', LIMITS.ACCOUNT_PASSWORD) ?? null,
        notes: optionalNullableString(notes, 'Notes', LIMITS.NOTE_CONTENT) ?? null,
        pinned: optionalFlag(pinned, 'pinned') ?? false,
    }, isAuthenticated(req)));
};

export const updateAccount = (req: Request, res: Response) => {
    const id = requireIdParam(req.params.id, 'Account');
    const { tagIds, identifier, password, notes, pinned } = req.body;

    res.json(AccountService.updateAccount(id, {
        tagIds: parseTagIds(tagIds),
        identifier: optionalNonEmptyString(identifier, 'Identifier', LIMITS.ACCOUNT_IDENTIFIER)?.trim(),
        password: optionalNullableString(password, 'Password', LIMITS.ACCOUNT_PASSWORD),
        notes: optionalNullableString(notes, 'Notes', LIMITS.NOTE_CONTENT),
        pinned: optionalFlag(pinned, 'pinned'),
    }, isAuthenticated(req)));
};

export const deleteAccount = (req: Request, res: Response) => {
    AccountService.deleteAccount(requireIdParam(req.params.id, 'Account'));
    res.status(204).send();
};
