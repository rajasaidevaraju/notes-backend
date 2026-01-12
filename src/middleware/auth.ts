import { Request, Response, NextFunction } from 'express';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const cookiePin = req.cookies?.auth_pin;
    const correctPin = process.env.HIDDEN_NOTES_PIN;
    const isAuth = cookiePin === correctPin;

    if (!isAuth) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
    }

    next();
};
