export function parseApiError(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: unknown } };
    const raw = e?.error?.message;
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object') {
        const inner = (raw as { message?: unknown }).message;
        if (typeof inner === 'string') return inner;
        if (Array.isArray(inner) && inner.length > 0 && typeof inner[0] === 'string') {
            return inner.join(', ');
        }
    }
    return fallback;
}