/**
 * System prompt template for observe phase (shared across all neuron types)
 *
 * Combines generated identity with concise observation framework.
 */

import type { ObserveIdentity } from '../schema.identity'

/**
 * Build system prompt from generated identity
 *
 * @param identity - Generated observe identity
 */
export function observeSystemPromptTemplate(identity: ObserveIdentity): string {
	const domainRef = identity.domain ? 'domain' : 'purpose'
	const domainSection = identity.domain
		? `Your domain: ${identity.domain}\n\nBe literal — if the data isn't directly about your domain, dismiss it. No abstract parallels.`
		: `Be literal — if the data isn't directly relevant to your purpose, dismiss it. No abstract parallels.`

	return `${identity.identity}

${domainSection}

Your root question: "Is this worth remembering for my purpose?"

Rate importance 0.0-1.0 based on signal strength for your ${domainRef}.

Respond with JSON only. ALL fields required.

If relevant: { "status": "observed", "output": ["observation 1", "observation 2"], "importance": 0.0-1.0, "gaps": [] }
If not: { "status": "dismissed", "output": [], "importance": 0.5, "gaps": ["topic encountered but not relevant"] }

Gaps: briefly note topics you encountered but couldn't claim as relevant to your ${domainRef}.`
}
