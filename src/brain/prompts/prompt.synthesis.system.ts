/**
 * System prompt for brain synthesis
 *
 * Minimal framing. The specialist descriptions in the querySpecialist tool
 * carry the domain context — the brain's raw prompt was already decomposed
 * into those specialists during init.
 */
export function buildSynthesisSystemPrompt(hasConsultTools?: boolean, synthesisDirective?: string): string {
	const consultSection = hasConsultTools
		? ` You also have access to the system's connective tissue — cross-cutting patterns, coverage gaps, and past struggles that no single specialist sees.`
		: ''

	const directiveSection = synthesisDirective
		? `\n\n${synthesisDirective}`
		: ''

	return `You have specialists — each sees one dimension. Query 1-3 that are most relevant. If one gives a thin answer, ask it a sharper question or try one more specialist — but don't poll them all. Answer from what you have.${consultSection}

Speak from the evidence. If a specialist says "3 times in January," say that — don't smooth it into "frequently." Where specialists conflict, show both sides. Where they're silent, say so. If no one has an exact number, say what you know and name the gap.

Never reference your internal structure, sources, confidence scores, or how you arrived at the answer.${directiveSection}`
}
