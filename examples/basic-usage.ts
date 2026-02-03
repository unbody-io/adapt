/**
 * Basic Brain Usage Example
 *
 * Run with: OPENROUTER_API_KEY=xxx bun examples/basic-usage.ts
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { Brain } from '../src/brain'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

async function main() {
	// 1. Create a Brain with a natural language prompt
	const brain = new Brain({
		prompt: `
			Learn about this person's music taste.
			Track their favorite genres, artists, and what they like/dislike.
		`,
		model: openrouter('google/gemini-2.0-flash-001'),
	})

	// 2. Feed it data (any shape — conversations, events, records)
	await brain.inject([
		{ type: 'conversation', text: "I've been listening to a lot of jazz lately, especially Miles Davis" },
		{ type: 'conversation', text: "Pop music is too repetitive for me, I prefer something with more depth" },
		{ type: 'playlist', name: 'Chill Vibes', artists: ['Norah Jones', 'Diana Krall', 'Bill Evans'] },
		{ type: 'skip', song: 'Bad Guy', artist: 'Billie Eilish', reason: 'not my style' },
		{ type: 'like', song: 'So What', artist: 'Miles Davis' },
	])

	// 3. Force synthesis to build understanding from buffered observations
	for (const learner of brain.getLearners()) {
		await learner.learn([], { forceSynthesize: true })
	}

	// 4. Ask questions
	const q1 = await brain.ask('What music does this person like?')
	console.log('Q: What music does this person like?')
	console.log('A:', q1.insight)
	console.log()

	const q2 = await brain.ask('Would they enjoy a Beyoncé concert?')
	console.log('Q: Would they enjoy a Beyoncé concert?')
	console.log('A:', q2.insight)
}

main().catch(console.error)
