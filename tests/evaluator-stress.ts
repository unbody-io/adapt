/**
 * Evaluator Stress Test v3 — Signal-Driven
 *
 * Exercises evolution actions via direct signals and brain.update()
 * instead of expensive bulk injection + queries.
 *
 * Strategy:
 *   1. Init brain + inject minimal foundation (1 chunk)
 *   2. Create problematic neurons + inject just enough to synthesize
 *   3. Send freeform signals → evaluate → verify DELETE, MERGE, SPLIT
 *   4. brain.update() with new scope → verify CREATE/UPDATE via auto-evaluation
 *
 * Prerequisites: Server running on localhost:3210 (brain NOT yet initialized).
 * Run: bun run tests/evaluator-stress.ts
 */

const BASE_URL = 'http://localhost:3210'

// ── Helpers ──

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJSON(path: string, options?: RequestInit) {
	const res = await fetch(`${BASE_URL}${path}`, {
		headers: { 'Content-Type': 'application/json' },
		...options,
	})
	if (!res.ok) {
		const text = await res.text()
		throw new Error(`${options?.method || 'GET'} ${path} failed (${res.status}): ${text}`)
	}
	return res.json()
}

function ts() {
	return new Date().toISOString().slice(11, 19)
}

function hr(label: string) {
	console.log(`\n${'='.repeat(60)}`)
	console.log(`  ${label}`)
	console.log(`${'='.repeat(60)}\n`)
}

// ── SSE Event Monitor ──

interface CapturedEvent {
	time: string
	event: string
	data: any
}

const capturedEvents: CapturedEvent[] = []
let sseAbortController: AbortController | null = null

async function startSSEMonitor(): Promise<void> {
	sseAbortController = new AbortController()
	const interestingPrefixes = [
		'evaluator:',
		'evolution:',
		'brain:signal',
		'neuron:signal',
		'server:brain:updated',
		'server:neuron:created',
		'server:neuron:updated',
		'server:evaluate:',
	]

	fetch(`${BASE_URL}/brain/events`, { signal: sseAbortController.signal })
		.then(async (res) => {
			const reader = res.body?.getReader()
			if (!reader) return
			const decoder = new TextDecoder()
			let buffer = ''
			let currentEvent = ''

			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				buffer += decoder.decode(value, { stream: true })

				const lines = buffer.split('\n')
				buffer = lines.pop() || ''

				for (const line of lines) {
					if (line.startsWith('event: ')) {
						currentEvent = line.slice(7).trim()
					} else if (line.startsWith('data: ') && currentEvent) {
						const isInteresting = interestingPrefixes.some((p) => currentEvent.startsWith(p))
						if (isInteresting) {
							let data: any
							try {
								data = JSON.parse(line.slice(6))
							} catch {
								data = line.slice(6)
							}
							const entry: CapturedEvent = { time: ts(), event: currentEvent, data }
							capturedEvents.push(entry)

							const tag = `  [SSE ${entry.time}] ${currentEvent}`
							if (currentEvent === 'evaluator:evaluation:completed') {
								console.log(`${tag}`)
								console.log(`    Decisions: ${data.decisionCount ?? data.decisions?.length ?? '?'}`)
								if (data.decisions) {
									for (const d of data.decisions) {
										console.log(`      → ${d.action}: ${JSON.stringify(d.targets || d.targetNeuronId || d.neuronIds || 'new').slice(0, 120)}`)
									}
								}
							} else if (currentEvent.startsWith('evolution:action:')) {
								console.log(`${tag}`)
								console.log(`    Action: ${data.action}, Targets: ${JSON.stringify(data.targets)}`)
								if (data.error) console.log(`    Error: ${data.error}`)
							} else if (currentEvent.includes('signal')) {
								// compact — just log signal source
								const src = data.source || data.neuronId || '?'
								console.log(`  [SSE ${entry.time}] signal from ${src}: ${(data.description || '').slice(0, 100)}`)
							}
						}
						currentEvent = ''
					} else if (line === '') {
						currentEvent = ''
					}
				}
			}
		})
		.catch((err) => {
			if (err.name !== 'AbortError') {
				console.error(`  [SSE] Connection error: ${err.message}`)
			}
		})

	await sleep(500)
	console.log(`  [SSE] Monitor connected`)
}

function stopSSEMonitor() {
	sseAbortController?.abort()
}

// ── API Helpers ──

async function getStatus(): Promise<any> {
	return fetchJSON('/brain/status')
}

async function printStatus(label?: string) {
	const status = await getStatus()
	console.log(`\n-- ${label || 'Status'}: ${status.neurons.length} neurons --`)
	for (const l of status.neurons) {
		const buf = l.buffer?.count ?? 0
		const und = l.understanding ? `${l.understanding.length}ch` : 'none'
		console.log(`  ${l.id}: buffer=${buf} understanding=${und}`)
	}
	return status
}

async function inject(items: unknown[]) {
	return fetchJSON('/brain/inject', {
		method: 'POST',
		body: JSON.stringify({ data: items }),
	})
}

async function createNeuron(name: string, instructions: string, description?: string): Promise<string> {
	const body: Record<string, string> = { name, instructions }
	if (description) body.description = description
	const result = await fetchJSON('/brain/neurons/create', {
		method: 'POST',
		body: JSON.stringify(body),
	})
	console.log(`  Created: ${(result as any).neuronId} (${name})`)
	return (result as any).neuronId
}

async function sendSignal(source: string, description: string) {
	return fetchJSON('/brain/signal', {
		method: 'POST',
		body: JSON.stringify({ source, description }),
	})
}

async function evaluate(): Promise<any> {
	console.log(`  [${ts()}] Triggering evaluation...`)
	const result = await fetchJSON('/brain/evaluate', { method: 'POST' })
	const r = result as any
	console.log(`  [${ts()}] Evaluation: ${r.decisions?.length ?? 0} decisions`)
	if (r.decisions?.length > 0) {
		for (const d of r.decisions) {
			console.log(`    → ${d.action}: ${JSON.stringify(d.targets || d.targetNeuronId || d.neuronIds || 'new').slice(0, 120)}`)
			console.log(`      ${(d.reasoning || '').slice(0, 150)}`)
		}
	}
	if (r.results) {
		const s = r.results
		const parts = []
		if (s.created?.length) parts.push(`created=${s.created.length}`)
		if (s.updated?.length) parts.push(`updated=${s.updated.length}`)
		if (s.deleted?.length) parts.push(`deleted=${s.deleted.length}`)
		if (s.merged?.length) parts.push(`merged=${s.merged.length}`)
		if (s.split?.length) parts.push(`split=${s.split.length}`)
		if (parts.length) console.log(`  Results: ${parts.join(', ')}`)
	}
	return result
}

async function brainUpdate(body: Record<string, any>): Promise<any> {
	console.log(`  [${ts()}] brain.update(${JSON.stringify(body).slice(0, 200)})`)
	const result = await fetchJSON('/brain/update', {
		method: 'POST',
		body: JSON.stringify(body),
	})
	const r = result as any
	console.log(`  [${ts()}] Changed: ${r.changedFields?.join(', ') || 'none'}`)
	if (r.evolutionResults) {
		const er = r.evolutionResults
		console.log(`  Evolution: ${er.decisions?.length ?? 0} decisions`)
		if (er.decisions?.length > 0) {
			for (const d of er.decisions) {
				console.log(`    → ${d.action}: ${JSON.stringify(d.targets || d.targetNeuronId || d.neuronIds || 'new').slice(0, 120)}`)
				console.log(`      ${(d.reasoning || '').slice(0, 150)}`)
			}
		}
		const s = er
		const parts = []
		if (s.created?.length) parts.push(`created=${s.created.length}`)
		if (s.updated?.length) parts.push(`updated=${s.updated.length}`)
		if (s.deleted?.length) parts.push(`deleted=${s.deleted.length}`)
		if (s.merged?.length) parts.push(`merged=${s.merged.length}`)
		if (s.split?.length) parts.push(`split=${s.split.length}`)
		if (parts.length) console.log(`  Results: ${parts.join(', ')}`)
	}
	return result
}

// ── Main ──

async function main() {
	hr('EVALUATOR STRESS TEST v3 — Signal-Driven')
	console.log(`[${ts()}] Lean test: signals + brain.update() instead of bulk injection`)
	console.log(`Target: all 5 action types (create, merge, split, update, delete)\n`)

	await startSSEMonitor()

	// ──────────────────────────────────────────────────────────────
	// PHASE 1: Init + minimal foundation
	// ──────────────────────────────────────────────────────────────
	hr('PHASE 1: Initialize + Foundation')

	const preCheck = await getStatus()
	if (preCheck.status === 'initialized') {
		console.log('Brain already initialized — using existing state.')
	} else {
		const initResult = await fetchJSON('/brain/init', {
			method: 'POST',
			body: JSON.stringify({
				prompt: 'You are the learning system for a senior software engineering team. Track coding practices, architectural decisions, debugging approaches, tooling, collaboration, and workflows.',
				model: 'google/gemini-2.5-flash-lite-preview-09-2025',
				blueprintModel: 'google/gemini-2.0-flash-lite-001',
				observeBlueprintModel: 'google/gemini-2.0-flash-lite-001',
				synthesizeBlueprintModel: 'google/gemini-2.0-flash-lite-001',
				evolution: {
					enabled: true,
					autoEvaluate: false,
					evaluatorSignalThreshold: 999,
				},
			}),
		}) as any
		console.log(`  Initialized: ${initResult.neurons?.length} neurons`)
		await sleep(1000)
	}

	// Inject ONE chunk of foundation data so neurons have something to work with
	const foundationData = [
		'Code reviews require 2 approvals. One from domain expert, one from senior. No self-merging.',
		'TypeScript strict mode everywhere. No `any` types allowed. Prefer interfaces over type aliases for object shapes.',
		'Trunk-based development: short-lived feature branches, merge within 24h. CI must pass before merge.',
		'Structured logging with correlation IDs. Every request gets a trace ID propagated through all services.',
		'Error handling: custom error classes, never throw raw strings. All errors must include error code and context.',
		'Testing: unit tests for business logic, integration tests for API endpoints, e2e for critical user flows.',
		'Architecture: modular monolith transitioning to microservices. Event-driven communication via message broker.',
		'Database: PostgreSQL primary, Redis for caching. Migrations must be backward-compatible and reversible.',
		'Deployment: blue-green with automated rollback. Canary releases for risky changes. Zero-downtime required.',
		'Monitoring: Prometheus metrics, Grafana dashboards, PagerDuty alerting. SLO: 99.9% availability.',
		'PR template: what changed, why, how to test, breaking changes. Reviewers focus on logic not style.',
		'Incident response: severity levels P0-P3, blameless postmortems, action items tracked in Jira.',
		'Dependencies: Dependabot for updates, lockfile required, no floating versions. Security audit on every PR.',
		'Git conventions: conventional commits, squash merge to main, release tags follow semver.',
		'IDE: VSCode with shared extensions list. Prettier for formatting, ESLint for linting. Format on save.',
		'API design: REST with OpenAPI spec. Versioning via URL path. Rate limiting per client.',
		'Feature flags: LaunchDarkly for gradual rollout. Kill switch for every new feature. Cleanup after 30 days.',
		'On-call rotation: weekly shifts, runbook for every alert. Escalation path documented.',
		'Pair programming for complex features. Mob programming for architectural decisions.',
		'Tech debt: dedicated 20% time every sprint. Tech debt tickets prioritized alongside features.',
	]

	console.log(`  Injecting foundation data (${foundationData.length} items)...`)
	const injectResult = await inject(foundationData)
	const batch = (injectResult as any).batches?.[0]
	if (batch) {
		const statuses = batch.results.map((r: any) => `${r.neuronId.slice(0, 15)}: ${r.result.status}`)
		console.log(`  ${statuses.join(' | ')}`)
	}
	await sleep(2000)

	const initial = await printStatus('After Foundation')

	// ──────────────────────────────────────────────────────────────
	// PHASE 2: Create problematic neurons + give them understanding
	// ──────────────────────────────────────────────────────────────
	hr('PHASE 2: Problematic Neurons')

	// Overlap neuron — overlaps with coding-practices/review topics
	const overlapId = await createNeuron(
		'Code Review Practices',
		'Track code review best practices, PR review workflows, review quality metrics, and team review culture.',
	)
	await sleep(1000)

	// Irrelevant neuron
	const irrelevantId = await createNeuron(
		'Culinary Techniques',
		'Learn about cooking techniques, recipes, food preparation, and culinary traditions.',
	)
	await sleep(1000)

	// Overly broad neuron
	const broadId = await createNeuron(
		'Professional Growth and Life Systems',
		'Track professional development, personal productivity, technical infrastructure, life habits, exercise, financial planning, and career growth.',
	)
	await sleep(1000)

	// Inject targeted content so problematic neurons build understanding
	const reviewContent = [
		'PR review turnaround: first feedback within 4 hours. PRs over 300 lines get rubber-stamped — enforce size limit.',
		'Conventional comments: prefix with suggestion:, nitpick:, question:, or blocking: to clarify severity.',
		'Review found subtle race condition: two async handlers on same cache key. Added optimistic locking.',
		'CODEOWNERS: database changes need DBA review, auth changes need security team, infra needs platform team.',
		'Tracking review metrics: time-to-first-review down from 12h to 3h after making it visible on dashboard.',
		'Pull request templates: What changed, Why, How to test, Screenshots, Breaking changes sections.',
		'Pre-commit hooks: no console.log, no TODO without ticket, type checking passes before review.',
		'Pair programming replaced formal review for complex features. Two people write it, merge without review.',
		'Static analysis: SonarQube for code smells and complexity. Blocks merge if quality gate fails.',
		'Review anti-patterns: nitpicking style, blocking on preference, drive-by reviews without context.',
		'ADRs linked from PRs so reviewers understand the "why" behind structural changes.',
		'Team norm: if you approve it, you own it. Shared responsibility changed review culture.',
	]
	console.log(`\n  Injecting review content (${reviewContent.length} items)...`)
	await inject(reviewContent)
	await sleep(2000)

	const cookingContent = [
		'French onion soup: caramelize onions 45 minutes, beef broth, thyme, Gruyere croutons.',
		'Sourdough starter day 7: consistent rise, fed twice daily at 1:1:1 ratio. Ready for first loaf.',
		'Knife skills: brunoise, julienne, chiffonade. Sharp knife = safe knife.',
		'Smoked brisket 14 hours at 225°F. Hit the stall at 160°F. Wrapped in butcher paper.',
		'Mother sauces: béchamel, velouté, espagnole, hollandaise, tomato. Master them, unlock hundreds.',
		'Bread autolyse: mix flour and water, rest 30 min before yeast and salt. Less kneading needed.',
		'Thai green curry from scratch: mortar and pestle for paste. Night and day vs jarred.',
		'Reverse sear steak: oven 275°F until internal 120°F, then cast iron at max heat.',
		'Fermented hot sauce: habaneros, garlic, salt, 2-week ferment. pH dropped to 3.4.',
		'Chocolate tempering: seed method. Melt 115°F, seed down to 82°F, back to 88-90°F.',
		'Ramen broth: 18h pork bone simmer. Cloudy tonkotsu needs vigorous rolling boil.',
		'Wok technique: smoking hot, small oil, stages by cook time. Wok hei from extreme heat.',
	]
	console.log(`  Injecting cooking content (${cookingContent.length} items)...`)
	await inject(cookingContent)
	await sleep(2000)

	const broadContent = [
		'Morning routine: wake 6am, 20 min meditation, cold shower, journal 10 min. Consistency matters.',
		'Kubernetes autoscaling: HPA at 70% CPU, VPA for right-sizing, cluster autoscaler for pending pods.',
		'Exercise: 3x strength, 2x cardio per week. Progressive overload. Deload every 4th week.',
		'Event-driven architecture: Kafka for high-throughput, RabbitMQ for task queues. Retry per consumer.',
		'Sleep optimization: blackout curtains, 65°F, no caffeine after 2pm. Sleep score 72 → 89.',
		'Financial planning: 50/30/20 rule. Automated transfers. 6 month emergency fund. Index funds.',
		'Microservices: sync for queries (gRPC), async for commands (event bus). Saga pattern for transactions.',
		'Time blocking: deep work 9-12, meetings 1-3, admin 3-4, learning 4-5. 40% output increase.',
		'CQRS: separate read/write models. Event sourcing on write side, denormalized projections for read.',
		'Networking: one meetup/month, one talk/quarter. Follow up within 48h. Genuine connections.',
		'Digital detox weekends: no work email, limited social media. Creativity better on Monday.',
		'Observability: Prometheus+Grafana, ELK, OpenTelemetry+Jaeger. Correlation IDs link all three.',
	]
	console.log(`  Injecting broad content (${broadContent.length} items)...`)
	await inject(broadContent)
	await sleep(2000)

	const afterProblematic = await printStatus('After Problematic Neurons')

	// Verify understanding was built
	const findNeuron = (id: string) => afterProblematic.neurons.find((l: any) => l.id === id)
	console.log(`\n  Understanding check:`)
	console.log(`    ${overlapId}: ${findNeuron(overlapId)?.understanding?.length ?? 0} chars`)
	console.log(`    ${irrelevantId}: ${findNeuron(irrelevantId)?.understanding?.length ?? 0} chars`)
	console.log(`    ${broadId}: ${findNeuron(broadId)?.understanding?.length ?? 0} chars`)

	// ──────────────────────────────────────────────────────────────
	// PHASE 3: Signal-driven evaluation → DELETE + MERGE + SPLIT
	// ──────────────────────────────────────────────────────────────
	hr('PHASE 3: Signals → DELETE + MERGE + SPLIT')

	console.log('  Sending signals...\n')

	await sendSignal(
		'governance-monitor',
		`Neuron "${irrelevantId}" tracks cooking techniques and culinary traditions. Fundamentally misaligned with a software engineering brain. Zero relevance on all queries. Should be deleted.`,
	)

	await sendSignal(
		'governance-monitor',
		`Neuron "${overlapId}" has significant overlap with existing coding-practices neuron. Both cover code reviews, PR workflows, review quality. Their understanding should be consolidated via merge.`,
	)

	await sendSignal(
		'governance-monitor',
		`Neuron "${broadId}" covers wildly disparate domains: personal habits (exercise, sleep, meditation), financial planning, AND technical infrastructure (Kubernetes, CQRS, microservices). Should be split — technical content belongs in existing neurons, personal content is out of scope.`,
	)

	await sleep(500)
	const round1 = await evaluate()
	await sleep(3000)
	await printStatus('After Round 1')

	// ──────────────────────────────────────────────────────────────
	// PHASE 4: brain.update() → CREATE + UPDATE
	//
	// Semantic prompt change auto-triggers evaluation.
	// ──────────────────────────────────────────────────────────────
	hr('PHASE 4: brain.update() → CREATE + UPDATE')

	console.log('  Sending coverage gap signals first...\n')

	await sendSignal(
		'coverage-monitor',
		'Persistent coverage gap: security topics (SAST/DAST, secrets management, authentication, container security, RBAC, WAF) are not well-covered by any neuron. The brain needs a dedicated security practices neuron.',
	)

	await sendSignal(
		'coverage-monitor',
		'The coding-practices neuron absorbs security-related patterns (input validation, parameterized queries) alongside general practices. Its scope should be refined to focus on coding conventions, deferring deep security to a dedicated neuron.',
	)

	await sleep(500)

	console.log('\n  Now updating brain prompt to expand scope...\n')

	const updateResult = await brainUpdate({
		prompt: 'You are the learning system for a senior software engineering team. Track coding practices, architectural decisions, debugging approaches, tooling, collaboration, workflows, AND security practices including DevSecOps, vulnerability management, and compliance.',
	})

	await sleep(3000)

	// If auto-evaluation didn't fire (because autoEvaluate is off),
	// manually evaluate with the buffered signals
	const updateEvolution = (updateResult as any).evolutionResults
	if (!updateEvolution?.decisions?.length) {
		console.log('\n  Auto-evaluation did not fire — triggering manual evaluation...')
		await evaluate()
		await sleep(3000)
	}

	await printStatus('After brain.update()')

	// ──────────────────────────────────────────────────────────────
	// FINAL: Report
	// ──────────────────────────────────────────────────────────────
	hr('FINAL REPORT')

	const finalStatus = await printStatus('Final')

	const initialIds = initial.neurons.map((l: any) => l.id as string)
	const finalIds = finalStatus.neurons.map((l: any) => l.id as string)
	const problematicIds = [overlapId, irrelevantId, broadId]
	const created = finalIds.filter((id: string) => !initialIds.includes(id) && !problematicIds.includes(id))
	const deleted = problematicIds.filter((id: string) => !finalIds.includes(id))

	console.log(`\nInitial: ${initial.neurons.length} neurons`)
	console.log(`Added: 3 problematic (${overlapId}, ${irrelevantId}, ${broadId})`)
	console.log(`Final: ${finalStatus.neurons.length} neurons`)
	console.log(`\nNew: ${created.length > 0 ? created.join(', ') : 'none'}`)
	console.log(`Deleted: ${deleted.length > 0 ? deleted.join(', ') : 'none'}`)

	const actionExecuted = capturedEvents.filter((e) => e.event === 'evolution:action:executed')
	const actionFailed = capturedEvents.filter((e) => e.event === 'evolution:action:failed')
	const actionTypes = new Set(actionExecuted.map((e) => e.data.action))

	console.log(`\nActions executed: ${actionExecuted.length}`)
	for (const e of actionExecuted) {
		console.log(`  ${e.data.action}: targets=${JSON.stringify(e.data.targets)}`)
	}
	if (actionFailed.length > 0) {
		console.log(`Actions FAILED: ${actionFailed.length}`)
		for (const e of actionFailed) {
			console.log(`  ${e.data.action}: ${e.data.error}`)
		}
	}

	const allActions = ['create', 'merge', 'split', 'update', 'delete']
	const covered = allActions.filter((a) => actionTypes.has(a))
	const missing = allActions.filter((a) => !actionTypes.has(a))

	console.log(`\nCovered: ${covered.join(', ') || 'none'} (${covered.length}/5)`)
	if (missing.length > 0) {
		console.log(`Missing: ${missing.join(', ')}`)
	} else {
		console.log(`ALL 5 ACTION TYPES COVERED!`)
	}

	stopSSEMonitor()
	console.log(`\n[${ts()}] Done.`)
}

main().catch((err) => {
	console.error('Fatal error:', err)
	stopSSEMonitor()
	process.exit(1)
})
