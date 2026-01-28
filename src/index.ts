/**
 * Unbody Brain
 *
 * Learning agents that build understanding over time.
 *
 * @example
 * ```typescript
 * import { TextLearner } from '@unbody/brain'
 * import { openai } from '@ai-sdk/openai'
 *
 * const learner = new TextLearner(
 *   { purpose: 'Understand user coding patterns' },
 *   openai('gpt-4o')
 * )
 *
 * await learner.onData([{ event: 'user prefers functional style' }])
 * const result = await learner.onQuery('What is my coding style?')
 * ```
 */

export * from './learners/index.js'
