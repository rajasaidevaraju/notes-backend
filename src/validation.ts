import { badRequest } from './errors';

type LengthCheck = [value: unknown, max: number, field: string];

export function firstLengthError(checks: LengthCheck[]): string | null {
    for (const [value, max, field] of checks) {
        if (typeof value === 'string' && value.length > max) {
            return `${field} must be at most ${max} characters.`;
        }
    }
    return null;
}

export function itemsContentLengthError(
    items: unknown,
    max: number,
    field: string
): string | null {
    if (!Array.isArray(items)) return null;
    for (const item of items) {
        if (typeof item?.content === 'string' && item.content.length > max) {
            return `${field} must be at most ${max} characters.`;
        }
    }
    return null;
}

export function requireIdParam(value: unknown, label: string): number {
    const id = typeof value === 'string' ? Number(value) : NaN;

    if (!Number.isInteger(id) || id <= 0) {
        throw badRequest(`Invalid ${label} ID`);
    }

    return id;
}
