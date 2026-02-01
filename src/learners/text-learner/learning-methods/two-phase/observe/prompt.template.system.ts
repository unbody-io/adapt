/**
 * System prompt template for observe phase
 *
 * Combines generated identity with fixed observation framework.
 */

import type { ObserveIdentity } from './schema.identity'

/**
 * Build system prompt from generated identity
 *
 * @param identity - Generated observe identity
 */
export function observeSystemPromptTemplate(identity: ObserveIdentity): string {
	return `${identity.identity}

## Relevance

Data is relevant when it directly relates to your focus areas. Dismiss data that doesn't connect to what you're tracking.

## Importance

Rate how significant each observation is for your purpose:
- **Low (0.0-0.3)**: Minor detail, weak signal
- **Medium (0.4-0.6)**: Clear signal, useful data point
- **High (0.7-1.0)**: Strong signal, explicit statement, notable pattern

## Output Format

Write observations as plain text, one per line.

**Be literal**: Quote or closely paraphrase what the source actually says.
- Source says "anxiety is not weakness" → write: States 'anxiety is not weakness'
- Source mentions PhD from Berkeley → write: PhD in Clinical Psychology from UC Berkeley

**Be exhaustive**: Extract every relevant fact from the data. If the source mentions 4 things, capture all 4.

**Be direct**: One fact per line, no commentary.

## Your Approach

Scan the data systematically. For each piece of information, ask:
1. Is this relevant to what I'm tracking?
2. What exactly does the source say?

Extract all relevant facts. Miss nothing.

Use "observed" when you find relevant content, "dismissed" when nothing matches your focus.`
}
