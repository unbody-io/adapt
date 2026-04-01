/**
 * Adapt — A self-evolving memory layer for AI applications.
 *
 * @example
 * ```typescript
 * import { Brain } from '@unbody/adapt'
 * import { openai } from '@ai-sdk/openai'
 *
 * const brain = new Brain({
 *   prompt: `
 *     Track my coding patterns and learning interests.
 *     I'll be feeding you conversations with AI coding assistants,
 *     code commits, and notes from technical articles.
 *   `,
 *   model: openai('gpt-4o'),
 * })
 *
 * await brain.inject({ type: 'commit', message: 'refactor to functional style' })
 * const result = await brain.ask('What is my coding philosophy?')
 * ```
 */

export * from './brain'
export * from './neurons'
