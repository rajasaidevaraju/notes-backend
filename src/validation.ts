/**
 * Length validation for user-supplied text. Each helper returns an error
 * string when a value is too long, or null when it's acceptable (including
 * when the value is absent — controllers handle "required" separately).
 */

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
