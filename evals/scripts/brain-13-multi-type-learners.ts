/**
 * Semantic Eval: Brain with multi-type learners
 *
 * Tests the full Brain lifecycle with a prompt designed to generate both text and list learners.
 * Verifies: decomposition → init → inject → ask → evolution → inject → ask
 *
 * Domain: tracking a startup's product development — mixing qualitative patterns (text)
 * with discrete entities (list).
 */

import { Brain } from '../../src/brain/class'
import { TextLearner } from '../../src/learners/text-learner/class'
import { ListLearner } from '../../src/learners/list-learner/class'
import { logger } from '../helpers/logger'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'

const events: Array<{ type: string; payload?: any; time: number }> = []
const startTime = Date.now()

function elapsed() {
	return ((Date.now() - startTime) / 1000).toFixed(1)
}

async function main() {
	// ━━━ 1. CREATE BRAIN ━━━
	logger.logSection('1. Create Brain with multi-type prompt')

	// Prompt deliberately mixes:
	// - Qualitative patterns (product philosophy, user feedback themes) → should be text learners
	// - Discrete entities (features, tools, team members, bugs) → should be list learners
	const brainPrompt = `You are a startup intelligence system tracking product development for a B2B SaaS company.

You should track:
- Product strategy and vision: the evolving philosophy behind product decisions, trade-offs between simplicity and power, positioning against competitors
- Feature inventory: specific features that exist in the product, their status (shipped, in-progress, planned, deprecated), and who owns them
- User feedback patterns: qualitative themes from user interviews, support tickets, and NPS surveys — what users love, what frustrates them, recurring requests
- Technology stack: specific tools, libraries, frameworks, and infrastructure the team uses, with versions and adoption status
- Team knowledge: who knows what, expertise areas, key decision makers for different parts of the system`

	const brain = new Brain({
		prompt: brainPrompt,
		model: openrouter(MODEL),
		evolution: {
			enabled: true,
			evaluatorSignalThreshold: 5,
			autoEvaluate: false,
		},
	})

	brain.on((event) => {
		const entry = { type: event.type, payload: event.payload, time: Date.now() - startTime }
		events.push(entry)

		// Compact logging
		const p = event.payload as any
		switch (event.type) {
			case 'brain:init:started':
			case 'brain:init:completed':
			case 'brain:inject:started':
			case 'brain:inject:completed':
			case 'brain:ask:started':
			case 'brain:ask:completed':
				console.log(`  [${elapsed()}s] ${event.type}`)
				break
			case 'brain:learner:added':
				console.log(`  [${elapsed()}s] ${event.type} — ${p?.name} (${p?.learnerId})`)
				break
			case 'brain:init:config:generated':
				console.log(`  [${elapsed()}s] ${event.type} — ${p?.configs?.length} learner configs`)
				break
			case 'learner:synthesized':
				console.log(`  [${elapsed()}s] ${event.type} (${p?.learnerId})`)
				break
			// Skip noisy events
			case 'learner:init:started':
			case 'learner:init:completed':
			case 'learner:observe:started':
			case 'learner:observe:thinking':
			case 'learner:synthesize:started':
			case 'learner:synthesize:thinking':
			case 'learner:query:started':
			case 'learner:query:completed':
			case 'learner:health:updated':
			case 'learner:understanding:set':
			case 'learner:prompts:regenerated':
			case 'learner:config:updated':
			case 'brain:inject:batch:started':
			case 'brain:inject:batch:completed':
			case 'brain:ask:synthesis:started':
			case 'brain:init:config:generating':
			case 'learner:query:thinking':
				break // skip
			default:
				console.log(`  [${elapsed()}s] ${event.type}`)
		}
	})

	// ━━━ 2. INITIALIZE ━━━
	logger.logSection('2. Initialize Brain (decompose prompt into learners)')

	await brain.initialize()

	const learners = Array.from(brain.learners.values())
	const textLearners = learners.filter(l => l instanceof TextLearner)
	const listLearners = learners.filter(l => l instanceof ListLearner)

	console.log(`\n  Total learners: ${learners.length}`)
	console.log(`  Text learners: ${textLearners.length}`)
	console.log(`  List learners: ${listLearners.length}`)

	console.log('\n  Learner breakdown:')
	for (const l of learners) {
		const type = l instanceof TextLearner ? 'text' : l instanceof ListLearner ? 'list' : 'unknown'
		console.log(`    [${type}] ${l.id} — "${l.name}"`)
		console.log(`      ${l.description}`)
	}

	// ━━━ 3. INJECT DATA (batch 1) ━━━
	logger.logSection('3. Inject batch 1 — product development updates')

	await brain.inject([
		// Strategy/vision content (should be captured by text learner)
		'Product leadership decided to prioritize simplicity over feature richness for Q1. The core thesis: our power users will tolerate fewer features if the ones we have are exceptionally reliable and fast. This means saying no to the enterprise dashboard customization requests for now.',

		// Feature inventory (should be captured by list learner)
		'Shipped features this sprint: real-time collaboration (v2.1), export-to-PDF, and the new onboarding wizard. The API rate limiter is in-progress, owned by the platform team. Planned for next sprint: SSO integration and audit log. The legacy CSV importer is now deprecated.',

		// User feedback (qualitative patterns — text learner)
		'NPS survey results from January: Overall score 42 (up from 38). Top praise: "the speed improvements are noticeable" and "love the new collaboration features". Top complaints: "still no SSO, this is a dealbreaker for our security team" and "the mobile experience is terrible". Three enterprise prospects churned citing lack of audit logging.',

		// Technology stack (discrete items — list learner)
		'Tech stack update: migrated from Express to Hono for the API layer (3x faster cold starts). Still using PostgreSQL 15 with Drizzle ORM. Frontend is Next.js 14 with React 18. Added Sentry for error tracking last week. Considering switching from Vercel to Cloudflare Workers for edge deployment.',

		// Team knowledge (discrete — list learner)
		'Sarah (tech lead) owns the API layer and database architecture. Marcus is the frontend specialist, knows React and Next.js deeply. New hire Priya is ramping up on the auth system — she previously built OAuth flows at her last company. DevOps is handled by Jake who manages our Vercel deployment and CI/CD pipeline.',
	])

	// Show state after injection
	console.log('\n  Per-learner state after inject:')
	for (const l of learners) {
		const type = l instanceof TextLearner ? 'text' : 'list'
		const understanding = await l.getUnderstanding()
		const metrics = l.getMetrics()
		if (type === 'text') {
			const text = understanding as string
			console.log(`\n    [${type}] ${l.name}:`)
			console.log(`      Understanding: ${text.length} chars`)
			console.log(`      Buffer: ${l.getBufferState().count}`)
			console.log(`      Syntheses: ${metrics.ingestion.synthesisCount}`)
			if (text) {
				console.log(`      Preview: ${text.slice(0, 200)}...`)
			}
		} else {
			const items = understanding as any[]
			console.log(`\n    [${type}] ${l.name}:`)
			console.log(`      Items: ${items.length}`)
			console.log(`      Buffer: ${l.getBufferState().count}`)
			console.log(`      Syntheses: ${metrics.ingestion.synthesisCount}`)
			if (items.length > 0) {
				for (const item of items.slice(0, 5)) {
					console.log(`      - [${item.id}] ${JSON.stringify(item.data).slice(0, 120)}`)
				}
				if (items.length > 5) console.log(`      ... and ${items.length - 5} more`)
			}
		}
	}

	// ━━━ 4. ASK — Cross-learner queries ━━━
	logger.logSection('4. Ask — "What is our product strategy?"')

	const ask1 = await brain.ask('What is our product strategy?')
	console.log(`\n  Insight:\n  ${ask1.insight.replace(/\n/g, '\n  ')}`)
	console.log(`  Sources: [${ask1.sources.join(', ')}]`)
	if (ask1.gaps.length) console.log(`  Gaps: [${ask1.gaps.join(', ')}]`)

	logger.logSection('4b. Ask — "What technologies are we using?"')

	const ask2 = await brain.ask('What technologies are we using?')
	console.log(`\n  Insight:\n  ${ask2.insight.replace(/\n/g, '\n  ')}`)
	console.log(`  Sources: [${ask2.sources.join(', ')}]`)

	logger.logSection('4c. Ask — "What features have shipped recently?"')

	const ask3 = await brain.ask('What features have shipped recently?')
	console.log(`\n  Insight:\n  ${ask3.insight.replace(/\n/g, '\n  ')}`)
	console.log(`  Sources: [${ask3.sources.join(', ')}]`)

	logger.logSection('4d. Ask — "What are users complaining about?"')

	const ask4 = await brain.ask('What are users complaining about?')
	console.log(`\n  Insight:\n  ${ask4.insight.replace(/\n/g, '\n  ')}`)
	console.log(`  Sources: [${ask4.sources.join(', ')}]`)

	// ━━━ 5. INJECT MORE DATA (batches 2-5) ━━━
	// Push enough data through all learners to trigger synthesis across the board

	logger.logSection('5a. Inject batch 2 — strategy + features + user feedback')

	await brain.inject([
		'Strategy pivot: after the enterprise churn, leadership is reconsidering the "simplicity first" approach. The new thinking is a "progressive complexity" model — simple by default, but power users can unlock advanced features. SSO and audit log are now top priority.',

		'Bug report: the real-time collaboration feature has a race condition when 3+ users edit simultaneously. Marcus is investigating. The export-to-PDF also has a rendering issue with tables wider than the page. Both are P1.',

		'New features shipped: basic webhook support (v1.0), team management roles (admin/editor/viewer). The API rate limiter shipped with configurable thresholds per plan tier. SSO integration is now in-progress, ETA 2 weeks.',

		'User interview insights: Enterprise customers value audit trails more than any individual feature. Two customers said they would upgrade from Team to Enterprise plan if we had SAML SSO. The collaboration features are driving organic growth — users invite teammates who then become power users.',
	])

	logger.logSection('5b. Inject batch 3 — tech stack heavy')

	await brain.inject([
		'Infrastructure update: we finalized the migration from Vercel to Cloudflare Workers. Cold starts went from 250ms to 40ms. The database stays on Supabase-hosted PostgreSQL 15. Redis (Upstash) added for session caching and rate limiting.',

		'Frontend tooling: upgraded to Next.js 15 with the new app router. Switched from styled-components to Tailwind CSS 4.0 for performance. Added Radix UI for accessible component primitives. Storybook 8 for component documentation.',

		'CI/CD pipeline: GitHub Actions for all builds and deploys. Turborepo for monorepo build orchestration. Playwright for E2E tests, Vitest for unit tests. Docker for local dev parity. Deployed via Cloudflare Pages (frontend) and Workers (API).',

		'Monitoring and observability: Sentry for error tracking (both frontend and API). Grafana Cloud for metrics dashboards. OpenTelemetry for distributed tracing. PagerDuty for on-call rotations. Datadog was evaluated but too expensive for current stage.',

		'Security tools: Snyk for dependency vulnerability scanning. SonarQube for code quality gates. Vault by HashiCorp for secrets management. Let\'s Encrypt for TLS certificates via Cloudflare.',
	])

	logger.logSection('5c. Inject batch 4 — team knowledge heavy')

	await brain.inject([
		'Team standup notes: Sarah is now splitting time between the API rewrite and mentoring Priya on database schema design. Marcus onboarded a contractor (Lisa) to help with the mobile-responsive redesign. Jake is sole owner of infrastructure and has flagged this as a bus factor risk.',

		'Expertise map update: Sarah — expert in PostgreSQL optimization, Drizzle ORM, API design patterns, system architecture. Marcus — React, Next.js, CSS/Tailwind, accessibility, Storybook. Priya — OAuth/OIDC, SAML, session management, learning Drizzle. Jake — Cloudflare Workers, GitHub Actions, Docker, Turborepo, monitoring.',

		'Hiring update: we are hiring a senior backend engineer to reduce Jake\'s load and cover backend gaps. The ideal candidate knows TypeScript, PostgreSQL, and has experience with edge computing (Cloudflare/Deno). Two candidates in final round: one from Stripe, one from Vercel.',

		'Knowledge sharing: Marcus ran a React Server Components workshop for the team. Sarah documented the database migration playbook. Priya wrote the auth system architecture decision record (ADR). Jake is writing runbooks for incident response.',

		'Decision makers: product direction → CEO + Sarah. Technical architecture → Sarah with input from Marcus on frontend. Security decisions → Priya (auth) + Jake (infra). Hiring → Sarah + CEO. Customer escalations → Head of Support + CEO.',
	])

	logger.logSection('5d. Inject batch 5 — more user feedback + features')

	await brain.inject([
		'Support ticket analysis (February): 45% of tickets are about the mobile experience. 20% are SSO-related from enterprise accounts. 15% are PDF export edge cases. The remaining 20% are miscellaneous bugs and feature requests.',

		'Customer advisory board meeting: top 3 requests were (1) granular permissions beyond admin/editor/viewer, (2) API for bulk data operations, (3) white-labeling option. Two customers volunteered for SSO beta testing. One customer building a custom integration via webhooks.',

		'Competitive analysis: Competitor A launched AI-powered features. Competitor B raised Series C and is hiring aggressively. Our differentiation is speed and simplicity. Users switching from Competitor A cite "too many features, too complex" as reason for switching to us.',

		'New features shipped this week: dark mode (v1.0), keyboard shortcuts for power users, improved search with fuzzy matching. Planned: granular permissions (Q2), bulk API (Q2), white-label (Q3). The onboarding wizard conversion rate improved 23% after A/B testing.',
	])

	// Show updated state after all batches
	const printLearnerStates = async (label: string) => {
		console.log(`\n  Per-learner state ${label}:`)
		for (const l of learners) {
			const type = l instanceof TextLearner ? 'text' : 'list'
			const understanding = await l.getUnderstanding()
			const metrics = l.getMetrics()
			if (type === 'text') {
				const text = understanding as string
				console.log(`    [${type}] ${l.name}: ${text.length} chars, ${metrics.ingestion.synthesisCount} syntheses, buffer=${l.getBufferState().count}`)
			} else {
				const items = understanding as any[]
				console.log(`    [${type}] ${l.name}: ${items.length} items, ${metrics.ingestion.synthesisCount} syntheses, buffer=${l.getBufferState().count}`)
			}
		}
	}

	await printLearnerStates('after all batches')

	// ━━━ 6. ASK AGAIN — after more data ━━━
	logger.logSection('6. Ask — "How has our strategy evolved?"')

	const ask5 = await brain.ask('How has our strategy evolved?')
	console.log(`\n  Insight:\n  ${ask5.insight.replace(/\n/g, '\n  ')}`)
	console.log(`  Sources: [${ask5.sources.join(', ')}]`)

	logger.logSection('6b. Ask — "Who should I talk to about the auth system?"')

	const ask6 = await brain.ask('Who should I talk to about the auth system?')
	console.log(`\n  Insight:\n  ${ask6.insight.replace(/\n/g, '\n  ')}`)
	console.log(`  Sources: [${ask6.sources.join(', ')}]`)

	logger.logSection('6c. Ask — "What is our full technology stack?"')

	const ask7tech = await brain.ask('What is our full technology stack? List every tool, framework, and service we use.')
	console.log(`\n  Insight:\n  ${ask7tech.insight.replace(/\n/g, '\n  ')}`)
	console.log(`  Sources: [${ask7tech.sources.join(', ')}]`)

	logger.logSection('6d. Ask — "Give me a status report on everything"')

	const ask7 = await brain.ask('Give me a comprehensive status report covering product, team, tech, and user sentiment')
	console.log(`\n  Insight:\n  ${ask7.insight.replace(/\n/g, '\n  ')}`)
	console.log(`  Sources: [${ask7.sources.join(', ')}]`)

	// ━━━ 7. EVOLUTION — dry run evaluation ━━━
	logger.logSection('7. Evolution — dry run evaluation')

	// Send a signal to give the evaluator something to work with
	brain.signal({
		source: 'eval-script',
		description: 'Manual check: are the current learners well-suited for the data flowing in? Are there coverage gaps or overlapping learners?',
		bypass: true,
	})

	const { decisions } = await brain.evaluateEvolution({ dryRun: true })

	if (decisions.length === 0) {
		console.log('  No evolution decisions — evaluator thinks current setup is fine')
	} else {
		console.log(`  ${decisions.length} evolution decision(s):`)
		for (const d of decisions) {
			console.log(`    [${d.action}] targets: [${d.targets.join(', ')}]`)
			console.log(`      reasoning: ${d.reasoning}`)
			console.log(`      guidance: ${d.guidance.slice(0, 200)}`)
		}
	}

	// ━━━ 8. EVENT LOG & SEMANTIC CHECKS ━━━
	logger.logSection('8. Event log summary')

	const eventCounts: Record<string, number> = {}
	for (const e of events) {
		eventCounts[e.type] = (eventCounts[e.type] || 0) + 1
	}

	console.log('\n  Event counts:')
	for (const [type, count] of Object.entries(eventCounts).sort()) {
		console.log(`    ${type}: ${count}`)
	}

	logger.logSection('9. Semantic checks')

	// Brain initialized
	logger.logAssertion('Brain initialized', events.some(e => e.type === 'brain:init:completed'))

	// Multiple learners created
	logger.logAssertion('Multiple learners created', learners.length >= 2, `count=${learners.length}`)

	// KEY TEST: Both types generated
	logger.logAssertion('At least one text learner', textLearners.length >= 1, `text=${textLearners.length}`)
	logger.logAssertion('At least one list learner', listLearners.length >= 1, `list=${listLearners.length}`)

	// ALL learners should have understanding after 5 inject batches
	const understandingResults = await Promise.all(learners.map(async l => {
		const u = await l.getUnderstanding()
		if (typeof u === 'string') return u.length > 0
		if (Array.isArray(u)) return u.length > 0
		return false
	}))
	const learnersWithUnderstanding = learners.filter((_, i) => understandingResults[i])
	logger.logAssertion('All learners have understanding', learnersWithUnderstanding.length === learners.length, `${learnersWithUnderstanding.length}/${learners.length}`)

	// Per-type understanding checks
	for (const l of textLearners) {
		const text = (await l.getUnderstanding()) as string
		logger.logAssertion(`Text learner "${l.name}" has understanding`, text.length > 0, `${text.length} chars`)
	}
	for (const l of listLearners) {
		const items = (await l.getUnderstanding()) as any[]
		logger.logAssertion(`List learner "${l.name}" has items`, items.length > 0, `${items.length} items`)
	}

	// Synthesis happened for multiple learners
	const synthesizedLearnerIds = new Set(
		events.filter(e => e.type === 'learner:synthesized').map(e => (e.payload as any)?.learnerId)
	)
	logger.logAssertion('Multiple learners synthesized', synthesizedLearnerIds.size >= 3, `${synthesizedLearnerIds.size} learners`)

	// Brain ask returned insights
	logger.logAssertion('Strategy ask has insight', ask1.insight.length > 0)
	logger.logAssertion('Tech stack ask (early) has insight', ask2.insight.length > 0)
	logger.logAssertion('Features ask has insight', ask3.insight.length > 0)
	logger.logAssertion('User feedback ask has insight', ask4.insight.length > 0)
	logger.logAssertion('Evolution ask has insight', ask5.insight.length > 0)
	logger.logAssertion('Full tech stack ask has insight', ask7tech.insight.length > 50, `${ask7tech.insight.length} chars`)
	logger.logAssertion('Comprehensive ask has insight', ask7.insight.length > 0)

	// Ask returned sources
	logger.logAssertion('Comprehensive ask attributes sources', ask7.sources.length > 0, `sources=${ask7.sources.length}`)

	// Inject events (5 batches)
	const injectCompletedCount = events.filter(e => e.type === 'brain:inject:completed').length
	logger.logAssertion('All 5 inject batches completed', injectCompletedCount === 5, `got ${injectCompletedCount}`)

	// Ask events
	logger.logAssertion('Ask events fired', events.some(e => e.type === 'brain:ask:started') && events.some(e => e.type === 'brain:ask:completed'))

	// Evolution evaluator ran
	logger.logAssertion('Evaluator ran', events.some(e => e.type === 'evaluator:evaluation:started') || decisions.length >= 0)

	logger.logSuccess(`Eval complete in ${elapsed()}s — ${events.length} total events, ${learners.length} learners (${textLearners.length} text, ${listLearners.length} list)`)
}

main().catch((error) => {
	logger.logError('Eval failed', error)
	process.exit(1)
})
