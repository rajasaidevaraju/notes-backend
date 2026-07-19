import { Request, Response } from 'express';
import { ChecklistService } from '../services/checklistService';
import { LIMITS } from '../constants';
import { firstLengthError, itemsContentLengthError } from '../validation';

const correctPin = process.env.HIDDEN_NOTES_PIN;

export const getAllVisibleChecklists = async (req: Request, res: Response) => {
    try {
        const checklists = await ChecklistService.getAllVisibleChecklists();
        res.json(checklists);
    } catch (err: any) {
        console.error('Error fetching checklists:', err.message);
        res.status(500).json({ error: 'Failed to fetch checklists' });
    }
};

export const getHiddenChecklists = async (req: Request, res: Response) => {
    try {
        const checklists = await ChecklistService.getHiddenChecklists();
        res.json(checklists);
    } catch (err: any) {
        if (err.message === 'Unauthorized') {
            res.status(403).json({ error: 'Unauthorized' });
        } else {
            console.error('Error fetching hidden checklists:', err.message);
            res.status(500).json({ error: 'Failed to fetch hidden checklists' });
        }
    }
};

export const createChecklist = async (req: Request, res: Response) => {
    const { title, items, pinned, hidden } = req.body;

    if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
    }

    const lengthError =
        firstLengthError([[title, LIMITS.TITLE, 'Title']]) ||
        itemsContentLengthError(items, LIMITS.CHECKLIST_ITEM, 'Checklist item');
    if (lengthError) {
        res.status(400).json({ error: lengthError });
        return;
    }

    try {
        const newChecklist = await ChecklistService.createChecklist(title, items, pinned, hidden);
        res.status(201).json(newChecklist);
    } catch (err: any) {
        console.error('Error creating checklist:', err.message);
        res.status(500).json({ error: 'Failed to create checklist' });
    }
};

export const updateChecklist = async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'Invalid Checklist ID' });
        return;
    }
    const { title, items, pinned, hidden } = req.body;

    const lengthError =
        firstLengthError([[title, LIMITS.TITLE, 'Title']]) ||
        itemsContentLengthError(items, LIMITS.CHECKLIST_ITEM, 'Checklist item');
    if (lengthError) {
        res.status(400).json({ error: lengthError });
        return;
    }

    const cookiePin = req.cookies?.auth_pin;
    const isAuthenticated = cookiePin === correctPin;

    try {
        const updatedChecklist = await ChecklistService.updateChecklist(id, title, items, pinned, hidden, isAuthenticated);
        res.json(updatedChecklist);
    } catch (err: any) {
        if (err.message === 'Checklist not found') {
            res.status(404).json({ error: err.message });
        } else if (err.message.startsWith('Unauthorized')) {
            res.status(403).json({ error: err.message });
        } else {
            console.error('Error updating checklist:', err.message);
            res.status(500).json({ error: 'Failed to update checklist' });
        }
    }
};

export const deleteChecklist = async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'Invalid Checklist ID' });
        return;
    }
    const cookiePin = req.cookies?.auth_pin;
    const isAuthenticated = cookiePin === correctPin;

    try {
        await ChecklistService.deleteChecklist(id, isAuthenticated);
        res.status(204).send();
    } catch (err: any) {
        if (err.message === 'Checklist not found') {
            res.status(404).json({ error: err.message });
        } else if (err.message.startsWith('Unauthorized')) {
            res.status(403).json({ error: err.message });
        } else {
            console.error('Error deleting checklist:', err.message);
            res.status(500).json({ error: 'Failed to delete checklist' });
        }
    }
};

export const addItem = async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'Invalid Checklist ID' });
        return;
    }
    const { content, checked, position } = req.body;

    if (!content) {
        res.status(400).json({ error: 'Content is required' });
        return;
    }

    const lengthError = firstLengthError([[content, LIMITS.CHECKLIST_ITEM, 'Checklist item']]);
    if (lengthError) {
        res.status(400).json({ error: lengthError });
        return;
    }

    const cookiePin = req.cookies?.auth_pin;
    const isAuthenticated = cookiePin === correctPin;

    try {
        const newItem = await ChecklistService.addItem(id, content, checked, position, isAuthenticated);
        res.status(201).json(newItem);
    } catch (err: any) {
        if (err.message.startsWith('Unauthorized')) {
            res.status(403).json({ error: err.message });
        } else {
            console.error('Error adding item:', err.message);
            res.status(500).json({ error: 'Failed to add item' });
        }
    }
};

export const updateItem = async (req: Request, res: Response) => {
    const { itemId } = req.params;
    if (!itemId || typeof itemId !== 'string') {
        res.status(400).json({ error: 'Invalid Item ID' });
        return;
    }
    const { content, checked, position } = req.body;

    const lengthError = firstLengthError([[content, LIMITS.CHECKLIST_ITEM, 'Checklist item']]);
    if (lengthError) {
        res.status(400).json({ error: lengthError });
        return;
    }

    const cookiePin = req.cookies?.auth_pin;
    const isAuthenticated = cookiePin === correctPin;

    try {
        const updatedItem = await ChecklistService.updateItem(itemId, content, checked, position, isAuthenticated);
        res.json(updatedItem);
    } catch (err: any) {
        if (err.message === 'Item not found' || err.message === 'Checklist not found') {
            res.status(404).json({ error: err.message });
        } else if (err.message.startsWith('Unauthorized')) {
            res.status(403).json({ error: err.message });
        } else if (err.message === 'No fields to update') {
            res.status(400).json({ error: err.message });
        } else {
            console.error('Error updating item:', err.message);
            res.status(500).json({ error: 'Failed to update item' });
        }
    }
};

export const deleteItem = async (req: Request, res: Response) => {
    const { itemId } = req.params;
    if (!itemId || typeof itemId !== 'string') {
        res.status(400).json({ error: 'Invalid Item ID' });
        return;
    }

    const cookiePin = req.cookies?.auth_pin;
    const isAuthenticated = cookiePin === correctPin;

    try {
        await ChecklistService.deleteItem(itemId, isAuthenticated);
        res.status(204).send();
    } catch (err: any) {
        if (err.message === 'Item not found' || err.message === 'Checklist not found') {
            res.status(404).json({ error: err.message });
        } else if (err.message.startsWith('Unauthorized')) {
            res.status(403).json({ error: err.message });
        } else {
            console.error('Error deleting item:', err.message);
            res.status(500).json({ error: 'Failed to delete item' });
        }
    }
};
