import { Request, Response } from 'express';
import * as ChecklistService from '../services/checklist';
import { LIMITS } from '../constants';
import {
    optionalChecklistItems,
    optionalFlag,
    optionalPosition,
    optionalString,
    optionalTitle,
    requireIdParam,
    requireString,
} from '../validation';
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

export const createChecklist = (req: Request, res: Response) => {
    const { title, items, pinned, hidden } = req.body;

    res.status(201).json(ChecklistService.createChecklist(
        requireString(title, 'Title', LIMITS.TITLE),
        optionalChecklistItems(items, LIMITS.CHECKLIST_ITEM),
        optionalFlag(pinned, 'pinned') ?? false,
        optionalFlag(hidden, 'hidden') ?? false
    ));
};

export const updateChecklist = (req: Request, res: Response) => {
    const id = requireIdParam(req.params.id, 'Checklist');
    const { title, items, pinned, hidden, archived } = req.body;

    res.json(ChecklistService.updateChecklist(id, {
        title: optionalTitle(title, LIMITS.TITLE),
        items: optionalChecklistItems(items, LIMITS.CHECKLIST_ITEM),
        pinned: optionalFlag(pinned, 'pinned'),
        hidden: optionalFlag(hidden, 'hidden'),
        archived: optionalFlag(archived, 'archived'),
    }, isAuthenticated(req)));
};

export const deleteChecklist = (req: Request, res: Response) => {
    const id = requireIdParam(req.params.id, 'Checklist');

    ChecklistService.deleteChecklist(id, isAuthenticated(req));
    res.status(204).send();
};

export const addItem = (req: Request, res: Response) => {
    const id = requireIdParam(req.params.id, 'Checklist');
    const { content, checked, position } = req.body;

    res.status(201).json(ChecklistService.addItem(
        id,
        requireString(content, 'Content', LIMITS.CHECKLIST_ITEM),
        optionalFlag(checked, 'checked'),
        optionalPosition(position),
        isAuthenticated(req)
    ));
};

export const updateItem = (req: Request, res: Response) => {
    const itemId = requireIdParam(req.params.itemId, 'Item');
    const { content, checked, position } = req.body;

    res.json(ChecklistService.updateItem(
        itemId,
        optionalString(content, 'Checklist item', LIMITS.CHECKLIST_ITEM),
        optionalFlag(checked, 'checked'),
        optionalPosition(position),
        isAuthenticated(req)
    ));
};

export const deleteItem = (req: Request, res: Response) => {
    const itemId = requireIdParam(req.params.itemId, 'Item');

    ChecklistService.deleteItem(itemId, isAuthenticated(req));
    res.status(204).send();
};
