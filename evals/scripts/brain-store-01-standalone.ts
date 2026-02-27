/**
 * Brain Store standalone test
 *
 * Tests the brain store module in complete isolation — no Brain, no LLM, no dependencies.
 * Verifies all BrainCollection<T> operations across all 3 namespaces.
 * Runs the full suite against both MemoryBrainStore and SQLiteBrainStore.
 */

import {
	MemoryBrainStore,
	SQLiteBrainStore,
	type BrainStore,
	type BrainStateRecord,
	type BrainRegistryRecord,
	type BrainEvolutionRecord,
} from '../../src/brain/stores'

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
	if (condition) {
		passed++
		console.log(`  ✓ ${message}`)
	} else {
		failed++
		console.log(`  ✗ ${message}`)
	}
}

function assertEqual<T>(actual: T, expected: T, message: string) {
	const ok = JSON.stringify(actual) === JSON.stringify(expected)
	if (ok) {
		passed++
		console.log(`  ✓ ${message}`)
	} else {
		failed++
		console.log(`  ✗ ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
	}
}

function section(title: string) {
	console.log(`\n━━━ ${title} ━━━`)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeState(id: string, value: unknown): BrainStateRecord {
	return { id, value, updated_at: new Date().toISOString() }
}

function makeRegistry(
	id: string,
	type: string,
	name: string,
	instructions: string,
): BrainRegistryRecord {
	const now = new Date().toISOString()
	return {
		id,
		type,
		name,
		description: `${name} description`,
		instructions,
		config: { governance: {}, thresholds: { minImportance: 0.3 } },
		created_at: now,
		updated_at: now,
	}
}

function makeEvolution(id: string, source: string): BrainEvolutionRecord {
	return {
		id,
		decisions: [{ action: 'update', targets: ['learner-1'], reasoning: 'test' }],
		source,
		created_at: new Date().toISOString(),
	}
}

type CreateStore = () => BrainStore

// ── Test: Collection CRUD (generic, works for any namespace) ────────────────

async function testCollectionCRUD<T extends { id: string }>(
	label: string,
	collection: import('../../src/brain/stores').BrainCollection<T>,
	makeItem: (id: string) => T,
	makeChanges: () => Partial<Omit<T, 'id'>>,
) {
	section(`${label} — CRUD`)

	// starts empty
	assertEqual(await collection.count(), 0, 'starts empty')
	assertEqual(await collection.list(), [], 'list returns empty array')
	assertEqual(await collection.get('nonexistent'), undefined, 'get nonexistent returns undefined')

	// add
	const item1 = makeItem('item-1')
	const item2 = makeItem('item-2')
	const item3 = makeItem('item-3')
	await collection.add(item1)
	assertEqual(await collection.count(), 1, 'count is 1 after add')
	await collection.add(item2)
	await collection.add(item3)
	assertEqual(await collection.count(), 3, 'count is 3 after 3 adds')

	// add duplicate throws
	let addDuplicateThrew = false
	try {
		await collection.add(item1)
	} catch {
		addDuplicateThrew = true
	}
	assert(addDuplicateThrew, 'add duplicate throws')
	assertEqual(await collection.count(), 3, 'count unchanged after failed add')

	// get
	const retrieved = await collection.get('item-1')
	assert(retrieved !== undefined, 'get returns the item')
	assertEqual(retrieved?.id, 'item-1', 'get returns correct item by id')

	// list (no filter)
	const all = await collection.list()
	assertEqual(all.length, 3, 'list returns all items')
	assert(all.some((i) => i.id === 'item-1'), 'list contains item-1')
	assert(all.some((i) => i.id === 'item-2'), 'list contains item-2')
	assert(all.some((i) => i.id === 'item-3'), 'list contains item-3')

	// list returns a copy, not a reference
	all.push(makeItem('rogue'))
	assertEqual(await collection.count(), 3, 'list returns a copy (push does not affect store)')

	// update
	const changes = makeChanges()
	await collection.update('item-2', changes)
	const updated = await collection.get('item-2')
	assert(updated !== undefined, 'updated item still exists')
	for (const [key, value] of Object.entries(changes)) {
		assertEqual((updated as Record<string, unknown>)[key], value, `update applied: ${key}`)
	}

	// update nonexistent throws
	let updateThrew = false
	try {
		await collection.update('nonexistent', changes)
	} catch {
		updateThrew = true
	}
	assert(updateThrew, 'update throws on nonexistent item')
	assertEqual(await collection.count(), 3, 'count unchanged after failed update')

	// delete
	await collection.delete('item-1')
	assertEqual(await collection.count(), 2, 'count decremented after delete')
	assertEqual(await collection.get('item-1'), undefined, 'deleted item is gone')

	// delete nonexistent throws
	let deleteThrew = false
	try {
		await collection.delete('item-1')
	} catch {
		deleteThrew = true
	}
	assert(deleteThrew, 'delete throws on nonexistent item')
	assertEqual(await collection.count(), 2, 'count unchanged after failed delete')

	// clear
	await collection.clear()
	assertEqual(await collection.count(), 0, 'count is 0 after clear')
	assertEqual(await collection.list(), [], 'list is empty after clear')

	// clear empty (should not throw)
	await collection.clear()
	assertEqual(await collection.count(), 0, 'clear on empty is safe')
}

// ── Test: list(filter) and count(filter) ────────────────────────────────────

async function testFiltering(createStore: CreateStore) {
	section('Filtering — list(filter) and count(filter)')

	const store = createStore()

	// Add registry records with different types
	await store.registry.add(makeRegistry('l-1', 'text', 'Text Learner 1', 'Track patterns'))
	await store.registry.add(makeRegistry('l-2', 'text', 'Text Learner 2', 'Track habits'))
	await store.registry.add(makeRegistry('l-3', 'list', 'List Learner 1', 'Track items'))
	await store.registry.add(makeRegistry('l-4', 'list', 'List Learner 2', 'Track tools'))

	// list with filter
	const textLearners = await store.registry.list({ type: 'text' })
	assertEqual(textLearners.length, 2, 'list(type=text) returns 2 text learners')
	assert(textLearners.every((r) => r.type === 'text'), 'all filtered items are text type')

	const listLearners = await store.registry.list({ type: 'list' })
	assertEqual(listLearners.length, 2, 'list(type=list) returns 2 list learners')

	// count with filter
	const textCount = await store.registry.count({ type: 'text' })
	assertEqual(textCount, 2, 'count(type=text) returns 2')

	const listCount = await store.registry.count({ type: 'list' })
	assertEqual(listCount, 2, 'count(type=list) returns 2')

	// count without filter
	const totalCount = await store.registry.count()
	assertEqual(totalCount, 4, 'count() returns total of 4')

	// Evolution source filtering
	await store.evolution.add(makeEvolution('eval-1', 'auto'))
	await store.evolution.add(makeEvolution('eval-2', 'auto'))
	await store.evolution.add(makeEvolution('eval-3', 'manual'))

	const autoEvals = await store.evolution.list({ source: 'auto' })
	assertEqual(autoEvals.length, 2, 'list(source=auto) returns 2')

	const manualEvals = await store.evolution.list({ source: 'manual' })
	assertEqual(manualEvals.length, 1, 'list(source=manual) returns 1')

	await store.dispose()
}

// ── Test: addBatch ──────────────────────────────────────────────────────────

async function testAddBatch(createStore: CreateStore) {
	section('addBatch')

	const store = createStore()

	const records = [
		makeState('key-1', 'value-1'),
		makeState('key-2', 'value-2'),
		makeState('key-3', 'value-3'),
	]

	await store.state.addBatch(records)
	assertEqual(await store.state.count(), 3, 'addBatch added 3 items')

	const first = await store.state.get('key-1')
	assert(first !== undefined, 'first batch item retrievable')
	assertEqual(first?.value, 'value-1', 'first batch item has correct value')

	await store.dispose()
}

// ── Test: Brain state pipeline simulation ────────────────────────────────────

async function testStatePipeline(createStore: CreateStore) {
	section('Brain state pipeline simulation')

	const store = createStore()

	// 1. Persist brain state (prompt, counters)
	await store.state.add(makeState('prompt', 'Track software engineering best practices'))
	await store.state.add(makeState('coverageGapCount', 0))
	await store.state.add(makeState('recentQueryCount', 0))

	assertEqual(await store.state.count(), 3, 'state has 3 entries after init')

	// 2. Update state (simulating after queries)
	await store.state.update('coverageGapCount', { value: 3, updated_at: new Date().toISOString() })
	await store.state.update('recentQueryCount', { value: 15, updated_at: new Date().toISOString() })

	const gapCount = await store.state.get('coverageGapCount')
	assertEqual(gapCount?.value, 3, 'coverageGapCount updated to 3')

	const queryCount = await store.state.get('recentQueryCount')
	assertEqual(queryCount?.value, 15, 'recentQueryCount updated to 15')

	// 3. Read all state back (simulating restore)
	const allState = await store.state.list()
	assertEqual(allState.length, 3, 'all 3 state entries restored')

	const prompt = allState.find((s) => s.id === 'prompt')
	assertEqual(prompt?.value, 'Track software engineering best practices', 'prompt restored correctly')

	await store.dispose()
}

// ── Test: Registry pipeline simulation ──────────────────────────────────────

async function testRegistryPipeline(createStore: CreateStore) {
	section('Registry pipeline simulation')

	const store = createStore()

	// 1. Register learners (simulating createLearnerFromConfig)
	await store.registry.add(makeRegistry('ts-learner', 'text', 'TypeScript Patterns', 'Track TS patterns'))
	await store.registry.add(makeRegistry('react-learner', 'text', 'React Practices', 'Track React practices'))
	await store.registry.add(makeRegistry('tools-learner', 'list', 'Tools Catalog', 'Track tools'))

	assertEqual(await store.registry.count(), 3, '3 learners registered')

	// 2. Update a learner (simulating adjustLearner)
	await store.registry.update('ts-learner', {
		instructions: 'Track advanced TS patterns including generics and conditional types',
		updated_at: new Date().toISOString(),
	})

	const updated = await store.registry.get('ts-learner')
	assert(
		updated?.instructions.includes('advanced'),
		'registry updated with new instructions after adjust',
	)

	// 3. Remove a learner (simulating removeLearner)
	await store.registry.delete('react-learner')
	assertEqual(await store.registry.count(), 2, '2 learners after removal')
	assertEqual(await store.registry.get('react-learner'), undefined, 'removed learner gone from registry')

	// 4. Restore all learners (simulating restoreFromRegistry)
	const allLearners = await store.registry.list()
	assertEqual(allLearners.length, 2, 'restored 2 learners from registry')

	const types = allLearners.map((l) => l.type).sort()
	assertEqual(types, ['list', 'text'], 'both text and list types preserved')

	// 5. Verify config serialization round-trip (JSON in state/registry)
	const toolsLearner = await store.registry.get('tools-learner')
	assert(toolsLearner !== undefined, 'tools learner exists in registry')
	const config = toolsLearner?.config as { governance: Record<string, unknown>; thresholds: { minImportance: number } }
	assertEqual(config.thresholds.minImportance, 0.3, 'config JSON round-trips correctly')

	await store.dispose()
}

// ── Test: Evolution history pipeline ────────────────────────────────────────

async function testEvolutionPipeline(createStore: CreateStore) {
	section('Evolution history pipeline simulation')

	const store = createStore()

	// 1. Record evolution evaluations
	await store.evolution.add({
		id: 'eval-1',
		decisions: [
			{ action: 'create', targets: [], reasoning: 'Need a new learner for API design' },
		],
		source: 'manual',
		created_at: new Date().toISOString(),
	})

	await store.evolution.add({
		id: 'eval-2',
		decisions: [
			{ action: 'update', targets: ['ts-learner'], reasoning: 'Broaden scope' },
			{ action: 'merge', targets: ['a', 'b'], reasoning: 'Too similar' },
		],
		source: 'auto',
		created_at: new Date().toISOString(),
	})

	await store.evolution.add({
		id: 'eval-3',
		decisions: [],
		source: 'auto',
		created_at: new Date().toISOString(),
	})

	assertEqual(await store.evolution.count(), 3, '3 evolution entries recorded')

	// 2. Restore history (simulating restoreEvolutionHistory)
	const history = await store.evolution.list()
	assertEqual(history.length, 3, 'all 3 entries restored')

	// Verify JSON round-trip for decisions
	const eval2 = await store.evolution.get('eval-2')
	const decisions = eval2?.decisions as Array<{ action: string; targets: string[]; reasoning: string }>
	assertEqual(decisions.length, 2, 'eval-2 has 2 decisions')
	assertEqual(decisions[0].action, 'update', 'first decision is update')
	assertEqual(decisions[1].action, 'merge', 'second decision is merge')
	assertEqual(decisions[1].targets, ['a', 'b'], 'merge targets preserved')

	// 3. Filter by source
	const autoEvals = await store.evolution.list({ source: 'auto' })
	assertEqual(autoEvals.length, 2, '2 auto evaluations')

	await store.dispose()
}

// ── Test: Cross-namespace isolation ─────────────────────────────────────────

async function testIsolation(createStore: CreateStore) {
	section('Cross-namespace isolation')

	const store = createStore()

	await store.state.add(makeState('key-1', 'state value'))
	await store.registry.add(makeRegistry('r-1', 'text', 'Learner', 'instructions'))
	await store.evolution.add(makeEvolution('e-1', 'auto'))

	// Clear one namespace, others unaffected
	await store.state.clear()
	assertEqual(await store.state.count(), 0, 'state cleared')
	assertEqual(await store.registry.count(), 1, 'registry unaffected')
	assertEqual(await store.evolution.count(), 1, 'evolution unaffected')

	// Delete from one namespace
	await store.registry.delete('r-1')
	assertEqual(await store.registry.count(), 0, 'registry removed')
	assertEqual(await store.evolution.count(), 1, 'evolution still unaffected')

	await store.dispose()
}

// ── Test: Two stores are independent ────────────────────────────────────────

async function testStoreIndependence(createStore: CreateStore) {
	section('Store independence (two stores do not share data)')

	const store1 = createStore()
	const store2 = createStore()

	await store1.registry.add(makeRegistry('l-1', 'text', 'Only in store1', 'instructions'))
	await store2.registry.add(makeRegistry('l-2', 'list', 'Only in store2', 'instructions'))
	await store2.registry.add(makeRegistry('l-3', 'list', 'Also in store2', 'instructions'))

	assertEqual(await store1.registry.count(), 1, 'store1 has 1 registry entry')
	assertEqual(await store2.registry.count(), 2, 'store2 has 2 registry entries')
	assertEqual(await store1.registry.get('l-2'), undefined, 'store1 cannot see store2 data')
	assertEqual(await store2.registry.get('l-1'), undefined, 'store2 cannot see store1 data')

	await store1.dispose()
	await store2.dispose()
}

// ── Test: dispose ───────────────────────────────────────────────────────────

async function testDispose(createStore: CreateStore) {
	section('dispose')

	const store = createStore()
	await store.state.add(makeState('key-1', 'test'))

	await store.dispose()
	passed++
	console.log('  ✓ dispose completes without error')
}

// ── Run all tests for a given adapter ───────────────────────────────────────

async function runSuite(adapterName: string, createStore: CreateStore) {
	console.log(`\n${'═'.repeat(60)}`)
	console.log(`  ${adapterName}`)
	console.log('═'.repeat(60))

	// Generic CRUD tests for each namespace (fresh store per namespace)
	const s1 = createStore()
	await testCollectionCRUD(
		'state',
		s1.state,
		(id) => makeState(id, { key: id }),
		() => ({ value: 'updated value', updated_at: new Date().toISOString() }),
	)
	await s1.dispose()

	const s2 = createStore()
	await testCollectionCRUD(
		'registry',
		s2.registry,
		(id) => makeRegistry(id, 'text', `Learner ${id}`, `Instructions for ${id}`),
		() => ({ name: 'Updated Name', description: 'Updated description', updated_at: new Date().toISOString() }),
	)
	await s2.dispose()

	const s3 = createStore()
	await testCollectionCRUD(
		'evolution',
		s3.evolution,
		(id) => makeEvolution(id, 'manual'),
		() => ({ source: 'auto', decisions: [{ action: 'delete', targets: ['x'], reasoning: 'test' }] }),
	)
	await s3.dispose()

	// Feature-specific tests
	await testFiltering(createStore)
	await testAddBatch(createStore)

	// Pipeline simulations
	await testStatePipeline(createStore)
	await testRegistryPipeline(createStore)
	await testEvolutionPipeline(createStore)

	// Isolation & independence
	await testIsolation(createStore)
	await testStoreIndependence(createStore)

	// Dispose
	await testDispose(createStore)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	console.log('Brain Store standalone test\n')

	await runSuite('MemoryBrainStore', () => new MemoryBrainStore())
	await runSuite('SQLiteBrainStore', () => new SQLiteBrainStore())

	// Summary
	console.log(`\n${'═'.repeat(60)}`)
	console.log(`  ${passed} passed, ${failed} failed`)
	console.log('═'.repeat(60))

	if (failed > 0) {
		process.exit(1)
	}
}

main()
