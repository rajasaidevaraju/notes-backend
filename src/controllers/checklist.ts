import { Request, Response } from 'express';
import * as ChecklistService from '../services/checklist';
import { LIMITS } from '../constants';
import { firstLengthError, itemsContentLengthError, requireIdParam } from '../validation';
import { badRequest } from '../errors';
import { isAuthenticated } from '../middleware/auth';

export const getAllVisibleChecklists = (req: Request, res: Response) => {
    res.json(ChecklistService.getAllVisibleChecklists());
};

export const getHiddenChecklists = (req: Request, res: Response) => {
    res.json(ChecklistService.getHiddenChecklists());
};

export const getArchivedChecklists = (req: Request, res: Response) => {
    res.json(ChecklistService.getArchivedChecklists());
};

const validateChecklistBody = (title: unknown, items: unknown) => {
    const lengthError =
        firstLengthError([[title, LIMITS.TITLE, 'Title']]) ||
        itemsContentLengthError(items, LIMITS.CHECKLIST_ITEM, 'Checklist item');
    if (lengthError) throw badRequest(lengthError);
};

export const createChecklist = (req: Request, res: Response) => {
    const { title, items, pinned, hidden } = req.body;

    if (!title) throw badRequest('Title is required');
    validateChecklistBody(title, items);

    res.status(201).json(ChecklistService.createChecklist(title, items, pinned, hidden));
};

export const updateChecklist = (req: Request, res: Response) => {
    const id = requireIdParam(req.params.id, 'Checklist');
    const { title, items, pinned, hidden, archived } = req.body;
    validateChecklistBody(title, items);

    res.json(ChecklistService.updateChecklist(id, title, items, pinned, hidden, archived, isAuthenticated(req)));
};

export const deleteChecklist = (req: Request, res: Response) => {
    const id = requireIdParam(req.params.id, 'Checklist');

    ChecklistService.deleteChecklist(id, isAuthenticated(req));
    res.status(204).send();
};

export const addItem = (req: Request, res: Response) => {
    const id = requireIdParam(req.params.id, 'Checklist');
    const { content, checked, position } = req.body;
    if (!content) throw badRequest('Content is required');

    const lengthError = firstLengthError([[content, LIMITS.CHECKLIST_ITEM, 'Checklist item']]);
    if (lengthError) throw badRequest(lengthError);

    res.status(201).json(ChecklistService.addItem(id, content, checked, position, isAuthenticated(req)));
};

export const updateItem = (req: Request, res: Response) => {
    const itemId = requireIdParam(req.params.itemId, 'Item');
    const { content, checked, position } = req.body;

    const lengthError = firstLengthError([[content, LIMITS.CHECKLIST_ITEM, 'Checklist item']]);
    if (lengthError) throw badRequest(lengthError);

    res.json(ChecklistService.updateItem(itemId, content, checked, position, isAuthenticated(req)));
};

export const deleteItem = (req: Request, res: Response) => {
    const itemId = requireIdParam(req.params.itemId, 'Item');

    ChecklistService.deleteItem(itemId, isAuthenticated(req));
    res.status(204).send();
};
