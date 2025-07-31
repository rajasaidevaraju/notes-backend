import { Request, Response } from 'express';
import os from 'os';

export const getHomePage = (req: Request, res: Response) => {
  res.send('Hello from the Notes API server!');
};

export const getServerIp = (req: Request, res: Response) => {
  const networkInterfaces = os.networkInterfaces();
  let serverIpAddress = 'Not Found';

  for (const interfaceName in networkInterfaces) {
    const networkInterface = networkInterfaces[interfaceName];
    if (networkInterface) {
      for (const alias of networkInterface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          serverIpAddress = alias.address;
          break;
        }
      }
    }
    if (serverIpAddress !== 'Not Found') {
      break;
    }
  }

  res.json({ ip: serverIpAddress });
};