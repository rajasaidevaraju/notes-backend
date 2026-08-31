import { ErrorRequestHandler } from 'express';
import { AppError } from '../errors';


export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof AppError) {
        if (!err.expose) {
            console.error(`${req.method} ${req.originalUrl}:`, err.message);
            res.status(err.status).json({ error: 'Internal server error' });
            return;
        }

        res.status(err.status).json({ error: err.message });
        return;
    }

    console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
    res.status(500).json({ error: 'Internal server error' });
};
