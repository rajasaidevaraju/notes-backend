import { Request, Response } from 'express';
import { recordFailedPinAttempt, clearFailedPinAttempts } from '../middleware/rateLimiter';
import { AppError, forbidden } from '../errors';
import { env } from '../config/env';

export const login = (req: Request, res: Response) => {
    const { pin } = req.body;
    const correctPin = env.hiddenNotesPin;
    const ip = req.ip;

    if (!ip) {
        throw new AppError(500, 'Could not determine request IP address.');
    }

    if (!pin || pin !== correctPin) {
        recordFailedPinAttempt(ip);
        throw forbidden('Invalid PIN');
    }

    res.cookie('auth_pin', pin, {
        httpOnly: true,
        sameSite: 'strict',
        secure: env.tls !== null,
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
    });

    clearFailedPinAttempts(ip);
    res.status(200).json({ message: 'Authenticated successfully' });
};

export const getStatus = (req: Request, res: Response) => {
    const pin = req.cookies['auth_pin'];
    res.json({ loggedIn: pin === env.hiddenNotesPin });
};

export const logout = (req: Request, res: Response) => {
    res.clearCookie('auth_pin', { path: '/', httpOnly: true, sameSite: 'strict', secure: env.tls !== null });
    res.status(200).json({ message: 'Logged out successfully' });
};
