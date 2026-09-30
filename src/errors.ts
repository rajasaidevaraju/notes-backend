export class AppError extends Error {
    constructor(
        readonly status: number,
        message: string,
        readonly expose = true
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export const badRequest = (message: string) => new AppError(400, message);
/** Missing or expired PIN cookie. The client treats any 401 as "session over" and re-locks. */
export const unauthorized = (message: string) => new AppError(401, message);
export const forbidden =(message: string) => new AppError(403, message);
export const notFound = (what: string) => new AppError(404, `${what} not found`);

/** Internal failure that shouldn't leak its message to the client. */
export const internal = (message: string) => new AppError(500, message, false);
