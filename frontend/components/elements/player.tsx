/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause } from "lucide-react"
import Image from "next/image"
import Konami from "react-konami"
import ElasticSliderVariant1 from "../ui/elastic-slider"
import AudioVisualizer from "./audio-visualizer"

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
  const pcmDataRef = useRef<Float32Array[]>([]) // Store PCM data for reuse

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
          console.log("Received processed audio from worker", {
            samplesPerChannel: payload.samplesPerChannel,
            duration: payload.duration,
            channels: payload.pcmData.length,
          })
          handleProcessedAudio(payload.pcmData, payload.samplesPerChannel, payload.duration)
          break
        case "BUFFER_INITIALIZED":
          console.log("Buffer initialized in worker", payload)
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
        case "ERROR":
          console.error("Worker error:", payload)
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
    }
  }, [sampleRate, channels, bitDepth, volume])

  // Handle processed audio data from worker
  const handleProcessedAudio = useCallback(
    (pcmData: Float32Array[], samplesPerChannel: number, audioDuration: number) => {
      if (!audioContextRef.current) return

      console.log("Processing audio data", {
        channels: pcmData.length,
        samplesPerChannel,
        audioDuration,
      })

      // Store PCM data for reuse
      pcmDataRef.current = pcmData

      // Update stream duration with accurate duration from worker
      streamDurationRef.current = audioDuration
      setDuration(audioDuration)

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

      // Update buffer status
      setBufferStatus(100) // Fully loaded

      console.log("Audio buffer created and ready for playback")
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

  // Add a function to fetch available audio files
  // const fetchAvailableFiles = useCallback(async () => {
  //   try {
  //     const response = await fetch("http://localhost:8000/api/audio/list")
  //     if (!response.ok) {
  //       throw new Error(`HTTP error! status: ${response.status}`)
  //     }

  //     const data = await response.json()
  //     console.log("Available audio files:", data.files)

  //     // You can use this data to create a playlist or file selector
  //     return data.files
  //   } catch (error) {
  //     console.error("Error fetching available files:", error)
  //     return []
  //   }
  // }, [])

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

        // Resume audio context if it was suspended (needed for Chrome)
        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume()
          console.log("Audio context resumed")
        }

        // Process the audio data - create a copy to avoid transfer issues
        if (audioWorkerRef.current) {
          try {
            // Create a copy of the array buffer to avoid transfer issues
            const arrayBufferCopy = arrayBuffer.slice(0)

            console.log("Sending audio data to worker for processing", {
              size: arrayBufferCopy.byteLength,
              bitDepth,
              channels,
              sampleRate,
            })

            audioWorkerRef.current.postMessage({
              type: "PROCESS_AUDIO",
              payload: {
                arrayBuffer: arrayBufferCopy,
                bitDepth,
                channels,
                sampleRate,
              },
            })
          } catch (error) {
            console.error("Error posting message to worker:", error)
            throw error
          }
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
  }, [isPlaying, sampleRate])

  // Add Konami code handler
  function easterEgg() {
    setRainbowMode((prev) => !prev)
    console.log("🌈 Rainbow mode activated!")
  }

  // Ensure audio is playing with the given buffer
  const ensureAudioIsPlaying = useCallback(
    (audioBuffer: AudioBuffer) => {
      if (!audioContextRef.current || !gainNodeRef.current) return

      console.log("Starting audio playback", {
        position: playbackPositionRef.current / sampleRate,
        bufferDuration: audioBuffer.duration,
      })

      // If we're already playing, stop the current source
      if (audioBufferSourceRef.current) {
        audioBufferSourceRef.current.stop()
        audioBufferSourceRef.current.disconnect()
        audioBufferSourceRef.current = null
      }

      // Create a buffer source
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(gainNodeRef.current)

      // Start playback from the current position
      const startPosition = Math.min(playbackPositionRef.current / sampleRate, audioBuffer.duration - 0.01)
      source.start(0, startPosition)
      audioBufferSourceRef.current = source
      lastPlayTimeRef.current = audioContextRef.current.currentTime

      // When this buffer finishes, play the next one
      source.onended = () => {
        console.log("Audio buffer playback ended")
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

  // Handle seeking with slider
  const handleSliderSeek = useCallback(
    (newTime: number[]) => {
      if (!audioContextRef.current) return

      const seekTime = newTime[0]
      const seekPosition = Math.floor(seekTime * sampleRate)

      console.log("Seeking to position", {
        seekTime,
        seekPosition,
        isPlaying,
      })

      // Update playback position
      playbackPositionRef.current = seekPosition
      setCurrentTime(seekTime)

      // If we're playing, restart playback from the new position
      if (isPlaying && pcmDataRef.current.length > 0 && pcmDataRef.current[0].length > 0) {
        if (audioBufferSourceRef.current) {
          audioBufferSourceRef.current.stop()
          audioBufferSourceRef.current = null
        }

        // Create a new buffer and play from the new position
        const audioBuffer = audioContextRef.current.createBuffer(channels, pcmDataRef.current[0].length, sampleRate)

        // Fill the audio buffer with our data
        for (let c = 0; c < channels; c++) {
          const channelData = audioBuffer.getChannelData(c)
          channelData.set(pcmDataRef.current[c])
        }

        ensureAudioIsPlaying(audioBuffer)
      }
    },
    [isPlaying, sampleRate, channels, ensureAudioIsPlaying],
  )

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
          try {
            // Create a copy of the array buffer to avoid transfer issues
            const arrayBufferCopy = arrayBuffer.slice(0)

            audioWorkerRef.current.postMessage({
              type: "PROCESS_AUDIO",
              payload: {
                arrayBuffer: arrayBufferCopy,
                bitDepth,
                channels,
                sampleRate,
              },
            })
          } catch (error) {
            console.error("Error posting message to worker:", error)
          }
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

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (!isConnected || !audioContextRef.current) return

    console.log("Toggle play/pause", {
      isPlaying: !isPlaying,
      audioContextState: audioContextRef.current.state,
      hasPcmData: pcmDataRef.current.length > 0 && pcmDataRef.current[0].length > 0,
    })

    // If we're going to start playing
    if (!isPlaying) {
      // Resume audio context if needed (important for Chrome)
      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume().then(() => {
          console.log("Audio context resumed")
        })
      }

      // If we have PCM data, create a buffer and play it
      if (pcmDataRef.current.length > 0 && pcmDataRef.current[0].length > 0) {
        const audioBuffer = audioContextRef.current.createBuffer(channels, pcmDataRef.current[0].length, sampleRate)

        // Fill the audio buffer with our data
        for (let c = 0; c < channels; c++) {
          const channelData = audioBuffer.getChannelData(c)
          channelData.set(pcmDataRef.current[c])
        }

        ensureAudioIsPlaying(audioBuffer)
      } else {
        console.warn("No PCM data available for playback")
      }
    } else {
      // Stop playback
      if (audioBufferSourceRef.current) {
        audioBufferSourceRef.current.stop()

        // Update playback position
        if (audioContextRef.current) {
          const playedTime = audioContextRef.current.currentTime - lastPlayTimeRef.current
          playbackPositionRef.current += playedTime * sampleRate
        }
      }
    }

    setIsPlaying(!isPlaying)
  }, [isPlaying, isConnected, channels, sampleRate, ensureAudioIsPlaying])

  // Call this function when the component mounts
  // useEffect(() => {
  //   fetchAvailableFiles()
  // }, [fetchAvailableFiles])

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
                {/* Audio Visualizer Component */}
                <AudioVisualizer
                  currentTime={currentTime}
                  duration={duration}
                  bufferStatus={bufferStatus}
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
              disabled={!isConnected}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
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
            <div className="flex-4 mr-4"></div>
            <ElasticSliderVariant1 />
          </div>
        </div>
      </div>
    </div>
  )
}

