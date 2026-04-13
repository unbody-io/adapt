"use client"

import { useState, useCallback, useEffect } from "react"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { LanguageModel } from "ai"
import type { UseCase, ModelRef } from "../../lib/demo/use-cases"
import type { DataSource } from "../../lib/demo/types"
import { useBrain } from "../../lib/demo/use-brain"
import { ConversationFlow } from "./conversation-flow"
import { Mycelium } from "./mycelium"
import { QueryBar } from "./query-bar"
import { StatusDisplay } from "./status-display"
import { CloseButton } from "./close-button"

// --- Model Factory (mirrors playground's createModel) ---

const openrouter = createOpenRouter({
	baseURL: "/api/llm-proxy",
	apiKey: "proxy",
})

function resolveModelRef(
	slot: string | ModelRef | undefined,
	defaultModel: string,
): string {
	if (!slot) return defaultModel
	if (typeof slot === "string") return slot
	return slot.model
}

function createModel(slot?: string | ModelRef, defaultModel = "google/gemini-2.5-flash"): LanguageModel {
	return openrouter(resolveModelRef(slot, defaultModel))
}

// ---

export function DemoOrchestrator() {
	const [live, setLive] = useState(false)
	const [activeUseCase, setActiveUseCase] = useState<UseCase | null>(null)
	const { state, brain, start, inject, destroy, downloadLog } = useBrain()
	const injectionStarted = state.injectionProgress !== null || state.events.some((event) => event.type === "brain:inject:started")

	const handleStart = useCallback(async (useCase: UseCase, prompt: string) => {
		setLive(true)
		setActiveUseCase(useCase)

		const model = createModel(useCase.model)

		await start({
			prompt,
			model,
			blueprintModel: useCase.blueprintModel ? createModel(useCase.blueprintModel) : model,
			autoSetup: useCase.autoSetup,
			learning: useCase.learning,
			evolution: useCase.evolution ? {
				enabled: useCase.evolution.enabled,
				autoEvaluate: useCase.evolution.autoEvaluate,
				evaluatorSignalThreshold: useCase.evolution.evaluatorSignalThreshold,
				...(useCase.evolution.model
					? { model: createModel(useCase.evolution.model) }
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
			<div style={{ width: "100%", height: "100vh" }}>
				<CloseButton />
				<ConversationFlow onStart={handleStart} />
			</div>
		)
	}

	return (
		<div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden" }}>
			<CloseButton />
			<button
				type="button"
				onClick={downloadLog}
				title="Download event log"
				style={{
					position: "fixed",
					top: "1rem",
					right: "3rem",
					zIndex: 70,
					background: "none",
					border: "none",
					cursor: "pointer",
					fontSize: "0.9rem",
					color: "#9b9ba8",
					padding: "0.25rem 0.5rem",
					lineHeight: 1,
					transition: "color 0.15s",
				}}
				onMouseEnter={(e) => { e.currentTarget.style.color = "#1a1a1f" }}
				onMouseLeave={(e) => { e.currentTarget.style.color = "#9b9ba8" }}
			>
				↓
			</button>

			{/* Shader visualization — centered, max 800x600 */}
			<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
				<Mycelium
					neurons={state.neurons}
					events={state.events}
				/>
			</div>

			{/* Status display — top center */}
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
