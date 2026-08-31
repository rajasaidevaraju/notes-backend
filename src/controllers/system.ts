import { Request, Response } from 'express';
import { enableLan, disableLan, getLanStatus } from '../services/lan';
import { isRequestLocal } from '../middleware/localOnly';

export const getLanSharingStatus = (req: Request, res: Response) => {
  res.json({ ...getLanStatus(), canManage: isRequestLocal(req) });
};

export const enableLanSharing = (req: Request, res: Response) => {
  enableLan();
  res.json({ message: 'LAN sharing enabled for 15 minutes', ...getLanStatus() });
};

export const disableLanSharing = (req: Request, res: Response) => {
  disableLan();
  res.json({ message: 'LAN sharing disabled' });
};
