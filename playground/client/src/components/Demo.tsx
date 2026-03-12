import { useEffect, useState, useCallback, useRef, type CSSProperties } from "react"
import type { UseCaseDetail, DataItem } from "../types"
import { useSession } from "../hooks/useSession"
import { DataDeck } from "./DataDeck"
import { Stream } from "./Stream"
import { Mycelium, type MyceliumHandle } from "./Mycelium"
import { LearnerCard } from "./LearnerCard"
import { QueryBar } from "./QueryBar"

interface Props {
	useCaseId: string
	version: string
	onBack: () => void
}

type PanelTab = "brain" | "data"

const styles = {
	topBar: {
		position: "absolute",
		top: 0,
		left: 0,
		zIndex: 30,
		display: "flex",
		alignItems: "center",
		gap: "0.25rem",
		padding: "1rem 1rem",
	} as CSSProperties,

	backBtn: {
		width: 32,
		height: 32,
		borderRadius: "50%",
		background: "none",
		border: "none",
		color: "#9b9ba8",
		cursor: "pointer",
		fontSize: "0.95rem",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		transition: "color 0.15s",
	} as CSSProperties,

	tab: {
		padding: "0.35rem 0.75rem",
		fontSize: "0.7rem",
		fontWeight: 500,
		letterSpacing: "0.04em",
		textTransform: "uppercase",
		color: "#9b9ba8",
		background: "none",
		border: "none",
		cursor: "pointer",
		borderRadius: 6,
		transition: "color 0.15s",
	} as CSSProperties,

	tabActive: {
		color: "#1a1a1f",
	} as CSSProperties,

	statusDot: {
		width: 6,
		height: 6,
		borderRadius: "50%",
		marginLeft: "0.5rem",
	} as CSSProperties,

	panel: {
		position: "absolute",
		top: 0,
		left: 0,
		bottom: 0,
		width: 340,
		zIndex: 20,
		overflowY: "auto",
		paddingTop: "3.5rem",
		scrollbarWidth: "none",
	} as CSSProperties,

	pendingOverlay: {
		position: "absolute",
		inset: 0,
		zIndex: 40,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	} as CSSProperties,

	pendingCard: {
		background: "rgba(255, 255, 255, 0.55)",
		backdropFilter: "blur(24px)",
		WebkitBackdropFilter: "blur(24px)",
		borderRadius: 14,
		padding: "2rem 2.5rem",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: "1.25rem",
		boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
	} as CSSProperties,

	pendingTitle: {
		fontSize: "0.75rem",
		fontWeight: 500,
		textTransform: "uppercase",
		letterSpacing: "0.06em",
		color: "#9b9ba8",
	} as CSSProperties,

	pendingButtons: {
		display: "flex",
		gap: "0.75rem",
	} as CSSProperties,

	pendingBtn: {
		padding: "0.55rem 1.25rem",
		borderRadius: 8,
		border: "none",
		fontSize: "0.82rem",
		fontWeight: 500,
		cursor: "pointer",
		transition: "all 0.15s",
	} as CSSProperties,

	brainContent: {
		padding: "1rem 1.5rem",
		display: "flex",
		flexDirection: "column",
		gap: "1rem",
	} as CSSProperties,

	promptLabel: {
		fontSize: "0.65rem",
		fontWeight: 500,
		textTransform: "uppercase",
		letterSpacing: "0.06em",
		color: "#9b9ba8",
	} as CSSProperties,

	promptText: {
		fontSize: "0.82rem",
		color: "#6b6b78",
		lineHeight: 1.65,
	} as CSSProperties,

	statusRow: {
		display: "flex",
		alignItems: "center",
		gap: "0.5rem",
		fontSize: "0.72rem",
		color: "#9b9ba8",
	} as CSSProperties,

	deleteBtn: {
		marginTop: "1rem",
		padding: "0.4rem 0",
		background: "none",
		border: "none",
		fontSize: "0.75rem",
		color: "#9b9ba8",
		cursor: "pointer",
		textAlign: "left",
		fontFamily: "inherit",
		transition: "color 0.15s",
	} as CSSProperties,
}

export function Demo({ useCaseId, version, onBack }: Props) {
	const [usecase, setUsecase] = useState<UseCaseDetail | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [activeTab, setActiveTab] = useState<PanelTab | null>(null)
	const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null)
	const [queryActive, setQueryActive] = useState(false)
	const [activeBatchY, setActiveBatchY] = useState<number | null>(null)
	const [askLearnerId, setAskLearnerId] = useState<string | null>(null)
	const myceliumRef = useRef<MyceliumHandle>(null)
	const { state, startSession, initSession, resetSession, inject, destroySession } = useSession()

	useEffect(() => {
		let cancelled = false

		async function init() {
			try {
				const res = await fetch(`/api/usecases/${useCaseId}?version=${version}`)
				if (!res.ok) throw new Error("Failed to load use case")
				const data = await res.json()
				if (cancelled) return
				setUsecase(data)

				await startSession(useCaseId, version)
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Unknown error")
				}
			}
		}

		init()
		return () => {
			cancelled = true
		}
	}, [useCaseId, version, startSession])

	const handleBack = async () => {
		await destroySession()
		onBack()
	}

	const handleInject = async (items: DataItem[]) => {
		try {
			await inject(items)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Injection failed")
		}
	}

	const handleSelectLearner = useCallback((learnerId: string | null) => {
		setSelectedLearnerId((prev) => (prev === learnerId ? null : learnerId))
	}, [])

	const handleClearAskLearner = useCallback(() => setAskLearnerId(null), [])

	if (error) {
		return (
			<div className="demo-error">
				<h2>Error</h2>
				<p>{error}</p>
				<button onClick={handleBack} type="button">
					Back
				</button>
			</div>
		)
	}

	const statusColor =
		state.status === "ready"
			? "#3ba55c"
			: state.status === "initializing"
				? "#c49a20"
				: state.status === "error"
					? "#d94848"
					: "#9b9ba8"

	// Compute injection label for the Data tab: "Jan 22 · 2/5"
	let injectionLabel: string | null = null
	if (state.injectionProgress && usecase) {
		const prog = state.injectionProgress
		// Find which source contains the active items
		const activeId = [...prog.activeItemIds][0] ?? [...prog.completedItemIds].pop()
		const src = activeId
			? usecase.dataSources.find((s) => s.items.some((i) => i.id === activeId))
			: null
		const dateMatch = src?.source.match(/(\d{4}-\d{2}-\d{2})/)
		const dateStr = dateMatch
			? new Date(`${dateMatch[1]}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
			: null
		const batchStr = `${prog.batchIndex + 1}/${prog.batchCount}`
		injectionLabel = dateStr ? `${dateStr} · ${batchStr}` : batchStr
	}

	// Find selected learner and its screen position
	const selectedLearner = selectedLearnerId
		? state.learners.find((l) => l.id === selectedLearnerId)
		: null

	return (
		<div className="demo">
			<div className="demo-canvas" style={{ opacity: queryActive ? 0.3 : 1, transition: "opacity 0.25s ease" }}>
				<Mycelium
					ref={myceliumRef}
					learners={state.learners}
					events={state.events}
					onSelectLearner={handleSelectLearner}
					selectedLearnerId={selectedLearnerId}
				/>
			</div>

			{/* Pending state — restore or start fresh */}
			{state.status === "pending" && (
				<div style={styles.pendingOverlay}>
					<div style={styles.pendingCard}>
						<div style={styles.pendingTitle}>Previous session found</div>
						<div style={styles.pendingButtons}>
							<button
								type="button"
								style={{
									...styles.pendingBtn,
									background: "rgba(26, 26, 31, 0.08)",
									color: "#1a1a1f",
								}}
								onClick={initSession}
							>
								Restore
							</button>
							<button
								type="button"
								style={{
									...styles.pendingBtn,
									background: "rgba(0, 0, 0, 0.03)",
									color: "#6b6b78",
								}}
								onClick={resetSession}
							>
								Start Fresh
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Learner detail card */}
			{selectedLearner && selectedLearnerId && (
				<LearnerCardOverlay
					learner={selectedLearner}
					learnerId={selectedLearnerId}
					myceliumRef={myceliumRef}
					onClose={() => setSelectedLearnerId(null)}
					onAsk={(id) => {
						setSelectedLearnerId(null)
						setAskLearnerId(id)
					}}
				/>
			)}

			{/* Top bar: back + tabs + status */}
			<div style={styles.topBar}>
				<button
					style={styles.backBtn}
					onClick={handleBack}
					type="button"
					title="Back"
				>
					←
				</button>
				{version !== "default" && (
					<span style={{
						fontSize: "0.65rem",
						fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
						color: "#9b9ba8",
						padding: "0.2rem 0.5rem",
						background: "rgba(0,0,0,0.04)",
						borderRadius: 4,
						marginRight: "0.25rem",
					}}>
						{version}
					</span>
				)}
				<button
					type="button"
					style={{
						...styles.tab,
						...(activeTab === "brain" ? styles.tabActive : {}),
					}}
					onClick={() => setActiveTab((prev) => prev === "brain" ? null : "brain")}
				>
					Brain
				</button>
				<button
					type="button"
					style={{
						...styles.tab,
						...(activeTab === "data" ? styles.tabActive : {}),
					}}
					onClick={() => setActiveTab((prev) => prev === "data" ? null : "data")}
				>
					Data
					{state.injectionProgress && injectionLabel && (
						<span style={{ fontWeight: 400, color: "#9b9ba8", textTransform: "none", letterSpacing: 0 }}>
							{" "}({injectionLabel})
						</span>
					)}
				</button>
				<span
					style={{
						...styles.statusDot,
						background: statusColor,
					}}
				/>
			</div>

			{/* Panel content below tabs */}
			{activeTab !== null && (
			<div style={styles.panel}>
				{activeTab === "brain" && (
					<div style={styles.brainContent}>
						<div style={styles.statusRow}>
							{state.status === "initializing"
								? "Initializing..."
								: state.status === "ready"
									? "Ready"
									: state.status}
						</div>
						{usecase && (
							<div>
								<div style={styles.promptLabel}>Prompt</div>
								<p style={styles.promptText}>{usecase.prompt}</p>
							</div>
						)}
						<button
							type="button"
							style={styles.deleteBtn}
							onClick={async () => {
								await destroySession()
								await fetch(`/api/usecases/${useCaseId}/versions/${version}`, { method: "DELETE" })
								onBack()
							}}
						>
							Delete version
						</button>
					</div>
				)}

				{activeTab === "data" && usecase && (
					<DataDeck
						dataSources={usecase.dataSources}
						injectedIds={state.injectedIds}
						injectionProgress={state.injectionProgress}
						onInject={handleInject}
						disabled={state.status !== "ready"}
						onActiveBatchY={setActiveBatchY}
					/>
				)}
			</div>
			)}

			{/* Flow stream — particles from panel edge toward canvas during injection */}
			{state.injectionProgress && state.injectionProgress.activeItemIds.size > 0 && activeBatchY !== null && (
				<InjectionFlow originY={activeBatchY} />
			)}

			{/* Floating stream cards */}
			<Stream text={state.commentary} activity={state.activity} />

			{/* Query bar */}
			<QueryBar
				learners={state.learners}
				disabled={state.status !== "ready"}
				onActiveChange={setQueryActive}
				askLearnerId={askLearnerId}
				onAskLearnerHandled={handleClearAskLearner}
			/>
		</div>
	)
}

/**
 * Animated particles streaming from the active batch's right edge toward the canvas.
 * All particles originate from a single point and fan out as they travel.
 */
function InjectionFlow({ originY }: { originY: number }) {
	const count = 12
	const particles = Array.from({ length: count }, (_, i) => i)

	// Each particle fans out to a different vertical offset as it travels right
	const keyframes = particles.map((i) => {
		const spreadY = (i - (count - 1) / 2) * 30
		return `@keyframes injP${i} {
			0% { transform: translate(0, 0) scale(1); opacity: 0; }
			6% { opacity: 0.6; }
			50% { opacity: 0.35; }
			100% { transform: translate(calc(50vw - 340px), ${spreadY}px) scale(0.4); opacity: 0; }
		}`
	}).join("\n")

	return (
		<div
			style={{
				position: "fixed",
				top: originY,
				left: 340,
				width: "calc(50vw - 340px)",
				height: 0,
				zIndex: 15,
				pointerEvents: "none",
				overflow: "visible",
			}}
		>
			<style>{keyframes}</style>
			{particles.map((i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						left: 0,
						top: 0,
						width: 6,
						height: 6,
						borderRadius: "50%",
						background: "#555560",
						opacity: 0,
						animation: `injP${i} 2s ease-out ${i * 0.16}s infinite`,
					}}
				/>
			))}
		</div>
	)
}

/**
 * Wrapper that positions the LearnerCard at the actual blob's screen position.
 */
function LearnerCardOverlay({
	learner,
	learnerId,
	myceliumRef,
	onClose,
	onAsk,
}: {
	learner: import("../types").Learner
	learnerId: string
	myceliumRef: React.RefObject<MyceliumHandle | null>
	onClose: () => void
	onAsk: (id: string) => void
}) {
	const anchor = myceliumRef.current?.getBlobScreenPos(learnerId)
		?? { x: 380, y: 200, radius: 40 }

	return (
		<LearnerCard
			learner={learner}
			anchor={anchor}
			onClose={onClose}
			onAsk={onAsk}
		/>
	)
}
