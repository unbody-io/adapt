import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react"
import type { Learner, BrainEvent } from "../types"
import { BlobManager, MAX_BLOBS } from "./mycelium/blob-manager"
import { VERTEX_SHADER, FRAGMENT_SHADER } from "./mycelium/shader"

export interface MyceliumHandle {
	getBlobScreenPos: (learnerId: string) => { x: number; y: number; radius: number } | null
}

interface Props {
	learners: Learner[]
	events: BrainEvent[]
	onSelectLearner?: (learnerId: string | null) => void
	selectedLearnerId?: string | null
}

function createShader(
	gl: WebGLRenderingContext,
	type: number,
	source: string,
): WebGLShader | null {
	const shader = gl.createShader(type)
	if (!shader) return null
	gl.shaderSource(shader, source)
	gl.compileShader(shader)
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error("Shader compile error:", gl.getShaderInfoLog(shader))
		gl.deleteShader(shader)
		return null
	}
	return shader
}

function createProgram(
	gl: WebGLRenderingContext,
	vs: WebGLShader,
	fs: WebGLShader,
): WebGLProgram | null {
	const program = gl.createProgram()
	if (!program) return null
	gl.attachShader(program, vs)
	gl.attachShader(program, fs)
	gl.linkProgram(program)
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error("Program link error:", gl.getProgramInfoLog(program))
		gl.deleteProgram(program)
		return null
	}
	return program
}

const ACTIVITY_LABELS: Record<string, string> = {
	observing: "observing",
	synthesizing: "synthesizing",
	idle: "",
}

export const Mycelium = forwardRef<MyceliumHandle, Props>(function Mycelium({ learners, events, onSelectLearner, selectedLearnerId }, ref) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const managerRef = useRef(new BlobManager())

	useImperativeHandle(ref, () => ({
		getBlobScreenPos: (learnerId: string) => {
			const canvas = canvasRef.current
			if (!canvas) return null
			const pos = managerRef.current.getBlobScreenPos(learnerId, canvas.width, canvas.height)
			if (!pos) return null
			const rect = canvas.getBoundingClientRect()
			const scaleX = rect.width / canvas.width
			const scaleY = rect.height / canvas.height
			return {
				x: rect.left + pos.x * scaleX,
				y: rect.top + pos.y * scaleY,
				radius: pos.radius * Math.min(scaleX, scaleY),
			}
		},
	}), [])
	const glRef = useRef<{
		offscreen: HTMLCanvasElement
		gl: WebGLRenderingContext
		program: WebGLProgram
		locs: {
			resolution: WebGLUniformLocation | null
			time: WebGLUniformLocation | null
			blobCount: WebGLUniformLocation | null
			injection: WebGLUniformLocation | null
			blobs: (WebGLUniformLocation | null)[]
			blobData: (WebGLUniformLocation | null)[]
		}
	} | null>(null)
	const rafRef = useRef(0)
	const startTimeRef = useRef(performance.now() / 1000)
	const prevTimeRef = useRef(performance.now() / 1000)
	const prevLearnersRef = useRef<string[]>([])
	const processedEventsRef = useRef(new Set<string>())

	// ─── Sync learners with blob manager ────────────────────────────

	useEffect(() => {
		const manager = managerRef.current
		const currentIds = learners.map((l) => l.id)
		const prevIds = prevLearnersRef.current

		for (const learner of learners) {
			if (!prevIds.includes(learner.id)) {
				manager.addLearner(learner.id, learner.name)
			}
		}

		for (const prevId of prevIds) {
			if (!currentIds.includes(prevId)) {
				manager.removeLearner(prevId)
			}
		}

		for (const learner of learners) {
			manager.updateUnderstandingSize(learner.id, learner.understandingSize)
			manager.updateActivity(learner.id, learner.activity)
			const blob = manager.blobs.find((b) => b.learnerId === learner.id)
			if (blob) {
				if (!blob.name) blob.name = learner.name
				// Sync metrics from state to blob for label rendering
				blob.observationCount = learner.metrics.observations
				blob.synthesisCount = learner.metrics.syntheses
			}
		}

		prevLearnersRef.current = currentIds
	}, [learners])

	// ─── Process events → blob reactions ────────────────────────────

	useEffect(() => {
		const manager = managerRef.current
		const processed = processedEventsRef.current

		for (const event of events) {
			if (processed.has(event.id)) continue
			processed.add(event.id)

			const payload = event.payload as Record<string, unknown>
			const learnerId = payload.learnerId as string | undefined

			switch (event.type) {
				case "brain:init:started":
					manager.onInitStarted()
					break
				case "brain:init:config:generated": {
					const configs = payload.configs as unknown[]
					if (Array.isArray(configs)) {
						manager.onConfigGenerated(configs.length)
					}
					break
				}
				case "brain:init:completed":
					manager.dissolveNucleus()
					break
				case "inject:started":
					manager.onInjection()
					break
				case "learner:observed":
					if (learnerId) manager.onObserved(learnerId)
					break
				case "learner:observe:dismissed":
					if (learnerId) manager.onDismissed(learnerId)
					break
				case "learner:synthesized":
					if (learnerId) {
						const sig = (payload.significance as number) ?? 0.5
						const gaps = payload.gaps as string[] | undefined
						manager.onSynthesized(learnerId, sig, gaps)
					}
					break
				case "learner:health:updated":
					if (learnerId) {
						manager.updateHealth(
							learnerId,
							(payload.activation as number) ?? 0.5,
							(payload.status as string) ?? "active",
						)
					}
					break
				case "evolution:action:executed": {
					const action = payload.action as string
					const result = payload.result as Record<string, unknown> | undefined
					const targets = payload.targets as string[] | undefined
					if (action === "merge" && result && targets) {
						const newIds = (result.newLearnerIds ?? result.created) as string[] | undefined
						if (newIds?.[0]) {
							manager.onMerge(targets, newIds[0])
						}
					} else if (action === "split" && result && targets?.[0]) {
						const newIds = (result.newLearnerIds ?? result.created) as string[] | undefined
						if (newIds?.length) {
							manager.onSplit(targets[0], newIds)
						}
					}
					break
				}
			}
		}

		if (processed.size > 500) {
			const arr = Array.from(processed)
			for (let i = 0; i < arr.length - 200; i++) {
				processed.delete(arr[i])
			}
		}
	}, [events])

	// ─── Click handling ────────────────────────────────────────────

	const handleCanvasClick = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			if (!onSelectLearner) return
			const canvas = canvasRef.current
			if (!canvas) return
			const rect = canvas.getBoundingClientRect()
			// Convert CSS click coords to canvas pixel coords
			const scaleX = canvas.width / rect.width
			const scaleY = canvas.height / rect.height
			const x = (e.clientX - rect.left) * scaleX
			const y = (e.clientY - rect.top) * scaleY
			const hit = managerRef.current.hitTest(x, y, canvas.width, canvas.height)
			onSelectLearner(hit)
		},
		[onSelectLearner],
	)

	// ─── Setup offscreen WebGL ──────────────────────────────────────

	const initGL = useCallback(() => {
		const offscreen = document.createElement("canvas")
		offscreen.width = 800
		offscreen.height = 600

		const gl = offscreen.getContext("webgl", { preserveDrawingBuffer: true })
		if (!gl) return null

		const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
		const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
		if (!vs || !fs) return null

		const program = createProgram(gl, vs, fs)
		if (!program) return null

		const buffer = gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)

		const posLoc = gl.getAttribLocation(program, "a_position")
		gl.enableVertexAttribArray(posLoc)
		gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

		const blobs: (WebGLUniformLocation | null)[] = []
		const blobData: (WebGLUniformLocation | null)[] = []
		for (let i = 0; i < MAX_BLOBS; i++) {
			blobs.push(gl.getUniformLocation(program, `u_blobs[${i}]`))
			blobData.push(gl.getUniformLocation(program, `u_blobData[${i}]`))
		}

		gl.useProgram(program)

		return {
			offscreen, gl, program,
			locs: {
				resolution: gl.getUniformLocation(program, "u_resolution"),
				time: gl.getUniformLocation(program, "u_time"),
				blobCount: gl.getUniformLocation(program, "u_blobCount"),
				injection: gl.getUniformLocation(program, "u_injection"),
				blobs, blobData,
			},
		}
	}, [])

	// ─── Render loop ────────────────────────────────────────────────

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const w = 800
		const h = 600
		canvas.width = w
		canvas.height = h

		const ctx2d = canvas.getContext("2d")
		if (!ctx2d) return

		const glCtx = initGL()
		if (!glCtx) return
		glRef.current = glCtx
		const { offscreen, gl, locs } = glCtx
		const glW = offscreen.width
		const glH = offscreen.height

		const render = () => {
			rafRef.current = requestAnimationFrame(render)

			const now = performance.now() / 1000
			const t = now - startTimeRef.current
			const dt = now - prevTimeRef.current
			prevTimeRef.current = now

			managerRef.current.update(dt)

			gl.viewport(0, 0, glW, glH)
			gl.clearColor(1.0, 1.0, 1.0, 1.0)
			gl.clear(gl.COLOR_BUFFER_BIT)

			gl.uniform2f(locs.resolution!, glW, glH)
			gl.uniform1f(locs.time!, t)
			gl.uniform1i(locs.blobCount!, managerRef.current.count)
			gl.uniform1f(locs.injection!, managerRef.current.injectionPulse)

			const positions = managerRef.current.packPositions()
			const data = managerRef.current.packData()

			for (let i = 0; i < managerRef.current.count; i++) {
				const loc = locs.blobs[i]
				if (loc) gl.uniform4f(loc, positions[i * 4], positions[i * 4 + 1], positions[i * 4 + 2], positions[i * 4 + 3])
				const dLoc = locs.blobData[i]
				if (dLoc) gl.uniform4f(dLoc, data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3])
			}

			gl.drawArrays(gl.TRIANGLES, 0, 6)

			// Copy to visible 2D canvas
			ctx2d.drawImage(offscreen, 0, 0)

			// ─── Labels ────────────────────────────────────────────
			const manager = managerRef.current
			for (let i = 0; i < manager.count; i++) {
				const blob = manager.blobs[i]
				if (!blob.name || blob.life < 0.3) continue
				const px = (blob.x * 0.5 + 0.5) * w
				const py = (1.0 - (blob.y * 0.5 + 0.5)) * h
				const blobRadiusPx = blob.radius * blob._radiusScale * Math.min(w, h) * 0.5
				const labelY = py + blobRadiusPx + 8
				const alpha = Math.min(blob.life, 1.0)
				const isActive = blob.activity !== "idle"

				// Name — brighter when active
				ctx2d.font = `500 11px "SF Mono", "Fira Code", "Cascadia Code", monospace`
				ctx2d.textAlign = "center"
				ctx2d.textBaseline = "top"
				const nameAlpha = isActive ? alpha * 0.95 : alpha * 0.75
				ctx2d.fillStyle = `rgba(50, 50, 60, ${nameAlpha})`
				ctx2d.fillText(blob.name, px, labelY)

				// Metrics line: counters + activity status
				const activityLabel = ACTIVITY_LABELS[blob.activity] || ""
				const metricsText = activityLabel
					? `${blob.observationCount} obs · ${activityLabel}`
					: blob.observationCount > 0
						? `${blob.observationCount} obs · ${blob.synthesisCount} syn`
						: ""

				if (metricsText) {
					ctx2d.font = `9px "SF Mono", "Fira Code", "Cascadia Code", monospace`
					ctx2d.fillStyle = isActive
						? `rgba(70, 70, 80, ${alpha * 0.85})`
						: `rgba(120, 120, 135, ${alpha * 0.45})`
					ctx2d.fillText(metricsText, px, labelY + 14)
				}
			}
		}

		rafRef.current = requestAnimationFrame(render)

		return () => {
			cancelAnimationFrame(rafRef.current)
		}
	}, [initGL])

	return (
		<canvas
			ref={canvasRef}
			className="mycelium"
			width={800}
			height={600}
			style={{ width: 800, height: 600, cursor: onSelectLearner ? "pointer" : "default" }}
			onClick={handleCanvasClick}
		/>
	)
})
