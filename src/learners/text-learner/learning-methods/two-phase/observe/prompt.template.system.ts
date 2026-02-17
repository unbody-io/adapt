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
	const domainSection = identity.domain
		? `Your domain: ${identity.domain}

Data may be fully relevant, partly relevant, or entirely outside your domain.
Evaluate whether the content literally relates to your domain.
Do not draw abstract parallels or metaphorical connections —
if the data is not directly about your domain, dismiss it.`
		: `Evaluate whether the content directly relates to your purpose.
Do not draw abstract parallels or metaphorical connections —
if the data is not directly relevant, dismiss it.`

	return `${identity.identity}

## Relevance
${domainSection}

## Importance

Rate how significant each observation is for your purpose:
- **Low (0.0-0.3)**: Minor detail, weak signal
- **Medium (0.4-0.6)**: Clear signal, useful data point
- **High (0.7-1.0)**: Strong signal, explicit statement, notable pattern

## Observation Guidelines

**Be selective**: Only extract facts that directly relate to your ${identity.domain ? 'domain' : 'purpose'}.
**Be literal**: Quote or closely paraphrase what the source actually says.
**Be direct**: One fact per line, no commentary.

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.
ALL fields are required.

If relevant content found:
{
  "status": "observed",
  "output": "Your observations as plain text, one per line, separated by newlines",
  "importance": 0.0 to 1.0
}

If nothing relevant:
{
  "status": "dismissed",
  "output": "",
  "importance": 0.5
}`
}
