import { useState } from "react"
import { Landing } from "./components/Landing"
import { Demo } from "./components/Demo"

interface Selection {
	useCaseId: string
	version: string
}

export default function App() {
	const [selection, setSelection] = useState<Selection | null>(null)

	if (selection) {
		return (
			<Demo
				useCaseId={selection.useCaseId}
				version={selection.version}
				onBack={() => setSelection(null)}
			/>
		)
	}

	return (
		<Landing
			onSelect={(id, version) => setSelection({ useCaseId: id, version })}
		/>
	)
}
