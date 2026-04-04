"use client"

import { useState, useEffect, useRef } from "react"
import { TextReveal } from "./text-reveal"
import type { InjectionProgress } from "../../lib/demo/types"

const mono = '"SF Mono", "Fira Code", "Cascadia Code", monospace'

interface Props {
	activity: string
	commentary: string
	injectionProgress: InjectionProgress | null
}

export function StatusDisplay({ activity, commentary, injectionProgress }: Props) {
	const lines = commentary ? commentary.split("\n\n").filter(Boolean) : []
	const latestComment = lines.length > 0 ? lines[lines.length - 1] : null
	const [commentKey, setCommentKey] = useState(0)
	const prevCommentRef = useRef<string | null>(null)

	useEffect(() => {
		if (latestComment && latestComment !== prevCommentRef.current) {
			prevCommentRef.current = latestComment
			setCommentKey((k) => k + 1)
		}
	}, [latestComment])

	const progress = injectionProgress?.batchCount
		? injectionProgress.batchIndex / injectionProgress.batchCount
		: 0

	const showActivitySpinner = activity !== "" && activity !== "Ready" && activity !== "Brain ready" && activity !== "Injection complete"

	return (
		<div style={{
			position: "fixed",
			top: "4.5rem",
			left: "1.25rem",
			zIndex: 50,
			maxWidth: 420,
			pointerEvents: "none",
			display: "flex",
			flexDirection: "column",
			gap: "1.25rem",
		}}>
			{/* Injection progress */}
			{injectionProgress && (
				<div style={{
					display: "flex",
					flexDirection: "column",
					gap: "0.4rem",
				}}>
					<div style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						fontFamily: mono,
						fontSize: "0.72rem",
						color: "#6b6b78",
						lineHeight: 1.6,
					}}>
						<span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
							<Spinner />
							Injecting {injectionProgress.sourceLabel}
						</span>
						{injectionProgress.batchCount > 0 && (
							<span style={{ color: "#9b9ba8", fontSize: "0.65rem" }}>
								{injectionProgress.batchIndex}/{injectionProgress.batchCount}
							</span>
						)}
					</div>
					<div style={{
						padding: "0.85rem 0.75rem",
						background: "rgba(26, 26, 31, 0.03)",
						border: "1px solid rgba(26, 26, 31, 0.08)",
						borderRadius: 6,
						overflow: "hidden",
					}}>
						<span style={{
							display: "block",
							fontSize: "0.6rem",
							fontFamily: mono,
							color: "#9b9ba8",
							textTransform: "uppercase",
							letterSpacing: "0.08em",
							marginBottom: "0.4rem",
						}}>
							Summary
						</span>
						<p style={{
							margin: 0,
							fontSize: "0.7rem",
							fontFamily: mono,
							color: "#9b9ba8",
							lineHeight: 1.6,
						}}>
							{injectionProgress.sourceSummary}
						</p>
						<div style={{
							margin: "0.85rem -0.75rem -0.85rem",
							height: 2,
							background: "rgba(155, 155, 168, 0.15)",
							borderRadius: "0 0 6px 6px",
							overflow: "hidden",
						}}>
							<div style={{
								width: `${progress * 100}%`,
								height: "100%",
								background: "rgba(26, 26, 31, 0.4)",
								transition: "width 0.6s ease",
							}} />
						</div>
					</div>
				</div>
			)}

			{/* Activity without injection */}
			{!injectionProgress && activity && (
				<div style={{
					fontSize: "0.7rem",
					fontFamily: mono,
					color: "#9b9ba8",
					letterSpacing: "0.04em",
					display: "inline-flex",
					alignItems: "center",
					gap: "0.5rem",
				}}>
					{showActivitySpinner && <Spinner />}
					{activity}
				</div>
			)}

			{/* Commentary */}
			{latestComment && (
				<div style={{
					fontSize: "0.95rem",
					fontFamily: '"Georgia", "Times New Roman", serif',
					color: "#6b6b78",
					fontStyle: "italic",
					lineHeight: 1.7,
				}}>
					<TextReveal
						text={latestComment}
						chunkType="sentence"
						staggerDelay={0.04}
						duration={0.4}
						blurAmount="6px"
						animationKey={commentKey}
					/>
				</div>
			)}
		</div>
	)
}

function Spinner() {
	return (
		<>
			<style>{`@keyframes status-spin { to { transform: rotate(360deg); } }`}</style>
			<span
				style={{
					width: 10,
					height: 10,
					borderRadius: "50%",
					border: "1.5px solid rgba(26, 26, 31, 0.15)",
					borderTopColor: "rgba(26, 26, 31, 0.55)",
					display: "inline-block",
					animation: "status-spin 0.8s linear infinite",
					flexShrink: 0,
				}}
			/>
		</>
	)
}
