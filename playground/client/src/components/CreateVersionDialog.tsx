import { useState } from "react"
import type { BrainConfig, ProviderType, ModelRef } from "../types"

interface Props {
	useCaseId: string
	baseConfig?: BrainConfig
	onClose: () => void
	onCreated: () => void
}

const PROVIDERS: ProviderType[] = ["openrouter", "ollama", "lmstudio"]
const GOVERNANCE_STRATEGIES = ["continuous", "cumulative", "decay"] as const

function modelToString(m?: string | ModelRef): string {
	if (!m) return ""
	if (typeof m === "string") return m
	return m.model
}

function modelProvider(m?: string | ModelRef): ProviderType | "" {
	if (!m || typeof m === "string") return ""
	return m.provider ?? ""
}

interface NeuronDraft {
	id: string
	name: string
	type: "text" | "list"
	description: string
	instructions: string
}

export function CreateVersionDialog({ useCaseId, baseConfig, onClose, onCreated }: Props) {
	const [name, setName] = useState("")
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState("")

	// Model config
	const [provider, setProvider] = useState<ProviderType>(baseConfig?.provider ?? "openrouter")
	const [model, setModel] = useState(modelToString(baseConfig?.model))
	const [modelProvider_, setModelProvider] = useState<ProviderType | "">(modelProvider(baseConfig?.model))
	const [blueprintModel, setBlueprintModel] = useState(modelToString(baseConfig?.blueprintModel))
	const [blueprintProvider, setBlueprintProvider] = useState<ProviderType | "">(modelProvider(baseConfig?.blueprintModel))
	const [commentatorModel, setCommentatorModel] = useState(modelToString(baseConfig?.commentatorModel))
	const [commentatorProvider, setCommentatorProvider] = useState<ProviderType | "">(modelProvider(baseConfig?.commentatorModel))

	// Prompt
	const [prompt, setPrompt] = useState(baseConfig?.prompt ?? "")

	// Brain setup
	const [autoSetup, setAutoSetup] = useState(baseConfig?.autoSetup ?? true)

	// Learning
	const [maxObservations, setMaxObservations] = useState<string>(
		baseConfig?.learning?.understand?.thresholds?.maxObservations?.toString() ?? "",
	)
	const [maxTokens, setMaxTokens] = useState<string>(
		baseConfig?.learning?.understand?.thresholds?.maxTokens?.toString() ?? "",
	)
	const [minImportance, setMinImportance] = useState<string>(
		baseConfig?.learning?.understand?.thresholds?.minImportance?.toString() ?? "",
	)
	const [govStrategy, setGovStrategy] = useState<string>(
		baseConfig?.learning?.governance?.strategy ?? "",
	)
	const [govMaxTokens, setGovMaxTokens] = useState<string>(
		baseConfig?.learning?.governance?.maxTokens?.toString() ?? "",
	)

	// Evolution
	const [evolutionEnabled, setEvolutionEnabled] = useState(baseConfig?.evolution?.enabled ?? false)
	const [evolutionModel, setEvolutionModel] = useState(modelToString(baseConfig?.evolution?.model))
	const [autoEvaluate, setAutoEvaluate] = useState(baseConfig?.evolution?.autoEvaluate ?? false)
	const [evalThreshold, setEvalThreshold] = useState<string>(
		baseConfig?.evolution?.evaluatorSignalThreshold?.toString() ?? "",
	)

	// Ingestion
	const [ingestBatchSize, setIngestBatchSize] = useState<string>(
		baseConfig?.ingest?.batchSize?.toString() ?? "",
	)
	const [appBatchSize, setAppBatchSize] = useState<string>(
		baseConfig?.appBatchSize?.toString() ?? "",
	)

	// Storage
	const [storagePath, setStoragePath] = useState(baseConfig?.storage?.path ?? "")

	// Neurons
	const [neurons, setNeurons] = useState<NeuronDraft[]>(
		baseConfig?.neurons?.map((l) => ({ ...l })) ?? [],
	)

	function buildModelRef(modelStr: string, providerOverride: ProviderType | ""): string | ModelRef | undefined {
		if (!modelStr) return undefined
		if (providerOverride) return { provider: providerOverride, model: modelStr }
		return modelStr
	}

	function buildConfig(): BrainConfig {
		const config: BrainConfig = { prompt }

		config.provider = provider
		const modelRef = buildModelRef(model, modelProvider_)
		if (modelRef) config.model = modelRef
		const bpRef = buildModelRef(blueprintModel, blueprintProvider)
		if (bpRef) config.blueprintModel = bpRef
		const cmRef = buildModelRef(commentatorModel, commentatorProvider)
		if (cmRef) config.commentatorModel = cmRef

		config.autoSetup = autoSetup

		// Learning
		const thresholds: Record<string, number> = {}
		if (maxObservations) thresholds.maxObservations = Number(maxObservations)
		if (maxTokens) thresholds.maxTokens = Number(maxTokens)
		if (minImportance) thresholds.minImportance = Number(minImportance)

		const governance: Record<string, unknown> = {}
		if (govStrategy) governance.strategy = govStrategy
		if (govMaxTokens) governance.maxTokens = Number(govMaxTokens)

		if (Object.keys(thresholds).length > 0 || Object.keys(governance).length > 0) {
			config.learning = {}
			if (Object.keys(thresholds).length > 0) {
				config.learning.understand = { thresholds }
			}
			if (Object.keys(governance).length > 0) {
				config.learning.governance = governance as BrainConfig["learning"] extends { governance?: infer G } ? G : never
			}
		}

		// Evolution
		if (evolutionEnabled) {
			config.evolution = {
				enabled: true,
				autoEvaluate,
				...(evolutionModel ? { model: evolutionModel } : {}),
				...(evalThreshold ? { evaluatorSignalThreshold: Number(evalThreshold) } : {}),
			}
		}

		// Ingestion
		if (ingestBatchSize) config.ingest = { batchSize: Number(ingestBatchSize) }
		if (appBatchSize) config.appBatchSize = Number(appBatchSize)

		// Storage
		if (storagePath) config.storage = { path: storagePath }

		// Neurons
		if (neurons.length > 0) config.neurons = neurons

		return config
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError("")

		if (!name.trim()) {
			setError("Version name is required")
			return
		}
		if (!prompt.trim()) {
			setError("Prompt is required")
			return
		}

		setSaving(true)
		try {
			const res = await fetch(`/api/usecases/${useCaseId}/versions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: name.trim(), config: buildConfig() }),
			})

			if (!res.ok) {
				const data = await res.json()
				setError(data.error || "Failed to create version")
				return
			}

			onCreated()
		} catch {
			setError("Network error")
		} finally {
			setSaving(false)
		}
	}

	function addNeuron() {
		setNeurons([...neurons, { id: "", name: "", type: "text", description: "", instructions: "" }])
	}

	function updateNeuron(index: number, field: keyof NeuronDraft, value: string) {
		const updated = [...neurons]
		updated[index] = { ...updated[index], [field]: value }
		setNeurons(updated)
	}

	function removeNeuron(index: number) {
		setNeurons(neurons.filter((_, i) => i !== index))
	}

	return (
		<div className="dialog-backdrop" onClick={onClose}>
			<div className="dialog" onClick={(e) => e.stopPropagation()}>
				<div className="dialog-header">
					<h2>New Version</h2>
					<button type="button" className="dialog-close" onClick={onClose}>
						&times;
					</button>
				</div>

				<form onSubmit={handleSubmit} className="dialog-form">
					{error && <div className="dialog-error">{error}</div>}

					<section className="form-section">
						<label className="form-label">
							Version Name
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g. ollama-local"
								className="form-input"
								autoFocus
							/>
						</label>
					</section>

					<section className="form-section">
						<h3 className="form-section-title">Prompt</h3>
						<textarea
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							className="form-textarea"
							rows={6}
							placeholder="System prompt for the brain..."
						/>
					</section>

					<details className="form-advanced">
					<summary className="form-advanced-toggle">Advanced</summary>

					<div className="form-advanced-content">
					<section className="form-section">
						<h3 className="form-section-title">Models</h3>

						<label className="form-label">
							Default Provider
							<select
								value={provider}
								onChange={(e) => setProvider(e.target.value as ProviderType)}
								className="form-select"
							>
								{PROVIDERS.map((p) => (
									<option key={p} value={p}>
										{p}
									</option>
								))}
							</select>
						</label>

						<div className="form-row">
							<label className="form-label form-grow">
								Model
								<input
									type="text"
									value={model}
									onChange={(e) => setModel(e.target.value)}
									className="form-input"
									placeholder="e.g. google/gemini-2.5-flash"
								/>
							</label>
							<label className="form-label">
								Override Provider
								<select
									value={modelProvider_}
									onChange={(e) => setModelProvider(e.target.value as ProviderType | "")}
									className="form-select"
								>
									<option value="">default</option>
									{PROVIDERS.map((p) => (
										<option key={p} value={p}>
											{p}
										</option>
									))}
								</select>
							</label>
						</div>

						<div className="form-row">
							<label className="form-label form-grow">
								Blueprint Model
								<input
									type="text"
									value={blueprintModel}
									onChange={(e) => setBlueprintModel(e.target.value)}
									className="form-input"
									placeholder="optional"
								/>
							</label>
							<label className="form-label">
								Override Provider
								<select
									value={blueprintProvider}
									onChange={(e) => setBlueprintProvider(e.target.value as ProviderType | "")}
									className="form-select"
								>
									<option value="">default</option>
									{PROVIDERS.map((p) => (
										<option key={p} value={p}>
											{p}
										</option>
									))}
								</select>
							</label>
						</div>

						<div className="form-row">
							<label className="form-label form-grow">
								Commentator Model
								<input
									type="text"
									value={commentatorModel}
									onChange={(e) => setCommentatorModel(e.target.value)}
									className="form-input"
									placeholder="optional"
								/>
							</label>
							<label className="form-label">
								Override Provider
								<select
									value={commentatorProvider}
									onChange={(e) => setCommentatorProvider(e.target.value as ProviderType | "")}
									className="form-select"
								>
									<option value="">default</option>
									{PROVIDERS.map((p) => (
										<option key={p} value={p}>
											{p}
										</option>
									))}
								</select>
							</label>
						</div>
					</section>

					<section className="form-section">
						<h3 className="form-section-title">Brain Setup</h3>
						<label className="form-checkbox">
							<input
								type="checkbox"
								checked={autoSetup}
								onChange={(e) => setAutoSetup(e.target.checked)}
							/>
							Auto Setup (LLM decomposes prompt into neurons)
						</label>
					</section>

					<section className="form-section">
						<h3 className="form-section-title">Learning</h3>
						<div className="form-row">
							<label className="form-label form-grow">
								Max Observations
								<input
									type="number"
									value={maxObservations}
									onChange={(e) => setMaxObservations(e.target.value)}
									className="form-input"
									placeholder="e.g. 5"
								/>
							</label>
							<label className="form-label form-grow">
								Max Tokens
								<input
									type="number"
									value={maxTokens}
									onChange={(e) => setMaxTokens(e.target.value)}
									className="form-input"
									placeholder="optional"
								/>
							</label>
							<label className="form-label form-grow">
								Min Importance
								<input
									type="number"
									value={minImportance}
									onChange={(e) => setMinImportance(e.target.value)}
									className="form-input"
									placeholder="0-1"
									step="0.1"
								/>
							</label>
						</div>

						<div className="form-row">
							<label className="form-label form-grow">
								Governance Strategy
								<select
									value={govStrategy}
									onChange={(e) => setGovStrategy(e.target.value)}
									className="form-select"
								>
									<option value="">default</option>
									{GOVERNANCE_STRATEGIES.map((s) => (
										<option key={s} value={s}>
											{s}
										</option>
									))}
								</select>
							</label>
							<label className="form-label form-grow">
								Governance Max Tokens
								<input
									type="number"
									value={govMaxTokens}
									onChange={(e) => setGovMaxTokens(e.target.value)}
									className="form-input"
									placeholder="optional"
								/>
							</label>
						</div>
					</section>

					<section className="form-section">
						<h3 className="form-section-title">Evolution</h3>
						<label className="form-checkbox">
							<input
								type="checkbox"
								checked={evolutionEnabled}
								onChange={(e) => setEvolutionEnabled(e.target.checked)}
							/>
							Enable Evolution
						</label>

						{evolutionEnabled && (
							<>
								<label className="form-checkbox">
									<input
										type="checkbox"
										checked={autoEvaluate}
										onChange={(e) => setAutoEvaluate(e.target.checked)}
									/>
									Auto Evaluate
								</label>

								<div className="form-row">
									<label className="form-label form-grow">
										Evolution Model
										<input
											type="text"
											value={evolutionModel}
											onChange={(e) => setEvolutionModel(e.target.value)}
											className="form-input"
											placeholder="optional override"
										/>
									</label>
									<label className="form-label form-grow">
										Signal Threshold
										<input
											type="number"
											value={evalThreshold}
											onChange={(e) => setEvalThreshold(e.target.value)}
											className="form-input"
											placeholder="e.g. 3"
										/>
									</label>
								</div>
							</>
						)}
					</section>

					<section className="form-section">
						<h3 className="form-section-title">Ingestion</h3>
						<div className="form-row">
							<label className="form-label form-grow">
								Ingest Batch Size
								<input
									type="number"
									value={ingestBatchSize}
									onChange={(e) => setIngestBatchSize(e.target.value)}
									className="form-input"
									placeholder="optional"
								/>
							</label>
							<label className="form-label form-grow">
								App Batch Size
								<input
									type="number"
									value={appBatchSize}
									onChange={(e) => setAppBatchSize(e.target.value)}
									className="form-input"
									placeholder="optional"
								/>
							</label>
						</div>
					</section>

					<section className="form-section">
						<h3 className="form-section-title">Storage</h3>
						<label className="form-label">
							Storage Path
							<input
								type="text"
								value={storagePath}
								onChange={(e) => setStoragePath(e.target.value)}
								className="form-input"
								placeholder="e.g. storage (leave empty for in-memory)"
							/>
						</label>
					</section>

					<section className="form-section">
						<div className="form-section-header">
							<h3 className="form-section-title">Neurons</h3>
							<button type="button" className="form-btn-small" onClick={addNeuron}>
								+ Add Neuron
							</button>
						</div>

						{neurons.map((l, i) => (
							<div key={i} className="form-neuron">
								<div className="form-row">
									<label className="form-label form-grow">
										ID
										<input
											type="text"
											value={l.id}
											onChange={(e) => updateNeuron(i, "id", e.target.value)}
											className="form-input"
										/>
									</label>
									<label className="form-label form-grow">
										Name
										<input
											type="text"
											value={l.name}
											onChange={(e) => updateNeuron(i, "name", e.target.value)}
											className="form-input"
										/>
									</label>
									<label className="form-label">
										Type
										<select
											value={l.type}
											onChange={(e) => updateNeuron(i, "type", e.target.value)}
											className="form-select"
										>
											<option value="text">text</option>
											<option value="list">list</option>
										</select>
									</label>
									<button
										type="button"
										className="form-btn-remove"
										onClick={() => removeNeuron(i)}
									>
										&times;
									</button>
								</div>
								<label className="form-label">
									Description
									<input
										type="text"
										value={l.description}
										onChange={(e) => updateNeuron(i, "description", e.target.value)}
										className="form-input"
									/>
								</label>
								<label className="form-label">
									Instructions
									<textarea
										value={l.instructions}
										onChange={(e) => updateNeuron(i, "instructions", e.target.value)}
										className="form-textarea"
										rows={2}
									/>
								</label>
							</div>
						))}
					</section>

					</div>
					</details>

					<div className="dialog-actions">
						<button type="submit" className="form-btn-primary" disabled={saving}>
							{saving ? "Creating..." : "Create Version"}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}
