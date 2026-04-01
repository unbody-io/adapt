import { useEffect, useState, useCallback, useRef } from "react"
import type { UseCase, VersionDetail, BrainConfig } from "../types"
import { CreateVersionDialog } from "./CreateVersionDialog"

interface Props {
	onSelect: (id: string, version: string) => void
}

function resolveModelLabel(v: VersionDetail): string | null {
	if (!v.model) return null
	if (typeof v.model === "string") return v.model
	return v.model.model
}

function timeAgo(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime()
	const mins = Math.floor(diff / 60000)
	if (mins < 1) return "just now"
	if (mins < 60) return `${mins}m ago`
	const hrs = Math.floor(mins / 60)
	if (hrs < 24) return `${hrs}h ago`
	const days = Math.floor(hrs / 24)
	return `${days}d ago`
}

function randomName(): string {
	const adjectives = ["swift", "bright", "calm", "deep", "sharp", "warm", "bold", "lean", "fresh", "keen"]
	const nouns = ["spark", "wave", "drift", "pulse", "bloom", "glow", "edge", "flux", "core", "arc"]
	const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
	const noun = nouns[Math.floor(Math.random() * nouns.length)]
	return `${adj}-${noun}`
}

interface InlineCreate {
	useCaseId: string
	prompt: string
	saving: boolean
}

export function Landing({ onSelect }: Props) {
	const [usecases, setUsecases] = useState<UseCase[]>([])
	const [loading, setLoading] = useState(true)
	const [dialogFor, setDialogFor] = useState<{ useCaseId: string; baseConfig?: BrainConfig } | null>(null)
	const [inline, setInline] = useState<InlineCreate | null>(null)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const addBtnRef = useRef<HTMLButtonElement>(null)
	const [inlinePos, setInlinePos] = useState<{ top: number; left: number; width: number } | null>(null)

	const fetchUsecases = useCallback(() => {
		fetch("/api/usecases")
			.then((r) => r.json())
			.then((data) => {
				setUsecases(data)
				setLoading(false)
			})
			.catch(() => setLoading(false))
	}, [])

	useEffect(() => {
		fetchUsecases()
	}, [fetchUsecases])

	useEffect(() => {
		if (inline && textareaRef.current) {
			textareaRef.current.focus()
		}
	}, [inline])

	function openInline(useCaseId: string, btnEl: HTMLButtonElement) {
		const rect = btnEl.getBoundingClientRect()
		setInlinePos({ top: rect.top, left: rect.left, width: rect.width })
		setInline({ useCaseId, prompt: "", saving: false })
	}

	function closeInline() {
		setInline(null)
		setInlinePos(null)
	}

	async function submitInline() {
		if (!inline || !inline.prompt.trim() || inline.saving) return
		setInline({ ...inline, saving: true })

		const config: BrainConfig = { prompt: inline.prompt.trim() }
		const name = randomName()

		try {
			const useCaseId = inline.useCaseId
			const res = await fetch(`/api/usecases/${useCaseId}/versions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, config }),
			})
			if (res.ok) {
				closeInline()
				onSelect(useCaseId, name)
			}
		} catch {
			setInline({ ...inline, saving: false })
		}
	}

	function openAdvancedDialog() {
		if (!inline) return
		const uc = usecases.find((u) => u.id === inline.useCaseId)
		if (!uc) return

		const defaultVersion = uc.versions.includes("default") ? "default" : uc.versions[0]
		fetch(`/api/usecases/${uc.id}?version=${defaultVersion}`)
			.then((r) => r.json())
			.then((detail) => {
				const { prompt, provider, model, blueprintModel, commentatorModel, autoSetup, neurons, learning, evolution, ingest, appBatchSize, storage } = detail
				const currentPrompt = inline?.prompt
				closeInline()
				setDialogFor({
					useCaseId: uc.id,
					baseConfig: { prompt: currentPrompt || prompt, provider, model, blueprintModel, commentatorModel, autoSetup, neurons, learning, evolution, ingest, appBatchSize, storage },
				})
			})
	}

	const isInlineActive = inline !== null

	return (
		<div className="landing">
			<div className={`landing-content ${isInlineActive ? "landing-content--blurred" : ""}`}>
				<div className="landing-header">
					<h1>Brain Playground</h1>
					<p>Watch an AI system learn, think, and evolve in real time.</p>
				</div>

				<div className="usecase-grid">
					{loading && <div className="loading">Loading use cases...</div>}
					{usecases.map((uc) => (
						<div key={uc.id} className="usecase-repo">
							<div className="usecase-meta">
								<h2>{uc.title}</h2>
								<p>{uc.description}</p>
								<div className="usecase-meta-stats">
									<span>{uc.itemCount} item{uc.itemCount !== 1 ? "s" : ""}</span>
									<span>{uc.versions.length} version{uc.versions.length !== 1 ? "s" : ""}</span>
								</div>
							</div>

							<div className="usecase-branches">
								{uc.versionDetails.map((v) => {
									const modelLabel = resolveModelLabel(v)

									return (
										<button
											key={v.name}
											type="button"
											className="version-card"
											onClick={() => onSelect(uc.id, v.name)}
										>
											<div className="version-info">
												<span className="version-name">{v.name}</span>
												<div className="version-detail">
													<span className="version-badge">{v.provider}</span>
													{modelLabel && <span>{modelLabel}</span>}
													{v.inited && v.lastInited && (
														<span className="version-badge" style={{ color: "var(--success)" }}>
															inited {timeAgo(v.lastInited)}
														</span>
													)}
												</div>
											</div>
										</button>
									)
								})}

								<button
									ref={inline?.useCaseId === uc.id ? undefined : addBtnRef}
									type="button"
									className="version-add"
									onClick={(e) => openInline(uc.id, e.currentTarget)}
								>
									+ new
								</button>
							</div>
						</div>
					))}
					{!loading && usecases.length === 0 && (
						<div className="empty">
							No use cases found. Add them to{" "}
							<code>playground/usecases/</code>
						</div>
					)}
				</div>
			</div>

			{isInlineActive && (
				<>
					<div className="inline-backdrop" onClick={closeInline} />
					<div
						className="inline-create"
						style={inlinePos ? { top: inlinePos.top, left: inlinePos.left, width: Math.max(inlinePos.width, 400) } : undefined}
					>
						<textarea
							ref={textareaRef}
							className="inline-create-input"
							value={inline.prompt}
							onChange={(e) => setInline({ ...inline, prompt: e.target.value })}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault()
									submitInline()
								}
								if (e.key === "Escape") closeInline()
							}}
							placeholder="Describe what you want..."
							rows={3}
							disabled={inline.saving}
						/>
						<div className="inline-create-actions">
							<button
								type="button"
								className="inline-create-advanced"
								onClick={openAdvancedDialog}
							>
								Advanced
							</button>
							{inline.prompt.trim() && (
								<span className="inline-create-hint">
									{inline.saving ? "Creating..." : "\u23CE to create"}
								</span>
							)}
						</div>
					</div>
				</>
			)}

			{dialogFor && (
				<CreateVersionDialog
					useCaseId={dialogFor.useCaseId}
					baseConfig={dialogFor.baseConfig}
					onClose={() => setDialogFor(null)}
					onCreated={() => {
						setDialogFor(null)
						fetchUsecases()
					}}
				/>
			)}
		</div>
	)
}
