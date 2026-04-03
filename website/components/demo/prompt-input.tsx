import { useState, useRef, useEffect } from "react"

interface Props {
	defaultPrompt: string
	onSubmit: (prompt: string) => void
}

export function PromptInput({ defaultPrompt, onSubmit }: Props) {
	const [prompt, setPrompt] = useState(defaultPrompt)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	useEffect(() => {
		textareaRef.current?.focus()
	}, [])

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			onSubmit(prompt.trim())
		}
	}

	return (
		<div style={{
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			height: "100%",
			padding: "2rem",
		}}>
			<div style={{ width: "100%", maxWidth: 520 }}>
				<p style={{
					fontSize: "0.72rem",
					color: "#9b9ba8",
					marginBottom: "0.75rem",
					fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
				}}>
					Edit the brain prompt, then press Enter to start.
				</p>
				<textarea
					ref={textareaRef}
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					onKeyDown={handleKeyDown}
					rows={8}
					style={{
						width: "100%",
						background: "none",
						border: "none",
						outline: "none",
						resize: "vertical",
						fontSize: "0.82rem",
						fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
						color: "#1a1a1f",
						lineHeight: 1.6,
						padding: 0,
					}}
				/>
				<div style={{
					fontSize: "0.62rem",
					color: "#9b9ba8",
					marginTop: "0.5rem",
					fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
				}}>
					press Enter to start
				</div>
			</div>
		</div>
	)
}
