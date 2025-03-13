// This worker handles audio processing tasks off the main thread

// Define message types for type safety
type WorkerMessageEvent = {
    data: WorkerMessage
  }
  
  type WorkerMessage =
    | {
        type: "PROCESS_AUDIO"
        payload: { arrayBuffer: ArrayBuffer; bitDepth: number; channels: number; sampleRate: number }
      }
    | { type: "INIT_BUFFER"; payload: { channels: number; bufferSize: number } }
  
  type MainThreadMessage =
    | { type: "PROCESSED_AUDIO"; payload: { pcmData: Float32Array[]; samplesPerChannel: number } }
    | { type: "BUFFER_INITIALIZED"; payload: { channels: number } }
  
  // Audio buffer storage
  let audioDataBuffer: Float32Array[] = []
  let bufferSize = 0
  
  // Process incoming messages from main thread
  self.onmessage = (event: WorkerMessageEvent) => {
    const { type, payload } = event.data
  
    switch (type) {
      case "INIT_BUFFER":
        initializeBuffer(payload.channels, payload.bufferSize)
        break
      case "PROCESS_AUDIO":
        processAudioData(payload.arrayBuffer, payload.bitDepth, payload.channels, payload.sampleRate)
        break
    }
  }
  
  // Initialize audio buffer
  function initializeBuffer(channels: number, size: number) {
    audioDataBuffer = []
    bufferSize = size
  
    for (let i = 0; i < channels; i++) {
      audioDataBuffer.push(new Float32Array(size))
    }
  
    self.postMessage({
      type: "BUFFER_INITIALIZED",
      payload: { channels },
    })
  }
  
  // Process audio data based on bit depth
  function processAudioData(arrayBuffer: ArrayBuffer, bitDepth: number, channels: number, sampleRate: number) {
    let pcmData: Float32Array[]
  
    if (bitDepth === 16) {
      // 16-bit PCM (Int16)
      const int16Array = new Int16Array(arrayBuffer)
      pcmData = deinterleave(int16Array, channels, (sample) => sample / 32768.0)
    } else if (bitDepth === 24) {
      // 24-bit PCM (needs special handling)
      pcmData = process24BitPCM(arrayBuffer, channels)
    } else if (bitDepth === 32) {
      // 32-bit float PCM
      const float32Array = new Float32Array(arrayBuffer)
      pcmData = deinterleave(float32Array, channels)
    } else if (bitDepth === 8) {
      // 8-bit PCM (Uint8)
      const uint8Array = new Uint8Array(arrayBuffer)
      pcmData = deinterleave(uint8Array, channels, (sample) => (sample - 128) / 128.0)
    } else {
      console.error("Unsupported bit depth:", bitDepth)
      return
    }
  
    // Send processed data back to main thread
    self.postMessage(
      {
        type: "PROCESSED_AUDIO",
        payload: {
          pcmData,
          samplesPerChannel: pcmData[0].length,
        },
      },
      {
        // Transfer ownership of the buffers to avoid copying
        transfer: pcmData.map((buffer) => buffer.buffer),
      },
    )
  }
  
  // Deinterleave audio channels
  function deinterleave<T extends ArrayLike<number>>(
    interleavedData: T,
    channels: number,
    normalizer?: (sample: number) => number,
  ): Float32Array[] {
    const deinterleavedData: Float32Array[] = []
    const samplesPerChannel = Math.floor(interleavedData.length / channels)
  
    // Create arrays for each channel
    for (let c = 0; c < channels; c++) {
      deinterleavedData.push(new Float32Array(samplesPerChannel))
    }
  
    // Fill the arrays
    for (let i = 0; i < samplesPerChannel; i++) {
      for (let c = 0; c < channels; c++) {
        const sample = interleavedData[i * channels + c]
        deinterleavedData[c][i] = normalizer ? normalizer(sample) : sample
      }
    }
  
    return deinterleavedData
  }
  
  // Special handling for 24-bit PCM
  function process24BitPCM(buffer: ArrayBuffer, channels: number): Float32Array[] {
    const bytes = new Uint8Array(buffer)
    const samplesPerChannel = Math.floor(bytes.length / (3 * channels)) // 3 bytes per sample
    const output: Float32Array[] = []
  
    // Create arrays for each channel
    for (let c = 0; c < channels; c++) {
      output.push(new Float32Array(samplesPerChannel))
    }
  
    // Process 24-bit samples (3 bytes per sample)
    for (let i = 0; i < samplesPerChannel; i++) {
      for (let c = 0; c < channels; c++) {
        const startByte = (i * channels + c) * 3
  
        // Combine 3 bytes into a 24-bit integer (little-endian)
        const sample = (bytes[startByte] << 8) | (bytes[startByte + 1] << 16) | (bytes[startByte + 2] << 24)
  
        // Convert to float in range [-1, 1]
        output[c][i] = sample / 8388608.0 // 2^23
      }
    }
  
    return output
  }
  
  