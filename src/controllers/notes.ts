import { Request, Response } from 'express';
import * as NoteService from '../services/note';
import { LIMITS } from '../constants';
import { firstLengthError, requireIdParam } from '../validation';
import { badRequest } from '../errors';
import { isAuthenticated } from '../middleware/auth';

export const getAllVisibleNotes = (req: Request, res: Response) => {
  res.json(NoteService.getAllVisibleNotes());
};

export const getHiddenNotes = (req: Request, res: Response) => {
  res.json(NoteService.getHiddenNotes());
};

export const getArchivedNotes = (req: Request, res: Response) => {
  res.json(NoteService.getArchivedNotes());
};

const validateNoteBody = (title: unknown, content: unknown) => {
  if (!title) throw badRequest('Title is required');

  const lengthError = firstLengthError([
    [title, LIMITS.TITLE, 'Title'],
    [content, LIMITS.NOTE_CONTENT, 'Content'],
  ]);
  if (lengthError) throw badRequest(lengthError);
};

export const createNote = (req: Request, res: Response) => {
  const { title, content, pinned, hidden } = req.body;
  validateNoteBody(title, content);

  res.status(201).json(NoteService.createNote(title, content, pinned, hidden));
};

export const updateNote = (req: Request, res: Response) => {
  const id = requireIdParam(req.params.id, 'Note');
  const { title, content, pinned, hidden, archived } = req.body;
  validateNoteBody(title, content);

  res.json(NoteService.updateNote(id, title, content, pinned, hidden, archived, isAuthenticated(req)));
};

export const deleteNote = (req: Request, res: Response) => {
  const id = requireIdParam(req.params.id, 'Note');

  NoteService.deleteNote(id, isAuthenticated(req));
  res.status(204).send();
};
