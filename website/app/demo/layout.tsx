export default function DemoLayout({ children }: { children: React.ReactNode }) {
	return (
		<div style={{ width: "100%", height: "100vh", overflow: "hidden" }}>
			{children}
		</div>
	)
}
