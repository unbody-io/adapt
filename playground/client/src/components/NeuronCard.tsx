import { useEffect, useRef, type CSSProperties } from "react"
import type { Neuron } from "../types"

interface Props {
	neuron: Neuron
	/** Canvas-space position to anchor near */
	anchor: { x: number; y: number; radius: number }
	onClose: () => void
	onAsk?: (neuronId: string) => void
}

const s = {
	overlay: {
		position: "fixed",
		inset: 0,
		zIndex: 50,
	} as CSSProperties,

	card: {
		position: "absolute",
		zIndex: 51,
		width: 280,
		background: "rgba(255,255,255,0.12)",
		backdropFilter: "blur(32px)",
		WebkitBackdropFilter: "blur(32px)",
		borderRadius: 14,
		boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
		padding: "1.2rem 1.4rem",
		display: "flex",
		flexDirection: "column",
		gap: "0.85rem",
		fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
	} as CSSProperties,

	header: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "0.5rem",
	} as CSSProperties,

	name: {
		fontSize: "0.95rem",
		fontWeight: 600,
		color: "#1a1a1f",
		letterSpacing: "-0.01em",
	} as CSSProperties,

	typeBadge: {
		fontSize: "0.55rem",
		fontWeight: 600,
		letterSpacing: "0.06em",
		textTransform: "uppercase",
		padding: "2px 6px",
		borderRadius: 4,
		background: "rgba(0,0,0,0.06)",
		color: "#6b6b78",
	} as CSSProperties,

	closeBtn: {
		background: "none",
		border: "none",
		cursor: "pointer",
		color: "#9b9ba8",
		fontSize: "0.85rem",
		padding: "2px 4px",
		lineHeight: 1,
	} as CSSProperties,

	section: {
		display: "flex",
		flexDirection: "column",
		gap: "0.35rem",
	} as CSSProperties,

	sectionLabel: {
		fontSize: "0.58rem",
		fontWeight: 500,
		textTransform: "uppercase",
		letterSpacing: "0.06em",
		color: "#9b9ba8",
	} as CSSProperties,

	row: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
	} as CSSProperties,

	metricLabel: {
		fontSize: "0.72rem",
		color: "#6b6b78",
	} as CSSProperties,

	metricValue: {
		fontSize: "0.72rem",
		fontWeight: 500,
		color: "#1a1a1f",
		fontVariantNumeric: "tabular-nums",
	} as CSSProperties,

	barTrack: {
		height: 3,
		borderRadius: 2,
		background: "rgba(0,0,0,0.06)",
		overflow: "hidden",
		marginTop: 2,
	} as CSSProperties,

	barFill: {
		height: "100%",
		borderRadius: 2,
		transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
	} as CSSProperties,

	statsGrid: {
		display: "grid",
		gridTemplateColumns: "1fr 1fr",
		gap: "0.5rem 1rem",
	} as CSSProperties,

	statItem: {
		display: "flex",
		flexDirection: "column",
		gap: "0.1rem",
	} as CSSProperties,

	statValue: {
		fontSize: "1.1rem",
		fontWeight: 600,
		color: "#1a1a1f",
		fontVariantNumeric: "tabular-nums",
		lineHeight: 1.2,
	} as CSSProperties,

	statLabel: {
		fontSize: "0.58rem",
		color: "#9b9ba8",
		textTransform: "uppercase",
		letterSpacing: "0.04em",
	} as CSSProperties,

	healthDot: {
		width: 6,
		height: 6,
		borderRadius: "50%",
		display: "inline-block",
	} as CSSProperties,

	activityBadge: {
		fontSize: "0.62rem",
		fontWeight: 500,
		padding: "2px 8px",
		borderRadius: 10,
		lineHeight: 1.4,
	} as CSSProperties,

	synthesisInfo: {
		fontSize: "0.7rem",
		color: "#6b6b78",
		lineHeight: 1.5,
		fontStyle: "italic",
	} as CSSProperties,

	description: {
		fontSize: "0.7rem",
		color: "#6b6b78",
		lineHeight: 1.5,
		display: "-webkit-box",
		WebkitLineClamp: 3,
		WebkitBoxOrient: "vertical" as const,
		overflow: "hidden",
	} as CSSProperties,
}

function activationColor(activation: number): string {
	if (activation >= 0.7) return "#3ba55c"
	if (activation >= 0.4) return "#c49a20"
	return "#9b9ba8"
}

function activityStyle(activity: string): CSSProperties {
	if (activity === "synthesizing") {
		return { ...s.activityBadge, background: "rgba(59,165,92,0.12)", color: "#3ba55c" }
	}
	if (activity === "observing") {
		return { ...s.activityBadge, background: "rgba(196,154,32,0.12)", color: "#c49a20" }
	}
	return { ...s.activityBadge, background: "rgba(0,0,0,0.04)", color: "#9b9ba8" }
}

export function NeuronCard({ neuron, anchor, onClose, onAsk }: Props) {
	const cardRef = useRef<HTMLDivElement>(null)

	// Position card to the right of the blob, or left if near edge
	const cardX = anchor.x + anchor.radius + 20
	const cardY = Math.max(20, anchor.y - 80)

	// Close on escape
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [onClose])

	const { metrics, health } = neuron
	const dismissalRate = metrics.observations > 0
		? (metrics.dismissals / metrics.observations * 100).toFixed(0)
		: "0"
	const activationPct = (health.activation * 100).toFixed(0)

	return (
		<>
			{/* Invisible overlay to catch clicks outside */}
			<div style={s.overlay} onClick={onClose} />

			<div
				ref={cardRef}
				style={{
					...s.card,
					left: cardX,
					top: cardY,
				}}
			>
				{/* Header */}
				<div style={s.header}>
					<div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
						<span style={s.name}>{neuron.name}</span>
						<span style={s.typeBadge}>{neuron.type}</span>
					</div>
					<button type="button" style={s.closeBtn} onClick={onClose}>✕</button>
				</div>

				{/* Status row */}
				<div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
					<span style={activityStyle(neuron.activity)}>
						{neuron.activity === "idle" ? "idle" : neuron.activity}
					</span>
					<span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
						<span style={{ ...s.healthDot, background: activationColor(health.activation) }} />
						<span style={{ fontSize: "0.65rem", color: "#6b6b78" }}>
							{health.status} · {activationPct}%
						</span>
					</span>
				</div>

				{/* Stats grid */}
				<div style={s.statsGrid}>
					<div style={s.statItem}>
						<span style={s.statValue}>{metrics.observations}</span>
						<span style={s.statLabel}>observed</span>
					</div>
					<div style={s.statItem}>
						<span style={s.statValue}>{metrics.dismissals}</span>
						<span style={s.statLabel}>dismissed</span>
					</div>
					<div style={s.statItem}>
						<span style={s.statValue}>{metrics.syntheses}</span>
						<span style={s.statLabel}>syntheses</span>
					</div>
					<div style={s.statItem}>
						<span style={s.statValue}>{dismissalRate}%</span>
						<span style={s.statLabel}>reject rate</span>
					</div>
				</div>

				{/* Activation bar */}
				<div style={s.section}>
					<div style={s.row}>
						<span style={s.sectionLabel}>Activation</span>
						<span style={s.metricValue}>{activationPct}%</span>
					</div>
					<div style={s.barTrack}>
						<div
							style={{
								...s.barFill,
								width: `${health.activation * 100}%`,
								background: activationColor(health.activation),
							}}
						/>
					</div>
				</div>

				{/* Understanding */}
				<div style={s.section}>
					<div style={s.row}>
						<span style={s.sectionLabel}>Understanding</span>
						<span style={s.metricValue}>
							{neuron.understandingSize > 0
								? neuron.type === "list"
									? `${neuron.understandingSize} items`
									: formatSize(neuron.understandingSize)
								: "—"}
						</span>
					</div>
				</div>

				{/* Last synthesis */}
				{metrics.lastSynthesisSignificance && (
					<div style={s.section}>
						<span style={s.sectionLabel}>Last Synthesis</span>
						<div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
							<span style={{
								...s.typeBadge,
								background: metrics.lastSynthesisSignificance === "high"
									? "rgba(59,165,92,0.12)"
									: metrics.lastSynthesisSignificance === "medium"
										? "rgba(196,154,32,0.12)"
										: "rgba(0,0,0,0.04)",
								color: metrics.lastSynthesisSignificance === "high"
									? "#3ba55c"
									: metrics.lastSynthesisSignificance === "medium"
										? "#c49a20"
										: "#6b6b78",
							}}>
								{metrics.lastSynthesisSignificance}
							</span>
						</div>
						{metrics.lastSynthesisEvolution && (
							<p style={s.synthesisInfo}>
								{metrics.lastSynthesisEvolution}
							</p>
						)}
					</div>
				)}

				{/* Description */}
				{neuron.description && (
					<p style={s.description}>{neuron.description}</p>
				)}

				{/* Ask button */}
				{onAsk && (
					<button
						type="button"
						style={{
							background: "rgba(26, 26, 31, 0.06)",
							border: "none",
							borderRadius: 8,
							padding: "0.5rem 0",
							cursor: "pointer",
							fontSize: "0.72rem",
							fontWeight: 500,
							color: "#1a1a1f",
							letterSpacing: "0.02em",
							transition: "background 0.15s",
						}}
						onClick={() => onAsk(neuron.id)}
					>
						Ask
					</button>
				)}
			</div>
		</>
	)
}

function formatSize(bytes: number): string {
	if (bytes < 1000) return `${bytes} chars`
	return `${(bytes / 1000).toFixed(1)}k chars`
}
