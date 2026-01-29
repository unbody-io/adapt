import { z } from 'zod'

/**
 * Tool schemas for TextLearner
 *
 * Data processing tools: compareToUnderstanding, detectShift, detectPattern, synthesize
 * Query tools: generateResponse, identifyGaps, complete
 */

// ─────────────────────────────────────────────────────────────────────────────
// Data Processing Tool Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const compareToUnderstandingParams = z.object({
	relation: z
		.enum(['confirms', 'contradicts', 'extends', 'new', 'irrelevant'])
		.describe(
			'How data relates to understanding: confirms (supports existing), contradicts (conflicts), extends (adds detail), new (relevant but unknown), irrelevant (off-purpose)',
		),
	explanation: z.string().describe('Brief explanation of the classification'),
})

export const detectShiftParams = z.object({
	shifted: z.boolean().describe('Whether a fundamental shift was detected'),
	from: z
		.string()
		.optional()
		.describe('What the understanding was shifting from'),
	to: z.string().optional().describe('What the understanding is shifting to'),
})

export const detectPatternParams = z.object({
	pattern: z.string().optional().describe('The emerging pattern, if detected'),
	confidence: z
		.number()
		.min(0)
		.max(1)
		.describe('Confidence in the pattern detection'),
})

/**
 * Done tool for data processing - captures the synthesized understanding
 */
export const synthesizeParams = z.object({
	newUnderstanding: z
		.string()
		.describe('The updated understanding after processing the data'),
	relevance: z
		.number()
		.min(0)
		.max(1)
		.describe('How relevant the data was to the learner purpose'),
	entry: z.object({
		summary: z.string().describe('Brief description of what changed and why'),
		significance: z
			.enum(['routine', 'notable', 'critical'])
			.describe(
				'routine = normal refinement, notable = new pattern or meaningful shift, critical = watched condition triggered',
			),
	}),
})

// ─────────────────────────────────────────────────────────────────────────────
// Query Tool Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const generateResponseParams = z.object({
	response: z.string().describe('The generated response to the query'),
	confidence: z.number().min(0).max(1).describe('Confidence in the response'),
})

export const identifyGapsParams = z.object({
	gaps: z
		.array(z.string())
		.describe('List of things that could not be answered'),
})

/**
 * Done tool for query handling - captures the final response
 */
export const completeParams = z.object({
	relevant: z
		.boolean()
		.describe('Whether this learner can help with the query'),
	confidence: z.number().min(0).max(1).describe('Confidence in the response'),
	insight: z.string().describe('The insight or response to the query'),
	gaps: z.array(z.string()).describe('What could not be answered'),
})

// ─────────────────────────────────────────────────────────────────────────────
// Type exports
// ─────────────────────────────────────────────────────────────────────────────

export type CompareToUnderstandingParams = z.infer<
	typeof compareToUnderstandingParams
>
export type DetectShiftParams = z.infer<typeof detectShiftParams>
export type DetectPatternParams = z.infer<typeof detectPatternParams>
export type SynthesizeParams = z.infer<typeof synthesizeParams>
export type GenerateResponseParams = z.infer<typeof generateResponseParams>
export type IdentifyGapsParams = z.infer<typeof identifyGapsParams>
export type CompleteParams = z.infer<typeof completeParams>
