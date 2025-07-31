import { Request, Response } from 'express';
import { recordFailedPinAttempt, clearFailedPinAttempts } from '../middleware/rateLimiter';

export const login = (req: Request, res: Response) => {
    const { pin } = req.body;
    const correctPin = process.env.HIDDEN_NOTES_PIN;
    const ip = req.ip;

      if (!ip) {
        res.status(500).json({ error: 'Could not determine request IP address.' });
        return;
    }


    if (!pin || pin !== correctPin) {
        recordFailedPinAttempt(ip);
        res.status(403).json({ error: 'Invalid PIN' });
        return;
    }

    res.cookie('auth_pin', pin, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
    });

    clearFailedPinAttempts(ip);
    res.status(200).json({ message: 'Authenticated successfully' });
};

export const getStatus = (req: Request, res: Response) => {
    const pin = req.cookies['auth_pin'];
    const correctPin = process.env.HIDDEN_NOTES_PIN;

    if (pin && pin === correctPin) {
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
};

export const logout = (req: Request, res: Response) => {
    res.clearCookie('auth_pin');
    res.status(200).json({ message: 'Logged out successfully' });
};
