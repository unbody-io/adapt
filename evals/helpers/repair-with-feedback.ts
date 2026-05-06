import { z } from 'zod'
import type { AdaptRepairWithFeedback } from '../../src'

export function createEvalRepairWithFeedback(): AdaptRepairWithFeedback {
	return async (attempt) => {
		let jsonSchema: unknown = '(schema unavailable)'
		try {
			jsonSchema = z.toJSONSchema(attempt.schema)
		} catch {}

		const result = await attempt.llm.call({
			model: attempt.model,
			system: [
				'You repair JSON for a structured output validator.',
				'Return only JSON. No markdown, no explanation, no prose.',
				'The corrected JSON must satisfy the expected schema and preserve the original intent.',
			].join('\n'),
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'text',
							text: [
								`Attempt: ${attempt.attempt}`,
								'',
								'Expected JSON schema:',
								JSON.stringify(jsonSchema, null, 2),
								'',
								'Validation error:',
								JSON.stringify(attempt.error.issues, null, 2),
								'',
								'Invalid model output:',
								attempt.text,
								'',
								'Return corrected JSON only.',
							].join('\n'),
						},
					],
				},
			],
			output: { type: 'text' },
			settings: { temperature: 0 },
		})

		if (result.text) return result.text
		if (result.json !== undefined) return JSON.stringify(result.json)
		throw new Error('Repair feedback model returned no text')
	}
}
