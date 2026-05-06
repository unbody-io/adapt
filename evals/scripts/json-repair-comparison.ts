/**
 * Compare our hand-rolled repairJson vs jsonrepair on representative
 * LLM JSON-output failure modes.
 *
 * Run:
 *   npx tsx evals/scripts/json-repair-comparison.ts
 *
 * Output: per-sample table showing whether each library produces parseable
 * JSON, plus a summary of coverage. The decision rule: if jsonrepair handles
 * everything ours does, swap. Otherwise, layer ours first then jsonrepair.
 */

import { jsonrepair } from 'jsonrepair'

// ── Replicas of our internal repairJson chain (src/llm/index.ts) ───────────
// These are not exported, so we re-implement the same five transforms locally
// for the comparison. If src changes, update here too.

function stripMarkdownCodeBlock(text: string): string {
	return text
		.replace(/^```(?:json)?\s*\n?/i, '')
		.replace(/\n?```\s*$/i, '')
		.trim()
}

function stripGarbagePrefix(text: string): string {
	const jsonStartPattern = /\{\s*"[a-zA-Z_]/
	const match = text.match(jsonStartPattern)
	if (match && match.index !== undefined) return text.slice(match.index)
	const loosePattern = /\{\s*"/
	const looseMatch = text.match(loosePattern)
	if (looseMatch && looseMatch.index !== undefined)
		return text.slice(looseMatch.index)
	return text
}

function fixDoubleBrace(text: string): string {
	return text.replace(/^\{\s*\{/, '{')
}

function fixQuotedObjectPrefix(text: string): string {
	const quotedObjectPattern = /^"\s*\{/
	if (quotedObjectPattern.test(text)) return text.replace(/^"\s*/, '')
	return text
}

function repairJsonNewlines(text: string): string {
	let result = ''
	let inString = false
	let escaped = false
	for (let i = 0; i < text.length; i++) {
		const char = text[i]
		if (escaped) {
			result += char
			escaped = false
			continue
		}
		if (char === '\\') {
			result += char
			escaped = true
			continue
		}
		if (char === '"') {
			inString = !inString
			result += char
			continue
		}
		if (inString && (char === '\n' || char === '\r')) {
			result += '\\n'
		} else {
			result += char
		}
	}
	return result
}

function ourRepair(text: string): string {
	let s = text
	s = stripMarkdownCodeBlock(s)
	s = stripGarbagePrefix(s)
	s = fixDoubleBrace(s)
	s = fixQuotedObjectPrefix(s)
	s = repairJsonNewlines(s)
	return s
}

// ── Failure samples ────────────────────────────────────────────────────────
// Each sample: a label, the malformed input, and the expected parsed shape
// (or `null` if we just want it to parse to *something* without throwing).

type Sample = {
	label: string
	input: string
	// Expected parsed value, or `'parses'` if we only require successful parse.
	expected: unknown | 'parses'
}

const samples: Sample[] = [
	// ── Envelope problems (our repair's bread and butter) ──
	{
		label: 'markdown-fence: ```json wrapped',
		input: '```json\n{"name": "foo", "value": 42}\n```',
		expected: { name: 'foo', value: 42 },
	},
	{
		label: 'markdown-fence: ``` (no json) wrapped',
		input: '```\n{"name": "foo"}\n```',
		expected: { name: 'foo' },
	},
	{
		label: 'preamble: chain-of-thought before JSON',
		input:
			'Let me think about this... I need to produce JSON.\n\nHere is the result: {"name": "foo", "value": 42}',
		expected: { name: 'foo', value: 42 },
	},
	{
		label: 'preamble: "Here is my answer:" prefix',
		input: 'Here is my answer:\n{"a": 1, "b": 2}',
		expected: { a: 1, b: 2 },
	},
	{
		label: 'envelope: double opening brace `{{ ... }`',
		input: '{{"name": "foo"}',
		expected: { name: 'foo' },
	},
	{
		label: 'envelope: whole object wrapped in quotes',
		input: '"{\\"name\\": \\"foo\\"}"',
		expected: { name: 'foo' },
	},
	{
		label: 'newlines: raw \\n inside a string value',
		input: '{"text": "line one\nline two", "n": 1}',
		expected: { text: 'line one\nline two', n: 1 },
	},
	{
		label: 'newlines: raw \\r\\n inside a string value',
		input: '{"text": "line one\r\nline two"}',
		expected: 'parses',
	},

	// ── Syntactic problems (jsonrepair territory) ──
	{
		label: 'syntax: trailing comma in object',
		input: '{"a": 1, "b": 2,}',
		expected: { a: 1, b: 2 },
	},
	{
		label: 'syntax: trailing comma in array',
		input: '{"items": [1, 2, 3,]}',
		expected: { items: [1, 2, 3] },
	},
	{
		label: 'syntax: single-quoted strings',
		input: "{'name': 'foo', 'value': 42}",
		expected: { name: 'foo', value: 42 },
	},
	{
		label: 'syntax: unquoted keys',
		input: '{name: "foo", value: 42}',
		expected: { name: 'foo', value: 42 },
	},
	{
		label: 'syntax: missing closing brace (truncated)',
		input: '{"name": "foo", "value": 42',
		expected: { name: 'foo', value: 42 },
	},
	{
		label: 'syntax: missing closing bracket in array',
		input: '{"items": [1, 2, 3}',
		expected: 'parses',
	},
	{
		label: 'syntax: comments inside JSON',
		input: '{\n  // a comment\n  "name": "foo"\n}',
		expected: { name: 'foo' },
	},

	// ── Combined failures (real-world — multiple problems in one) ──
	{
		label: 'combined: markdown fence + trailing comma',
		input: '```json\n{"a": 1, "b": 2,}\n```',
		expected: { a: 1, b: 2 },
	},
	{
		label: 'combined: preamble + truncation',
		input:
			'Sure, here is your JSON:\n\n{"name": "foo", "value": 42',
		expected: { name: 'foo', value: 42 },
	},
	{
		label: 'combined: markdown fence + raw newline in string',
		input: '```json\n{"text": "first line\nsecond line"}\n```',
		expected: { text: 'first line\nsecond line' },
	},

	// ── Edge: just `{` (the truncation we hit in the docs-code run) ──
	{
		label: 'edge: just `{` (severe truncation)',
		input: '{',
		expected: 'parses', // Anything that parses without throwing is acceptable.
	},
]

// ── Runner ─────────────────────────────────────────────────────────────────

type Outcome = {
	parsed: boolean
	matches: boolean
	error?: string
}

function tryRun(repair: (s: string) => string, sample: Sample): Outcome {
	try {
		const repaired = repair(sample.input)
		const parsed = JSON.parse(repaired)
		if (sample.expected === 'parses') {
			return { parsed: true, matches: true }
		}
		const matches = JSON.stringify(parsed) === JSON.stringify(sample.expected)
		return { parsed: true, matches }
	} catch (err) {
		return {
			parsed: false,
			matches: false,
			error: err instanceof Error ? err.message : String(err),
		}
	}
}

function symbol(o: Outcome): string {
	if (!o.parsed) return '✗'
	if (!o.matches) return '~' // parses but wrong shape
	return '✓'
}

console.log(
	'\nLEGEND  ✓ parses + matches expected   ~ parses but shape differs   ✗ throws\n',
)

const colWidth = 56
const header = `${'Sample'.padEnd(colWidth)}  ours    jsonrepair  layered`
console.log(header)
console.log('─'.repeat(header.length))

let oursWins = 0
let jrWins = 0
let layeredWins = 0
const oursLosesTo: string[] = []
const jrLosesTo: string[] = []

for (const sample of samples) {
	const ours = tryRun(ourRepair, sample)
	const jr = tryRun(jsonrepair, sample)
	const layered = tryRun((s) => jsonrepair(ourRepair(s)), sample)

	if (ours.parsed && ours.matches) oursWins++
	if (jr.parsed && jr.matches) jrWins++
	if (layered.parsed && layered.matches) layeredWins++

	if (ours.parsed && ours.matches && !(jr.parsed && jr.matches)) {
		oursLosesTo.push(sample.label) // ours wins, jsonrepair loses
	}
	if (jr.parsed && jr.matches && !(ours.parsed && ours.matches)) {
		jrLosesTo.push(sample.label) // jsonrepair wins, ours loses
	}

	const label = sample.label.padEnd(colWidth)
	console.log(
		`${label}  ${symbol(ours).padEnd(6)}  ${symbol(jr).padEnd(10)}  ${symbol(layered)}`,
	)
}

console.log('\n' + '═'.repeat(header.length))
console.log(`ours       : ${oursWins}/${samples.length} samples handled`)
console.log(`jsonrepair : ${jrWins}/${samples.length} samples handled`)
console.log(`layered    : ${layeredWins}/${samples.length} samples handled`)

if (jrLosesTo.length === 0 && oursLosesTo.length === 0) {
	console.log('\nResult: identical coverage. Swap freely.')
} else if (oursLosesTo.length === 0) {
	console.log(
		`\nResult: jsonrepair strictly dominates. ours wins on 0 samples; jsonrepair wins on ${jrLosesTo.length}.`,
	)
	console.log('Recommendation: swap (drop ours).')
} else if (jrLosesTo.length === 0) {
	console.log(
		`\nResult: ours strictly dominates. jsonrepair wins on 0; ours wins on ${oursLosesTo.length}.`,
	)
	console.log('Recommendation: keep ours.')
} else {
	console.log(
		`\nResult: complementary. ours-only wins: ${oursLosesTo.length}, jsonrepair-only wins: ${jrLosesTo.length}`,
	)
	console.log(
		`\nours-only handles:\n  - ${oursLosesTo.join('\n  - ')}\n\njsonrepair-only handles:\n  - ${jrLosesTo.join('\n  - ')}`,
	)
	console.log('\nRecommendation: layer (ours first, then jsonrepair).')
}
