import { Request, Response } from 'express';
import { recordFailedPinAttempt, clearFailedPinAttempts } from '../middleware/rateLimiter';
import { AppError, forbidden } from '../errors';

export const login = (req: Request, res: Response) => {
    const { pin } = req.body;
    const correctPin = process.env.HIDDEN_NOTES_PIN;
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
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
    });

    clearFailedPinAttempts(ip);
    res.status(200).json({ message: 'Authenticated successfully' });
};

export const getStatus = (req: Request, res: Response) => {
    const pin = req.cookies['auth_pin'];
    const correctPin = process.env.HIDDEN_NOTES_PIN;

    res.json({ loggedIn: Boolean(correctPin) && pin === correctPin });
};

export const logout = (req: Request, res: Response) => {
    res.clearCookie('auth_pin', { path: '/' });
    res.status(200).json({ message: 'Logged out successfully' });
};
