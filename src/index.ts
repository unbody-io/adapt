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
 * const learner = new TextLearner({
 *   model: openai('gpt-4o'),
 *   instructions: 'Understand user coding patterns',
 * })
 *
 * await learner.ingest([{ event: 'user prefers functional style' }])
 * const result = await learner.ask('What is my coding style?')
 * ```
 */

export * from './learners/index.js'
