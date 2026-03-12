import { useEffect, useRef, useState } from "react"

interface Props {
	text: string
	activity?: string
}

export function Stream({ text, activity }: Props) {
	const [revealed, setRevealed] = useState(0)
	const targetRef = useRef(text)
	const revealedRef = useRef(0)
	const prevLenRef = useRef(0)
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const activeRef = useRef<HTMLParagraphElement>(null)

	// If text jumps by a large amount at once (snapshot), skip to it instantly
	const delta = text.length - prevLenRef.current
	if (delta > 200 && prevLenRef.current === 0) {
		revealedRef.current = text.length
		// setState is fine during render for initialization
		if (revealed !== text.length) {
			setRevealed(text.length)
		}
	}
	prevLenRef.current = text.length
	targetRef.current = text

	// Reveal ~5 chars every 15ms (~333 chars/sec) — keeps up with streaming
	useEffect(() => {
		intervalRef.current = setInterval(() => {
			if (revealedRef.current < targetRef.current.length) {
				revealedRef.current = Math.min(
					revealedRef.current + 5,
					targetRef.current.length,
				)
				setRevealed(revealedRef.current)
			}
		}, 15)

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current)
		}
	}, [])

	// Scroll to the latest paragraph
	useEffect(() => {
		activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
	}, [revealed])

	const visible = text.slice(0, revealed)
	const isTyping = revealed < text.length
	const paragraphs = visible.split("\n\n").filter((p) => p.trim()).slice(-10)

	return (
		<div className="stream">
			<div className="stream-text">
				{!visible && (
					<span className="stream-empty">
						Waiting for the Brain to speak...
					</span>
				)}

				{paragraphs.length > 0 && <div className="stream-anchor" />}

				{paragraphs.map((p, i) => {
					const isLast = i === paragraphs.length - 1
					const labelMatch = p.match(/^\[([^\]]+)\]\s*/)
					const label = labelMatch ? labelMatch[1] : null
					const body = label ? p.slice(labelMatch![0].length) : p
					const isEvolution = label ? /evolution|evaluator/i.test(label) : false
					return (
						<p
							key={i}
							ref={isLast ? activeRef : undefined}
							className={`stream-paragraph ${isLast ? "latest" : ""} ${isEvolution ? "stream-evolution" : ""}`}
						>
							{label && <span className="stream-event-label">{label}</span>}
							{body}
							{isLast && isTyping && <span className="stream-cursor" />}
						</p>
					)
				})}

				{activity && !isTyping && (
					<p className="stream-status">{activity}</p>
				)}

				{paragraphs.length > 0 && <div className="stream-tail" />}
			</div>
		</div>
	)
}
