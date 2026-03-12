import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react"
import Markdown from "react-markdown"
import type { Learner } from "../types"

interface Source {
	id: string
	relevance?: number
	confidence?: number
	insight: string
}

interface Activity {
	action: string
	specialistId?: string
	question?: string
	insight?: string
	toolName?: string
	relevant?: boolean
}

interface LearnerResult {
	learnerId: string
	name: string
	text: string
	done: boolean
	error?: string
}

interface QueryResult {
	intent?: "ask" | "signal"
	reasoning?: string
	status?: string
	insight?: string
	sources?: Source[]
	gaps?: string[]
	signalMessage?: string
	error?: string
	thinkingText?: string
	activities?: Activity[]
	learnerResults?: LearnerResult[]
}

interface Props {
	learners: Learner[]
	disabled: boolean
	onActiveChange?: (active: boolean) => void
	askLearnerId?: string | null
	onAskLearnerHandled?: () => void
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

function ThinkingSection({
	text,
	activities,
	collapsed: initialCollapsed,
}: {
	text?: string
	activities?: Activity[]
	collapsed: boolean
}) {
	const [collapsed, setCollapsed] = useState(false)

	useEffect(() => {
		if (initialCollapsed) setCollapsed(true)
	}, [initialCollapsed])

	const latestActivity = activities?.length ? activities[activities.length - 1] : null

	const headerLabel = (() => {
		if (initialCollapsed) return "reasoning"
		if (latestActivity?.action === "querying-specialist")
			return `asking ${latestActivity.specialistId}...`
		if (latestActivity?.action === "specialist-responded")
			return `${latestActivity.specialistId} responded`
		if (latestActivity?.action === "consulting")
			return `consulting ${latestActivity.toolName}...`
		if (text) return "thinking..."
		return "starting..."
	})()

	return (
		<div style={{ marginBottom: "0.75rem" }}>
			<button
				type="button"
				onClick={() => setCollapsed((v) => !v)}
				style={{
					...s.label,
					background: "none",
					border: "none",
					cursor: "pointer",
					padding: 0,
					display: "flex",
					alignItems: "center",
					gap: "0.35rem",
				}}
			>
				<span style={{ fontSize: "0.5rem", opacity: 0.6 }}>{collapsed ? "+" : "-"}</span>
				<span>{headerLabel}</span>
			</button>

			{!collapsed && (
				<div
					style={{
						marginTop: "0.35rem",
						paddingLeft: "0.5rem",
						borderLeft: "1px solid rgba(155, 155, 168, 0.2)",
					}}
				>
					{text && (
						<div
							style={{
								fontSize: "0.78rem",
								fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
								color: "#9b9ba8",
								lineHeight: 1.6,
								whiteSpace: "pre-wrap",
								wordBreak: "break-word",
							}}
						>
							{text}
						</div>
					)}

					{activities?.map((act, i) => (
						<div
							key={i}
							style={{
								fontSize: "0.7rem",
								fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
								color:
									act.action === "specialist-responded" && act.relevant
										? "#4a9a6b"
										: act.action === "specialist-responded"
											? "#b8935a"
											: "#7a7a8a",
								marginTop: "0.25rem",
								display: "flex",
								alignItems: "baseline",
								gap: "0.4rem",
							}}
						>
							<span style={{ opacity: 0.5 }}>
								{act.action === "querying-specialist"
									? ">"
									: act.action === "specialist-responded"
										? act.relevant
											? "+"
											: "-"
										: "*"}
							</span>
							<span>
								{act.action === "querying-specialist" &&
									`ask ${act.specialistId}: ${act.question}`}
								{act.action === "specialist-responded" &&
									(act.relevant
										? `${act.specialistId} responded`
										: `${act.specialistId}: not relevant`)}
								{act.action === "consulting" && `consult ${act.toolName}`}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export function QueryBar({ learners, disabled, onActiveChange, askLearnerId, onAskLearnerHandled }: Props) {
	const [query, setQuery] = useState("")
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [deepSearch, setDeepSearch] = useState(false)
	const [focused, setFocused] = useState(false)
	const [loading, setLoading] = useState(false)
	const [result, setResult] = useState<QueryResult | null>(null)
	const [menuOpen, setMenuOpen] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	const abortRef = useRef<AbortController | null>(null)

	// When a learner "Ask" button is clicked, select it and focus input
	useEffect(() => {
		if (!askLearnerId) return
		setSelectedIds(new Set([askLearnerId]))
		setFocused(true)
		setQuery("")
		setResult(null)
		inputRef.current?.focus()
		onAskLearnerHandled?.()
	}, [askLearnerId, onAskLearnerHandled])

	// Search overlay is open only when we have an ask result
	const searchOpen = !!(result && result.intent === "ask")

	const closeSearch = useCallback(() => {
		setResult(null)
		setMenuOpen(false)
		abortRef.current?.abort()
		onActiveChange?.(false)
	}, [onActiveChange])

	// Notify parent about canvas dimming
	useEffect(() => {
		if (searchOpen) onActiveChange?.(true)
	}, [searchOpen, onActiveChange])

	// Escape closes search overlay
	useEffect(() => {
		if (!searchOpen) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeSearch()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [searchOpen, closeSearch])

	const toggleLearner = (id: string) => {
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

		abortRef.current?.abort()
		const abort = new AbortController()
		abortRef.current = abort

		setLoading(true)
		// Show classifying status inline (no backdrop yet)
		setResult({ status: "Classifying..." })

		try {
			const learnerIds = selectedIds.size > 0 ? Array.from(selectedIds) : undefined
			const mode = deepSearch ? "deep" : "direct"
			const res = await fetch("/api/brain/query", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: q, mode, learnerIds }),
				signal: abort.signal,
			})

			if (!res.ok) {
				const err = await res.json()
				throw new Error(err.error || "Query failed")
			}

			const reader = res.body!.getReader()
			const decoder = new TextDecoder()
			let buffer = ""
			let currentEvent = ""

			const handlePayload = (payload: Record<string, unknown>) => {
				switch (payload.type) {
					case "status":
						setResult((prev) => ({ ...prev, status: payload.message as string }))
						break
					case "classified":
						if (payload.intent === "signal") {
							// Signal: clear input, drop result, let it run silently
							setQuery("")
							setMenuOpen(false)
							setResult(null)
						} else {
							// Ask: now open the search overlay
							setResult((prev) => ({
								...prev,
								intent: "ask",
								reasoning: payload.reasoning as string,
								status: undefined,
							}))
						}
						break
					case "reasoning":
						setResult((prev) => ({
							...prev,
							thinkingText: (prev?.thinkingText ?? "") + (payload.text as string),
							status: undefined,
						}))
						break
					case "activity":
						setResult((prev) => ({
							...prev,
							activities: [...(prev?.activities ?? []), payload as unknown as Activity],
							status: undefined,
						}))
						break
					case "answer-delta":
						setResult((prev) => ({
							...prev,
							insight: (prev?.insight ?? "") + (payload.text as string),
							status: undefined,
						}))
						break
					case "answer": {
						const rawSources = payload.sources as
							| Array<Record<string, unknown>>
							| undefined
						const sources = rawSources?.map((src) => ({
							id: (src.id ?? src.learnerId ?? "") as string,
							insight: (src.insight ?? "") as string,
							relevance: src.relevance as number | undefined,
							confidence: src.confidence as number | undefined,
						}))
						setResult((prev) => ({
							...prev,
							insight: payload.insight as string,
							sources: sources ?? prev?.sources,
							gaps: payload.gaps as string[],
							status: undefined,
						}))
						break
					}
					case "signal-ack":
						// Signal already handled — ignore
						break
					case "learner-start":
						setResult((prev) => ({
							...prev,
							status: undefined,
							learnerResults: [
								...(prev?.learnerResults ?? []),
								{ learnerId: payload.learnerId as string, name: payload.name as string, text: "", done: false },
							],
						}))
						break
					case "learner-delta":
						setResult((prev) => ({
							...prev,
							learnerResults: (prev?.learnerResults ?? []).map((lr) =>
								lr.learnerId === payload.learnerId
									? { ...lr, text: lr.text + (payload.text as string) }
									: lr,
							),
						}))
						break
					case "learner-done":
						setResult((prev) => ({
							...prev,
							learnerResults: (prev?.learnerResults ?? []).map((lr) =>
								lr.learnerId === payload.learnerId
									? { ...lr, done: true }
									: lr,
							),
						}))
						break
					case "learner-error":
						setResult((prev) => ({
							...prev,
							learnerResults: (prev?.learnerResults ?? []).map((lr) =>
								lr.learnerId === payload.learnerId
									? { ...lr, done: true, error: payload.message as string }
									: lr,
							),
						}))
						break
					case "error":
						setResult((prev) => ({
							...prev,
							error: payload.message as string,
							status: undefined,
						}))
						break
				}
			}

			while (true) {
				const { done, value } = await reader.read()
				if (done) break

				buffer += decoder.decode(value, { stream: true })
				const lines = buffer.split("\n")
				buffer = lines.pop() || ""

				for (const line of lines) {
					const trimmed = line.trim()
					if (!trimmed) {
						currentEvent = ""
						continue
					}
					if (trimmed.startsWith("event:")) {
						currentEvent = trimmed.slice(6).trim()
					} else if (trimmed.startsWith("data:") && currentEvent === "query") {
						try {
							handlePayload(JSON.parse(trimmed.slice(5).trim()))
						} catch {
							// malformed JSON, skip
						}
					}
				}
			}
		} catch (err) {
			if ((err as Error).name !== "AbortError") {
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

			{/* Results overlay — only for ask queries */}
			{searchOpen && result && (
				<div style={s.resultsAnchor}>
					{result.status && (
						<div style={{ ...s.resultText, color: "#9b9ba8", marginBottom: "0.5rem" }}>
							{result.status}
						</div>
					)}

					{(result.thinkingText || result.activities?.length) && (
						<ThinkingSection
							text={result.thinkingText}
							activities={result.activities}
							collapsed={!!result.insight}
						/>
					)}

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

					{result.learnerResults && result.learnerResults.length > 0 && (
						<div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
							{result.learnerResults.map((lr) => (
								<div
									key={lr.learnerId}
									style={{
										borderLeft: "2px solid rgba(155, 155, 168, 0.2)",
										paddingLeft: "0.75rem",
									}}
								>
									<div style={{
										...s.label,
										marginBottom: "0.35rem",
										display: "flex",
										alignItems: "center",
										gap: "0.4rem",
									}}>
										<span>{lr.name}</span>
										{!lr.done && (
											<span style={{ opacity: 0.5, fontSize: "0.5rem" }}>streaming...</span>
										)}
									</div>
									{lr.error ? (
										<div style={{ ...s.resultText, color: "#d94848", fontSize: "0.82rem" }}>
											{lr.error}
										</div>
									) : (
										<div style={s.resultText} className="query-markdown"><Markdown>{lr.text}</Markdown></div>
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

			{/* Search bar */}
			<div style={s.wrapper}>
				<div
					style={{ ...s.card, position: "relative" }}
					onBlur={(e) => {
						// Only unfocus if focus moved outside the entire card
						if (!e.currentTarget.contains(e.relatedTarget as Node)) {
							setFocused(false)
							setMenuOpen(false)
						}
					}}
				>
					{/* Learner selection menu */}
					{menuOpen && learners.length > 0 && (
						<div style={s.menu}>
							{learners.map((l) => {
								const on = selectedIds.has(l.id)
								return (
									<button
										key={l.id}
										type="button"
										style={s.menuItem}
										onClick={() => toggleLearner(l.id)}
									>
										<span style={s.menuCheck}>{on ? "✓" : ""}</span>
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
						{focused && learners.length > 0 && (
							<button
								type="button"
								style={{
									...s.menuToggle,
									color: selectedIds.size > 0 ? "#1a1a1f" : "#9b9ba8",
								}}
								onClick={() => setMenuOpen((v) => !v)}
							>
								{selectedIds.size > 0 ? `${selectedIds.size}↕` : "↕"}
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
								↵
							</button>
						)}
					</div>

					{/* Inline classifying status — shown before intent is known */}
					{result && !result.intent && result.status && (
						<div style={s.inlineStatus}>{result.status}</div>
					)}
				</div>
			</div>
		</>
	)
}
