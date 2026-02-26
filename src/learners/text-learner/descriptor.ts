/**
 * Text learner type descriptor — static metadata for Brain's evolution system.
 */

import { z } from 'zod'
import type { LearnerTypeDescriptor } from '../types'
import { TextLearner } from './class'
import type { TextLearnerConfig } from './types'

export const textLearnerDescriptor: LearnerTypeDescriptor = {
	type: 'text',

	description: `TEXT learners build narrative prose understanding.
Best for: qualitative patterns, preferences, philosophies, interconnected concepts, nuanced reasoning.
- governance: { strategy: "continuous" | "cumulative" | "decay" }
  - continuous: Single growing understanding (default, good for most cases)
  - cumulative: Summarize when understanding gets large (good for high-volume data)
  - decay: Weight recent observations higher (good for tracking evolving preferences)`,

	factory(config: Record<string, unknown>) {
		return new TextLearner(config as unknown as TextLearnerConfig)
	},

	mergeUnderstandingSchema: z
		.string()
		.describe(
			'Merged understanding text combining knowledge from all source learners',
		),

	splitUnderstandingSchema: z
		.string()
		.describe('Understanding text for this split learner'),
}
