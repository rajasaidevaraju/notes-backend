import { Request, Response } from 'express';
import * as TagService from '../services/tag';
import { LIMITS } from '../constants';
import { requireIdParam, requireString } from '../validation';

const requireName = (value: unknown): string => requireString(value, 'Tag name', LIMITS.TAG_NAME).trim();

export const getTags = (req: Request, res: Response) => {
    res.json(TagService.getTags());
};

export const createTag = (req: Request, res: Response) => {
    res.status(201).json(TagService.createTag(requireName(req.body.name)));
};

export const renameTag = (req: Request, res: Response) => {
    const id = requireIdParam(req.params.id, 'Tag');
    res.json(TagService.renameTag(id, requireName(req.body.name)));
};

export const deleteTag = (req: Request, res: Response) => {
    TagService.deleteTag(requireIdParam(req.params.id, 'Tag'));
    res.status(204).send();
};
