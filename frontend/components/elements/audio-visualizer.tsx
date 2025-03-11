"use client"

import { useRef, useEffect, useState } from "react"

interface AudioVisualizerProps {
  audioRef: React.RefObject<HTMLAudioElement> | null
  isPlaying: boolean
  currentTime: number
  duration: number
  onSeek: (time: number) => void
}

export default function AudioVisualizer({ 
  audioRef, 
  isPlaying, 
  currentTime, 
  duration, 
  onSeek 
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [dataArray, setDataArray] = useState<Uint8Array | null>(null)
  const [source, setSource] = useState<MediaElementAudioSourceNode | null>(null)
  const animationRef = useRef<number>(0)
  
  // Initialize audio context and analyzer
  useEffect(() => {
    if (!audioRef?.current) return
    
    const context = new (window.AudioContext)()
    const analyzerNode = context.createAnalyser()
    analyzerNode.fftSize = 256
    
    const bufferLength = analyzerNode.frequencyBinCount
    const dataArr = new Uint8Array(bufferLength)
    
    const sourceNode = context.createMediaElementSource(audioRef.current)
    sourceNode.connect(analyzerNode)
    analyzerNode.connect(context.destination)
    
    setAudioContext(context)
    setAnalyser(analyzerNode)
    setDataArray(dataArr)
    setSource(sourceNode)
    
    return () => {
      if (source) {
        source.disconnect()
      }
      if (analyser) {
        analyser.disconnect()
      }
      if (audioContext) {
        audioContext.close()
      }
      cancelAnimationFrame(animationRef.current)
    }
  }, [audioRef])
  
  // Draw visualization
  useEffect(() => {
    if (!analyser || !dataArray || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const draw = () => {
      if (!analyser || !dataArray || !ctx) return
      
      // Set canvas dimensions
      canvas.width = canvas.clientWidth * window.devicePixelRatio
      canvas.height = canvas.clientHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Get frequency data
      analyser.getByteFrequencyData(dataArray)
      
      const barWidth = canvas.clientWidth / (dataArray.length * 0.7)
      const progressWidth = (currentTime / duration) * canvas.clientWidth
      
      // Draw bars
      for (let i = 0; i < dataArray.length; i++) {
        const x = i * barWidth + barWidth / 2
        
        // Calculate bar height based on frequency data
        // Use a minimum height for visual appeal
        const minHeight = 2
        const maxHeight = canvas.clientHeight * 0.8
        const rawHeight = dataArray[i] / 255 * maxHeight
        const barHeight = Math.max(minHeight, rawHeight)
        
        // Position bars in the middle vertically
        const y = (canvas.clientHeight - barHeight) / 2
        
        // Determine if this bar is within the progress area
        const isInProgress = x <= progressWidth
        
        // Set color based on progress
        if (isInProgress) {
          ctx.fillStyle = 'hsl(12, 100%, 62%)' // Primary color for played portion
        } else {
          ctx.fillStyle = 'hsla(12, 100%, 62%, 0.3)' // Faded primary for unplayed
        }
        
        // Draw the bar
        ctx.fillRect(x, y, barWidth * 0.7, barHeight)
      }
      
      // Continue animation if playing
      if (isPlaying) {
        animationRef.current = requestAnimationFrame(draw)
      }
    }
    
    // Start animation if playing
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(draw)
    } else {
      // Draw static visualization when paused
      draw()
    }
    
    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [analyser, dataArray, isPlaying, currentTime, duration])
  
  // Handle seeking when clicking on the visualizer
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !duration) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentClicked = clickX / rect.width
    const newTime = percentClicked * duration
    
    onSeek(newTime)
  }
  
  return (
    <div className="relative w-full h-10">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full cursor-pointer"
        onClick={handleClick}
      />
    </div>
  )
}
