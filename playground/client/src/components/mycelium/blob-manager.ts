/**
 * Blob State Manager — the choreographer for the mycelium visualization.
 *
 * Manages per-blob state (position, life, pulse, activation, membrane)
 * and handles animated transitions for birth, death, merge, split.
 * The shader is a dumb renderer; all intelligence lives here.
 */

export const MAX_BLOBS = 32

/** Special ID for the nucleus blob that appears before any learners */
const NUCLEUS_ID = "__nucleus__"

export interface BlobState {
	/** Learner ID this blob represents (or NUCLEUS_ID) */
	learnerId: string
	/** Display name for label */
	name: string
	/** Center position in UV space (-1 to 1 range) */
	x: number
	y: number
	/** Base radius (before breathing) */
	radius: number
	/** 0 = not born / fully dead, 1 = fully alive. Animated. */
	life: number
	/** 0 = idle, 1 = just fired. Decays over time. Event-triggered. */
	pulse: number
	/** 0-1 from learner health activation */
	activation: number
	/** 0-1 outer membrane size, driven by gaps/dismissal metrics */
	membrane: number
	/** Temporary radius multiplier for synthesis heartbeat */
	_radiusScale: number
	/** Internal tracking for membrane computation */
	_observeCount: number
	_dismissCount: number
	_gapCount: number
	/** Target position (blob drifts toward this) */
	_targetX: number
	_targetY: number
	/** Current activity for label display */
	activity: "idle" | "observing" | "synthesizing"
	/** Observation count for label display */
	observationCount: number
	/** Synthesis count for label display */
	synthesisCount: number
}

interface PendingAnimation {
	type: "birth" | "death" | "heartbeat"
	blobIndex: number
	startTime: number
	duration: number
}

/**
 * Hash function matching the shader's hash1 —
 * ensures blob positions are consistent between JS and GPU.
 */
function hash1(p: number): number {
	p = ((p * 0.1031) % 1 + 1) % 1
	p *= p + 33.33
	p *= p + p
	return ((p % 1) + 1) % 1
}

/**
 * Golden angle distribution — wide spacing so blobs never overlap.
 * Each index always maps to the same position regardless of total count.
 */
function homePosition(i: number): { x: number; y: number } {
	if (i === 0) return { x: 0, y: 0 }

	const goldenAngle = Math.PI * (3 - Math.sqrt(5))
	const angle = i * goldenAngle
	// Tighter radius to keep blobs within 800x600 canvas bounds
	const radius = 0.3 * Math.sqrt(i) + (hash1(i * 8.71) - 0.5) * 0.04

	return {
		x: clamp(Math.cos(angle) * radius, -0.9, 0.9),
		y: clamp(Math.sin(angle) * radius, -0.7, 0.7),
	}
}

function clamp(v: number, min: number, max: number): number {
	return v < min ? min : v > max ? max : v
}

export class BlobManager {
	blobs: BlobState[] = []
	private animations: PendingAnimation[] = []
	/** Tracks how many real learners have been added (starts at 1 so all drift outward from center) */
	private learnerIndex = 1
	/** How many learners the nucleus will split into (set when config is generated) */
	private expectedLearnerCount = 0
	/** How many learners have been born from the nucleus so far */
	private spawnedFromNucleus = 0
	/** Full radius of the nucleus (set based on expected learner count) */
	private nucleusFullRadius = 0.035

	/** Global injection pulse — decays over time, shader uses for edge ripple */
	injectionPulse = 0

	/** How fast pulse decays (per second) */
	private readonly pulseDecayRate = 2.0
	/** How long birth/death animations take (seconds) */
	private readonly birthDuration = 1.8
	private readonly deathDuration = 2.5
	/** How long the heartbeat animation takes */
	private readonly heartbeatDuration = 0.6
	/** Slow birth for the nucleus */
	private readonly nucleusBirthDuration = 2.5

	// ─── Init / nucleus ─────────────────────────────────────────────

	/** Brain init started — spawn a small nucleus seed at center */
	onInitStarted(): void {
		if (this.blobs.some((b) => b.learnerId === NUCLEUS_ID)) return

		const blob: BlobState = {
			learnerId: NUCLEUS_ID,
			name: "",
			x: 0,
			y: 0,
			_targetX: 0,
			_targetY: 0,
			radius: 0.04,
			life: 0,
			pulse: 0.3,
			activation: 0.9,
			membrane: 0.85,
			_radiusScale: 1.0,
			_observeCount: 0,
			_dismissCount: 0,
			_gapCount: 0,
			activity: "synthesizing", // nucleus always alive with full contour effects
			observationCount: 0,
			synthesisCount: 0,
		}

		this.blobs.push(blob)
		this.animations.push({
			type: "birth",
			blobIndex: this.blobs.length - 1,
			startTime: performance.now() / 1000,
			duration: this.nucleusBirthDuration,
		})
	}

	/** Learner configs generated — we now know how many learners will split from nucleus.
	 *  Grow the nucleus to a size proportional to the count. */
	onConfigGenerated(learnerCount: number): void {
		const nucleus = this.blobs.find((b) => b.learnerId === NUCLEUS_ID)
		if (!nucleus) return

		this.expectedLearnerCount = learnerCount
		this.spawnedFromNucleus = 0

		// Nucleus radius scales with how many learners it contains
		// sqrt so it represents area — 3 learners ≈ 0.14, 6 ≈ 0.18, 10 ≈ 0.22
		this.nucleusFullRadius = 0.08 + 0.045 * Math.sqrt(learnerCount)
		nucleus.radius = this.nucleusFullRadius
		nucleus.pulse = 0.6
	}

	/** Dissolve the nucleus — called when init completes and learners have emerged */
	dissolveNucleus(): void {
		const idx = this.blobs.findIndex((b) => b.learnerId === NUCLEUS_ID)
		if (idx < 0) return

		this.animations.push({
			type: "death",
			blobIndex: idx,
			startTime: performance.now() / 1000,
			duration: 1.2, // slow fade
		})
	}

	// ─── Learner lifecycle ──────────────────────────────────────────

	/** A new learner was created — emerges from the nucleus (center) */
	addLearner(learnerId: string, name: string, spawnX = 0, spawnY = 0): void {
		if (this.blobs.length >= MAX_BLOBS) return
		if (this.blobs.some((b) => b.learnerId === learnerId)) return

		// Spawn at nucleus position — metaball field merges overlapping blobs,
		// so the new blob starts fused with the nucleus and pinches off as it drifts
		const nucleus = this.blobs.find((b) => b.learnerId === NUCLEUS_ID)
		if (nucleus) {
			spawnX = nucleus.x
			spawnY = nucleus.y
		}

		const home = homePosition(this.learnerIndex)
		this.learnerIndex++

		const blob: BlobState = {
			learnerId,
			name,
			x: spawnX,
			y: spawnY,
			_targetX: home.x,
			_targetY: home.y,
			radius: 0.065,
			life: 0.35,
			pulse: 0,
			activation: 0.5,
			membrane: 0.5,
			_radiusScale: 1.0,
			_observeCount: 0,
			_dismissCount: 0,
			_gapCount: 0,
			activity: "idle",
			observationCount: 0,
			synthesisCount: 0,
		}

		this.blobs.push(blob)
		this.animations.push({
			type: "birth",
			blobIndex: this.blobs.length - 1,
			startTime: performance.now() / 1000,
			duration: this.birthDuration,
		})

		// Nucleus reacts: pulse + shrink as each learner splits off
		if (nucleus && this.expectedLearnerCount > 0) {
			this.spawnedFromNucleus++
			nucleus.pulse = Math.min(nucleus.pulse + 0.5, 1.0)
			nucleus._radiusScale = 1.12

			// Shrink nucleus — each split removes a "portion" of its mass
			const remaining = Math.max(0, 1 - this.spawnedFromNucleus / this.expectedLearnerCount)
			// Don't let it vanish completely — dissolveNucleus handles the final fade
			nucleus.radius = this.nucleusFullRadius * Math.max(remaining, 0.15)
		} else if (nucleus) {
			nucleus.pulse = Math.min(nucleus.pulse + 0.5, 1.0)
			nucleus._radiusScale = 1.12
		}
	}

	/** A learner was removed — death animation */
	removeLearner(learnerId: string): void {
		const idx = this.blobs.findIndex((b) => b.learnerId === learnerId)
		if (idx < 0) return

		this.animations.push({
			type: "death",
			blobIndex: idx,
			startTime: performance.now() / 1000,
			duration: this.deathDuration,
		})
	}

	// ─── Event reactions ────────────────────────────────────────────

	/** Data injection started — global edge ripple */
	onInjection(): void {
		this.injectionPulse = 1.0
	}

	/** Learner observed data — small pulse + track metric */
	onObserved(learnerId: string): void {
		const blob = this.findBlob(learnerId)
		if (!blob) return
		blob.pulse = Math.min(blob.pulse + 0.4, 1.0)
		blob._observeCount++
		blob.observationCount++
		this.recomputeMembrane(blob)
	}

	/** Learner dismissed data — brief contraction + track metric */
	onDismissed(learnerId: string): void {
		const blob = this.findBlob(learnerId)
		if (!blob) return
		blob.pulse = Math.min(blob.pulse + 0.15, 1.0)
		blob._dismissCount++
		this.recomputeMembrane(blob)
	}

	/** Learner synthesized understanding — heartbeat animation (contract → expand → settle) */
	onSynthesized(learnerId: string, significance?: number, gaps?: string[]): void {
		const blob = this.findBlob(learnerId)
		if (!blob) return
		blob.pulse = Math.min(0.6 + (significance ?? 0.5) * 0.4, 1.0)
		blob.synthesisCount++

		// Trigger heartbeat animation
		const idx = this.blobs.indexOf(blob)
		if (idx >= 0) {
			this.animations.push({
				type: "heartbeat",
				blobIndex: idx,
				startTime: performance.now() / 1000,
				duration: this.heartbeatDuration,
			})
		}

		if (gaps) {
			blob._gapCount = gaps.length
			this.recomputeMembrane(blob)
		}
	}

	/** Update blob radius from understanding size (string length or item count) */
	updateUnderstandingSize(learnerId: string, size: number): void {
		const blob = this.findBlob(learnerId)
		if (!blob) return
		// Map understanding size to radius: min 0.065, max 0.14
		// Use log scale so early growth is visible, later growth tapers
		const normalized = Math.log1p(size) / Math.log1p(2000)
		blob.radius = 0.065 + Math.min(normalized, 1.0) * 0.075
	}

	/** Update learner health metrics */
	updateHealth(
		learnerId: string,
		activation: number,
		_status: string,
	): void {
		const blob = this.findBlob(learnerId)
		if (blob) {
			blob.activation = activation
		}
	}

	/** Recompute membrane from internal counters */
	private recomputeMembrane(blob: BlobState): void {
		const total = blob._observeCount + blob._dismissCount
		const dismissalRate = total > 0 ? blob._dismissCount / total : 0

		// Gaps expand membrane (reaching out for more data)
		// High dismissal contracts it (rejecting environment)
		// 0.5 is neutral, >0.5 expanding, <0.5 contracting
		const gapFactor = Math.min(blob._gapCount / 10, 1.0) * 0.3
		const dismissFactor = dismissalRate * 0.3
		blob.membrane = Math.max(0.1, Math.min(1.0, 0.5 + gapFactor - dismissFactor))
	}

	// ─── Evolution animations ───────────────────────────────────────

	/** Two learners merge — drift toward each other, then birth new at centroid */
	onMerge(
		deletedIds: string[],
		newLearnerId: string,
	): void {
		// Compute centroid of merging blobs
		const merging = deletedIds
			.map((id) => this.findBlob(id))
			.filter((b): b is BlobState => b != null)

		let cx = 0
		let cy = 0
		for (const b of merging) {
			cx += b.x
			cy += b.y
		}
		if (merging.length > 0) {
			cx /= merging.length
			cy /= merging.length
		}

		// Drift merging blobs toward centroid before killing them
		for (const b of merging) {
			b._targetX = cx
			b._targetY = cy
		}

		// Delayed death — let them converge first
		setTimeout(() => {
			for (const id of deletedIds) {
				this.removeLearner(id)
			}

			// Birth new blob at centroid after death animation
			setTimeout(() => {
				this.addLearner(newLearnerId, "", cx, cy)
			}, this.deathDuration * 600)
		}, 400) // 400ms to drift together
	}

	/** One learner splits — death at position, daughters spawn from parent position */
	onSplit(
		deletedId: string,
		newLearnerIds: string[],
	): void {
		const parent = this.findBlob(deletedId)
		const parentX = parent?.x ?? 0
		const parentY = parent?.y ?? 0

		this.removeLearner(deletedId)

		// Stagger births from the parent's position
		for (let i = 0; i < newLearnerIds.length; i++) {
			setTimeout(() => {
				this.addLearner(newLearnerIds[i], "", parentX, parentY)
			}, this.deathDuration * 500 + i * 200)
		}
	}

	// ─── Frame update ───────────────────────────────────────────────

	/** Call every frame. Advances animations, decays pulses, drifts positions. */
	update(dt: number): void {
		const now = performance.now() / 1000

		// Decay injection pulse
		if (this.injectionPulse > 0) {
			this.injectionPulse = Math.max(0, this.injectionPulse - dt * 0.8)
		}

		// Decay pulses + drift toward target position
		const driftSpeed = 1.5 // how fast blobs drift to their home
		for (const blob of this.blobs) {
			const isActive = blob.activity !== "idle"

			if (blob.pulse > 0) {
				// Active blobs: pulse decays slower, never fully to 0
				const floor = isActive ? 0.15 : 0
				const rate = isActive ? this.pulseDecayRate * 0.5 : this.pulseDecayRate
				blob.pulse = Math.max(floor, blob.pulse - rate * dt)
			} else if (isActive) {
				// Keep a gentle pulse alive while active
				blob.pulse = 0.15
			}

			// Active blobs get boosted activation → shader breathes faster + more glow
			if (isActive) {
				blob.activation = Math.min(1.0, blob.activation + dt * 2.0)
			}

			// Contour rings: oscillate membrane so rings breathe in/out when busy
			if (isActive) {
				// Observing: contours pulse outward rhythmically (reaching for data)
				// Synthesizing: faster, wider contour breathing (processing)
				const baseM = 0.5
				const mSpeed = blob.activity === "synthesizing" ? 2.8 : 1.6
				const mAmp = blob.activity === "synthesizing" ? 0.35 : 0.2
				const phase = blob._targetX * 7.0 + blob._targetY * 5.0 // unique per blob
				const targetM = baseM + mAmp * (0.5 + 0.5 * Math.sin(now * mSpeed + phase))
				blob.membrane += (targetM - blob.membrane) * Math.min(dt * 5, 1)
			} else {
				// Idle: membrane drifts back to its recomputed resting value
				// (already set by recomputeMembrane, just smooth it)
			}

			// Decay radius scale back to 1.0, but active blobs wobble
			if (isActive) {
				const wobbleSpeed = blob.activity === "synthesizing" ? 4.5 : 3.0
				const wobbleAmp = blob.activity === "synthesizing" ? 0.06 : 0.03
				const target = 1.0 + Math.sin(now * wobbleSpeed + blob._targetX * 10) * wobbleAmp
				blob._radiusScale += (target - blob._radiusScale) * Math.min(dt * 8, 1)
			} else if (blob._radiusScale !== 1.0) {
				blob._radiusScale += (1.0 - blob._radiusScale) * Math.min(dt * 4, 1)
				if (Math.abs(blob._radiusScale - 1.0) < 0.001) blob._radiusScale = 1.0
			}

			// Drift uses life² so newborns start slow (stay fused with nucleus)
			// then accelerate as they gain life — creates visible pinch-off
			const lifeFactor = blob.life * blob.life
			const effectiveDrift = driftSpeed * dt * lifeFactor
			blob.x += (blob._targetX - blob.x) * Math.min(effectiveDrift, 1)
			blob.y += (blob._targetY - blob.y) * Math.min(effectiveDrift, 1)
		}

		// Process animations
		for (let i = this.animations.length - 1; i >= 0; i--) {
			const anim = this.animations[i]
			const elapsed = now - anim.startTime
			const t = Math.min(elapsed / anim.duration, 1.0)
			const blob = this.blobs[anim.blobIndex]
			if (!blob) {
				this.animations.splice(i, 1)
				continue
			}

			if (anim.type === "birth") {
				// Lerp from initial life (0.35) to 1.0 — blob starts visible inside nucleus
				// and gradually strengthens as it drifts away, creating a pinch-off
				const startLife = 0.35
				blob.life = startLife + (1.0 - startLife) * easeOutCubic(t)
			} else if (anim.type === "death") {
				// Ease out — fast start, gentle dissolve
				blob.life = 1.0 - easeOutCubic(t)
			} else if (anim.type === "heartbeat") {
				// Contract → expand → settle
				if (t < 0.3) {
					blob._radiusScale = 1.0 - 0.15 * easeOutCubic(t / 0.3)
				} else if (t < 0.6) {
					const st = (t - 0.3) / 0.3
					blob._radiusScale = 0.85 + 0.30 * easeOutCubic(st)
				} else {
					const st = (t - 0.6) / 0.4
					blob._radiusScale = 1.15 - 0.15 * easeOutCubic(st)
				}
			}

			if (t >= 1.0) {
				this.animations.splice(i, 1)

				if (anim.type === "heartbeat") {
					blob._radiusScale = 1.0
				}

				// Clean up dead blobs
				if (anim.type === "death") {
					this.blobs.splice(anim.blobIndex, 1)
					// Fix animation indices that point after removed blob
					for (const other of this.animations) {
						if (other.blobIndex > anim.blobIndex) {
							other.blobIndex--
						}
					}
				}
			}
		}
	}

	// ─── Uniform packing ────────────────────────────────────────────

	/** Pack blob positions + life into a Float32Array for u_blobs uniform (vec4 per blob) */
	packPositions(): Float32Array {
		const data = new Float32Array(MAX_BLOBS * 4)
		for (let i = 0; i < this.blobs.length && i < MAX_BLOBS; i++) {
			const b = this.blobs[i]
			data[i * 4 + 0] = b.x
			data[i * 4 + 1] = b.y
			data[i * 4 + 2] = b.radius * b._radiusScale
			data[i * 4 + 3] = b.life
		}
		return data
	}

	/** Pack blob data into a Float32Array for u_blobData uniform (vec4 per blob) */
	packData(): Float32Array {
		const data = new Float32Array(MAX_BLOBS * 4)
		for (let i = 0; i < this.blobs.length && i < MAX_BLOBS; i++) {
			const b = this.blobs[i]
			data[i * 4 + 0] = b.activation
			data[i * 4 + 1] = b.pulse
			data[i * 4 + 2] = b.membrane
			data[i * 4 + 3] = b.activity === "synthesizing" ? 1.0 : b.activity === "observing" ? 0.5 : 0.0
		}
		return data
	}

	get count(): number {
		return Math.min(this.blobs.length, MAX_BLOBS)
	}

	// ─── Activity + hit testing ─────────────────────────────────────

	/** Update the activity state of a blob (for label display) */
	updateActivity(learnerId: string, activity: "idle" | "observing" | "synthesizing"): void {
		const blob = this.findBlob(learnerId)
		if (blob) blob.activity = activity
	}

	/** Find which blob (if any) was clicked, given canvas pixel coordinates */
	hitTest(canvasX: number, canvasY: number, canvasW: number, canvasH: number): string | null {
		for (const blob of this.blobs) {
			if (blob.learnerId === "__nucleus__" || blob.life < 0.3) continue
			const px = (blob.x * 0.5 + 0.5) * canvasW
			const py = (1.0 - (blob.y * 0.5 + 0.5)) * canvasH
			const blobRadiusPx = blob.radius * blob._radiusScale * Math.min(canvasW, canvasH) * 0.5
			const hitRadius = Math.max(blobRadiusPx + 20, 30) // generous click area
			const dx = canvasX - px
			const dy = canvasY - py
			if (dx * dx + dy * dy <= hitRadius * hitRadius) {
				return blob.learnerId
			}
		}
		return null
	}

	/** Get the screen position of a blob for overlay positioning */
	getBlobScreenPos(learnerId: string, canvasW: number, canvasH: number): { x: number; y: number; radius: number } | null {
		const blob = this.findBlob(learnerId)
		if (!blob || blob.life < 0.3) return null
		return {
			x: (blob.x * 0.5 + 0.5) * canvasW,
			y: (1.0 - (blob.y * 0.5 + 0.5)) * canvasH,
			radius: blob.radius * blob._radiusScale * Math.min(canvasW, canvasH) * 0.5,
		}
	}

	// ─── Helpers ────────────────────────────────────────────────────

	private findBlob(learnerId: string): BlobState | undefined {
		return this.blobs.find((b) => b.learnerId === learnerId)
	}
}

// ─── Easing functions ───────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
	return 1 - (1 - t) ** 3
}
