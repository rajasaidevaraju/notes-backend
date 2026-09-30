import { badRequest } from './errors';

export function optionalString(value: unknown, field: string, max: number): string | undefined {
    if (typeof value === 'undefined') return undefined;
    if (typeof value !== 'string') throw badRequest(`${field} must be a string.`);
    if (value.length > max) throw badRequest(`${field} must be at most ${max} characters.`);
    return value;
}

export function requireString(value: unknown, field: string, max: number): string {
    const str = optionalString(value, field, max);
    if (typeof str === 'undefined' || !str.trim()) throw badRequest(`${field} is required`);
    return str;
}

export function optionalTitle(value: unknown, max: number): string | undefined {
    const title = optionalString(value, 'Title', max);
    if (typeof title !== 'undefined' && !title.trim()) throw badRequest('Title cannot be empty');
    return title;
}

export function optionalNullableString(value: unknown, field: string, max: number): string | null | undefined {
    if (value === null) return null;
    return optionalString(value, field, max);
}

export function optionalFlag(value: unknown, field: string): boolean | undefined {
    if (typeof value === 'undefined') return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 0 || value === 1) return value === 1;
    throw badRequest(`${field} must be a boolean.`);
}

export function optionalPosition(value: unknown): number | undefined {
    if (typeof value === 'undefined') return undefined;
    if (!Number.isInteger(value) || (value as number) < 0) {
        throw badRequest('position must be a non-negative integer.');
    }
    return value as number;
}

export interface ChecklistItemInput {
    content: string;
    checked: boolean;
    position: number | undefined;
}

export function optionalChecklistItems(value: unknown, max: number): ChecklistItemInput[] | undefined {
    if (typeof value === 'undefined') return undefined;
    if (!Array.isArray(value)) throw badRequest('items must be an array.');

    return value.map((item, i) => {
        if (typeof item !== 'object' || item === null) throw badRequest(`Item ${i} must be an object.`);
        return {
            content: optionalString(item.content, 'Checklist item', max) ?? '',
            checked: optionalFlag(item.checked, 'checked') ?? false,
            position: optionalPosition(item.position),
        };
    });
}

export const isPositiveInteger = (value: unknown): boolean =>
    Number.isInteger(Number(value)) && Number(value) > 0;

export function requireIdParam(value: unknown, label: string): number {
    const id = typeof value === 'string' ? Number(value) : NaN;

    if (!Number.isInteger(id) || id <= 0) {
        throw badRequest(`Invalid ${label} ID`);
    }

    return id;
}
