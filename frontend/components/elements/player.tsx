"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Play, Pause, Volume2, VolumeX } from "lucide-react"
import Image from "next/image"

interface PlayerProps {
  img: string
  isBlurred?: boolean
  websocketUrl?: string
  trackTitle?: string
  artistName?: string
  sampleRate?: number
  channels?: number
  bitDepth?: number
}

export default function Player({
  img = "",
  websocketUrl = "ws://localhost:8080/audio",
  trackTitle = "Live Stream",
  artistName = "WebSocket PCM",
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

  // Audio analysis refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const streamStartTimeRef = useRef<number>(0)
  const audioBufferSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioDataBufferRef = useRef<Float32Array[]>([])
  const bufferSizeRef = useRef<number>(0)
  const playbackPositionRef = useRef<number>(0)
  const lastPlayTimeRef = useRef<number>(0)
  const streamDurationRef = useRef<number>(0)

  // Initialize Web Audio API
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

    // Initialize audio data buffer for each channel
    for (let i = 0; i < channels; i++) {
      audioDataBufferRef.current.push(new Float32Array(sampleRate * 10)); // 10 seconds buffer
    }
    bufferSizeRef.current = sampleRate * 10;

    // Set up stream duration tracking
    streamDurationRef.current = 0;

    // Clean up
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close()
      }
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
      cancelAnimationFrame(animationRef.current)
    }
  }, [sampleRate, channels, bitDepth])

  // Connect to WebSocket and handle PCM data
  useEffect(() => {
    if (!audioContextRef.current || !gainNodeRef.current) return;

    const connectWebSocket = () => {
      const ws = new WebSocket(websocketUrl);
      websocketRef.current = ws;

      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        setIsLoaded(true);
        streamStartTimeRef.current = audioContextRef.current?.currentTime || 0;
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        setIsPlaying(false);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
        setIsPlaying(false);
      };

      ws.onmessage = (event) => {
        if (!audioContextRef.current) return;
        
        // Process incoming PCM data
        const arrayBuffer = event.data;
        processAudioData(arrayBuffer);
      };
    };

    // Process incoming PCM data and add to buffer
    const processAudioData = (arrayBuffer: ArrayBuffer) => {
      if (!audioContextRef.current) return;

      // Convert the incoming PCM data based on bit depth
      let pcmData: Float32Array[];
      
      if (bitDepth === 16) {
        // 16-bit PCM (Int16)
        const int16Array = new Int16Array(arrayBuffer);
        pcmData = deinterleave(int16Array, channels, (sample) => sample / 32768.0);
      } else if (bitDepth === 24) {
        // 24-bit PCM (needs special handling)
        pcmData = process24BitPCM(arrayBuffer, channels);
      } else if (bitDepth === 32) {
        // 32-bit float PCM
        const float32Array = new Float32Array(arrayBuffer);
        pcmData = deinterleave(float32Array, channels);
      } else if (bitDepth === 8) {
        // 8-bit PCM (Uint8)
        const uint8Array = new Uint8Array(arrayBuffer);
        pcmData = deinterleave(uint8Array, channels, (sample) => (sample - 128) / 128.0);
      } else {
        console.error("Unsupported bit depth:", bitDepth);
        return;
      }

      // Add the data to our buffer
      const samplesPerChannel = pcmData[0].length;
      
      // Update stream duration
      const newAudioDuration = samplesPerChannel / sampleRate;
      streamDurationRef.current += newAudioDuration;
      setDuration(streamDurationRef.current);

      // Add to buffer and play if needed
      addToBuffer(pcmData);
      
      // If we're playing, ensure audio is playing
      if (isPlaying && audioContextRef.current.state === "running") {
        ensureAudioIsPlaying();
      }
      
      // Update buffer status
      const bufferFillPercentage = Math.min(100, (getBufferFillAmount() / bufferSizeRef.current) * 100);
      setBufferStatus(bufferFillPercentage);
    };

    // Deinterleave audio channels
    const deinterleave = <T extends ArrayLike<number>>(
      interleavedData: T, 
      channels: number, 
      normalizer?: (sample: number) => number
    ): Float32Array[] => {
      const deinterleavedData: Float32Array[] = [];
      const samplesPerChannel = Math.floor(interleavedData.length / channels);
      
      // Create arrays for each channel
      for (let c = 0; c < channels; c++) {
        deinterleavedData.push(new Float32Array(samplesPerChannel));
      }
      
      // Fill the arrays
      for (let i = 0; i < samplesPerChannel; i++) {
        for (let c = 0; c < channels; c++) {
          const sample = interleavedData[i * channels + c];
          deinterleavedData[c][i] = normalizer ? normalizer(sample) : sample;
        }
      }
      
      return deinterleavedData;
    };

    // Special handling for 24-bit PCM
    const process24BitPCM = (buffer: ArrayBuffer, channels: number): Float32Array[] => {
      const bytes = new Uint8Array(buffer);
      const samplesPerChannel = Math.floor(bytes.length / (3 * channels)); // 3 bytes per sample
      const output: Float32Array[] = [];
      
      // Create arrays for each channel
      for (let c = 0; c < channels; c++) {
        output.push(new Float32Array(samplesPerChannel));
      }
      
      // Process 24-bit samples (3 bytes per sample)
      for (let i = 0; i < samplesPerChannel; i++) {
        for (let c = 0; c < channels; c++) {
          const startByte = (i * channels + c) * 3;
          
          // Combine 3 bytes into a 24-bit integer (little-endian)
          const sample = (bytes[startByte] << 8) | (bytes[startByte + 1] << 16) | (bytes[startByte + 2] << 24);
          
          // Convert to float in range [-1, 1]
          output[c][i] = sample / 8388608.0; // 2^23
        }
      }
      
      return output;
    };

    // Add PCM data to our circular buffer
    const addToBuffer = (pcmData: Float32Array[]) => {
      const samplesPerChannel = pcmData[0].length;
      
      // For each channel
      for (let c = 0; c < channels; c++) {
        // Get current buffer for this channel
        const buffer = audioDataBufferRef.current[c];
        
        // If buffer is full, shift data to make room
        if (getBufferFillAmount() + samplesPerChannel > bufferSizeRef.current) {
          // Shift buffer to make room
          const amountToShift = samplesPerChannel;
          buffer.copyWithin(0, amountToShift);
          
          // Adjust playback position
          if (playbackPositionRef.current > amountToShift) {
            playbackPositionRef.current -= amountToShift;
          } else {
            playbackPositionRef.current = 0;
          }
        }
        
        // Add new data to buffer
        const startPos = getBufferFillAmount();
        for (let i = 0; i < samplesPerChannel; i++) {
          buffer[startPos + i] = pcmData[c][i];
        }
      }
    };

    // Get the amount of data in the buffer
    const getBufferFillAmount = (): number => {
      // All channels have the same amount of data
      // Find the first non-zero sample from the end
      const buffer = audioDataBufferRef.current[0];
      for (let i = bufferSizeRef.current - 1; i >= 0; i--) {
        if (buffer[i] !== 0) {
          return i + 1;
        }
      }
      return 0;
    };

    // Ensure audio is playing
    const ensureAudioIsPlaying = () => {
      if (!audioContextRef.current || !gainNodeRef.current) return;
      
      // If we're already playing, don't start again
      if (audioBufferSourceRef.current) return;
      
      // Create a new buffer source
      const bufferFill = getBufferFillAmount();
      if (bufferFill < sampleRate * 0.5) {
        // Not enough data to play yet (less than 0.5 seconds)
        return;
      }
      
      // Create an audio buffer
      const audioBuffer = audioContextRef.current.createBuffer(
        channels,
        bufferFill,
        sampleRate
      );
      
      // Fill the audio buffer with our data
      for (let c = 0; c < channels; c++) {
        const channelData = audioBuffer.getChannelData(c);
        channelData.set(audioDataBufferRef.current[c].slice(0, bufferFill));
      }
      
      // Create a buffer source
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNodeRef.current);
      
      // Start playback from the current position
      source.start(0, playbackPositionRef.current / sampleRate);
      audioBufferSourceRef.current = source;
      lastPlayTimeRef.current = audioContextRef.current.currentTime;
      
      // When this buffer finishes, play the next one
      source.onended = () => {
        if (audioBufferSourceRef.current === source) {
          audioBufferSourceRef.current = null;
          
          // Update playback position
          if (audioContextRef.current) {
            const playedTime = audioContextRef.current.currentTime - lastPlayTimeRef.current;
            playbackPositionRef.current += playedTime * sampleRate;
            
            // If we're still playing, start the next buffer
            if (isPlaying) {
              ensureAudioIsPlaying();
            }
          }
        }
      };
    };

    // Connect to WebSocket
    connectWebSocket();

    // Clean up
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [websocketUrl, isPlaying, bitDepth, channels, sampleRate]);

  // Update current time based on playback position
  useEffect(() => {
    if (!isPlaying) return;

    const updateTime = () => {
      if (audioContextRef.current && audioBufferSourceRef.current) {
        const playedTime = audioContextRef.current.currentTime - lastPlayTimeRef.current;
        const currentPos = playbackPositionRef.current + playedTime * sampleRate;
        setCurrentTime(currentPos / sampleRate);
      }
      
      requestAnimationFrame(updateTime);
    };

    const timeUpdateId = requestAnimationFrame(updateTime);
    
    return () => {
      cancelAnimationFrame(timeUpdateId);
    };
  }, [isPlaying]);

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
      ctx.fillStyle = "hsl(178, 51%, 51%)"
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
      ctx.fillStyle = "hsla(178, 51%, 51%, 0.3)"
      ctx.fill()
    }

    // Draw buffer status indicator
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)"
    ctx.fillRect(0, height - 2, (bufferStatus / 100) * width, 2)

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
  }, [isLoaded, currentTime])

  // Handle play/pause
  const togglePlay = () => {
    if (!audioContextRef.current || !isConnected) return;

    if (isPlaying) {
      // Pause playback
      if (audioBufferSourceRef.current) {
        audioBufferSourceRef.current.stop();
        audioBufferSourceRef.current = null;
        
        // Update playback position
        const playedTime = audioContextRef.current.currentTime - lastPlayTimeRef.current;
        playbackPositionRef.current += playedTime * sampleRate;
      }
    } else {
      // Resume audio context if needed
      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume();
      }
      
      // Start playback
      if (!audioBufferSourceRef.current) {
        // This will trigger playback
        const ensureAudioIsPlaying = () => {
          if (!audioContextRef.current || !gainNodeRef.current) return;
          
          // Create a new buffer source
          const bufferFill = getBufferFillAmount();
          if (bufferFill < sampleRate * 0.5) {
            // Not enough data to play yet (less than 0.5 seconds)
            return;
          }
          
          // Create an audio buffer
          const audioBuffer = audioContextRef.current.createBuffer(
            channels,
            bufferFill,
            sampleRate
          );
          
          // Fill the audio buffer with our data
          for (let c = 0; c < channels; c++) {
            const channelData = audioBuffer.getChannelData(c);
            channelData.set(audioDataBufferRef.current[c].slice(0, bufferFill));
          }
          
          // Create a buffer source
          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(gainNodeRef.current);
          
          // Start playback from the current position
          source.start(0, playbackPositionRef.current / sampleRate);
          audioBufferSourceRef.current = source;
          lastPlayTimeRef.current = audioContextRef.current.currentTime;
          
          // When this buffer finishes, play the next one
          source.onended = () => {
            if (audioBufferSourceRef.current === source) {
              audioBufferSourceRef.current = null;
              
              // Update playback position
              if (audioContextRef.current) {
                const playedTime = audioContextRef.current.currentTime - lastPlayTimeRef.current;
                playbackPositionRef.current += playedTime * sampleRate;
                
                // If we're still playing, start the next buffer
                if (isPlaying) {
                  ensureAudioIsPlaying();
                }
              }
            }
          };
        };
        
        ensureAudioIsPlaying();
      }
    }
    
    setIsPlaying(!isPlaying);
  }

  // Get buffer fill amount
  const getBufferFillAmount = (): number => {
    // All channels have the same amount of data
    // Find the first non-zero sample from the end
    const buffer = audioDataBufferRef.current[0];
    for (let i = bufferSizeRef.current - 1; i >= 0; i--) {
      if (buffer[i] !== 0) {
        return i + 1;
      }
    }
    return 0;
  };

  // Handle volume change
  const handleVolumeChange = (newVolume: number[]) => {
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
  }

  // Handle seeking with slider
  const handleSliderSeek = (newTime: number[]) => {
    if (!audioContextRef.current) return;
    
    const seekTime = newTime[0];
    const seekPosition = Math.floor(seekTime * sampleRate);
    
    // Update playback position
    playbackPositionRef.current = seekPosition;
    setCurrentTime(seekTime);
    
    // If we're playing, restart playback from the new position
    if (isPlaying) {
      if (audioBufferSourceRef.current) {
        audioBufferSourceRef.current.stop();
        audioBufferSourceRef.current = null;
      }
      
      // This will trigger playback from the new position
      const ensureAudioIsPlaying = () => {
        if (!audioContextRef.current || !gainNodeRef.current) return;
        
        // Create a new buffer source
        const bufferFill = getBufferFillAmount();
        if (bufferFill < sampleRate * 0.5) {
          // Not enough data to play yet (less than 0.5 seconds)
          return;
        }
        
        // Create an audio buffer
        const audioBuffer = audioContextRef.current.createBuffer(
          channels,
          bufferFill,
          sampleRate
        );
        
        // Fill the audio buffer with our data
        for (let c = 0; c < channels; c++) {
          const channelData = audioBuffer.getChannelData(c);
          channelData.set(audioDataBufferRef.current[c].slice(0, bufferFill));
        }
        
        // Create a buffer source
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNodeRef.current);
        
        // Start playback from the current position
        source.start(0, playbackPositionRef.current / sampleRate);
        audioBufferSourceRef.current = source;
        lastPlayTimeRef.current = audioContextRef.current.currentTime;
        
        // When this buffer finishes, play the next one
        source.onended = () => {
          if (audioBufferSourceRef.current === source) {
            audioBufferSourceRef.current = null;
            
            // Update playback position
            if (audioContextRef.current) {
              const playedTime = audioContextRef.current.currentTime - lastPlayTimeRef.current;
              playbackPositionRef.current += playedTime * sampleRate;
              
              // If we're still playing, start the next buffer
              if (isPlaying) {
                ensureAudioIsPlaying();
              }
            }
          }
        };
      };
      
      ensureAudioIsPlaying();
    }
  }

  // Handle seeking with canvas click
  const handleCanvasSeek = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !audioContextRef.current || duration === 0) return

    const rect = canvas.getBoundingClientRect()
    const clickPosition = event.clientX - rect.left
    const seekPercentage = clickPosition / rect.width
    const seekTime = seekPercentage * duration

    // Use the slider seek function to handle the actual seeking
    handleSliderSeek([seekTime]);
  }

  // Toggle mute
  const toggleMute = () => {
    if (!gainNodeRef.current) return;

    if (isMuted) {
      gainNodeRef.current.gain.value = volume;
      setIsMuted(false);
    } else {
      gainNodeRef.current.gain.value = 0;
      setIsMuted(true);
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
    <div className="fixed bottom-0 left-0 w-full h-[9vh] overflow-hidden -z-5 bg-sidebar">
      {/* Player content */}
      
      {/* Player content */}
      <div className="relative h-full flex items-center z-10 px-4">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-12 gap-4 items-center">
          {/* Track info - 3 columns */}
          <div className="col-span-3 flex items-center gap-3">
            <div className={`h-12 w-12 rounded-md overflow-hidden flex-shrink-0 ${img == "" ? "hidden" : ""}`}>
              {img && (
                <Image
                  width={48}
                  height={48}
                  src={img || "/placeholder.svg"}
                  alt="Album cover"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
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
          </div>
        </div>
      </div>
    </div>

  );
}