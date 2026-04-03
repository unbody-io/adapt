import { useState, useRef, useEffect, useCallback, type CSSProperties, type RefObject } from "react"
import Markdown from "react-markdown"
import type { Brain } from "@unbody/adapt"
import type { Neuron } from "../../lib/demo/types"

interface Source {
	id: string
	relevance?: number
	confidence?: number
	insight: string
}

interface QueryResult {
	insight?: string
	sources?: Source[]
	gaps?: string[]
	error?: string
	status?: string
}

interface Props {
	neurons: Neuron[]
	disabled: boolean
	brainRef: RefObject<Brain | null>
	onActiveChange?: (active: boolean) => void
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
		bottom: "1.5rem",
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
									background: isOpen
										? "rgba(26, 26, 31, 0.06)"
										: "rgba(26, 26, 31, 0.03)",
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
	const abortRef = useRef(false)

	const searchOpen = !!(result && result.insight)

	const closeSearch = useCallback(() => {
		setResult(null)
		setMenuOpen(false)
		abortRef.current = true
		onActiveChange?.(false)
	}, [onActiveChange])

	useEffect(() => {
		if (searchOpen) onActiveChange?.(true)
	}, [searchOpen, onActiveChange])

	useEffect(() => {
		if (!searchOpen) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeSearch()
		}
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

		abortRef.current = false
		setLoading(true)
		setResult({ status: "Thinking..." })

		try {
			const mode = deepSearch ? "deep" : "direct"
			const streamResult = await brain.askStream(q, { mode })

			let accumulated = ""
			for await (const chunk of streamResult.textStream) {
				if (abortRef.current) break
				accumulated += chunk
				setResult({ insight: accumulated })
			}

			// Get final result for sources
			const final = await streamResult.response
			const sources = (final as Record<string, unknown>).sources as Source[] | undefined

			setResult((prev) => ({
				...prev,
				insight: accumulated,
				sources: sources ?? [],
			}))
		} catch (err) {
			if (!abortRef.current) {
				setResult({
					error: err instanceof Error ? err.message : "Unknown error",
				})
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
			{/* Backdrop — only when search results are showing */}
			<div
				style={{
					...s.backdropBase,
					opacity: searchOpen ? 1 : 0,
					pointerEvents: searchOpen ? "auto" : "none",
				}}
				onClick={closeSearch}
			/>

			{/* Results overlay */}
			{searchOpen && result && (
				<div style={s.resultsAnchor}>
					{result.insight && (
						<div>
							<div style={s.resultText} className="query-markdown"><Markdown>{result.insight}</Markdown></div>
							{result.sources && result.sources.length > 0 && (
								<SourceCards sources={result.sources} />
							)}
							{result.gaps && result.gaps.length > 0 && (
								<div
									style={{
										...s.resultText,
										marginTop: "0.5rem",
										fontSize: "0.72rem",
										opacity: 0.4,
									}}
								>
									gaps: {result.gaps.join(", ")}
								</div>
							)}
						</div>
					)}

					{result.error && (
						<div style={{ ...s.resultText, color: "#d94848" }}>{result.error}</div>
					)}
				</div>
			)}

			{/* Search bar */}
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
					{/* Neuron selection menu */}
					{menuOpen && neurons.length > 0 && (
						<div style={s.menu}>
							{neurons.map((l) => {
								const on = selectedIds.has(l.id)
								return (
									<button
										key={l.id}
										type="button"
										style={s.menuItem}
										onClick={() => toggleNeuron(l.id)}
									>
										<span style={s.menuCheck}>{on ? "\u2713" : ""}</span>
										<span>{l.name}</span>
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
								style={{
									...s.menuToggle,
									color: deepSearch ? "#1a1a1f" : "#9b9ba8",
								}}
								onClick={() => setDeepSearch((v) => !v)}
								title={deepSearch ? "Deep search (agentic)" : "Direct search (fast)"}
							>
								{deepSearch ? "deep" : "fast"}
							</button>
						)}
						{focused && neurons.length > 0 && (
							<button
								type="button"
								style={{
									...s.menuToggle,
									color: selectedIds.size > 0 ? "#1a1a1f" : "#9b9ba8",
								}}
								onClick={() => setMenuOpen((v) => !v)}
							>
								{selectedIds.size > 0 ? `${selectedIds.size}\u2195` : "\u2195"}
							</button>
						)}
						{focused && (
							<button
								type="button"
								style={{
									...s.submitBtn,
									opacity: loading ? 0.4 : 1,
									cursor: loading ? "default" : "pointer",
								}}
								onClick={submit}
								disabled={loading}
							>
								\u21B5
							</button>
						)}
					</div>

					{/* Inline status */}
					{result && !result.insight && result.status && (
						<div style={{
							fontSize: "0.68rem",
							fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
							color: "#9b9ba8",
							padding: "0.25rem 0",
						}}>
							{result.status}
						</div>
					)}
				</div>
			</div>
		</>
	)
}
