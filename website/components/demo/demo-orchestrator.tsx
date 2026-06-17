"use client"

import { useState, useCallback, useEffect } from "react"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import type { LanguageModel } from "ai"
import type { UseCase, ModelRef } from "../../lib/demo/use-cases"
import type { DataSource } from "../../lib/demo/types"
import { useBrain } from "../../lib/demo/use-brain"
import { ConversationFlow } from "./conversation-flow"
import { Mycelium } from "./mycelium"
import { QueryBar } from "./query-bar"
import { StatusDisplay } from "./status-display"
import { DemoBreadcrumb } from "./breadcrumb"

// --- Model Factory ---
// Provider is config-driven (see ModelRef.provider). Each provider points its
// native AI SDK client at a local proxy route that injects the real API key, so
// keys never reach the browser. Switching a slot's provider is a config change.

const PROVIDERS = {
	openrouter: createOpenRouter({ baseURL: "/api/llm-proxy", apiKey: "proxy" }),
	google: createGoogleGenerativeAI({ baseURL: "/api/gemini-proxy/v1beta", apiKey: "proxy" }),
} as const

type ProviderId = keyof typeof PROVIDERS

const DEFAULT_PROVIDER: ProviderId = "openrouter"
const DEFAULT_MODEL = "google/gemini-2.5-flash"

function isProviderId(value: string | undefined): value is ProviderId {
	return value === "openrouter" || value === "google"
}

function createModel(
	slot?: string | ModelRef,
	defaults?: { provider?: string; model?: string },
): LanguageModel {
	const name = !slot ? (defaults?.model ?? DEFAULT_MODEL) : typeof slot === "string" ? slot : slot.model
	const provider = (typeof slot === "object" ? slot.provider : undefined) ?? defaults?.provider
	return PROVIDERS[isProviderId(provider) ? provider : DEFAULT_PROVIDER](name)
}

// ---

export function DemoOrchestrator() {
	const [live, setLive] = useState(false)
	const [activeUseCase, setActiveUseCase] = useState<UseCase | null>(null)
	const { state, brain, start, inject, destroy } = useBrain()
	const injectionStarted = state.injectionProgress !== null || state.events.some((event) => event.type === "brain:inject:started")

	const handleStart = useCallback(async (useCase: UseCase, prompt: string) => {
		setLive(true)
		setActiveUseCase(useCase)

		const defaults = { provider: useCase.provider }
		const model = createModel(useCase.model, defaults)

		await start({
			prompt,
			model,
			blueprintModel: useCase.blueprintModel ? createModel(useCase.blueprintModel, defaults) : model,
			autoSetup: useCase.autoSetup,
			learning: useCase.learning,
			evolution: useCase.evolution ? {
				enabled: useCase.evolution.enabled,
				autoEvaluate: useCase.evolution.autoEvaluate,
				evaluatorSignalThreshold: useCase.evolution.evaluatorSignalThreshold,
				...(useCase.evolution.model
					? { model: createModel(useCase.evolution.model, defaults) }
					: {}),
			} : undefined,
			ingest: useCase.ingest,
		})

		// Auto-inject data in background
		const dataSources = await loadDataSources(useCase.dataPaths)
		inject(dataSources)
	}, [start, inject])

	// Cleanup on unmount
	useEffect(() => {
		return () => { destroy() }
	}, [destroy])

	if (!live) {
		return (
			<div style={{ width: "100%", height: "100dvh" }}>
				<DemoBreadcrumb />
				<ConversationFlow onStart={handleStart} />
			</div>
		)
	}

	return (
		<div style={{ width: "100%", height: "100dvh", position: "relative", overflow: "hidden" }}>
			<DemoBreadcrumb useCaseName={activeUseCase?.title} />

			{/* Shader visualization — centered on desktop, bottom on mobile */}
			<div className="absolute inset-0 bottom-[50px] flex items-end justify-center md:bottom-0 md:items-center">
				<Mycelium
					neurons={state.neurons}
					events={state.events}
				/>
			</div>

			{/* Status + info button */}
			<StatusDisplay
				activity={state.activity}
				commentary={state.commentary}
				injectionProgress={state.injectionProgress}
				evolutionActivity={state.evolutionActivity}
				evolutionCommentary={state.evolutionCommentary}
				useCase={activeUseCase}
			/>

			{/* Query bar + evolution status — bottom center */}
			<QueryBar
				neurons={state.neurons}
				disabled={state.phase !== "ready" || !injectionStarted}
				brainRef={brain}
				suggestions={activeUseCase?.suggestions}
			/>
		</div>
	)
}


async function loadDataSources(paths: string[]): Promise<DataSource[]> {
	const sources: DataSource[] = []
	for (const path of paths) {
		const res = await fetch(path)
		const data = await res.json()
		sources.push(data)
	}
	return sources
}
