/** Recursively extract all string values from an object */
export function extractStrings(obj: unknown): string[] {
	if (typeof obj === 'string') return [obj]
	if (obj === null || obj === undefined) return []
	if (Array.isArray(obj)) return obj.flatMap(extractStrings)
	if (typeof obj === 'object') return Object.values(obj).flatMap(extractStrings)
	return []
}

export function matchesSearchQuery(obj: unknown, query: string): boolean {
	const normalizedQuery = query.toLowerCase()
	return extractStrings(obj).some((value) =>
		value.toLowerCase().includes(normalizedQuery),
	)
}
