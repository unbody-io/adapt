import { type NextRequest, NextResponse } from "next/server"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText, Output } from "ai"
import { z } from "zod"

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })

const schema = z.object({
	intent: z.enum(["ask", "signal"]),
	reasoning: z.string().describe("Brief explanation of why this is a question or a signal"),
})

export async function POST(req: NextRequest) {
	const { query, neurons } = await req.json() as {
		query: string
		neurons: { name: string; description?: string }[]
	}

	const neuronList = neurons.map((n) => `- ${n.name}${n.description ? `: ${n.description}` : ""}`).join("\n") || "none"

	try {
		const { output: classified } = await generateText({
			model: openrouter("google/gemini-2.5-flash"),
			output: Output.object({ schema }),
			system: `You are a classifier for a living knowledge network — a Brain with specialist neurons that continuously grow their understanding from incoming data.

Your root question: Is this person asking what the brain knows, or directing what the brain should grow toward?

The Brain has these specialists:
${neuronList}`,
			prompt: query,
		})

		return NextResponse.json({ intent: classified.intent })
	} catch {
		return NextResponse.json({ intent: "ask" })
	}
}
