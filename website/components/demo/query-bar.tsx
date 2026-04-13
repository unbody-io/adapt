import { useState, useRef, useEffect, useCallback, type CSSProperties, type RefObject } from "react"
import Markdown from "react-markdown"
import type { Brain, BaseNeuron } from "@unbody/adapt"
import type { Neuron } from "../../lib/demo/types"

interface Source {
	id: string
	relevance?: number
	insight: string
}

interface NeuronResult {
	neuronId: string
	name: string
	text: string
	done: boolean
	error?: string
}

interface QueryResult {
	intent?: "ask" | "signal"
	status?: string
	insight?: string
	sources?: Source[]
	gaps?: string[]
	neuronResults?: NeuronResult[]
	error?: string
}

interface Props {
	neurons: Neuron[]
	disabled: boolean
	brainRef: RefObject<Brain | null>
	onActiveChange?: (active: boolean) => void
}

async function classifyIntent(query: string, neurons: Neuron[]): Promise<"ask" | "signal"> {
	try {
		const res = await fetch("/api/brain/classify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query, neurons: neurons.map((n) => ({ name: n.name, description: n.description })) }),
		})
		if (!res.ok) return "ask"
		const data = await res.json() as { intent: "ask" | "signal" }
		return data.intent
	} catch {
		return "ask"
	}
}

const s = {
	backdropBase: {
		position: "fixed",
		inset: 0,
		zIndex: 59,
		background: "rgba(255, 255, 255, 0.4)",
		backdropFilter: "blur(16px)",
		WebkitBackdropFilter: "blur(16px)",
		transition: "opacity 0.25s ease",
		pointerEvents: "none",
	} as CSSProperties,

	wrapper: {
		position: "fixed",
		bottom: "3.5rem",
		left: "50%",
		transform: "translateX(-50%)",
		zIndex: 60,
		width: 500,
		display: "flex",
		flexDirection: "column",
		gap: "0.5rem",
	} as CSSProperties,

	card: {
		background: "rgba(255, 255, 255, 0.15)",
		backdropFilter: "blur(32px)",
		WebkitBackdropFilter: "blur(32px)",
		borderRadius: 14,
		boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
		padding: "0.75rem 1.2rem",
		display: "flex",
		flexDirection: "column",
		gap: "0.5rem",
	} as CSSProperties,

	inputRow: {
		display: "flex",
		alignItems: "center",
		gap: "0.5rem",
	} as CSSProperties,

	input: {
		flex: 1,
		background: "none",
		border: "none",
		outline: "none",
		fontSize: "0.92rem",
		fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
		color: "#1a1a1f",
		padding: "0.4rem 0",
		letterSpacing: "-0.01em",
	} as CSSProperties,

	submitBtn: {
		background: "none",
		border: "none",
		cursor: "pointer",
		color: "#9b9ba8",
		fontSize: "0.9rem",
		padding: "4px 6px",
		lineHeight: 1,
		transition: "color 0.15s",
	} as CSSProperties,

	menuToggle: {
		background: "none",
		border: "none",
		cursor: "pointer",
		color: "#9b9ba8",
		fontSize: "0.72rem",
		padding: "4px 6px",
		lineHeight: 1,
		transition: "color 0.15s",
		fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
	} as CSSProperties,

	menu: {
		position: "absolute",
		bottom: "100%",
		left: 0,
		right: 0,
		marginBottom: 4,
		background: "rgba(255, 255, 255, 0.85)",
		backdropFilter: "blur(24px)",
		WebkitBackdropFilter: "blur(24px)",
		borderRadius: 10,
		boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
		padding: "0.35rem 0",
		maxHeight: 200,
		overflowY: "auto",
		scrollbarWidth: "none",
	} as CSSProperties,

	menuItem: {
		display: "flex",
		alignItems: "center",
		gap: "0.5rem",
		width: "100%",
		padding: "0.45rem 0.9rem",
		background: "none",
		border: "none",
		cursor: "pointer",
		fontSize: "0.75rem",
		color: "#6b6b78",
		textAlign: "left",
		transition: "background 0.1s",
		fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
	} as CSSProperties,

	menuCheck: {
		width: 14,
		fontSize: "0.65rem",
		color: "#1a1a1f",
	} as CSSProperties,

	resultsAnchor: {
		position: "fixed",
		top: 0,
		left: "50%",
		transform: "translateX(-50%)",
		width: 520,
		zIndex: 60,
		height: "100vh",
		overflowY: "auto",
		scrollbarWidth: "none",
		padding: "2rem 0 7rem",
		boxSizing: "border-box",
	} as CSSProperties,

	resultText: {
		fontSize: "0.92rem",
		color: "#6b6b78",
		fontFamily: '"Georgia", "Times New Roman", serif',
		lineHeight: 1.8,
	} as CSSProperties,

	label: {
		fontSize: "0.58rem",
		fontWeight: 500,
		textTransform: "uppercase",
		letterSpacing: "0.06em",
		color: "#9b9ba8",
		marginBottom: "0.25rem",
	} as CSSProperties,

	inlineStatus: {
		fontSize: "0.68rem",
		fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
		color: "#9b9ba8",
		padding: "0.25rem 0",
	} as CSSProperties,
}

function SourceCards({ sources }: { sources: Source[] }) {
	const [expandedId, setExpandedId] = useState<string | null>(null)

	return (
		<div style={{ marginTop: "0.75rem" }}>
			<div style={s.label}>sources ({sources.length})</div>
			<div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.3rem" }}>
				{sources.map((src) => {
					const isOpen = expandedId === src.id
					return (
						<div key={src.id}>
							<button
								type="button"
								onClick={() => setExpandedId(isOpen ? null : src.id)}
								style={{
									background: isOpen ? "rgba(26, 26, 31, 0.06)" : "rgba(26, 26, 31, 0.03)",
									border: "1px solid rgba(155, 155, 168, 0.15)",
									borderRadius: 6,
									padding: "0.3rem 0.55rem",
									cursor: "pointer",
									fontSize: "0.68rem",
									fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
									color: "#6b6b78",
									transition: "background 0.15s",
								}}
							>
								{src.id}
								{src.relevance != null && (
									<span style={{ opacity: 0.4, marginLeft: "0.35rem" }}>
										{Math.round(src.relevance * 100)}%
									</span>
								)}
							</button>
							{isOpen && (
								<div
									style={{
										marginTop: "0.3rem",
										padding: "0.5rem 0.6rem",
										background: "rgba(26, 26, 31, 0.03)",
										borderRadius: 8,
										border: "1px solid rgba(155, 155, 168, 0.1)",
										fontSize: "0.78rem",
										fontFamily: '"Georgia", "Times New Roman", serif',
										color: "#6b6b78",
										lineHeight: 1.7,
									}}
									className="query-markdown"
								>
									<Markdown>{src.insight}</Markdown>
								</div>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}

export function QueryBar({ neurons, disabled, brainRef, onActiveChange }: Props) {
	const [query, setQuery] = useState("")
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [deepSearch, setDeepSearch] = useState(false)
	const [focused, setFocused] = useState(false)
	const [loading, setLoading] = useState(false)
	const [result, setResult] = useState<QueryResult | null>(null)
	const [menuOpen, setMenuOpen] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	const abortRef = useRef<AbortController | null>(null)

	const searchOpen = result?.intent === "ask"

	const closeSearch = useCallback(() => {
		setResult(null)
		setMenuOpen(false)
		abortRef.current?.abort()
		onActiveChange?.(false)
	}, [onActiveChange])

	useEffect(() => {
		if (searchOpen) onActiveChange?.(true)
	}, [searchOpen, onActiveChange])

	useEffect(() => {
		if (!searchOpen) return
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSearch() }
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [searchOpen, closeSearch])

	const toggleNeuron = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const submit = async () => {
		const q = query.trim()
		if (!q || loading || disabled) return

		const brain = brainRef.current
		if (!brain) return

		abortRef.current?.abort()
		const abort = new AbortController()
		abortRef.current = abort

		setLoading(true)
		setResult({ status: "Classifying..." })

		try {
			const intent = await classifyIntent(q, neurons)
			if (abort.signal.aborted) return

			if (intent === "signal") {
				brain.signal({ source: "user:query-bar", description: q, bypass: true })
				setQuery("")
				setResult(null)
				return
			}

			// Ask: open overlay
			setResult({ intent: "ask", status: "Thinking..." })
			const mode = deepSearch ? "deep" : "direct"

			if (selectedIds.size > 0) {
				const selectedNeurons = Array.from(selectedIds)
					.map((id) => brain.getNeuron(id))
					.filter((n): n is BaseNeuron<unknown> => n != null)

				setResult((prev) => ({
					...prev,
					status: undefined,
					neuronResults: selectedNeurons.map((n) => ({
						neuronId: n.id,
						name: neurons.find((x) => x.id === n.id)?.name ?? n.id,
						text: "",
						done: false,
					})),
				}))

				await Promise.all(
					selectedNeurons.map(async (neuron) => {
						try {
							const stream = await neuron.queryStream(q)
							for await (const chunk of stream.textStream) {
								if (abort.signal.aborted) return
								setResult((prev) => ({
									...prev,
									neuronResults: prev?.neuronResults?.map((r) =>
										r.neuronId === neuron.id ? { ...r, text: r.text + chunk } : r
									),
								}))
							}
							setResult((prev) => ({
								...prev,
								neuronResults: prev?.neuronResults?.map((r) =>
									r.neuronId === neuron.id ? { ...r, done: true } : r
								),
							}))
						} catch (err) {
							if (abort.signal.aborted) return
							setResult((prev) => ({
								...prev,
								neuronResults: prev?.neuronResults?.map((r) =>
									r.neuronId === neuron.id
										? { ...r, done: true, error: err instanceof Error ? err.message : "Failed" }
										: r
								),
							}))
						}
					})
				)
			} else {
				const streamResult = await brain.askStream(q, { mode })

				let accumulated = ""
				for await (const chunk of streamResult.textStream) {
					if (abort.signal.aborted) break
					accumulated += chunk
					setResult((prev) => ({ ...prev, insight: accumulated, status: undefined }))
				}

				const final = await streamResult.response
				const sources = (final as Record<string, unknown>).sources as Source[] | undefined

				setResult((prev) => ({
					...prev,
					insight: accumulated,
					sources: sources ?? [],
					status: undefined,
				}))
			}
		} catch (err) {
			if (!abort.signal.aborted) {
				setResult({ intent: "ask", error: err instanceof Error ? err.message : "Unknown error" })
			}
		} finally {
			setLoading(false)
		}
	}

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			submit()
		}
	}

	return (
		<>
			<div
				style={{
					...s.backdropBase,
					opacity: searchOpen ? 1 : 0,
					pointerEvents: searchOpen ? "auto" : "none",
				}}
				onClick={closeSearch}
			/>

			{searchOpen && result && (
				<div style={s.resultsAnchor}>
					{result.status && (
						<div style={{ ...s.resultText, color: "#9b9ba8", marginBottom: "0.5rem" }}>
							{result.status}
						</div>
					)}

					{result.insight && (
						<div>
							<div style={s.resultText} className="query-markdown">
								<Markdown>{result.insight}</Markdown>
							</div>
							{result.sources && result.sources.length > 0 && (
								<SourceCards sources={result.sources} />
							)}
							{result.gaps && result.gaps.length > 0 && (
								<div style={{ ...s.resultText, marginTop: "0.5rem", fontSize: "0.72rem", opacity: 0.4 }}>
									gaps: {result.gaps.join(", ")}
								</div>
							)}
						</div>
					)}

					{result.neuronResults && result.neuronResults.length > 0 && (
						<div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
							{result.neuronResults.map((r) => (
								<div
									key={r.neuronId}
									style={{ borderLeft: "2px solid rgba(155, 155, 168, 0.2)", paddingLeft: "0.75rem" }}
								>
									<div style={{ ...s.label, marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
										<span>{r.name}</span>
										{!r.done && <span style={{ opacity: 0.5, fontSize: "0.5rem" }}>streaming...</span>}
									</div>
									{r.error ? (
										<div style={{ ...s.resultText, color: "#d94848", fontSize: "0.82rem" }}>{r.error}</div>
									) : (
										<div style={s.resultText} className="query-markdown">
											<Markdown>{r.text}</Markdown>
										</div>
									)}
								</div>
							))}
						</div>
					)}

					{result.error && (
						<div style={{ ...s.resultText, color: "#d94848" }}>{result.error}</div>
					)}
				</div>
			)}

			<div style={s.wrapper}>
				<div
					style={{ ...s.card, position: "relative" }}
					onBlur={(e) => {
						if (!e.currentTarget.contains(e.relatedTarget as Node)) {
							setFocused(false)
							setMenuOpen(false)
						}
					}}
				>
					{menuOpen && neurons.length > 0 && (
						<div style={s.menu}>
							{neurons.map((n) => {
								const on = selectedIds.has(n.id)
								return (
									<button key={n.id} type="button" style={s.menuItem} onClick={() => toggleNeuron(n.id)}>
										<span style={s.menuCheck}>{on ? "✓" : ""}</span>
										<span>{n.name}</span>
									</button>
								)
							})}
						</div>
					)}

					<div style={s.inputRow}>
						<input
							ref={inputRef}
							type="text"
							value={query}
							placeholder="ask the brain something..."
							style={s.input}
							onFocus={() => setFocused(true)}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={onKeyDown}
						/>
						{focused && (
							<button
								type="button"
								style={{ ...s.menuToggle, color: deepSearch ? "#1a1a1f" : "#9b9ba8" }}
								onClick={() => setDeepSearch((v) => !v)}
								title={deepSearch ? "Deep search (agentic)" : "Direct search (fast)"}
							>
								{deepSearch ? "deep" : "fast"}
							</button>
						)}
						{focused && neurons.length > 0 && (
							<button
								type="button"
								style={{ ...s.menuToggle, color: selectedIds.size > 0 ? "#1a1a1f" : "#9b9ba8" }}
								onClick={() => setMenuOpen((v) => !v)}
							>
								{selectedIds.size > 0 ? `${selectedIds.size}↕` : "↕"}
							</button>
						)}
						{focused && (
							<button
								type="button"
								style={{ ...s.submitBtn, opacity: loading ? 0.4 : 1, cursor: loading ? "default" : "pointer" }}
								onClick={submit}
								disabled={loading}
							>
								↵
							</button>
						)}
					</div>

					{result && !result.intent && result.status && (
						<div style={s.inlineStatus}>{result.status}</div>
					)}
				</div>
			</div>
		</>
	)
}
