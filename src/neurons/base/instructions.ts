export interface PhaseInstructionState {
	instructions: string
	observeInstructions?: string | null
	understandInstructions?: string | null
	focus?: string | null
}

function clean(value: string | null | undefined): string {
	return value?.trim() ?? ''
}

export function resolveObserveInstructions(
	state: PhaseInstructionState,
): string {
	const base = clean(state.observeInstructions ?? state.instructions)
	const focus = clean(state.focus)
	if (!focus) return base
	if (!base) return `Focus:\n${focus}`
	return `${base}\n\nFocus:\n${focus}`
}

export function resolveUnderstandInstructions(
	state: PhaseInstructionState,
): string {
	return clean(state.understandInstructions ?? state.instructions)
}
