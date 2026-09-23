import { Request, Response } from 'express';
import * as NoteService from '../services/note';
import { LIMITS } from '../constants';
import { optionalFlag, optionalNullableString, optionalTitle, requireIdParam, requireString } from '../validation';
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

export const createNote = (req: Request, res: Response) => {
  const { title, content, pinned, hidden } = req.body;

  res.status(201).json(NoteService.createNote(
    requireString(title, 'Title', LIMITS.TITLE),
    optionalNullableString(content, 'Content', LIMITS.NOTE_CONTENT) ?? null,
    optionalFlag(pinned, 'pinned') ?? false,
    optionalFlag(hidden, 'hidden') ?? false
  ));
};

export const updateNote = (req: Request, res: Response) => {
  const id = requireIdParam(req.params.id, 'Note');
  const { title, content, pinned, hidden, archived } = req.body;

  res.json(NoteService.updateNote(id, {
    title: optionalTitle(title, LIMITS.TITLE),
    content: optionalNullableString(content, 'Content', LIMITS.NOTE_CONTENT),
    pinned: optionalFlag(pinned, 'pinned'),
    hidden: optionalFlag(hidden, 'hidden'),
    archived: optionalFlag(archived, 'archived'),
  }, isAuthenticated(req)));
};

export const deleteNote = (req: Request, res: Response) => {
  const id = requireIdParam(req.params.id, 'Note');

  NoteService.deleteNote(id, isAuthenticated(req));
  res.status(204).send();
};
