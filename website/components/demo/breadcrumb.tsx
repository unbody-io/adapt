const mono = '"SF Mono", "Fira Code", "Cascadia Code", monospace'

interface Props {
	useCaseName?: string
}

export function DemoBreadcrumb({ useCaseName }: Props) {
	return (
		<nav
			style={{
				position: "fixed",
				top: "1rem",
				left: "calc(1rem + 4.2em)",
				zIndex: 50,
				display: "flex",
				alignItems: "center",
				gap: "0.4em",
				fontSize: "0.85rem",
				fontFamily: mono,
				color: "#9b9ba8",
			}}
		>
			<span>/</span>
			<span style={{ color: useCaseName ? "#9b9ba8" : "#1a1a1f" }}>
				Demo
			</span>
			{useCaseName && (
				<>
					<span>/</span>
					<span style={{ color: "#1a1a1f" }}>{useCaseName}</span>
				</>
			)}
		</nav>
	)
}
