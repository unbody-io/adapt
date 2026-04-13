import Link from "next/link"

export function CloseButton() {
	return (
		<Link
			href="/"
			style={{
				position: "fixed",
				top: "1rem",
				right: "1rem",
				zIndex: 70,
				background: "none",
				border: "none",
				cursor: "pointer",
				fontSize: "1.4rem",
				color: "#9b9ba8",
				padding: "0.5rem 0.75rem",
				lineHeight: 1,
				textDecoration: "none",
				transition: "color 0.15s",
			}}
		>
			&times;
		</Link>
	)
}
