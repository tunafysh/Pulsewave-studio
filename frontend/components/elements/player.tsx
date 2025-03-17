/* eslint-disable react-hooks/exhaustive-deps */
"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Play, Pause, Volume2, VolumeX } from "lucide-react"
import Image from "next/image"
import Konami from "react-konami"

interface PlayerProps {
  img: string
  isBlurred?: boolean
  httpUrl?: string
  trackTitle?: string
  artistName?: string
  sampleRate?: number
  channels?: number
  bitDepth?: number
}

export default function Player({
  img = "",
  httpUrl = "http://localhost:8000/api/audio",
  trackTitle = "Live Stream",
  artistName = "HTTP PCM",
  sampleRate = 44100,
  channels = 2,
  bitDepth = 16,
}: PlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(0.7)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [bufferStatus, setBufferStatus] = useState(0) // 0-100% buffer fill
  const [rainbowMode, setRainbowMode] = useState(false)
  const [isMetadataLoading, setIsMetadataLoading] = useState(false)
  // Add this state to store the extended props
  const [extendedProps, setExtendedProps] = useState({
    img,
    trackTitle,
    artistName,
  })

  // Audio analysis refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const streamStartTimeRef = useRef<number>(0)
  const audioBufferSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioWorkerRef = useRef<Worker | null>(null)
  const playbackPositionRef = useRef<number>(0)
  const lastPlayTimeRef = useRef<number>(0)
  const streamDurationRef = useRef<number>(0)
  const bufferSizeRef = useRef<number>(0)
  const refreshCountRef = useRef<number>(0)

  // Initialize Web Audio API and Web Worker
  useEffect(() => {
    // Create audio context
    const AudioContext = window.AudioContext
    const audioContext = new AudioContext({
      sampleRate: sampleRate,
    })
    audioContextRef.current = audioContext

    // Create analyzer
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 512 // Increased for more detail
    analyser.smoothingTimeConstant = 0.8 // Higher value = smoother (0-1)
    analyserRef.current = analyser

    // Create gain node for volume control
    const gainNode = audioContext.createGain()
    gainNode.gain.value = volume
    gainNodeRef.current = gainNode

    // Connect nodes
    gainNode.connect(analyser)
    analyser.connect(audioContext.destination)

    // Create buffer for frequency data
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    dataArrayRef.current = dataArray

    // Initialize Web Worker for audio processing
    const worker = new Worker(new URL("./audio-worker.ts", import.meta.url))
    audioWorkerRef.current = worker

    // Set up buffer size
    bufferSizeRef.current = sampleRate * 10 // 10 seconds buffer

    // Initialize audio buffer in worker
    worker.postMessage({
      type: "INIT_BUFFER",
      payload: {
        channels,
        bufferSize: bufferSizeRef.current,
      },
    })

    // Handle messages from worker
    worker.onmessage = (event) => {
      const { type, payload } = event.data

      switch (type) {
        case "PROCESSED_AUDIO":
          handleProcessedAudio(payload.pcmData, payload.samplesPerChannel)
          break
        case "METADATA":
          // If the worker sends metadata, update it
          if (payload && (payload.image || payload.title || payload.artist)) {
            setExtendedProps((prev) => ({
              img: payload.image || prev.img,
              trackTitle: payload.title || prev.trackTitle,
              artistName: payload.artist || prev.artistName,
            }))
          }
          break
      }
    }

    // Set up stream duration tracking
    streamDurationRef.current = 0

    // Clean up
    return () => {
      if (audioBufferSourceRef.current) {
        audioBufferSourceRef.current.stop()
        audioBufferSourceRef.current.disconnect()
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect()
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect()
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close()
      }
      if (audioWorkerRef.current) {
        audioWorkerRef.current.terminate()
      }
      cancelAnimationFrame(animationRef.current)
    }
  }, [sampleRate, channels, bitDepth, volume])

  // Handle processed audio data from worker
  const handleProcessedAudio = useCallback(
    (pcmData: Float32Array[], samplesPerChannel: number) => {
      if (!audioContextRef.current) return

      // Update stream duration
      const newAudioDuration = samplesPerChannel / sampleRate
      streamDurationRef.current += newAudioDuration
      setDuration(streamDurationRef.current)

      // Create an audio buffer
      const audioBuffer = audioContextRef.current.createBuffer(channels, samplesPerChannel, sampleRate)

      // Fill the audio buffer with our data
      for (let c = 0; c < channels; c++) {
        const channelData = audioBuffer.getChannelData(c)
        channelData.set(pcmData[c])
      }

      // If we're playing, ensure audio is playing
      if (isPlaying && audioContextRef.current.state === "running") {
        ensureAudioIsPlaying(audioBuffer)
      }

      // Update buffer status (simplified for now)
      setBufferStatus(Math.min(100, 75 + Math.random() * 25)) // Placeholder
    },
    [channels, isPlaying, sampleRate],
  )

  // Function to fetch metadata
  const fetchMetadata = useCallback(async () => {
    setIsMetadataLoading(true)
    try {
      console.log("Fetching metadata from:", "http://localhost:8000/api/audio/data")
      const response = await fetch("http://localhost:8000/api/audio/data")

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("Metadata received:", data)

      // Update state with the fetched metadata (extending the props)
      setExtendedProps({
        img: data.image || img,
        trackTitle: data.title || trackTitle,
        artistName: data.artist || artistName,
      })
    } catch (error) {
      console.error("Error fetching metadata:", error)
      // Keep using the original props as fallback
    } finally {
      setIsMetadataLoading(false)
    }
  }, [img, trackTitle, artistName])

  // Replace the WebSocket connection useEffect with HTTP fetch
  useEffect(() => {
    if (!audioContextRef.current || !audioWorkerRef.current) return

    const fetchAudioData = async () => {
      try {
        setIsLoaded(false)
        console.log("Fetching audio data from:", httpUrl)

        const response = await fetch(httpUrl)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        // Get the audio data as ArrayBuffer
        const arrayBuffer = await response.arrayBuffer()
        console.log("Audio data received, size:", arrayBuffer.byteLength)

        setIsConnected(true)
        setIsLoaded(true)
        streamStartTimeRef.current = audioContextRef.current?.currentTime || 0

        // Process the audio data
        if (audioWorkerRef.current) {
          audioWorkerRef.current.postMessage(
            {
              type: "PROCESS_AUDIO",
              payload: {
                arrayBuffer,
                bitDepth,
                channels,
                sampleRate,
              },
            },
            [arrayBuffer.slice(0)], // Clone to transfer ownership
          )
        }

        // Fetch metadata when audio is loaded
        fetchMetadata()
      } catch (error) {
        console.error("Error fetching audio data:", error)
        setIsConnected(false)
        setIsPlaying(false)
      }
    }

    // Fetch audio data when component mounts
    fetchAudioData()

    // Clean up function
    return () => {
      if (audioBufferSourceRef.current) {
        audioBufferSourceRef.current.stop()
        audioBufferSourceRef.current.disconnect()
      }
    }
  }, [httpUrl, bitDepth, channels, sampleRate, fetchMetadata, refreshCountRef.current])

  // Update current time based on playback position
  useEffect(() => {
    if (!isPlaying) return

    const updateTime = () => {
      if (audioContextRef.current && audioBufferSourceRef.current) {
        const playedTime = audioContextRef.current.currentTime - lastPlayTimeRef.current
        const currentPos = playbackPositionRef.current + playedTime * sampleRate
        setCurrentTime(currentPos / sampleRate)
      }

      requestAnimationFrame(updateTime)
    }

    const timeUpdateId = requestAnimationFrame(updateTime)

    return () => {
      cancelAnimationFrame(timeUpdateId)
    }
  }, [isPlaying])

  // Add Konami code handler
  function easterEgg() {
    setRainbowMode((prev) => !prev)
    console.log("🌈 Rainbow mode activated!")
  }

  // Ensure audio is playing with the given buffer
  const ensureAudioIsPlaying = useCallback(
    (audioBuffer: AudioBuffer) => {
      if (!audioContextRef.current || !gainNodeRef.current) return

      // If we're already playing, don't start again
      if (audioBufferSourceRef.current) return

      // Create a buffer source
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(gainNodeRef.current)

      // Start playback from the current position
      source.start(0, playbackPositionRef.current / sampleRate)
      audioBufferSourceRef.current = source
      lastPlayTimeRef.current = audioContextRef.current.currentTime

      // When this buffer finishes, play the next one
      source.onended = () => {
        if (audioBufferSourceRef.current === source) {
          audioBufferSourceRef.current = null

          // Update playback position
          if (audioContextRef.current) {
            const playedTime = audioContextRef.current.currentTime - lastPlayTimeRef.current
            playbackPositionRef.current += playedTime * sampleRate
          }
        }
      }
    },
    [sampleRate],
  )

  // Draw waveform visualization
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    const dataArray = dataArrayRef.current

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

      // Create a symmetrical pattern where the middle has the highest values
      const patternPosition =
        normalizedPosition <= 0.5
          ? (1 - normalizedPosition) * 2 // 0 to 1 (first half)
          : normalizedPosition * 2 - 1 // 1 to 0 (second half)

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

      // Fill with the played color
      if (rainbowMode) {
        const gradient = ctx.createLinearGradient(0, 0, width, 0)
        gradient.addColorStop(0, "hsl(0, 100%, 50%)") // Red
        gradient.addColorStop(0.17, "hsl(60, 100%, 50%)") // Yellow
        gradient.addColorStop(0.33, "hsl(120, 100%, 50%)") // Green
        gradient.addColorStop(0.5, "hsl(180, 100%, 50%)") // Cyan
        gradient.addColorStop(0.67, "hsl(240, 100%, 50%)") // Blue
        gradient.addColorStop(0.83, "hsl(270, 100%, 50%)") // Purple
        gradient.addColorStop(1, "hsl(300, 100%, 50%)") // Pink
        ctx.fillStyle = gradient
      } else {
        ctx.fillStyle = "hsl(178, 51%, 51%)"
      }
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

      // Fill with the unplayed color
      if (rainbowMode) {
        const gradient = ctx.createLinearGradient(0, 0, width, 0)
        gradient.addColorStop(0, "hsla(0, 100%, 50%, 0.3)")
        gradient.addColorStop(0.17, "hsla(60, 100%, 50%, 0.3)")
        gradient.addColorStop(0.33, "hsla(120, 100%, 50%, 0.3)")
        gradient.addColorStop(0.5, "hsla(180, 100%, 50%, 0.3)")
        gradient.addColorStop(0.67, "hsla(240, 100%, 50%, 0.3)")
        gradient.addColorStop(0.83, "hsla(270, 100%, 50%, 0.3)")
        gradient.addColorStop(1, "hsla(300, 100%, 50%, 0.3)")
        ctx.fillStyle = gradient
      } else {
        ctx.fillStyle = "hsla(178, 51%, 51%, 0.3)"
      }
      ctx.fill()
    }

    // Draw buffer status indicator
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)"
    ctx.fillRect(0, height - 2, (bufferStatus / 100) * width, 2)

    animationRef.current = requestAnimationFrame(drawWaveform)
  }, [currentTime, duration, rainbowMode])

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

  // Update visualization
  useEffect(() => {
    // Always keep the animation running when audio is loaded
    if (isLoaded) {
      // Resume audio context if it was suspended
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume()
      }
      animationRef.current = requestAnimationFrame(drawWaveform)
    } else {
      cancelAnimationFrame(animationRef.current)
    }

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [isLoaded, currentTime, drawWaveform])

  // Handle play/pause
  const togglePlay = useCallback(() => {
    if (!audioContextRef.current || !isConnected) return

    if (isPlaying) {
      // Pause playback
      if (audioBufferSourceRef.current) {
        audioBufferSourceRef.current.stop()
        audioBufferSourceRef.current = null

        // Update playback position
        const playedTime = audioContextRef.current.currentTime - lastPlayTimeRef.current
        playbackPositionRef.current += playedTime * sampleRate
      }
    } else {
      // Resume audio context if needed
      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume()
      }
    }

    setIsPlaying(!isPlaying)
  }, [isConnected, isPlaying, sampleRate])

  // Handle volume change
  const handleVolumeChange = useCallback((newVolume: number[]) => {
    const volumeValue = newVolume[0]
    setVolume(volumeValue)

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volumeValue
    }

    if (volumeValue === 0) {
      setIsMuted(true)
    } else {
      setIsMuted(false)
    }
  }, [])

  // Handle seeking with slider
  const handleSliderSeek = useCallback(
    (newTime: number[]) => {
      if (!audioContextRef.current) return

      const seekTime = newTime[0]
      const seekPosition = Math.floor(seekTime * sampleRate)

      // Update playback position
      playbackPositionRef.current = seekPosition
      setCurrentTime(seekTime)

      // If we're playing, restart playback from the new position
      if (isPlaying && audioBufferSourceRef.current) {
        audioBufferSourceRef.current.stop()
        audioBufferSourceRef.current = null
      }
    },
    [isPlaying, sampleRate],
  )

  // Handle seeking with canvas click
  const handleCanvasSeek = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas || !audioContextRef.current || duration === 0) return

      const rect = canvas.getBoundingClientRect()
      const clickPosition = event.clientX - rect.left
      const seekPercentage = clickPosition / rect.width
      const seekTime = seekPercentage * duration

      // Use the slider seek function to handle the actual seeking
      handleSliderSeek([seekTime])
    },
    [duration, handleSliderSeek],
  )

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!gainNodeRef.current) return

    if (isMuted) {
      gainNodeRef.current.gain.value = volume
      setIsMuted(false)
    } else {
      gainNodeRef.current.gain.value = 0
      setIsMuted(true)
    }
  }, [isMuted, volume])

  // Format time
  const formatTime = useCallback((time: number) => {
    if (isNaN(time)) return "0:00"

    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }, [])

  // Handle refresh button click
  const handleRefresh = useCallback(() => {
    // Reset playback and fetch new data
    if (audioBufferSourceRef.current) {
      audioBufferSourceRef.current.stop()
      audioBufferSourceRef.current = null
    }
    playbackPositionRef.current = 0
    setCurrentTime(0)

    // Increment refresh counter to trigger useEffect
    refreshCountRef.current += 1

    // Trigger a new fetch by re-running the effect
    const fetchAudioData = async () => {
      try {
        setIsLoaded(false)
        const response = await fetch(httpUrl)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const arrayBuffer = await response.arrayBuffer()

        if (audioWorkerRef.current) {
          audioWorkerRef.current.postMessage(
            {
              type: "PROCESS_AUDIO",
              payload: {
                arrayBuffer,
                bitDepth,
                channels,
                sampleRate,
              },
            },
            [arrayBuffer.slice(0)],
          )
        }

        setIsLoaded(true)

        // Also refresh metadata
        fetchMetadata()
      } catch (error) {
        console.error("Error refreshing audio data:", error)
      }
    }

    fetchAudioData()
  }, [httpUrl, bitDepth, channels, sampleRate, fetchMetadata])

  return (
    <div className="fixed bottom-0 left-0 w-full h-[9vh] overflow-hidden -z-5 bg-sidebar">
      <Konami easterEgg={easterEgg} />
      {/* Player content */}
      <div className="relative h-full flex items-center z-10 px-4">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-12 gap-4 items-center">
          {/* Track info - 3 columns */}
          <div className="col-span-3 flex items-center gap-3">
            <div className={`h-12 w-12 rounded-md overflow-hidden flex-shrink-0 ${extendedProps.img ? "" : "hidden"}`}>
              {extendedProps.img && (
                <Image
                  width={48}
                  height={48}
                  src={extendedProps.img || "/placeholder.svg"}
                  alt="Album cover"
                  className="h-full w-full object-cover"
                  crossOrigin="anonymous"
                />
              )}
            </div>
            <div className="text-sm">
              <div className="font-medium text-foreground">
                {isMetadataLoading ? (
                  <span className="inline-block w-24 h-4 bg-muted animate-pulse rounded"></span>
                ) : (
                  extendedProps.trackTitle
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {isMetadataLoading ? (
                  <span className="inline-block w-16 h-3 bg-muted animate-pulse rounded mt-1"></span>
                ) : (
                  extendedProps.artistName
                )}
              </div>
            </div>
          </div>

          {/* Player controls - 6 columns */}
          <div className="col-span-6 flex flex-col items-center">
            <div className="w-full flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-8 text-right">{formatTime(currentTime)}</span>
              <div className="relative flex-1 h-10">
                {/* Canvas visualization */}
                <canvas ref={canvasRef} className="w-full h-full cursor-pointer" onClick={handleCanvasSeek} />

                {/* Invisible slider for accessibility */}
                <div className="absolute inset-0 opacity-0 flex items-center">
                  <Slider
                    className="h-full"
                    value={[currentTime]}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={handleSliderSeek}
                  />
                </div>
              </div>
              <span className="text-xs text-muted-foreground w-8">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Volume control - 3 columns */}
          <div className="col-span-3 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary hover:text-primary/80 hover:bg-transparent"
              onClick={togglePlay}
              disabled={!isConnected}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
              onClick={toggleMute}
              disabled={!isConnected}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-24"
              disabled={!isConnected}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
              onClick={handleRefresh}
              disabled={!isConnected}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-refresh-cw"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

