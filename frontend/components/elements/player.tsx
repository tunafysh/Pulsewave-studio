"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Play, Pause, Volume2, VolumeX } from "lucide-react"

interface PlayerProps {
  img?: string
  isBlurred?: boolean
  trackUrl?: string
  trackTitle?: string
  artistName?: string
}

export default function Player({
  // img = "/it-girl.jpeg",
  // isBlurred = false,
  trackUrl = "/sample.mp3",
  trackTitle = "Icon design learning",
  artistName = "Visual design",
}: PlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(0.7)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Audio analysis refs
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)

  // Initialize Web Audio API
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Create audio context
    const AudioContext = window.AudioContext
    const audioContext = new AudioContext()
    audioContextRef.current = audioContext

    // Create analyzer
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 512 // Increased for more detail
    analyser.smoothingTimeConstant = 0.5 // Lower value = more responsive (0-1)
    analyserRef.current = analyser

    // Create buffer for frequency data
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    dataArrayRef.current = dataArray

    // Connect audio element to analyzer
    const source = audioContext.createMediaElementSource(audio)
    source.connect(analyser)
    analyser.connect(audioContext.destination)
    sourceNodeRef.current = source

    // Clean up
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect()
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect()
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close()
      }
      cancelAnimationFrame(animationRef.current)
    }
  }, [])

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Load the audio file
    audio.load()

    // Multiple event listeners to ensure we get the duration
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Number.POSITIVE_INFINITY) {
        setDuration(audio.duration)
        setIsLoaded(true)
      }
    }

    const handleDurationChange = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Number.POSITIVE_INFINITY) {
        setDuration(audio.duration)
        setIsLoaded(true)
      }
    }

    const handleCanPlay = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Number.POSITIVE_INFINITY) {
        setDuration(audio.duration)
        setIsLoaded(true)
      }
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)

      // As a fallback, try to get duration here if it wasn't available earlier
      if (duration === 0 && audio.duration && !isNaN(audio.duration) && audio.duration !== Number.POSITIVE_INFINITY) {
        setDuration(audio.duration)
        setIsLoaded(true)
      }
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      audio.currentTime = 0
    }

    // Add all event listeners
    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("durationchange", handleDurationChange)
    audio.addEventListener("canplay", handleCanPlay)
    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("ended", handleEnded)

    // Cleanup
    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("durationchange", handleDurationChange)
      audio.removeEventListener("canplay", handleCanPlay)
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [duration])

  // Draw waveform visualization
  const drawWaveform = () => {
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
    const barCount = 100 // Fixed number of bars for better appearance
    const barWidth = width / barCount
    const progressPosition = (currentTime / (duration || 1)) * width

    // We'll use a subset of the frequency data (focus on audible range)
    const usableDataLength = Math.min(dataArray.length, 160) // Focus on lower frequencies

    // Create a pattern that goes from low to high to low
    for (let i = 0; i < barCount; i++) {
      // Calculate position in the pattern (0 to 1 to 0)
      // This creates a symmetrical pattern where the middle has the highest values
      const normalizedPosition = i / (barCount - 1) // 0 to 1
      const patternPosition =
        normalizedPosition <= 0.5
          ? ( 1- normalizedPosition) * 2 // 0 to 1 (first half)
          : normalizedPosition * 2 // 1 to 0 (second half)

      // Map this position to our frequency data
      // Lower frequencies have more energy, so we'll use the first part of the array
      const dataIndex = Math.floor(patternPosition * usableDataLength * 0.5)

      // Get the frequency value
      const frequencyValue = dataArray[dataIndex]

      // Apply sensitivity boost and scaling
      const sensitivity = 1.5 // Increased sensitivity
      const minHeight = height * 0.05 // Minimum bar height
      const normalizedValue = frequencyValue / 255

      // Apply non-linear scaling to boost visibility of quieter sounds
      const boostedValue = Math.pow(normalizedValue, 0.7) * sensitivity

      // Calculate bar height with minimum to ensure visibility
      const barHeight = Math.max(minHeight, boostedValue * height * 0.8)

      const x = i * barWidth
      const y = (height - barHeight) / 2

      // Determine if this bar is in the played portion
      if (x < progressPosition) {
        // Played portion - orange-red color
        ctx.fillStyle = "hsl(178, 51%, 51%)"
      } else {
        // Unplayed portion - dimmed color
        ctx.fillStyle = "hsla(178, 51%, 51%, 0.3)"
      }

      // Draw bar with slight rounding
      ctx.beginPath()
      ctx.roundRect(x, y, barWidth * 0.8, barHeight, 1)
      ctx.fill()
    }

    animationRef.current = requestAnimationFrame(drawWaveform)
  }

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

  // Update visualization when playing state changes
  useEffect(() => {
    if (isPlaying) {
      // Resume audio context if it was suspended
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume()
      }
      animationRef.current = requestAnimationFrame(drawWaveform)
    } else {
      cancelAnimationFrame(animationRef.current)
      // Draw one last time to show current state
      drawWaveform()
    }

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying])

  // Handle play/pause
  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      // Resume audio context if needed (browsers require user interaction)
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume()
      }

      audio.play().catch((error) => {
        console.error("Error playing audio:", error)
      })
    }
    setIsPlaying(!isPlaying)
  }

  // Handle volume change
  const handleVolumeChange = (newVolume: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    const volumeValue = newVolume[0]
    setVolume(volumeValue)
    audio.volume = volumeValue

    if (volumeValue === 0) {
      setIsMuted(true)
    } else {
      setIsMuted(false)
    }
  }

  // Handle seeking with slider
  const handleSliderSeek = (newTime: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    const seekTime = newTime[0]
    audio.currentTime = seekTime
    setCurrentTime(seekTime)
  }

  // Handle seeking with canvas click
  const handleCanvasSeek = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const audio = audioRef.current
    if (!canvas || !audio || duration === 0) return

    const rect = canvas.getBoundingClientRect()
    const clickPosition = event.clientX - rect.left
    const seekPercentage = clickPosition / rect.width
    const seekTime = seekPercentage * duration

    audio.currentTime = seekTime
    setCurrentTime(seekTime)
  }

  // Toggle mute
  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isMuted) {
      audio.volume = volume
      setIsMuted(false)
    } else {
      audio.volume = 0
      setIsMuted(true)
    }
  }

  // Format time
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00"

    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  return (
    <div className="fixed bottom-0 left-0 w-full h-[9vh] overflow-hidden -z-5 bg-black">
      {/* Audio element with proper source */}
      <audio ref={audioRef} preload="metadata">
        <source src={trackUrl} type="audio/mpeg" />
        <source src={trackUrl} type="audio/mp3" />
        Your browser does not support the audio element.
      </audio>

      {/* Player content */}
      <div className="relative h-full flex items-center z-10 px-4">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-12 gap-4 items-center">
          {/* Track info - 3 columns */}
          <div className="col-span-3 flex items-center gap-3">
            <div className="text-sm">
              <div className="font-medium text-foreground">{trackTitle}</div>
              <div className="text-xs text-muted-foreground">{artistName}</div>
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
                  <Slider className="h-full" value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSliderSeek} />
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
              disabled={!isLoaded}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
              onClick={toggleMute}
              disabled={!isLoaded}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-24"
              disabled={!isLoaded}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

