import { Request, Response } from 'express';
import * as AccountService from '../services/account';
import { LIMITS } from '../constants';
import {
    optionalFlag,
    optionalNonEmptyString,
    optionalNullableId,
    optionalNullableString,
    requireIdParam,
    requireString,
} from '../validation';
import { isAuthenticated } from '../middleware/auth';

export const getAccounts = (req: Request, res: Response) => {
    res.json(AccountService.getAccounts(isAuthenticated(req)));
};

export const createAccount = (req: Request, res: Response) => {
    const { groupId, identifier, password, notes, pinned } = req.body;

    res.status(201).json(AccountService.createAccount({
        groupId: optionalNullableId(groupId, 'groupId') ?? null,
        identifier: requireString(identifier, 'Identifier', LIMITS.ACCOUNT_IDENTIFIER).trim(),
        password: optionalNullableString(password, 'Password', LIMITS.ACCOUNT_PASSWORD) ?? null,
        notes: optionalNullableString(notes, 'Notes', LIMITS.NOTE_CONTENT) ?? null,
        pinned: optionalFlag(pinned, 'pinned') ?? false,
    }, isAuthenticated(req)));
};

export const updateAccount = (req: Request, res: Response) => {
    const id = requireIdParam(req.params.id, 'Account');
    const { groupId, identifier, password, notes, pinned } = req.body;

    res.json(AccountService.updateAccount(id, {
        groupId: optionalNullableId(groupId, 'groupId'),
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

const requireGroupName = (value: unknown): string =>
    requireString(value, 'Group name', LIMITS.ACCOUNT_GROUP).trim();

export const createGroup = (req: Request, res: Response) => {
    res.status(201).json(AccountService.createGroup(requireGroupName(req.body.name)));
};

export const renameGroup = (req: Request, res: Response) => {
    const id = requireIdParam(req.params.id, 'Group');
    res.json(AccountService.renameGroup(id, requireGroupName(req.body.name)));
};

export const deleteGroup = (req: Request, res: Response) => {
    AccountService.deleteGroup(requireIdParam(req.params.id, 'Group'));
    res.status(204).send();
};
