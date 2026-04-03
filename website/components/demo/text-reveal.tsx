import { motion } from "motion/react"
import React, { useMemo, useRef, useCallback } from "react"

export type ChunkType = "character" | "word" | "sentence" | "line"

export interface TextRevealProps {
	text: string
	chunkType?: ChunkType
	staggerDelay?: number
	duration?: number
	blurAmount?: string
	className?: string
	animationKey?: string | number
	onComplete?: () => void
}

export function TextReveal({
	text,
	chunkType = "word",
	staggerDelay = 0.05,
	duration = 0.5,
	blurAmount = "10px",
	className = "",
	animationKey = 0,
	onComplete,
}: TextRevealProps) {
	const calledRef = useRef(false)

	const chunks = useMemo(() => {
		calledRef.current = false
		if (!text) return []
		if (chunkType === "character") {
			return text.split("")
		} else if (chunkType === "word") {
			return text.match(/\S+|\s+/g) || []
		} else if (chunkType === "sentence") {
			return text.match(/[^.!?]+[.!?]+|\s+|[^.!?]+/g) || []
		} else if (chunkType === "line") {
			return text.split("\n")
		}
		return [text]
	}, [text, chunkType])

	const lastIndex = chunks.length - 1

	const handleAnimationComplete = useCallback((index: number) => {
		if (index === lastIndex && onComplete && !calledRef.current) {
			calledRef.current = true
			onComplete()
		}
	}, [lastIndex, onComplete])

	return (
		<div className={className} key={animationKey}>
			{chunks.map((chunk, index) => {
				if (chunkType !== "line" && chunk === "\n") {
					return <br key={index} />
				}

				return (
					<React.Fragment key={index}>
						<motion.span
							initial={{ opacity: 0, filter: `blur(${blurAmount})` }}
							animate={{ opacity: 1, filter: "blur(0px)" }}
							transition={{
								duration: duration,
								delay: index * staggerDelay,
								ease: "easeOut",
							}}
							onAnimationComplete={() => handleAnimationComplete(index)}
							style={{
								display: /^\s+$/.test(chunk) ? "inline" : "inline-block",
								whiteSpace: "pre-wrap",
							}}
						>
							{chunk}
						</motion.span>
						{chunkType === "line" && index < chunks.length - 1 && <br />}
					</React.Fragment>
				)
			})}
		</div>
	)
}
