"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion } from "motion/react"
import { Clock, Activity, MessageSquare, ArrowRight } from "lucide-react"
import { USE_CASES, type UseCase, type ModelRef } from "../../lib/demo/use-cases"
import { TextReveal } from "./text-reveal"

function modelName(m: string | ModelRef | undefined): string | null {
	if (!m) return null
	const id = typeof m === "string" ? m : m.model
	return id.includes("/") ? id.split("/").pop()! : id
}

const CARD_META: Record<string, { icon: typeof Activity; color: string; bgColor: string }> = {
	"daily-standups": {
		icon: Activity,
		color: "rgb(45, 122, 79)",
		bgColor: "rgba(45, 122, 79, 0.1)",
	},
	"product-feedback": {
		icon: MessageSquare,
		color: "rgb(155, 155, 168)",
		bgColor: "rgba(155, 155, 168, 0.1)",
	},
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
				position: "relative",
			}}>
				{step === "pick" && (
					<div style={{
						position: "absolute",
						inset: 0,
						padding: "0 2rem",
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
						<div style={{
							display: "flex",
							gap: "1rem",
							opacity: revealDone ? 1 : 0,
							transform: revealDone ? "translateY(0)" : "translateY(6px)",
							transition: "opacity 0.3s ease, transform 0.3s ease",
							pointerEvents: revealDone ? "auto" : "none",
						}}>
							{USE_CASES.map((uc, index) => {
								const meta = CARD_META[uc.id] ?? CARD_META["product-feedback"]
								const Icon = meta.icon
								const models = [modelName(uc.model), modelName(uc.evolution?.model)].filter(Boolean).join(" + ")

								return (
									<motion.button
										key={uc.id}
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.5, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
										whileHover={{ y: -4 }}
										whileTap={{ scale: 0.98 }}
										onClick={() => handleSelect(uc)}
										className="demo-option-card"
										style={{
											flex: "1 1 0px",
											background: "rgba(26, 26, 31, 0.02)",
											border: "1px solid rgba(155, 155, 168, 0.12)",
											borderRadius: 20,
											padding: "1.5rem",
											cursor: "pointer",
											textAlign: "left",
											display: "flex",
											flexDirection: "column",
											gap: "0.75rem",
											transition: "border-color 0.3s, box-shadow 0.3s, background 0.3s",
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.borderColor = "rgba(155, 155, 168, 0.3)"
											e.currentTarget.style.boxShadow = "0 20px 40px -15px rgba(0,0,0,0.05)"
											e.currentTarget.style.background = "rgba(26, 26, 31, 0.03)"
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.borderColor = "rgba(155, 155, 168, 0.12)"
											e.currentTarget.style.boxShadow = "none"
											e.currentTarget.style.background = "rgba(26, 26, 31, 0.02)"
										}}
									>
										{/* Header: icon + title | duration */}
										<div style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: "0.75rem",
										}}>
											<div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
												<div style={{
													padding: "0.45rem",
													borderRadius: 12,
													backgroundColor: meta.bgColor,
													color: meta.color,
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
												}}>
													<Icon size={18} strokeWidth={1.5} />
												</div>
												<span style={{
													fontSize: "0.95rem",
													fontWeight: 500,
													color: "#1a1a1f",
													fontFamily: mono,
													letterSpacing: "-0.01em",
												}}>
													{uc.title}
												</span>
											</div>
											{uc.duration && (
												<div style={{
													display: "flex",
													alignItems: "center",
													gap: "0.3rem",
													padding: "0.2rem 0.55rem",
													borderRadius: 99,
													background: "rgba(155, 155, 168, 0.08)",
													color: "#1a1a1f",
													opacity: 0.5,
												}}>
													<Clock size={12} />
													<span style={{
														fontSize: "0.65rem",
														fontFamily: mono,
														fontWeight: 500,
													}}>
														{uc.duration}
													</span>
												</div>
											)}
										</div>

										{/* Description */}
										<p style={{
											margin: 0,
											fontSize: "0.82rem",
											color: "#6b6b78",
											lineHeight: 1.6,
											fontFamily: mono,
											fontWeight: 300,
											flex: 1,
										}}>
											{uc.description}
										</p>

										{/* Footer: eval + models | arrow */}
										<div style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: "0.5rem",
											paddingTop: "0.75rem",
											borderTop: "1px solid rgba(155, 155, 168, 0.1)",
										}}>
											<div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
												<span style={{
													display: "inline-flex",
													alignItems: "center",
													gap: "0.3rem",
													fontSize: "0.62rem",
													fontFamily: mono,
													fontWeight: 600,
													textTransform: "uppercase",
													letterSpacing: "0.05em",
													color: uc.evolution?.autoEvaluate ? meta.color : "#9b9ba8",
													flexShrink: 0,
												}}>
													<span style={{
														width: 7,
														height: 7,
														borderRadius: "50%",
														background: uc.evolution?.autoEvaluate ? meta.color : "rgba(155, 155, 168, 0.4)",
														flexShrink: 0,
													}} />
													{uc.evolution?.autoEvaluate ? "auto-eval" : "manual eval"}
												</span>
												{models && (
													<>
														<span style={{ color: "rgba(155, 155, 168, 0.3)" }}>·</span>
														<span style={{
															fontSize: "0.58rem",
															fontFamily: mono,
															color: "#9b9ba8",
															opacity: 0.8,
															fontWeight: 300,
															overflow: "hidden",
															textOverflow: "ellipsis",
															whiteSpace: "nowrap",
														}}>
															{models}
														</span>
													</>
												)}
											</div>
											<div
												className="demo-card-arrow"
												style={{
													width: 26,
													height: 26,
													borderRadius: "50%",
													border: "1px solid rgba(155, 155, 168, 0.2)",
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													color: "#1a1a1f",
													opacity: 0,
													transform: "translateX(-8px)",
													transition: "opacity 0.3s, transform 0.3s",
													flexShrink: 0,
												}}
											>
												<ArrowRight size={13} />
											</div>
										</div>
									</motion.button>
								)
							})}
						</div>
						<style>{`
							.demo-option-card:hover .demo-card-arrow {
								opacity: 1 !important;
								transform: translateX(0) !important;
							}
						`}</style>
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
							transform: revealDone ? "translateY(0)" : "translateY(6px)",
							transition: "opacity 0.3s ease, transform 0.3s ease",
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
							<div style={{
								display: "flex",
								justifyContent: "flex-end",
								alignItems: "center",
								gap: "0.5rem",
							}}>
								<button
									type="button"
									onClick={handleBack}
									style={{
										background: "none",
										border: "none",
										padding: "0.35rem 0.5rem",
										cursor: "pointer",
										fontSize: "0.7rem",
										fontFamily: mono,
										color: "#9b9ba8",
										transition: "color 0.15s",
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.color = "#1a1a1f"
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.color = "#9b9ba8"
									}}
								>
									← Back
								</button>
								<button
									type="button"
									onClick={handleStart}
									style={{
										background: "#1a1a1f",
										border: "1px solid #1a1a1f",
										borderRadius: 5,
										padding: "0.35rem 0.9rem",
										cursor: "pointer",
										fontSize: "0.7rem",
										fontFamily: mono,
										color: "#fff",
										transition: "background 0.15s, border-color 0.15s",
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = "#000"
										e.currentTarget.style.borderColor = "#000"
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = "#1a1a1f"
										e.currentTarget.style.borderColor = "#1a1a1f"
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
