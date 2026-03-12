import { useState, useEffect, useRef, type CSSProperties } from "react"
import type { DataSource, DataItem, InjectionProgress } from "../types"

interface Props {
	dataSources: DataSource[]
	injectedIds: Set<string>
	injectionProgress: InjectionProgress | null
	onInject: (items: DataItem[]) => void
	disabled: boolean
	onActiveBatchY?: (y: number | null) => void
}

/** "standup-2026-01-22" → "Wed, Jan 22" */
function formatSourceDate(source: string): { day: string; weekday: string } {
	const match = source.match(/(\d{4}-\d{2}-\d{2})/)
	if (!match) return { day: source, weekday: "" }
	const date = new Date(`${match[1]}T12:00:00`)
	const weekday = date.toLocaleDateString("en-US", { weekday: "short" })
	const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
	return { day, weekday }
}

/** Extract just the summary paragraph from Gemini's notes blob */
function extractSummary(description: string): string {
	const summaryIdx = description.indexOf("Summary\n")
	const detailsIdx = description.indexOf("Details\n")
	if (summaryIdx >= 0 && detailsIdx > summaryIdx) {
		return description.slice(summaryIdx + "Summary\n".length, detailsIdx).trim()
	}
	return description.slice(0, 200)
}

// ─── Styles ────────────────────────────────────────────────────

const styles = {
	deck: {
		display: "flex",
		flexDirection: "column",
		height: "100%",
	} as CSSProperties,

	header: {
		display: "flex",
		alignItems: "center",
		gap: "0.75rem",
		padding: "1.5rem 1.5rem 1.25rem",
	} as CSSProperties,

	counter: {
		fontSize: "0.72rem",
		color: "#9b9ba8",
		whiteSpace: "nowrap",
		fontVariantNumeric: "tabular-nums",
	} as CSSProperties,

	progressTrack: {
		flex: 1,
		height: 1,
		background: "rgba(0,0,0,0.06)",
		overflow: "hidden",
	} as CSSProperties,

	progressFill: {
		height: "100%",
		background: "#555560",
		transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
	} as CSSProperties,

	injectBtn: {
		margin: "0 1.5rem 1rem",
		padding: "0.55rem",
		border: "none",
		borderRadius: 10,
		background: "rgba(0,0,0,0.04)",
		color: "#6b6b78",
		fontSize: "0.78rem",
		fontWeight: 500,
		cursor: "pointer",
	} as CSSProperties,

	list: {
		flex: 1,
		overflowY: "auto",
		display: "flex",
		flexDirection: "column",
		scrollbarWidth: "none",
		scrollBehavior: "smooth",
	} as CSSProperties,

	card: {
		padding: "0.9rem 1.5rem",
		display: "flex",
		flexDirection: "column",
		gap: "0.4rem",
		cursor: "pointer",
		background: "rgba(255,255,255,0.45)",
		backdropFilter: "blur(12px)",
		WebkitBackdropFilter: "blur(12px)",
		borderRadius: 10,
		margin: "0 1rem 0.5rem",
		boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
		transition: "all 0.3s ease",
	} as CSSProperties,

	cardCollapsed: {
		maxHeight: 0,
		opacity: 0,
		overflow: "hidden",
		padding: "0 1.5rem",
		margin: "0 1rem",
		boxShadow: "none",
	} as CSSProperties,

	cardDisabled: {
		cursor: "default",
		opacity: 0.45,
	} as CSSProperties,

	dateRow: {
		display: "flex",
		alignItems: "baseline",
		gap: "0.4rem",
	} as CSSProperties,

	weekday: {
		fontSize: "0.65rem",
		fontWeight: 500,
		textTransform: "uppercase",
		letterSpacing: "0.06em",
		color: "#9b9ba8",
	} as CSSProperties,

	day: {
		fontSize: "0.85rem",
		fontWeight: 500,
		color: "#1a1a1f",
	} as CSSProperties,

	summary: {
		fontSize: "0.75rem",
		color: "#6b6b78",
		lineHeight: 1.55,
		margin: 0,
		display: "-webkit-box",
		WebkitLineClamp: 2,
		WebkitBoxOrient: "vertical" as const,
		overflow: "hidden",
	} as CSSProperties,

	meta: {
		fontSize: "0.65rem",
		color: "#6b6b78",
		opacity: 0.5,
		fontVariantNumeric: "tabular-nums",
	} as CSSProperties,

	done: {
		position: "absolute",
		top: "50%",
		right: "1.5rem",
		transform: "translateY(-50%)",
		width: 6,
		height: 6,
		borderRadius: "50%",
		background: "#3ba55c",
		opacity: 0.6,
	} as CSSProperties,

	spinner: {
		width: 10,
		height: 10,
		borderRadius: "50%",
		border: "1.5px solid rgba(0,0,0,0.1)",
		borderTopColor: "#6b6b78",
		animation: "spin 0.6s linear infinite",
	} as CSSProperties,

	// ─── Ticker batch view ─────────────────────────────────────

	tickerOuter: {
		flex: 1,
		position: "relative",
		overflow: "hidden",
		// Fade top and bottom edges
		WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)",
		maskImage: "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)",
	} as CSSProperties,

	tickerHeader: {
		position: "absolute",
		top: 8,
		left: 0,
		right: 0,
		textAlign: "center",
		fontSize: "0.58rem",
		fontWeight: 500,
		color: "#9b9ba8",
		fontVariantNumeric: "tabular-nums",
		zIndex: 2,
		// Exempt header from mask
		pointerEvents: "none",
	} as CSSProperties,

	tickerTrack: {
		display: "flex",
		flexDirection: "column",
		transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
	} as CSSProperties,

	batchCard: {
		margin: "0.35rem 0.75rem",
		padding: "0.5rem 0.75rem",
		borderRadius: 8,
		transition: "all 0.4s ease",
	} as CSSProperties,

	batchLabel: {
		fontSize: "0.55rem",
		fontWeight: 600,
		textTransform: "uppercase",
		letterSpacing: "0.06em",
		marginBottom: "0.2rem",
		display: "flex",
		alignItems: "center",
		gap: "0.35rem",
	} as CSSProperties,

	batchChunk: {
		padding: "0.15rem 0",
		fontSize: "0.7rem",
		lineHeight: 1.45,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	} as CSSProperties,
}

// ─── SourceCard Component ──────────────────────────────────────

function SourceCard({
	source,
	allInjected,
	isInjecting,
	canInject,
	collapsed,
	onInject,
}: {
	source: DataSource
	allInjected: boolean
	isInjecting: boolean
	canInject: boolean
	collapsed: boolean
	onInject: () => void
}) {
	const [hover, setHover] = useState(false)
	const { day, weekday } = formatSourceDate(source.source)
	const summary = extractSummary(source.description)

	const cardStyle: CSSProperties = {
		...styles.card,
		...(collapsed ? styles.cardCollapsed : {}),
		...(allInjected && !collapsed ? styles.cardDisabled : {}),
		...(isInjecting && !collapsed ? { opacity: 0.5 } : {}),
		...(hover && canInject ? { background: "rgba(255,255,255,0.6)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" } : {}),
		position: "relative",
	}

	return (
		<div
			style={cardStyle}
			onClick={canInject ? onInject : undefined}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
		>
			<div style={styles.dateRow}>
				<span style={styles.weekday}>{weekday}</span>
				<span style={styles.day}>{day}</span>
				{isInjecting && !collapsed && <span style={styles.spinner} />}
			</div>
			<p style={styles.summary}>{summary}</p>
			<span style={styles.meta}>
				{isInjecting ? "Injecting..." : `${source.items.length} segments`}
			</span>
			{allInjected && <span style={styles.done} />}
		</div>
	)
}

// ─── Expanded Batch View ────────────────────────────────────────

function ExpandedBatchView({
	source,
	progress,
	batchSize,
	onActiveBatchY,
}: {
	source: DataSource
	progress: InjectionProgress
	batchSize: number
	onActiveBatchY?: (y: number | null) => void
}) {
	const outerRef = useRef<HTMLDivElement>(null)
	const activeRef = useRef<HTMLDivElement>(null)
	const batches: DataItem[][] = []
	for (let i = 0; i < source.items.length; i += batchSize) {
		batches.push(source.items.slice(i, i + batchSize))
	}

	// Measure container + batch card heights to compute translateY
	const [containerH, setContainerH] = useState(0)
	const [batchH, setBatchH] = useState(0)

	useEffect(() => {
		if (!outerRef.current) return
		const obs = new ResizeObserver(([entry]) => setContainerH(entry.contentRect.height))
		obs.observe(outerRef.current)
		return () => obs.disconnect()
	}, [])

	useEffect(() => {
		if (!activeRef.current) return
		setBatchH(activeRef.current.offsetHeight)
	}, [progress.batchIndex])

	// Report active batch vertical center to parent for particle origin
	useEffect(() => {
		if (!activeRef.current || !onActiveBatchY || !outerRef.current) return
		const el = activeRef.current
		const report = () => {
			const rect = el.getBoundingClientRect()
			onActiveBatchY(rect.top + rect.height / 2)
		}
		// Report after transform transition settles (0.6s)
		const timer = setTimeout(report, 650)
		report()
		const observer = new ResizeObserver(report)
		observer.observe(el)
		window.addEventListener("resize", report)
		return () => {
			clearTimeout(timer)
			observer.disconnect()
			window.removeEventListener("resize", report)
			onActiveBatchY(null)
		}
	}, [progress.batchIndex, onActiveBatchY])

	// Shift the track so the active batch sits at the vertical center
	// Each batch card is ~batchH tall + margins. We offset to center the active one.
	const batchCardHeight = batchH || 80 // fallback
	const centerOffset = containerH / 2 - batchCardHeight / 2
	const translateY = centerOffset - progress.batchIndex * (batchCardHeight + 10) // 10 ≈ margins

	return (
		<>
			{/* Ticker viewport — fades top and bottom */}
			<div ref={outerRef} style={styles.tickerOuter}>
				{/* Sliding track */}
				<div style={{ ...styles.tickerTrack, transform: `translateY(${translateY}px)` }}>
					{batches.map((batch, batchIdx) => {
						const isActive = batchIdx === progress.batchIndex
						const isDone = batch.every((item) => progress.completedItemIds.has(item.id))

						return (
							<div
								key={batchIdx}
								ref={isActive ? activeRef : undefined}
								style={{
									...styles.batchCard,
									border: isActive
										? "1.5px dashed #555560"
										: isDone
											? "1.5px solid rgba(59, 165, 92, 0.3)"
											: "1.5px solid rgba(0,0,0,0.04)",
									opacity: isActive ? 1 : isDone ? 0.5 : 0.35,
								}}
							>
								<div style={{
									...styles.batchLabel,
									color: isActive ? "#555560" : isDone ? "#3ba55c" : "#9b9ba8",
								}}>
									{isActive && <span style={styles.spinner} />}
									{isDone && <span style={{ fontSize: "0.6rem" }}>✓</span>}
									<span>{batchIdx + 1} · {JSON.stringify(batch.map(i => i.data)).length} chars</span>
								</div>
								{batch.map((item) => {
									const chunkText = typeof item.data.chunk === "string"
										? item.data.chunk
										: item.label

									return (
										<div
											key={item.id}
											style={{
												...styles.batchChunk,
												color: isActive ? "#1a1a1f" : "#9b9ba8",
											}}
										>
											{chunkText}
										</div>
									)
								})}
							</div>
						)
					})}
				</div>
			</div>
		</>
	)
}

// ─── DataDeck ──────────────────────────────────────────────────

export function DataDeck({ dataSources, injectedIds, injectionProgress, onInject, disabled, onActiveBatchY }: Props) {
	const [injecting, setInjecting] = useState<string | null>(null)

	const injectSource = async (source: DataSource) => {
		const uninjected = source.items.filter((i) => !injectedIds.has(i.id))
		if (uninjected.length === 0) return

		setInjecting(source.id)
		try {
			await onInject(uninjected)
		} finally {
			setInjecting(null)
		}
	}

	const injectNext = async () => {
		const next = dataSources.find(
			(s) => !s.items.every((i) => injectedIds.has(i.id)),
		)
		if (next) await injectSource(next)
	}

	const totalSources = dataSources.length
	const injectedSources = dataSources.filter((s) =>
		s.items.every((i) => injectedIds.has(i.id)),
	).length
	const progress = totalSources > 0 ? injectedSources / totalSources : 0
	const allDone = injectedSources === totalSources

	// Find the source being injected for expanded view
	const injectingSource = injecting
		? dataSources.find((s) => s.id === injecting)
		: null

	// Batch size from progress or default
	const batchSize = injectionProgress
		? Math.ceil(
				(injectingSource?.items.filter((i) => !injectedIds.has(i.id)).length ?? 10) /
				injectionProgress.batchCount,
			)
		: 10

	return (
		<div style={styles.deck}>
			{!injecting && (
				<div style={styles.header}>
					<span style={styles.counter}>
						{injectedSources} of {totalSources}
					</span>
					<div style={styles.progressTrack}>
						<div style={{ ...styles.progressFill, width: `${progress * 100}%` }} />
					</div>
				</div>
			)}

			{!allDone && !injecting && (
				<button
					type="button"
					style={{
						...styles.injectBtn,
						...(disabled ? { opacity: 0.35, cursor: "default" } : {}),
					}}
					onClick={injectNext}
					disabled={disabled}
				>
					Inject next day
				</button>
			)}

			<div style={styles.list} data-scroll-container>
				{/* Expanded batch view when injecting and we have progress */}
				{injectingSource && injectionProgress && (
					<ExpandedBatchView
						source={injectingSource}
						progress={injectionProgress}
						batchSize={batchSize}
						onActiveBatchY={onActiveBatchY}
					/>
				)}

				{dataSources.map((source) => {
					const allInjected = source.items.every((item) =>
						injectedIds.has(item.id),
					)
					const isInjecting = injecting === source.id
					const canInject = !disabled && !allInjected && !isInjecting && !injecting
					const collapsed = injecting !== null && !isInjecting

					// Hide the injecting card when expanded view is shown
					if (isInjecting && injectionProgress) return null

					return (
						<SourceCard
							key={source.id}
							source={source}
							allInjected={allInjected}
							isInjecting={isInjecting}
							canInject={canInject}
							collapsed={collapsed}
							onInject={() => injectSource(source)}
						/>
					)
				})}
			</div>
		</div>
	)
}
