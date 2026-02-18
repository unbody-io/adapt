/**
 * Observation buffer for learning methods
 *
 * Stores observations until synthesis is triggered.
 * Shared across all learning method variants.
 */

import type { SynthesizeThresholds } from './types'

/**
 * A buffered observation
 */
export interface BufferedObservation {
	text: string
	importance: number
}

/**
 * Observation buffer
 *
 * Simple array-based buffer with computed metrics.
 * Clears completely after synthesis.
 */
export class ObservationBuffer {
	private observations: BufferedObservation[] = []

	add(observation: BufferedObservation): void {
		this.observations.push(observation)
	}

	getAll(): BufferedObservation[] {
		return [...this.observations]
	}

	getTexts(): string[] {
		return this.observations.map((o) => o.text)
	}

	clear(): void {
		this.observations = []
	}

	get count(): number {
		return this.observations.length
	}

	get avgImportance(): number {
		if (this.observations.length === 0) return 0
		const sum = this.observations.reduce((acc, o) => acc + o.importance, 0)
		return sum / this.observations.length
	}

	/**
	 * Estimated total tokens (rough: 4 chars per token)
	 */
	get totalTokens(): number {
		const totalChars = this.observations.reduce(
			(acc, o) => acc + o.text.length,
			0,
		)
		return Math.ceil(totalChars / 4)
	}

	shouldSynthesize(thresholds: SynthesizeThresholds): boolean {
		const { maxObservations, maxTokens } = thresholds

		if (maxObservations !== undefined && this.count >= maxObservations) {
			return true
		}

		if (maxTokens !== undefined && this.totalTokens >= maxTokens) {
			return true
		}

		return false
	}

	get isEmpty(): boolean {
		return this.observations.length === 0
	}
}
