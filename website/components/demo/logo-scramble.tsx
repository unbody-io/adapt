"use client"

import { useEffect, useRef, useState } from "react"

const GLYPHS = "!@#$%^&*_+-=|;:<>?~01".split("")
const rand = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr]
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[a[i], a[j]] = [a[j], a[i]]
	}
	return a
}

interface LogoScrambleProps {
	word?: string
	scrambleFrames?: number
	frameInterval?: number
	pauseBetweenLoops?: number
	className?: string
}

export function LogoScramble({
	word = "Adapt",
	scrambleFrames = 6,
	frameInterval = 50,
	pauseBetweenLoops = 3000,
	className,
}: LogoScrambleProps) {
	const [chars, setChars] = useState<string[]>(() => word.split(""))
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		let cancelled = false
		const intervals: ReturnType<typeof setInterval>[] = []

		function runLoop() {
			if (cancelled) return

			// Randomize the order of character indices
			const indices = shuffle(Array.from({ length: word.length }, (_, i) => i))

			// Pick a random number of chars to animate at a time (1 to word.length)
			const batchSize = randInt(1, Math.max(1, Math.ceil(word.length / 2)))

			let batchStart = 0

			function animateBatch() {
				if (cancelled) return
				if (batchStart >= indices.length) {
					// All done — pause then restart
					timerRef.current = setTimeout(() => {
						if (!cancelled) runLoop()
					}, pauseBetweenLoops)
					return
				}

				const batch = indices.slice(batchStart, batchStart + batchSize)
				batchStart += batchSize

				// Each char in the batch gets a random number of scramble frames
				const batchFrameCounts = batch.map(() => randInt(3, scrambleFrames))
				const maxFrames = Math.max(...batchFrameCounts)
				let frame = 0

				const id = setInterval(() => {
					if (cancelled) {
						clearInterval(id)
						return
					}
					frame++
					setChars((prev) => {
						const next = [...prev]
						for (let b = 0; b < batch.length; b++) {
							const idx = batch[b]
							if (frame <= batchFrameCounts[b]) {
								next[idx] = rand(GLYPHS)
							} else {
								next[idx] = word[idx]
							}
						}
						return next
					})
					if (frame > maxFrames) {
						clearInterval(id)
						// Small stagger before next batch
						timerRef.current = setTimeout(() => animateBatch(), randInt(30, 150))
					}
				}, frameInterval)
				intervals.push(id)
			}

			animateBatch()
		}

		// Start settled, then begin after a pause
		setChars(word.split(""))
		timerRef.current = setTimeout(() => {
			if (!cancelled) runLoop()
		}, pauseBetweenLoops)

		return () => {
			cancelled = true
			if (timerRef.current) clearTimeout(timerRef.current)
			for (const id of intervals) clearInterval(id)
		}
	}, [word, scrambleFrames, frameInterval, pauseBetweenLoops])

	return (
		<span className={className} style={{ fontFamily: "inherit", fontWeight: 400, letterSpacing: "0.02em" }}>
			{chars.map((ch, i) => (
				<span
					key={i}
					style={{
						display: "inline-block",
						width: "0.65em",
						textAlign: "center",
						color: ch !== word[i] ? "#9b9ba8" : "inherit",
						transition: "color 0.1s",
					}}
				>
					{ch}
				</span>
			))}
		</span>
	)
}
