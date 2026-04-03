import { type NextRequest } from "next/server"

// Concurrency limiter — OpenRouter can't handle too many simultaneous calls
const MAX_CONCURRENT = 8
let running = 0
const queue: Array<{ resolve: () => void }> = []

function acquire(): Promise<void> {
	if (running < MAX_CONCURRENT) {
		running++
		return Promise.resolve()
	}
	return new Promise((resolve) => queue.push({ resolve }))
}

function release() {
	const next = queue.shift()
	if (next) {
		next.resolve()
	} else {
		running--
	}
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path } = await params
	const target = `https://openrouter.ai/api/v1/${path.join("/")}`
	const body = await req.text()

	await acquire()
	try {
		const res = await fetch(target, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
			},
			body,
		})

		return new Response(res.body, {
			status: res.status,
			headers: {
				"Content-Type": res.headers.get("Content-Type") ?? "application/json",
			},
		})
	} finally {
		release()
	}
}
