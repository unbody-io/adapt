/**
 * Observation buffer for two-phase learning
 *
 * Stores observations from the observe phase until synthesis is triggered.
 * Provides computed metrics for threshold checking.
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

	/**
	 * Add an observation to the buffer
	 */
	add(observation: BufferedObservation): void {
		this.observations.push(observation)
	}

	/**
	 * Get all buffered observations
	 */
	getAll(): BufferedObservation[] {
		return [...this.observations]
	}

	/**
	 * Get observation texts only (for synthesis)
	 */
	getTexts(): string[] {
		return this.observations.map((o) => o.text)
	}

	/**
	 * Clear the buffer (after synthesis)
	 */
	clear(): void {
		this.observations = []
	}

	/**
	 * Number of observations in buffer
	 */
	get count(): number {
		return this.observations.length
	}

	/**
	 * Average importance of buffered observations
	 */
	get avgImportance(): number {
		if (this.observations.length === 0) return 0
		const sum = this.observations.reduce((acc, o) => acc + o.importance, 0)
		return sum / this.observations.length
	}

	/**
	 * Estimated total tokens in buffer
	 *
	 * Uses rough estimate of 4 characters per token.
	 */
	get totalTokens(): number {
		const totalChars = this.observations.reduce(
			(acc, o) => acc + o.text.length,
			0,
		)
		return Math.ceil(totalChars / 4)
	}

	/**
	 * Check if any synthesis threshold is met
	 */
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

	/**
	 * Check if buffer is empty
	 */
	get isEmpty(): boolean {
		return this.observations.length === 0
	}
}
