import { Request, Response } from 'express';
import { NoteService } from '../services/noteService';

const correctPin = process.env.HIDDEN_NOTES_PIN;

export const getAllVisibleNotes = async (req: Request, res: Response) => {
  try {
    const notes = await NoteService.getAllVisibleNotes();
    res.json(notes);
  } catch (err: any) {
    console.error('Error fetching notes:', err.message);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
};

export const getHiddenNotes = async (req: Request, res: Response) => {
  try {
    const notes = await NoteService.getHiddenNotes();
    res.json(notes);
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      res.status(403).json({ error: 'Unauthorized' });
    } else {
      console.error('Error fetching hidden notes:', err.message);
      res.status(500).json({ error: 'Failed to fetch hidden notes' });
    }
  }
};

export const createNote = async (req: Request, res: Response) => {
  const { title, content, pinned, hidden } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  try {
    const newNote = await NoteService.createNote(title, content, pinned, hidden);
    res.status(201).json(newNote);
  } catch (err: any) {
    if (err.message.includes('reserved title')) {
      res.status(400).json({ error: err.message });
    } else {
      console.error('Error creating note:', err.message);
      res.status(500).json({ error: 'Failed to create note' });
    }
  }
};

export const updateNote = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'Invalid Note ID' });
    return;
  }
  const { title, content, pinned, hidden } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const cookiePin = req.cookies?.auth_pin;
  const isAuthenticated = cookiePin === correctPin;

  try {
    const updatedNote = await NoteService.updateNote(id, title, content, pinned, hidden, isAuthenticated);
    res.json(updatedNote);
  } catch (err: any) {
    if (err.message === 'Note not found') {
      res.status(404).json({ error: 'Note not found' });
    } else if (err.message.startsWith('Unauthorized')) {
      res.status(403).json({ error: err.message });
    } else if (err.message.includes('Cannot change') || err.message.includes('reserved title')) {
      res.status(403).json({ error: err.message });
    } else {
      console.error('Error updating note:', err.message);
      res.status(500).json({ error: 'Failed to update note' });
    }
  }
};

export const deleteNote = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'Invalid Note ID' });
    return;
  }
  const cookiePin = req.cookies?.auth_pin;
  const isAuthenticated = cookiePin === correctPin;

  try {
    await NoteService.deleteNote(id, isAuthenticated);
    res.status(204).send();
  } catch (err: any) {
    if (err.message === 'Note not found') {
      res.status(404).json({ error: 'Note not found' });
    } else if (err.message.startsWith('Unauthorized')) {
      res.status(403).json({ error: err.message });
    } else if (err.message.includes('Cannot delete')) {
      res.status(403).json({ error: err.message });
    } else {
      console.error('Error deleting note:', err.message);
      res.status(500).json({ error: 'Failed to delete note' });
    }
  }
};
