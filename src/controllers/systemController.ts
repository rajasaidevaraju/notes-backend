import { Request, Response } from 'express';
import { SystemService } from '../services/systemService';
import { enableLan, disableLan, getLanStatus } from '../services/lanService';

export const getHomePage = (req: Request, res: Response) => {
  res.send('Hello from the Notes API server!');
};

export const getServerIp = (req: Request, res: Response) => {
  const serverIpAddress = SystemService.getIpAddress();
  res.json({ ip: serverIpAddress });
};

export const getHealth = (req: Request, res: Response) => {
  res.json({ status: 'OK' });
};

export const getLanSharingStatus = (req: Request, res: Response) => {
  res.json(getLanStatus());
};

const isRequestLocal = (req: Request): boolean => {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : (req.ip || req.socket.remoteAddress || '');
  const ip = realIp.replace(/^::ffff:/, '');
  return ip === '::1' || ip === '127.0.0.1' || ip === 'localhost';
};

export const enableLanSharing = (req: Request, res: Response) => {
  if (!isRequestLocal(req)) {
    res.status(403).json({ error: 'Only localhost can enable/disable LAN sharing.' });
    return;
  }

  enableLan();
  res.json({ message: 'LAN sharing enabled for 15 minutes', ...getLanStatus() });
};

export const disableLanSharing = (req: Request, res: Response) => {
  if (!isRequestLocal(req)) {
    res.status(403).json({ error: 'Only localhost can enable/disable LAN sharing.' });
    return;
  }

  disableLan();
  res.json({ message: 'LAN sharing disabled' });
};