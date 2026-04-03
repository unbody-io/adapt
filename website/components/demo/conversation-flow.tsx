"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { USE_CASES, type UseCase } from "../../lib/demo/use-cases"
import { TextReveal } from "./text-reveal"

interface Props {
	onStart: (useCase: UseCase, prompt: string) => void
}

const mono = '"SF Mono", "Fira Code", "Cascadia Code", monospace'

type Step = "pick" | "prompt" | "starting"

export function ConversationFlow({ onStart }: Props) {
	const [step, setStep] = useState<Step>("pick")
	const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null)
	const [prompt, setPrompt] = useState("")
	const [started, setStarted] = useState(false)
	const [revealDone, setRevealDone] = useState(false)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	useEffect(() => {
		if (step === "prompt" && revealDone) {
			setTimeout(() => textareaRef.current?.focus(), 100)
		}
	}, [step, revealDone])

	const handleSelect = useCallback((uc: UseCase) => {
		setSelectedUseCase(uc)
		setPrompt(uc.prompt)
		setTimeout(() => {
			setRevealDone(false)
			setStep("prompt")
		}, 200)
	}, [])

	const handleStart = useCallback(() => {
		if (!selectedUseCase || started) return
		setStarted(true)
		setRevealDone(false)
		setStep("starting")
		setTimeout(() => {
			onStart(selectedUseCase, prompt.trim() || selectedUseCase.prompt)
		}, 800)
	}, [selectedUseCase, prompt, started, onStart])



	return (
		<div style={{
			width: "100%",
			height: "100%",
			display: "flex",
			justifyContent: "center",
			alignItems: "center",
			paddingBottom: "8vh",
		}}>
			<div style={{
				width: "100%",
				maxWidth: 640,
				height: 320,
				padding: "0 2rem",
				position: "relative",
			}}>
				{step === "pick" && (
					<div style={{
						position: "absolute",
						inset: 0,
						padding: "0 2rem",
						display: "flex",
						flexDirection: "column",
						gap: "2.5rem",
					}}>
						<div style={{
							fontSize: "0.82rem",
							color: "#6b6b78",
							fontFamily: mono,
							lineHeight: 1.7,
						}}>
							<TextReveal
								text="Pick a scenario."
								chunkType="word"
								staggerDelay={0.03}
								duration={0.35}
								blurAmount="6px"
								animationKey="pick"
								onComplete={() => setRevealDone(true)}
							/>
						</div>
						<div style={{
							display: "flex",
							gap: "0.6rem",
							opacity: revealDone ? 1 : 0,
							transform: revealDone ? "translateY(0)" : "translateY(6px)",
							transition: "opacity 0.3s ease, transform 0.3s ease",
							pointerEvents: revealDone ? "auto" : "none",
						}}>
							{USE_CASES.map((uc) => (
								<button
									key={uc.id}
									type="button"
									onClick={() => handleSelect(uc)}
									className="demo-option-card"
									style={{
										flex: "1 1 0px",
										background: "rgba(26, 26, 31, 0.02)",
										border: "1px solid rgba(155, 155, 168, 0.12)",
										borderRadius: 10,
										padding: "0.85rem 1rem",
										cursor: "pointer",
										textAlign: "left",
										display: "flex",
										flexDirection: "column",
										gap: "0.3rem",
									}}
								>
									<span style={{
										fontSize: "0.78rem",
										fontWeight: 500,
										color: "#1a1a1f",
										fontFamily: mono,
									}}>
										{uc.title}
									</span>
									<span style={{
										fontSize: "0.68rem",
										color: "#9b9ba8",
										fontFamily: mono,
										lineHeight: 1.5,
									}}>
										{uc.description}
									</span>
								</button>
							))}
						</div>
					</div>
				)}

				{step === "prompt" && (
					<div style={{
						position: "absolute",
						inset: 0,
						padding: "0 2rem",
						display: "flex",
						flexDirection: "column",
						gap: "2.5rem",
					}}>
						<div style={{
							fontSize: "0.82rem",
							color: "#6b6b78",
							fontFamily: mono,
							lineHeight: 1.7,
						}}>
							<TextReveal
								text="This is the prompt that tells the Brain what to pay attention to. Tweak it or just hit Start."
								chunkType="word"
								staggerDelay={0.03}
								duration={0.35}
								blurAmount="6px"
								animationKey="prompt-intro"
								onComplete={() => setRevealDone(true)}
							/>
						</div>
						<div style={{
							flex: 1,
							display: "flex",
							flexDirection: "column",
							gap: "0.5rem",
							opacity: revealDone ? 1 : 0,
							transform: revealDone ? "translateY(0)" : "translateY(6px)",
							transition: "opacity 0.3s ease, transform 0.3s ease",
							pointerEvents: revealDone ? "auto" : "none",
						}}>
							<textarea
								ref={textareaRef}
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								rows={8}
								style={{
									flex: 1,
									width: "100%",
									background: "none",
									border: "none",
									outline: "none",
									resize: "none",
									fontSize: "0.95rem",
									fontFamily: "Georgia, 'Times New Roman', serif",
									color: "#1a1a1f",
									lineHeight: 1.7,
									padding: 0,
								}}
							/>
							<div style={{
								display: "flex",
								justifyContent: "flex-end",
								alignItems: "center",
							}}>
								<button
									type="button"
									onClick={handleStart}
									style={{
										background: "none",
										border: "1px solid rgba(26, 26, 31, 0.12)",
										borderRadius: 5,
										padding: "0.3rem 0.75rem",
										cursor: "pointer",
										fontSize: "0.7rem",
										fontFamily: mono,
										color: "#1a1a1f",
										transition: "background 0.15s",
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = "rgba(26, 26, 31, 0.04)"
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = "none"
									}}
								>
									Start
								</button>
							</div>
						</div>
					</div>
				)}

				{step === "starting" && (
					<div style={{
						position: "absolute",
						inset: 0,
						padding: "0 2rem",
						display: "flex",
						alignItems: "center",
						pointerEvents: "none",
					}}>
						<div style={{
							fontSize: "0.82rem",
							color: "#6b6b78",
							fontFamily: mono,
							lineHeight: 1.7,
						}}>
							<TextReveal
								text="Starting the Brain..."
								chunkType="word"
								staggerDelay={0.03}
								duration={0.35}
								blurAmount="6px"
								animationKey="starting"
							/>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
