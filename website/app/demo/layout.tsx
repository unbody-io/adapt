export default function DemoLayout({ children }: { children: React.ReactNode }) {
	return (
		<div style={{ width: "100%", height: "100dvh", overflow: "hidden" }}>
			{children}
		</div>
	)
}
