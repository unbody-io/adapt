import type { LanguageModel } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import { Brain, type BrainAskResult } from '../../src'
import type { BrainStore, NeuronStore } from '../../src/stores'
import type { LanguageModelV3CallOptions } from '@ai-sdk/provider'
import type { JSONValue } from '@ai-sdk/provider/internal'
import { join } from 'node:path'

interface StoreFactories {
	createBrainStore: (dbPath: string) => BrainStore
	createNeuronStore: (dbPath: string) => NeuronStore
}

export interface BrainRestoreSmokeResult {
	firstAsk: BrainAskResult
	secondAsk: BrainAskResult
	firstUnderstanding: string
	secondUnderstanding: string
	injectStatus: string
	callsBeforeRestoreInitialize: number
	callsAfterRestoreInitialize: number
	callsAfterRestoreAsk: number
	restoredNeuronCount: number
}

interface ScriptedModelHandle {
	model: LanguageModel
	getCallCount: () => number
}

const compareSkills = [
	{ skill: 'confirms', description: 'What reinforces the same engineering decision?' },
	{ skill: 'contradicts', description: 'What conflicts with the recorded decision?' },
	{ skill: 'extends', description: 'What adds more detail to the decision?' },
	{ skill: 'new', description: 'What introduces a brand new decision?' },
	{ skill: 'irrelevant', description: 'What does not belong to this decision log?' },
] as const

const dynamicsSkills = [
	{ skill: 'recurs', description: 'What decision keeps coming up again?' },
	{ skill: 'intensifies', description: 'What tradeoff is becoming more important?' },
	{ skill: 'fades', description: 'What decision is no longer active?' },
	{ skill: 'shifts', description: 'How is the team changing its decision?' },
	{ skill: 'avoids', description: 'What decision keeps being deferred?' },
] as const

function createUsage() {
	return {
		inputTokens: {
			total: 32,
			noCache: 32,
			cacheRead: undefined,
			cacheWrite: undefined,
		},
		outputTokens: {
			total: 24,
			text: 24,
			reasoning: undefined,
		},
	}
}

function createJsonResult(value: JSONValue) {
	return {
		content: [{ type: 'text' as const, text: JSON.stringify(value) }],
		finishReason: { unified: 'stop' as const, raw: undefined },
		usage: createUsage(),
		warnings: [],
	}
}

function createTextResult(text: string) {
	return {
		content: [{ type: 'text' as const, text }],
		finishReason: { unified: 'stop' as const, raw: undefined },
		usage: createUsage(),
		warnings: [],
	}
}

function getPromptText(options: LanguageModelV3CallOptions): string {
	return options.prompt
		.map((message) => {
			if (message.role === 'system') return message.content
			return message.content
				.map((part) => {
					if (part.type === 'text') return part.text
					if (part.type === 'tool-call') return JSON.stringify(part.input)
					if (part.type === 'tool-result') return JSON.stringify(part.output)
					return ''
				})
				.join('\n')
		})
		.join('\n\n')
}

function getSystemText(options: LanguageModelV3CallOptions): string {
	return options.prompt
		.filter((message) => message.role === 'system')
		.map((message) => message.content)
		.join('\n\n')
}

function extractSection(text: string, heading: string, endMarker?: string): string {
	const start = text.indexOf(heading)
	if (start === -1) return ''
	const contentStart = start + heading.length
	const rest = text.slice(contentStart)
	if (!endMarker) return rest.trim()
	const end = rest.indexOf(endMarker)
	return (end === -1 ? rest : rest.slice(0, end)).trim()
}

function buildUnderstanding(promptText: string): string {
	const currentUnderstanding = extractSection(
		promptText,
		'## Current Understanding\n\n',
		'\n\n## Observations to Integrate',
	)
	const observationsSection = extractSection(
		promptText,
		'## Observations to Integrate\n\n',
		'\n\nIntegrate these observations into your understanding.',
	)

	const observations = observationsSection
		.split('\n\n---\n\n')
		.map((item) => item.trim())
		.filter(Boolean)

	const pieces = new Set<string>()
	if (currentUnderstanding && !currentUnderstanding.startsWith('(No understanding yet')) {
		pieces.add(currentUnderstanding)
	}
	for (const observation of observations) {
		pieces.add(observation)
	}

	return Array.from(pieces).join('\n')
}

function extractSpecialistIds(promptText: string): string[] {
	return Array.from(promptText.matchAll(/^- ([^:]+):/gm), (match) => match[1])
}

function extractUnderstandingFromSystem(systemText: string): string {
	return extractSection(systemText, '# Your Understanding\n', '\n\nAnswer from your understanding.')
}

function extractSpecialistInsights(systemText: string): string[] {
	return Array.from(
		systemText.matchAll(/## [^\n]+\n([\s\S]*?)(?=\n## [^\n]+\n|$)/g),
		(match) => match[1].trim(),
	).filter(Boolean)
}

function createScriptedBrainModel(): ScriptedModelHandle {
	let callCount = 0

	const model = new MockLanguageModelV3({
		doGenerate: async (options) => {
			callCount++

			const promptText = getPromptText(options)
			const systemText = getSystemText(options)

			if (promptText.includes('You are generating the identity for a Synthesizer')) {
				return createJsonResult({
					identity:
						'You track engineering decisions, runtime constraints, persistence tradeoffs, and implementation rationale.',
					skills: compareSkills,
					dynamicsSkills,
				})
			}

			if (promptText.includes('You are analyzing a user-authored prompt for a living knowledge network')) {
				return createJsonResult({
					purpose: 'Track engineering decisions and remember their rationale.',
					evolutionGuidance: null,
					synthesisDirective: 'Answer concretely from stored engineering evidence.',
				})
			}

			if (promptText.includes('## Current Understanding') && promptText.includes('## Observations to Integrate')) {
				const understanding = buildUnderstanding(promptText)
				return createJsonResult({
					status: 'synthesized',
					newUnderstanding: understanding,
					significance: 'notable',
					evolution: 'Integrated the new engineering decision into stored understanding.',
					reasoning: 'The new observation adds concrete project knowledge.',
					output: '',
				})
			}

			if (systemText.includes('You select which specialist neurons are relevant to a user query.')) {
				return createJsonResult({
					ids: extractSpecialistIds(promptText),
				})
			}

			if (systemText.includes('# Your Understanding')) {
				const understanding = extractUnderstandingFromSystem(systemText)
				return createJsonResult({
					relevant: true,
					relevance: 1,
					confidence: 0.96,
					response: understanding,
					gaps: [],
				})
			}

			if (systemText.includes('# Specialist Knowledge')) {
				const insights = extractSpecialistInsights(systemText)
				return createJsonResult({
					response: insights.join('\n\n'),
					gaps: [],
				})
			}

			return createTextResult('No additional processing required.')
		},
	})

	return {
		model: model as unknown as LanguageModel,
		getCallCount: () => callCount,
	}
}

function createBrainConfig(
	dir: string,
	model: LanguageModel,
	factories: StoreFactories,
) {
	return {
		prompt: 'Track engineering decisions and their rationale.',
		model,
		autoSetup: false,
		store: factories.createBrainStore(join(dir, 'brain.db')),
		evolution: {
			enabled: false,
			autoEvaluate: false,
		},
		internalNeurons: {
			globalUnderstanding: false,
			globalQueryUnderstanding: false,
			injectionGaps: false,
			queryGaps: false,
		},
		learning: {
			store: (neuronId: string) =>
				factories.createNeuronStore(join(dir, `neuron-${neuronId}.db`)),
			understand: {
				thresholds: {
					maxObservations: 1,
					maxTokens: 8000,
					minImportance: 0.1,
				},
			},
		},
		neurons: [
			{
				id: 'engineering-decisions',
				name: 'Engineering Decisions',
				description: 'Tracks project decisions and technical tradeoffs.',
				type: 'text' as const,
				instructions:
					'Track engineering decisions, runtime tradeoffs, and the rationale behind technical changes.',
				skipObservation: true,
				observationSchema: { type: 'string' },
				understandingSchema: { type: 'string' },
			},
		],
	}
}

export async function runBrainRestoreSmoke(
	dir: string,
	factories: StoreFactories,
): Promise<BrainRestoreSmokeResult> {
	const firstModel = createScriptedBrainModel()
	const firstBrain = new Brain(createBrainConfig(dir, firstModel.model, factories))

	await firstBrain.initialize()

	const injectResult = await firstBrain.inject([
		'We chose runtime-specific SQLite adapters so Adapt core stays runtime-agnostic.',
	])
	const firstAsk = await firstBrain.ask('What engineering decision was made?')
	const firstUnderstanding =
		(await firstBrain.getNeuron('engineering-decisions')?.getUnderstanding()) as string
	await firstBrain.dispose()

	const restoredModel = createScriptedBrainModel()
	const restoredBrain = new Brain(
		createBrainConfig(dir, restoredModel.model, factories),
	)

	const callsBeforeRestoreInitialize = restoredModel.getCallCount()
	await restoredBrain.initialize()
	const callsAfterRestoreInitialize = restoredModel.getCallCount()
	const restoredNeuronCount = restoredBrain.getNeurons().length
	const secondAsk = await restoredBrain.ask('What engineering decision was made?')
	const callsAfterRestoreAsk = restoredModel.getCallCount()
	const secondUnderstanding =
		(await restoredBrain.getNeuron('engineering-decisions')?.getUnderstanding()) as string
	await restoredBrain.dispose()

	return {
		firstAsk,
		secondAsk,
		firstUnderstanding,
		secondUnderstanding,
		injectStatus: injectResult.batches[0]?.results[0]?.result.status ?? 'unknown',
		callsBeforeRestoreInitialize,
		callsAfterRestoreInitialize,
		callsAfterRestoreAsk,
		restoredNeuronCount,
	}
}
