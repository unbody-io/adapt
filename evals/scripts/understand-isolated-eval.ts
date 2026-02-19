/**
 * Isolated eval: Understand phase for ListLearner
 *
 * Tests understand() directly with predefined schemas and known inputs.
 * No schema generation, no observe phase, no full pipeline.
 *
 * Scenarios:
 * 1. Empty collection — add new items (fresh start)
 * 2. Pre-populated collection — update existing, add new (subsequent learn)
 * 3. Divergent schemas — observation extracted with one shape, understanding expects another
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { nanoid } from 'nanoid'
import { MemoryCollection } from '../../src/learners/stores/memory'
import type { UnderstandingRecord } from '../../src/learners/stores/types'
import { understand } from '../../src/learners/list-learner/understand'
import type { UnderstandIdentity } from '../../src/learners/list-learner/understand'
import type { ListItem } from '../../src/learners/list-learner/types'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'
const model = openrouter(MODEL)

// ── Helpers ──────────────────────────────────────────────────────────────────

function section(title: string) {
	console.log(`\n${'═'.repeat(70)}`)
	console.log(`  ${title}`)
	console.log(`${'═'.repeat(70)}\n`)
}

async function dumpCollection(collection: MemoryCollection<UnderstandingRecord>, label: string) {
	const items = await collection.list()
	console.log(`\n  [${label}] ${items.length} items in collection`)
	for (const item of items) {
		const li = item.data as ListItem
		console.log(`    [${item.id}] data=${JSON.stringify(li.data)} confidence=${li.metadata.confidence}`)
	}
}

function seedItem(
	collection: MemoryCollection<UnderstandingRecord>,
	id: string,
	data: Record<string, unknown>,
	confidence = 0.5,
) {
	const now = new Date().toISOString()
	const listItem: ListItem = {
		id,
		data,
		metadata: { confidence, firstSeen: now, lastUpdated: now, signals: [] },
	}
	return collection.add({
		id,
		data: listItem as unknown,
		metadata_confidence: confidence,
		metadata_created_at: now,
		metadata_updated_at: now,
	})
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const restaurantSchema = {
	type: 'object',
	properties: {
		name: { type: 'string', description: 'Name of the restaurant' },
		cuisine: {
			type: 'string',
			description: 'Type of cuisine',
			enum: ['japanese', 'italian', 'mexican', 'french', 'pizza', 'american', 'other'],
		},
		location: { type: 'string', description: 'Location or neighborhood' },
		rating: { type: 'number', description: 'Rating out of 5', minimum: 0, maximum: 5 },
		hours: { type: 'string', description: 'Operating hours or schedule' },
	},
	required: ['name'],
}

// Observation schema: looser — raw extraction fields
const observationSchema = {
	type: 'object',
	properties: {
		name: { type: 'string', description: 'Name of the restaurant' },
		food_type: { type: 'string', description: 'What kind of food they serve' },
		area: { type: 'string', description: 'Where the restaurant is' },
		score: { type: 'number', description: 'Rating or score mentioned' },
		notes: { type: 'string', description: 'Any extra details mentioned' },
	},
	required: ['name'],
}

// Understanding schema: stricter — curated collection fields (different field names)
const curatedSchema = {
	type: 'object',
	properties: {
		name: { type: 'string', description: 'Official restaurant name' },
		cuisine: {
			type: 'string',
			description: 'Cuisine category',
			enum: ['japanese', 'italian', 'mexican', 'french', 'pizza', 'american', 'chinese', 'thai', 'other'],
		},
		neighborhood: { type: 'string', description: 'Neighborhood or district' },
		rating: { type: 'number', description: 'Rating out of 5', minimum: 0, maximum: 5 },
		price_range: {
			type: 'string',
			description: 'Price range',
			enum: ['$', '$$', '$$$', '$$$$', 'unknown'],
			default: 'unknown',
		},
		is_open: { type: 'boolean', description: 'Whether the restaurant is currently open/active', default: true },
	},
	required: ['name', 'cuisine'],
}

const identity: UnderstandIdentity = {
	identity:
		'You maintain a collection of restaurants. Each restaurant is identified by its name. When two observations refer to the same restaurant, update the existing entry rather than adding a duplicate. Add new restaurants when they are clearly distinct. Remove entries only if explicitly told they are closed or no longer relevant.',
}

// ── Scenarios ────────────────────────────────────────────────────────────────

async function scenario1_emptyCollection() {
	section('Scenario 1: Empty collection — add new items')

	const collection = new MemoryCollection<UnderstandingRecord>()

	const observations = [
		'Sushi Nakazawa is a high-end Japanese omakase restaurant in the West Village, NYC. They have a 4.8 rating and are open Tuesday through Saturday.',
		"Joe's Pizza on Carmine Street in Greenwich Village is a classic NYC pizza spot, known for their thin-crust slices. Rating 4.5, open daily.",
	]

	console.log(`  Schema: restaurantSchema (predefined)`)
	console.log(`  Collection: empty`)
	console.log(`  Observations: ${observations.length}`)

	const result = await understand(model, identity, {
		learnerId: 'test-1',
		instructions: 'Track restaurants.',
		observations,
	}, collection, restaurantSchema)

	console.log(`\n  Result: ${result.status}`)
	if (result.status === 'synthesized') {
		console.log(`  Significance: ${result.significance}`)
		console.log(`  Evolution: ${result.evolution}`)
	}
	await dumpCollection(collection, 'after')
}

async function scenario2_prePopulated() {
	section('Scenario 2: Pre-populated collection — update + add')

	const collection = new MemoryCollection<UnderstandingRecord>()

	// Seed existing items
	await seedItem(collection, 'item_sushi', {
		name: 'Sushi Nakazawa',
		cuisine: 'japanese',
		location: 'West Village, NYC',
		rating: 4.7,
		hours: 'Tue-Sat',
	}, 0.8)
	await seedItem(collection, 'item_joes', {
		name: "Joe's Pizza",
		cuisine: 'pizza',
		location: 'Greenwich Village',
		rating: 4.5,
		hours: 'daily',
	}, 0.9)

	await dumpCollection(collection, 'before')

	const observations = [
		'Sushi Nakazawa updated their rating to 4.9 and now they are open Monday through Saturday.',
		'Le Bernardin is a Michelin 3-star French seafood restaurant in Midtown Manhattan. Rating 4.9, reservations required.',
	]

	console.log(`\n  Observations: update Sushi Nakazawa + add Le Bernardin`)

	const result = await understand(model, identity, {
		learnerId: 'test-2',
		instructions: 'Track restaurants.',
		observations,
	}, collection, restaurantSchema)

	console.log(`\n  Result: ${result.status}`)
	if (result.status === 'synthesized') {
		console.log(`  Significance: ${result.significance}`)
		console.log(`  Evolution: ${result.evolution}`)
	}
	await dumpCollection(collection, 'after')
}

async function scenario3_divergentSchemas() {
	section('Scenario 3: Divergent schemas — observation fields ≠ understanding fields')

	const collection = new MemoryCollection<UnderstandingRecord>()

	// These observations use observation-schema field names (food_type, area, score, notes)
	// but the understanding schema expects different fields (cuisine, neighborhood, rating, price_range)
	const observations = [
		JSON.stringify({ name: 'Sushi Nakazawa', food_type: 'Japanese omakase', area: 'West Village NYC', score: 4.8, notes: 'High-end, open Tue-Sat' }),
		JSON.stringify({ name: "Joe's Pizza", food_type: 'Pizza, thin-crust', area: 'Greenwich Village', score: 4.5, notes: 'Classic NYC spot, open daily' }),
		JSON.stringify({ name: 'Le Bernardin', food_type: 'French seafood', area: 'Midtown Manhattan', score: 4.9, notes: 'Michelin 3-star, expensive, reservations required' }),
	]

	console.log(`  Observation fields: name, food_type, area, score, notes`)
	console.log(`  Understanding fields: name, cuisine (enum), neighborhood, rating, price_range (enum), is_open`)
	console.log(`  Testing: can the agent map observation fields → understanding schema\n`)
	console.log(`  Observations:`)
	for (const o of observations) console.log(`    ${o}`)

	const result = await understand(model, identity, {
		learnerId: 'test-3',
		instructions: 'Track restaurants with their name, cuisine category, neighborhood, rating, price range, and whether they are open.',
		observations,
	}, collection, curatedSchema)

	console.log(`\n  Result: ${result.status}`)
	if (result.status === 'synthesized') {
		console.log(`  Significance: ${result.significance}`)
		console.log(`  Evolution: ${result.evolution}`)
	}
	await dumpCollection(collection, 'after')
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	console.log(`Understand Isolated Eval`)
	console.log(`Model: ${MODEL}`)
	console.log(`Time: ${new Date().toISOString()}\n`)

	await scenario1_emptyCollection()
	await scenario2_prePopulated()
	await scenario3_divergentSchemas()

	section('Done')
}

main().catch((err) => {
	console.error('\n[FATAL]', err)
	process.exit(1)
})
