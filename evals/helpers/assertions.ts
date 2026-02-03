/**
 * Eval script assertion utilities
 * Test helpers for validating system behavior
 */

import type { Brain } from '../../src/brain/class'
import { logger } from './logger'

export class AssertionError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'AssertionError'
	}
}

/**
 * Assert two values are equal
 */
export function assertEqual<T>(actual: T, expected: T, label: string): void {
	const passed = actual === expected
	logger.logAssertion(label, passed, passed ? undefined : `Expected ${expected}, got ${actual}`)

	if (!passed) {
		throw new AssertionError(`${label}: Expected ${expected}, got ${actual}`)
	}
}

/**
 * Assert a condition is true
 */
export function assertTrue(condition: boolean, message: string): void {
	logger.logAssertion(message, condition)

	if (!condition) {
		throw new AssertionError(message)
	}
}

/**
 * Assert a condition is false
 */
export function assertFalse(condition: boolean, message: string): void {
	logger.logAssertion(message, !condition)

	if (condition) {
		throw new AssertionError(message)
	}
}

/**
 * Assert an event was emitted
 */
export function assertEventEmitted(
	events: Array<{ type: string; payload?: any }>,
	eventType: string,
	matcher?: (payload: any) => boolean,
): void {
	const found = events.find((e) => {
		if (e.type !== eventType) return false
		if (matcher && !matcher(e.payload)) return false
		return true
	})

	const message = matcher
		? `Event ${eventType} emitted with matching payload`
		: `Event ${eventType} emitted`

	logger.logAssertion(message, !!found)

	if (!found) {
		throw new AssertionError(
			`Expected event ${eventType} to be emitted${matcher ? ' with matching payload' : ''}`,
		)
	}
}

/**
 * Assert an event was NOT emitted
 */
export function assertEventNotEmitted(
	events: Array<{ type: string; payload?: any }>,
	eventType: string,
): void {
	const found = events.find((e) => e.type === eventType)

	logger.logAssertion(`Event ${eventType} NOT emitted`, !found)

	if (found) {
		throw new AssertionError(`Expected event ${eventType} NOT to be emitted, but it was`)
	}
}

/**
 * Assert a learner exists in the brain
 */
export function assertLearnerExists(brain: Brain, learnerId: string): void {
	const exists = brain.learners.has(learnerId)
	logger.logAssertion(`Learner ${learnerId} exists`, exists)

	if (!exists) {
		throw new AssertionError(`Expected learner ${learnerId} to exist`)
	}
}

/**
 * Assert a learner was deleted from the brain
 */
export function assertLearnerDeleted(brain: Brain, learnerId: string): void {
	const exists = brain.learners.has(learnerId)
	logger.logAssertion(`Learner ${learnerId} deleted`, !exists)

	if (exists) {
		throw new AssertionError(`Expected learner ${learnerId} to be deleted`)
	}
}

/**
 * Assert a value is defined (not null or undefined)
 */
export function assertDefined<T>(value: T | null | undefined, label: string): asserts value is T {
	const defined = value !== null && value !== undefined
	logger.logAssertion(`${label} is defined`, defined)

	if (!defined) {
		throw new AssertionError(`${label} is not defined`)
	}
}

/**
 * Assert a number is within a range
 */
export function assertInRange(
	value: number,
	min: number,
	max: number,
	label: string,
): void {
	const inRange = value >= min && value <= max
	logger.logAssertion(
		label,
		inRange,
		inRange ? undefined : `Expected ${value} to be between ${min} and ${max}`,
	)

	if (!inRange) {
		throw new AssertionError(`${label}: Expected ${value} to be between ${min} and ${max}`)
	}
}

/**
 * Assert a string contains a substring
 */
export function assertContains(haystack: string, needle: string, label: string): void {
	const contains = haystack.includes(needle)
	logger.logAssertion(label, contains, contains ? undefined : `Expected "${haystack}" to contain "${needle}"`)

	if (!contains) {
		throw new AssertionError(`${label}: Expected "${haystack}" to contain "${needle}"`)
	}
}

/**
 * Assert an array has a specific length
 */
export function assertLength(array: any[], expectedLength: number, label: string): void {
	const passed = array.length === expectedLength
	logger.logAssertion(
		label,
		passed,
		passed ? undefined : `Expected length ${expectedLength}, got ${array.length}`,
	)

	if (!passed) {
		throw new AssertionError(`${label}: Expected length ${expectedLength}, got ${array.length}`)
	}
}

/**
 * Assert a value is greater than another
 */
export function assertGreaterThan(actual: number, threshold: number, label: string): void {
	const passed = actual > threshold
	logger.logAssertion(label, passed, passed ? undefined : `Expected ${actual} > ${threshold}`)

	if (!passed) {
		throw new AssertionError(`${label}: Expected ${actual} > ${threshold}`)
	}
}

/**
 * Assert a value is less than another
 */
export function assertLessThan(actual: number, threshold: number, label: string): void {
	const passed = actual < threshold
	logger.logAssertion(label, passed, passed ? undefined : `Expected ${actual} < ${threshold}`)

	if (!passed) {
		throw new AssertionError(`${label}: Expected ${actual} < ${threshold}`)
	}
}
