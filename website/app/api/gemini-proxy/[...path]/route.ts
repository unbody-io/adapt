import { type NextRequest } from "next/server"

// Concurrency limiter — keep parallel calls bounded like the OpenRouter proxy.
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

// Forwards the native Google Generative Language API. The browser uses the
// @ai-sdk/google provider with baseURL "/api/gemini-proxy/v1beta" and a dummy
// key; we inject the real GOOGLE_GEMINI_API_KEY here so it never reaches the client.
export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path } = await params
	const target = `https://generativelanguage.googleapis.com/${path.join("/")}${req.nextUrl.search}`
	const body = await req.text()

	await acquire()
	try {
		const res = await fetch(target, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": process.env.GOOGLE_GEMINI_API_KEY ?? "",
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
