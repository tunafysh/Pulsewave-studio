"use client"

import type React from "react"

import { useRef, useEffect, useCallback } from "react"
import { Slider } from "@/components/ui/slider"

interface AudioVisualizerProps {
  currentTime: number
  duration: number
  rainbowMode: boolean
  analyser: AnalyserNode | null
  dataArray: Uint8Array | null
  onSeek: (newTime: number[]) => void
}

export default function AudioVisualizer({
  currentTime,
  duration,
  rainbowMode,
  analyser,
  dataArray,
  onSeek,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Set canvas dimensions with proper scaling for high DPI displays
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.scale(dpr, dpr)
    }
  }, [])

  // Draw waveform visualization
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !analyser || !dataArray) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Get frequency data
    analyser.getByteFrequencyData(dataArray)

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate dimensions
    const width = canvas.width
    const height = canvas.height
    const progressPosition = (currentTime / Math.max(duration, 1)) * width

    // We'll use a subset of the frequency data (focus on audible range)
    const usableDataLength = Math.min(dataArray.length, 160) // Focus on lower frequencies

    // Number of segments to draw
    const segmentCount = 150
    const segmentWidth = width / segmentCount

    // Draw the waveform using a simplified approach
    // First, create an array of heights
    const heights = []

    for (let i = 0; i < segmentCount; i++) {
      // Calculate normalized position (0 to 1)
      const normalizedPosition = i / (segmentCount - 1)

      // Create a symmetrical pattern where the middle has the highest values (low, high, low)
      const patternPosition = Math.abs(normalizedPosition * 2 - 1) // 1 to 0 to 1

      // Map this position to our frequency data
      const dataIndex = Math.floor(patternPosition * usableDataLength * 0.5)

      // Get the frequency value and normalize it
      const frequencyValue = dataArray[dataIndex]
      const normalizedValue = frequencyValue / 255

      // Apply non-linear scaling to boost visibility of quieter sounds
      const sensitivity = 1.2
      const boostedValue = Math.pow(normalizedValue, 0.7) * sensitivity

      // Calculate height with a minimum to ensure visibility
      const minHeight = height * 0.1
      const maxHeight = height * 0.8
      const barHeight = minHeight + boostedValue * (maxHeight - minHeight)

      heights.push(barHeight)
    }

    // Apply additional smoothing to the heights
    const smoothedHeights = []
    const smoothingFactor = 3 // Higher = more smoothing

    for (let i = 0; i < heights.length; i++) {
      let sum = 0
      let count = 0

      // Average the heights around this point
      for (let j = Math.max(0, i - smoothingFactor); j <= Math.min(heights.length - 1, i + smoothingFactor); j++) {
        sum += heights[j]
        count++
      }

      smoothedHeights.push(sum / count)
    }

    // Calculate the center line of the waveform
    const centerY = height / 2

    // Create a gradient that represents the duration
    const createDurationGradient = (ctx: CanvasRenderingContext2D, alpha = 1) => {
      const gradient = ctx.createLinearGradient(0, 0, width, 0)

      if (rainbowMode) {
        // Rainbow gradient
        gradient.addColorStop(0, `hsla(0, 100%, 50%, ${alpha})`) // Red
        gradient.addColorStop(0.17, `hsla(60, 100%, 50%, ${alpha})`) // Yellow
        gradient.addColorStop(0.33, `hsla(120, 100%, 50%, ${alpha})`) // Green
        gradient.addColorStop(0.5, `hsla(180, 100%, 50%, ${alpha})`) // Cyan
        gradient.addColorStop(0.67, `hsla(240, 100%, 50%, ${alpha})`) // Blue
        gradient.addColorStop(0.83, `hsla(270, 100%, 50%, ${alpha})`) // Purple
        gradient.addColorStop(1, `hsla(300, 100%, 50%, ${alpha})`) // Pink
      } else {
        // Primary color gradient that changes hue slightly across duration
        gradient.addColorStop(0, `hsla(178, 51%, 51%, ${alpha})`)
        gradient.addColorStop(1, `hsla(178, 51%, 51%, ${alpha})`)
      }

      return gradient
    }

    // Draw the played portion
    if (progressPosition > 0) {
      ctx.beginPath()

      // Start at the center-left
      ctx.moveTo(0, centerY)

      // Draw the top curve
      for (let i = 0; i < segmentCount; i++) {
        const x = i * segmentWidth
        if (x > progressPosition) break

        const barHeight = smoothedHeights[i]
        const y = centerY - barHeight / 2

        ctx.lineTo(x, y)
      }

      // Find the exact progress position
      const progressIndex = Math.min(segmentCount - 1, Math.floor(progressPosition / segmentWidth))
      const progressX = progressPosition
      const progressBarHeight = smoothedHeights[progressIndex]
      const progressTopY = centerY - progressBarHeight / 2

      // Draw a line to the exact progress position
      ctx.lineTo(progressX, progressTopY)

      // Draw a line down to the bottom of the waveform at the progress position
      const progressBottomY = centerY + progressBarHeight / 2
      ctx.lineTo(progressX, progressBottomY)

      // Draw the bottom curve (mirror of the top)
      for (let i = progressIndex; i >= 0; i--) {
        const x = i * segmentWidth
        const barHeight = smoothedHeights[i]
        const y = centerY + barHeight / 2

        ctx.lineTo(x, y)
      }

      // Close the path back to the start
      ctx.lineTo(0, centerY)
      ctx.closePath()

      // Fill with the duration-based gradient
      ctx.fillStyle = createDurationGradient(ctx, 1)
      ctx.fill()
    }

    // Draw the unplayed portion
    if (progressPosition < width) {
      ctx.beginPath()

      // Find the exact progress position
      const progressIndex = Math.min(segmentCount - 1, Math.floor(progressPosition / segmentWidth))
      const progressX = progressPosition
      const progressBarHeight = smoothedHeights[progressIndex]
      const progressTopY = centerY - progressBarHeight / 2

      // Start at the top of the progress position
      ctx.moveTo(progressX, progressTopY)

      // Draw the top curve from progress to end
      for (let i = progressIndex + 1; i < segmentCount; i++) {
        const x = i * segmentWidth
        const barHeight = smoothedHeights[i]
        const y = centerY - barHeight / 2

        ctx.lineTo(x, y)
      }

      // Draw a line to the bottom-right corner of the last segment
      const lastIndex = segmentCount - 1
      const lastX = lastIndex * segmentWidth
      const lastBarHeight = smoothedHeights[lastIndex]
      const lastBottomY = centerY + lastBarHeight / 2

      ctx.lineTo(lastX, lastBottomY)

      // Draw the bottom curve from end back to progress
      for (let i = segmentCount - 2; i >= progressIndex; i--) {
        const x = i * segmentWidth
        const barHeight = smoothedHeights[i]
        const y = centerY + barHeight / 2

        ctx.lineTo(x, y)
      }

      // Close the path back to the progress position
      const progressBottomY = centerY + progressBarHeight / 2
      ctx.lineTo(progressX, progressBottomY)
      ctx.closePath()

      // Fill with the faded duration-based gradient
      ctx.fillStyle = createDurationGradient(ctx, 0.3)
      ctx.fill()
    }

    animationRef.current = requestAnimationFrame(drawWaveform)
  }, [currentTime, duration, rainbowMode, analyser, dataArray])

  // Update visualization
  useEffect(() => {
    // Start animation
    animationRef.current = requestAnimationFrame(drawWaveform)

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [drawWaveform])

  // Handle seeking with canvas click
  const handleCanvasSeek = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || duration === 0) return

    const rect = canvas.getBoundingClientRect()
    const clickPosition = event.clientX - rect.left
    const seekPercentage = clickPosition / rect.width
    const seekTime = seekPercentage * duration

    // Use the provided seek function to handle the actual seeking
    onSeek([seekTime])
  }

  return (
    <>
      {/* Canvas visualization */}
      <canvas ref={canvasRef} className="w-full h-full cursor-pointer" onClick={handleCanvasSeek} />

      {/* Invisible slider for accessibility */}
      <div className="absolute inset-0 opacity-0 flex items-center">
        <Slider className="h-full" value={[currentTime]} max={duration || 0} step={0.1} onValueChange={onSeek} />
      </div>
    </>
  )
}

