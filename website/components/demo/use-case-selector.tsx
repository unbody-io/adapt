import { USE_CASES, type UseCase } from "../../lib/demo/use-cases"

interface Props {
	onSelect: (useCase: UseCase) => void
}

export function UseCaseSelector({ onSelect }: Props) {
	return (
		<div style={{
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			height: "100%",
			gap: "2rem",
			padding: "2rem",
		}}>
			<div style={{ textAlign: "center" }}>
				<h1 style={{
					fontSize: "0.92rem",
					fontWeight: 400,
					color: "#1a1a1f",
					marginBottom: "0.5rem",
					fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
				}}>
					Choose a use case
				</h1>
				<p style={{
					fontSize: "0.75rem",
					color: "#9b9ba8",
					fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
				}}>
					Watch a Brain learn from real data in real time.
				</p>
			</div>

			<div style={{ display: "flex", gap: "1rem" }}>
				{USE_CASES.map((uc) => (
					<button
						key={uc.id}
						type="button"
						onClick={() => onSelect(uc)}
						style={{
							background: "rgba(255, 255, 255, 0.15)",
							backdropFilter: "blur(24px)",
							WebkitBackdropFilter: "blur(24px)",
							border: "1px solid rgba(155, 155, 168, 0.15)",
							borderRadius: 12,
							padding: "1.25rem 1.5rem",
							cursor: "pointer",
							textAlign: "left",
							maxWidth: 260,
							transition: "border-color 0.15s, box-shadow 0.15s",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.borderColor = "rgba(26, 26, 31, 0.2)"
							e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.06)"
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.borderColor = "rgba(155, 155, 168, 0.15)"
							e.currentTarget.style.boxShadow = "none"
						}}
					>
						<div style={{
							fontSize: "0.82rem",
							fontWeight: 500,
							color: "#1a1a1f",
							marginBottom: "0.35rem",
							fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
						}}>
							{uc.title}
						</div>
						<div style={{
							fontSize: "0.7rem",
							color: "#6b6b78",
							lineHeight: 1.5,
							fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
						}}>
							{uc.description}
						</div>
					</button>
				))}
			</div>
		</div>
	)
}
