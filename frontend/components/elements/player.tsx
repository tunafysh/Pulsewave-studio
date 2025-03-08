"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react"

interface PlayerProps {
  img?: string
  isBlurred: boolean
  trackUrl?: string
  trackTitle?: string
  artistName?: string
}

export default function Player({
  img = "/it-girl.jpeg",
  isBlurred,
  trackUrl = "/sample-track.mp3",
  trackTitle = "It Girl",
  artistName = "Aliyah's Interlude",
}: PlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(0.7)
  const [isMuted, setIsMuted] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Set up event listeners
    const setAudioData = () => {
      setDuration(audio.duration)
    }

    const setAudioTime = () => {
      setCurrentTime(audio.currentTime)
    }

    // Events
    audio.addEventListener("loadeddata", setAudioData)
    audio.addEventListener("timeupdate", setAudioTime)
    audio.addEventListener("ended", () => setIsPlaying(false))

    // Cleanup
    return () => {
      audio.removeEventListener("loadeddata", setAudioData)
      audio.removeEventListener("timeupdate", setAudioTime)
      audio.removeEventListener("ended", () => setIsPlaying(false))
    }
  }, [])

  // Handle play/pause
  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
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

  // Handle seeking
  const handleSeek = (newTime: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = newTime[0]
    setCurrentTime(newTime[0])
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
    <div className={`fixed bottom-0 left-0 w-full h-[9vh] overflow-hidden -z-5 ${isBlurred ? "backdrop-blur-sm" : ""}`}>
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center -z-10"
        style={{
          backgroundImage: `url(${img})`,
          filter: "blur(10px)",
          transform: "scale(1.1)", // Slightly scale up to avoid blur edges
        }}
      />

      {/* Overlay with transparency */}
      <div className="absolute inset-0 dark:bg-gray-800/60 bg-gray-200/60 backdrop-blur-md -z-5" />

      {/* Audio element */}
      <audio ref={audioRef} src={trackUrl} />

      {/* Player content */}
      <div className="relative h-full flex items-center z-10 px-4">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-12 gap-4 items-center">
          {/* Track info and image - 3 columns */}
          <div className="col-span-3 flex items-center gap-3">
            <div className="h-12 w-12 rounded-md overflow-hidden relative flex-shrink-0">
              <Image src={img || "/placeholder.svg"} alt="Now playing" fill className="object-cover" sizes="48px" />
            </div>
            <div className="text-sm truncate">
              <div className="font-bold truncate">{trackTitle}</div>
              <div className="text-muted-foreground truncate">{artistName}</div>
            </div>
          </div>

          {/* Player controls - 6 columns */}
          <div className="col-span-6 flex flex-col items-center">
            <div className="flex items-center gap-2 mb-1">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
            <div className="w-full flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-8 text-right">{formatTime(currentTime)}</span>
              <Slider
                value={[currentTime]}
                max={duration}
                step={0.1}
                onValueChange={handleSeek}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-8">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Volume control - 3 columns */}
          <div className="col-span-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMute}>
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-24"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

