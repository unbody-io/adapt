/**
 * Detailed eval for two-phase learning (Observe → Synthesize)
 *
 * Shows complete pipeline internals:
 * - Instructions
 * - Generated identities per phase
 * - System prompts per phase
 * - Each data item processed
 * - Observations extracted
 * - Synthesis results
 * - Final understanding
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { TextLearner } from '../src/learners'

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
const MODEL = process.env.MODEL ?? 'google/gemini-2.0-flash-001'

// Report accumulator
const report: string[] = []

function log(text: string) {
	console.log(text)
	report.push(text)
}

function section(title: string) {
	const divider = '='.repeat(60)
	log(`\n${divider}`)
	log(`  ${title}`)
	log(divider)
}

function subsection(title: string) {
	log(`\n--- ${title} ---`)
}

async function runEval() {
	const dataset = JSON.parse(
		readFileSync('evals/datasets/therapist-profile.json', 'utf-8'),
	)

	// Config
	const eventCount = parseInt(process.env.EVENTS ?? '5', 10)
	const learnerIndex = parseInt(process.env.LEARNER ?? '0', 10)
	const events = dataset.events.slice(0, eventCount)
	const purpose = dataset.metadata.learners[learnerIndex].purpose

	section('CONFIGURATION')
	log(`Model: ${MODEL}`)
	log(`Dataset: therapist-profile`)
	log(`Events: ${events.length}`)
	log(`Learner: ${dataset.metadata.learners[learnerIndex].name}`)

	section('INSTRUCTIONS')
	log(purpose)

	// Create learner
	const learner = new TextLearner({
		model: openrouter(MODEL),
		instructions: purpose,
		synthesize: {
			thresholds: {
				maxObservations: 3, // Low threshold to trigger synthesis quickly
			},
		},
	})

	section('INITIALIZATION')
	log('Generating identities and system prompts...')

	const initStart = Date.now()
	await learner.init()
	const initDuration = Date.now() - initStart

	log(`Initialization completed in ${initDuration}ms`)

	subsection('Observe Identity')
	const observeIdentity = learner.getObserveIdentity()
	if (observeIdentity) {
		log(JSON.stringify(observeIdentity, null, 2))
	}

	subsection('Synthesize Identity')
	const synthesizeIdentity = learner.getSynthesizeIdentity()
	if (synthesizeIdentity) {
		log(JSON.stringify(synthesizeIdentity, null, 2))
	}

	subsection('Observe System Prompt')
	log(learner.getObserveSystemPrompt() ?? '(not generated)')

	subsection('Synthesize System Prompt')
	log(learner.getSynthesizeSystemPrompt() ?? '(not generated)')

	section('LEARNING EVENTS')
	log('(Processing events one-by-one. Each .learn() call receives a single-item array.)')
	log(`Synthesis threshold: maxObservations=3\n`)

	for (let i = 0; i < events.length; i++) {
		const event = events[i]
		subsection(`Event ${i + 1}/${events.length}: ${event.type}`)

		log('\nInput Data (batch of 1):')
		log(JSON.stringify(event, null, 2).slice(0, 500) + (JSON.stringify(event).length > 500 ? '...' : ''))

		const start = Date.now()
		const result = await learner.learn([event]) // Single item batch
		const duration = Date.now() - start

		// Clear phase indicator
		const phaseIcon = result.status.startsWith('synthesize') || result.status === 'synthesized'
			? '🔄 SYNTHESIZE'
			: '👁️ OBSERVE'
		log(`\n${phaseIcon} → ${result.status} (${duration}ms)`)

		switch (result.status) {
			case 'observed':
				log(`  Observation: ${result.output}`)
				log(`  (buffered, threshold not yet met)`)
				break
			case 'observe:dismissed':
				log(`  Dismissed: ${result.output}`)
				break
			case 'synthesized':
				log(`  ✓ SYNTHESIS TRIGGERED (threshold met)`)
				log(`  Significance: ${result.significance}`)
				log(`  Evolution: ${result.evolution}`)
				if (result.reasoning) {
					log(`  Reasoning: ${result.reasoning}`)
				}
				break
			case 'synthesize:dismissed':
				log(`  Dismissed: ${result.output}`)
				break
			case 'observe:error':
			case 'synthesize:error':
				log(`  Error: ${result.error}`)
				break
		}

		// Show buffer state
		const bufferState = learner.getBufferState()
		log(`\nBuffer: ${bufferState.count} observations, avg importance: ${bufferState.avgImportance.toFixed(2)}`)

		// Show buffered observations if any
		const bufferedObs = learner.getBufferedObservations()
		if (bufferedObs.length > 0) {
			log('Buffered observations:')
			bufferedObs.forEach((obs, idx) => {
				log(`  ${idx + 1}. [${obs.importance.toFixed(2)}] ${obs.text.slice(0, 100)}...`)
			})
		}
	}

	section('FINAL STATE')

	subsection('Buffer')
	const finalBuffer = learner.getBufferState()
	log(`Count: ${finalBuffer.count}`)
	log(`Avg Importance: ${finalBuffer.avgImportance.toFixed(2)}`)
	log(`Total Tokens: ${finalBuffer.totalTokens}`)

	subsection('Evolution History')
	const evolution = learner.getEvolution()
	if (evolution.length === 0) {
		log('(no evolution entries yet)')
	} else {
		evolution.forEach((entry, idx) => {
			log(`${idx + 1}. [${entry.significance}] ${entry.summary}`)
		})
	}

	subsection('Final Understanding')
	const understanding = learner.getUnderstanding()
	if (understanding) {
		log(understanding)
	} else {
		log('(no understanding yet - synthesis threshold not reached)')
	}

	// Save report
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
	const modelSlug = MODEL.replace(/[/]/g, '-')
	const reportPath = `evals/reports/two-phase-${modelSlug}-${timestamp}.md`

	mkdirSync('evals/reports', { recursive: true })
	writeFileSync(reportPath, report.join('\n'))
	log(`\nReport saved to: ${reportPath}`)
}

runEval().catch(console.error)
