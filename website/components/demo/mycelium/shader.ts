/**
 * Mycelium shader — metaballs with contour rings, breathing, pulse glow.
 * Avoids local arrays and loop-variable indexing (ANGLE/Metal miscompilation).
 */

import { MAX_BLOBS } from "./blob-manager"

export const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`

export const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform int u_blobCount;
uniform vec4 u_blobs[${MAX_BLOBS}];
uniform vec4 u_blobData[${MAX_BLOBS}];
uniform float u_injection;

#define FIELD_THRESHOLD 1.0
#define BREATHE_DEPTH 0.18

float hash1(float p) {
	p = fract(p * 0.1031);
	p *= p + 33.33;
	p *= p + p;
	return fract(p);
}

float hash1v(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash1v(i + vec2(0,0)), hash1v(i + vec2(1,0)), u.x),
		mix(hash1v(i + vec2(0,1)), hash1v(i + vec2(1,1)), u.x),
		u.y
	) * 2.0 - 1.0;
}

float wander(vec2 seed, float t) {
	return vnoise(seed + vec2(t * 0.31, t * 0.17))
		 + 0.4 * vnoise(seed * 2.3 + vec2(t * 0.61, t * 0.43));
}

// Noisy, alive membrane ripple — multi-octave angular distortion
float membraneRipple(vec2 p, float t, float distress, float activity) {
	vec2 n = normalize(p + vec2(0.0001));
	float a = atan(n.y, n.x);
	float d = length(p);

	// Base ripple — slow, organic
	float base = sin(a * 6.0 + t * 1.2) * cos(a * 4.0 - t * 0.8)
		+ 0.5 * sin(a * 11.0 - t * 2.3);

	// Stress harmonics — faster, noisier when distressed
	float stress = sin(a * 17.0 + t * 4.5) * 0.4
		+ sin(a * 23.0 - t * 6.1) * 0.3
		+ sin(a * 31.0 + t * 8.3) * 0.2;

	// Activity noise — high-frequency turbulence when busy
	float turb = 0.0;
	if (activity > 0.01) {
		turb = vnoise(vec2(a * 3.0, t * 2.0 + d * 5.0)) * 0.6
			+ vnoise(vec2(a * 7.0 + t * 1.5, d * 10.0)) * 0.3;
	}

	float amplitude = 0.04 + 0.06 * distress + 0.10 * activity;
	return amplitude * (base + stress * distress + turb * activity);
}

// Compute one contour ring band
float ringBand(float F, float level, float ripple, float bandWidth, float opacity) {
	float lvl = level + ripple * level;
	float dist = abs(F - lvl);
	float band = 1.0 - smoothstep(0.0, bandWidth, dist);
	return band * opacity;
}

void main() {
	vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
	float t = mod(u_time, 600.0);

	if (u_blobCount == 0) {
		gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
		return;
	}

	// Metaball field
	float F = 0.0;
	float wActivation = 0.0;
	float wMembrane = 0.0;
	float wDistress = 0.0;
	float wActivity = 0.0;
	// Pulse glow accumulator (computed in same loop to avoid second pass)
	vec3 pulseGlow = vec3(0.0);

	for (int i = 0; i < ${MAX_BLOBS}; i++) {
		if (i >= u_blobCount) break;
		vec4 blob = u_blobs[i];
		vec4 bdata = u_blobData[i];

		float life = blob.w;
		if (life < 0.001) continue;

		float activation = bdata.x;
		float pulse = bdata.y;
		float membrane = bdata.z;
		float activity = bdata.w; // 0=idle, 0.5=observing, 1.0=synthesizing
		float fi = float(i);

		vec2 seed = vec2(fi * 1.631 + 0.5, fi * 2.917 + 0.5);

		// Active blobs drift more — organic, restless movement
		float driftAmt = 0.08 + 0.06 * activity;
		float driftSpd = 0.45 + 0.35 * activity;
		vec2 drift = vec2(
			wander(seed, t * driftSpd),
			wander(seed + vec2(5.3, 9.7), t * driftSpd)
		) * driftAmt * life;
		vec2 pos = blob.xy + drift;

		// Active blobs: faster, deeper breathing
		float breathPhase = hash1(fi * 11.3) * 6.2832;
		float breathFreq = (0.4 + 0.6 * hash1(fi * 2.9)) * (0.5 + 0.5 * activation);
		float breathAmp = BREATHE_DEPTH + 0.08 * activity;
		float breath = 1.0 + breathAmp * sin(t * breathFreq + breathPhase);

		// Active blobs: gentle organic edge wobble (not crazy, just alive)
		float deform = 0.0;
		if (activity > 0.01) {
			vec2 nn = normalize(uv - pos + vec2(0.0001));
			float aa = atan(nn.y, nn.x);
			deform = activity * 0.003 * (
				sin(aa * 3.0 + t * 0.8)
				+ 0.4 * sin(aa * 5.0 - t * 1.2)
			);
		}

		float actScale = 0.8 + 0.2 * activation;
		float r = blob.z * breath * life * actScale + deform;

		vec2 dd = uv - pos;
		float d2 = dot(dd, dd);
		float r2 = r * r;
		float contribution = r2 / max(d2, r2 * 0.01);
		F += contribution;

		wActivation += contribution * activation;
		wMembrane += contribution * membrane;
		wActivity += contribution * activity;
		// Active blobs contribute more distress → ripplier contours
		wDistress += contribution * ((1.0 - activation) + activity * 0.6);

		// Pulse glow (inline, no second loop)
		if (pulse > 0.01) {
			float pd = length(uv - blob.xy);
			float pr = blob.z * life;
			float glow = pulse * life * smoothstep(pr * 4.0, pr * 0.3, pd) * 0.2;
			pulseGlow += vec3(glow * 0.4, glow * 0.15, 0.0);
		}
	}

	float avgActivation = F > 0.001 ? wActivation / F : 0.5;
	float avgMembrane = F > 0.001 ? wMembrane / F : 0.5;
	float avgDistress = F > 0.001 ? wDistress / F : 0.0;
	float avgActivity = F > 0.001 ? wActivity / F : 0.0;

	// Fill
	float aa = 2.0 / u_resolution.y;
	float fill = 1.0 - smoothstep(FIELD_THRESHOLD - aa, FIELD_THRESHOLD + aa, F);

	// Membrane contour rings — noisy, alive, many layers
	float ripple = membraneRipple(uv, t, avgDistress, avgActivity);

	// Ring spread: idle = tight, active = wide and dramatic
	float ringSpread = 0.6 + 0.4 * avgMembrane + 0.5 * avgActivity;

	// Ring opacity scales with membrane and activity
	float ringAlpha = 0.15 + 0.12 * avgMembrane + 0.15 * avgActivity;

	// 6 contour rings — spread out more, thicker bands when active
	float bw = 0.012 + 0.008 * avgActivity; // band width grows when active
	float outline = 0.0;
	outline += ringBand(F, FIELD_THRESHOLD * (1.0 - 0.06 * ringSpread), ripple, bw, 1.0);
	outline += ringBand(F, FIELD_THRESHOLD * (1.0 - 0.14 * ringSpread), ripple, bw * 1.3, 0.75 * ringSpread);
	outline += ringBand(F, FIELD_THRESHOLD * (1.0 - 0.24 * ringSpread), ripple, bw * 1.6, 0.55 * ringSpread);
	outline += ringBand(F, FIELD_THRESHOLD * (1.0 - 0.36 * ringSpread), ripple, bw * 1.9, 0.38 * ringSpread);
	outline += ringBand(F, FIELD_THRESHOLD * (1.0 - 0.50 * ringSpread), ripple, bw * 2.2, 0.22 * ringSpread);
	outline += ringBand(F, FIELD_THRESHOLD * (1.0 - 0.66 * ringSpread), ripple, bw * 2.5, 0.12 * ringSpread);
	outline = clamp(outline * ringAlpha, 0.0, 1.0);

	// Composite
	vec3 col = vec3(1.0);
	col = mix(vec3(0.0), col, fill);

	float outlineVis = outline * fill;
	col = mix(col, vec3(0.06), outlineVis);

	float innerGlow = 1.0 - smoothstep(FIELD_THRESHOLD, FIELD_THRESHOLD * 1.3, F);
	innerGlow *= (1.0 - fill);
	col += innerGlow * (0.05 + 0.04 * avgActivation);

	col += pulseGlow;

	// Injection ripple
	if (u_injection > 0.01) {
		float edgeDist = length(uv) * 0.7;
		float wave = sin(edgeDist * 18.0 - t * 5.0) * 0.5 + 0.5;
		wave *= smoothstep(0.2, 0.9, edgeDist);
		float inj = wave * u_injection * 0.03;
		col = mix(col, col - vec3(inj), fill);
	}

	col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));

	gl_FragColor = vec4(col, 1.0);
}
`
