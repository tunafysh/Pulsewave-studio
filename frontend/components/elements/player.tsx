/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
"use client"

import { useState, useRef, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Play, Pause, Volume2, VolumeX } from "lucide-react"
import AudioVisualizer from "./audio-visualizer"
import ElasticSliderVariant1 from "../ui/elastic-slider"

// Extend HTMLAudioElement to include our custom property
interface AudioElementWithSourceNode extends HTMLAudioElement {
  _hasSourceNode?: boolean
}

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
  trackUrl = "/sample.wav",
  trackTitle = "Icon design learning",
  artistName = "Visual design",
}: PlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(0.7)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [rainbowMode, setRainbowMode] = useState(false)

  // Audio analysis refs
  const audioRef = useRef<AudioElementWithSourceNode>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)

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
    analyser.smoothingTimeConstant = 0.8 // Good balance between responsive and smooth
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

    // Mark this audio element as having a source node
    audio._hasSourceNode = true

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
      if (audio) {
        audio._hasSourceNode = false
      }
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

  // Toggle rainbow mode (Easter egg)
  const toggleRainbowMode = () => {
    setRainbowMode(!rainbowMode)
  }

  return (
    <div className="fixed bottom-0 left-0 w-full h-[9vh] overflow-hidden -z-5 bg-black">
      {/* Audio element with proper source */}
      <audio ref={audioRef} preload="metadata">
        <source src={trackUrl} type="audio/wav" />
        Your browser does not support the audio element.
      </audio>

      {/* Player content */}
      <div className="relative h-full flex items-center z-10 px-4">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-12 gap-4 items-center">
          {/* Track info - 3 columns */}
          <div className="col-span-3 flex items-center gap-3">
            <div className="text-sm">
              <div className="font-medium text-foreground" onDoubleClick={toggleRainbowMode}>
                {trackTitle}
              </div>
              <div className="text-xs text-muted-foreground">{artistName}</div>
            </div>
          </div>

          {/* Player controls - 6 columns */}
          <div className="col-span-6 flex flex-col items-center">
            <div className="w-full flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-8 text-right">{formatTime(currentTime)}</span>
              <div className="relative flex-1 h-10">
                {/* Audio Visualizer component */}
                <AudioVisualizer
                  currentTime={currentTime}
                  duration={duration}
                  rainbowMode={rainbowMode}
                  analyser={analyserRef.current}
                  dataArray={dataArrayRef.current}
                  onSeek={handleSliderSeek}
                />
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
            <ElasticSliderVariant1 />
          </div>
        </div>
      </div>
    </div>
  )
}

