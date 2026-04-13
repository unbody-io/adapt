"use client"

import { useState, useEffect, useRef } from "react"
import { TextReveal } from "./text-reveal"

const mono = '"SF Mono", "Fira Code", "Cascadia Code", monospace'

interface Props {
	activity: string
	commentary: string
}

export function EvolutionStatus({ activity, commentary }: Props) {
	const [commentKey, setCommentKey] = useState(0)
	const prevCommentRef = useRef<string | null>(null)

	useEffect(() => {
		if (commentary && commentary !== prevCommentRef.current) {
			prevCommentRef.current = commentary
			setCommentKey((k) => k + 1)
		}
	}, [commentary])

	const showSpinner = activity !== "" && activity !== "Ready"

	if (!activity && !commentary) return null

	return (
		<div style={{
			display: "flex",
			flexDirection: "column",
			gap: "0.5rem",
			maxWidth: 500,
			width: "100%",
		}}>
			{activity && (
				<div style={{
					fontSize: "0.68rem",
					fontFamily: mono,
					color: "#9b9ba8",
					letterSpacing: "0.04em",
					display: "inline-flex",
					alignItems: "center",
					gap: "0.5rem",
				}}>
					{showSpinner && <Spinner />}
					{activity}
				</div>
			)}
			{commentary && (
				<div style={{
					fontSize: "0.82rem",
					fontFamily: '"Georgia", "Times New Roman", serif',
					color: "#6b6b78",
					fontStyle: "italic",
					lineHeight: 1.7,
				}}>
					<TextReveal
						text={commentary}
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
			<style>{`@keyframes evo-spin { to { transform: rotate(360deg); } }`}</style>
			<span
				style={{
					width: 10,
					height: 10,
					borderRadius: "50%",
					border: "1.5px solid rgba(26, 26, 31, 0.15)",
					borderTopColor: "rgba(26, 26, 31, 0.55)",
					display: "inline-block",
					animation: "evo-spin 0.8s linear infinite",
					flexShrink: 0,
				}}
			/>
		</>
	)
}
