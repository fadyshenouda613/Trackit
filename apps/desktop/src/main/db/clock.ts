/** Now, as every timestamp is stored: a UTC ISO 8601 string. */
export const nowIso = (): string => new Date().toISOString()
