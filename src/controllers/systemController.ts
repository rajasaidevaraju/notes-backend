import { Request, Response } from 'express';
import { SystemService } from '../services/systemService';

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