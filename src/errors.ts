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
export const unauthorized = (message: string) => new AppError(401, message);
export const forbidden = (message: string) => new AppError(403, message);
export const notFound = (what: string) => new AppError(404, `${what} not found`);

export const internal = (message: string) => new AppError(500, message, false);
