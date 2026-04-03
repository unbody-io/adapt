'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const GLYPHS = '!@#$%^&*_+-=|;:<>?~01'.split('')
const rand = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]

function scramble(
  target: string,
  steps: number,
  interval: number,
  onFrame: (text: string) => void,
  onDone: () => void,
) {
  let frame = 0
  const id = setInterval(() => {
    onFrame(
      target
        .split('')
        .map((ch, i) =>
          ch === ' ' || i <= (frame / steps) * target.length
            ? ch
            : rand(GLYPHS),
        )
        .join(''),
    )
    if (++frame > steps) {
      onFrame(target)
      clearInterval(id)
      onDone()
    }
  }, interval)
  return () => clearInterval(id)
}

interface ScrambleTextProps {
  text: string | string[]
  steps?: number
  interval?: number
  pause?: number
  className?: string
}

export function ScrambleText({
  text,
  steps = 8,
  interval = 60,
  pause = 2000,
  className,
}: ScrambleTextProps) {
  const [display, setDisplay] = useState('')
  const idxRef = useRef(0)
  const cleanupRef = useRef<(() => void) | null>(null)

  const texts = Array.isArray(text) ? text : [text]

  const run = useCallback(() => {
    const current = texts[idxRef.current % texts.length]
    cleanupRef.current = scramble(current, steps, interval, setDisplay, () => {
      if (texts.length > 1) {
        idxRef.current++
        setTimeout(run, pause)
      }
    })
  }, [texts, steps, interval, pause])

  useEffect(() => {
    idxRef.current = 0
    run()
    return () => cleanupRef.current?.()
  }, [run])

  return <span className={className}>{display}</span>
}
