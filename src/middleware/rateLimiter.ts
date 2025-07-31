import { Request, Response, NextFunction } from 'express';

interface AttemptRecord {
  count: number;
  resetTime: number;
}

const failedAttempts: Record<string, AttemptRecord> = {};
const MAX_ATTEMPTS = 5;
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

export const recordFailedPinAttempt = (ip: string) => {
  const now = Date.now();
  const record = failedAttempts[ip];

  if (record && now < record.resetTime) {
    record.count++;
  } else {
    failedAttempts[ip] = {
      count: 1,
      resetTime: now + ONE_HOUR_IN_MS,
    };
  }
};

export const clearFailedPinAttempts = (ip: string) => {
    if(ip in failedAttempts){
        delete failedAttempts[ip];
    }
}

export const pinRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip;
  if (!ip) {
    res.status(500).json({ error: 'Could not determine request IP address.' });
    return;
  }

  const record = failedAttempts[ip];
  const now = Date.now();

  if (record && now < record.resetTime) {
    if (record.count >= MAX_ATTEMPTS) {
      const timeLeft = Math.ceil((record.resetTime - now) / (1000 * 60));
      res.set('Retry-After', record.resetTime.toString());
      res.status(429).json({error: `Too many failed attempts. Please try again in ${timeLeft} minutes.`,});
      return;
    }
  }

  next();
};