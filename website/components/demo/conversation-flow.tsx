"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Clock } from "lucide-react"
import { USE_CASES, type UseCase, type ModelRef } from "../../lib/demo/use-cases"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TextReveal } from "./text-reveal"

function modelName(m: string | ModelRef | undefined): string | null {
	if (!m) return null
	const id = typeof m === "string" ? m : m.model
	return id.includes("/") ? id.split("/").pop()! : id
}

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
		setPrompt("")
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

	const handleBack = useCallback(() => {
		setRevealDone(false)
		setStep("pick")
	}, [])

	const activeStepIndex = step === "pick" ? 0 : 1

	return (
		<div style={{
			width: "100%",
			height: "100%",
			display: "flex",
			flexDirection: "column",
			justifyContent: "center",
			alignItems: "center",
			paddingBottom: "8vh",
			gap: "1.5rem",
		}}>
			<div style={{
				width: "100%",
				maxWidth: 720,
				minHeight: 340,
				padding: "0 2rem",
				boxSizing: "border-box",
			}}>
				{step === "pick" && (
					<div style={{
						display: "flex",
						flexDirection: "column",
						gap: "2rem",
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
						<div
							className="demo-card-grid"
							style={{
								display: "grid",
								gap: "0.75rem",
								width: "100%",
								opacity: revealDone ? 1 : 0,
								transition: "opacity 0.3s ease",
								pointerEvents: revealDone ? "auto" : "none",
							}}
						>
							{USE_CASES.map((uc) => {
								const models = [modelName(uc.model), modelName(uc.evolution?.model)].filter(Boolean)

								return (
									<button
										key={uc.id}
										type="button"
										onClick={() => handleSelect(uc)}
										className="demo-option-card"
										style={{
											background: "#fff",
											border: "1px solid #e0e0e3",
											borderRadius: 12,
											padding: "1.25rem",
											cursor: "pointer",
											textAlign: "left",
											display: "flex",
											flexDirection: "column",
											gap: "0.5rem",
											minWidth: 0,
											overflow: "hidden",
										}}
									>
										<div style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: "0.5rem",
										}}>
											<span style={{
												fontSize: "0.78rem",
												fontWeight: 300,
												color: "#1a1a1f",
												fontFamily: mono,
											}}>
												{uc.title}
											</span>
											{uc.duration && (
												<span style={{
													display: "inline-flex",
													alignItems: "center",
													gap: "0.25rem",
													fontSize: "0.65rem",
													fontFamily: mono,
													color: "#9b9ba8",
													flexShrink: 0,
												}}>
													<Clock size={11} />
													{uc.duration}
												</span>
											)}
										</div>

										<p style={{
											margin: 0,
											fontSize: "0.78rem",
											color: "#6b6b78",
											lineHeight: 1.6,
											fontFamily: mono,
											fontWeight: 300,
											flex: 1,
											paddingBottom: "0.6rem",
										}}>
											{uc.description}
										</p>

										<div style={{
											display: "flex",
											flexDirection: "column",
											gap: "0.4rem",
											paddingTop: "0.8rem",
										}}>
											<div>
												<Badge variant="secondary" className="text-[0.62rem] font-mono">
													{uc.evolution?.autoEvaluate ? "auto-eval" : "manual eval"}
												</Badge>
											</div>
											{models.length > 0 && (
												<div
													style={{
														display: "flex",
														flexDirection: "column",
														gap: "0.1rem",
														fontSize: "0.58rem",
														lineHeight: 1.5,
														color: "#7b7b86",
														fontFamily: mono,
														fontStyle: "italic",
													}}
												>
													{models.map((model) => (
														<div key={model}>{model}</div>
													))}
												</div>
											)}
										</div>
									</button>
								)
							})}
						</div>
						<style>{`
							.demo-card-grid {
								grid-template-columns: repeat(2, 1fr);
							}
							@media (max-width: 600px) {
								.demo-card-grid {
									grid-template-columns: 1fr;
								}
							}
						`}</style>
					</div>
				)}

				{step === "prompt" && (
					<div style={{
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
								text="Instruct the Brain."
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
							transition: "opacity 0.3s ease",
							pointerEvents: revealDone ? "auto" : "none",
						}}>
							<textarea
								ref={textareaRef}
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								placeholder={selectedUseCase?.prompt}
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
							<div className="flex justify-end items-center gap-2">
								<Button variant="ghost" size="sm" onClick={handleBack}>
									← Back
								</Button>
								<Button size="sm" onClick={handleStart}>
									Start
								</Button>
							</div>
						</div>
					</div>
				)}

				{step === "starting" && (
					<div style={{
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
			{step !== "starting" && (
				<div style={{
					display: "flex",
					gap: "0.5rem",
					alignItems: "center",
				}}>
					{[0, 1].map((i) => (
						<span
							key={i}
							style={{
								width: i === activeStepIndex ? 18 : 6,
								height: 6,
								borderRadius: 3,
								background: i === activeStepIndex ? "#1a1a1f" : "rgba(26, 26, 31, 0.18)",
								transition: "width 0.25s ease, background 0.25s ease",
							}}
						/>
					))}
				</div>
			)}
		</div>
	)
}
