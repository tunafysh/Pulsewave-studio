/* eslint-disable @typescript-eslint/no-unused-vars */
// audio-worker.ts
// Web Worker for WAV file processing

// Define WAV file format structure
interface WAVFormat {
  audioFormat: number
  numChannels: number
  sampleRate: number
  byteRate: number
  blockAlign: number
  bitsPerSample: number
}

// Define WAV metadata
interface WAVMetadata {
  title?: string
  artist?: string
  album?: string
  year?: string
  image?: string
  format: WAVFormat
}

// Initialize worker state
let bufferSize = 0
let channels = 2
let audioBuffer: Float32Array[] = []

// Helper function to read a string from a DataView
function readString(dataView: DataView, offset: number, length: number): string {
  let str = ""
  for (let i = 0; i < length; i++) {
    const char = dataView.getUint8(offset + i)
    if (char !== 0) {
      str += String.fromCharCode(char)
    }
  }
  return str
}

// Parse WAV file header
function parseWAVHeader(arrayBuffer: ArrayBuffer): {
  format: WAVFormat
  dataOffset: number
  dataLength: number
  metadata: WAVMetadata
} {
  const dataView = new DataView(arrayBuffer)
  let offset = 0

  // Check RIFF header
  const riffHeader = readString(dataView, offset, 4)
  if (riffHeader !== "RIFF") {
    throw new Error("Invalid WAV file: RIFF header not found")
  }
  offset += 4

  // File size (minus 8 bytes for the RIFF header)
  const fileSize = dataView.getUint32(offset, true) + 8
  offset += 4

  // Check WAVE format
  const waveHeader = readString(dataView, offset, 4)
  if (waveHeader !== "WAVE") {
    throw new Error("Invalid WAV file: WAVE header not found")
  }
  offset += 4

  // Initialize format and metadata
  const format: WAVFormat = {
    audioFormat: 1, // Default to PCM
    numChannels: 2,
    sampleRate: 44100,
    byteRate: 176400,
    blockAlign: 4,
    bitsPerSample: 16,
  }

  let dataOffset = 0
  let dataLength = 0
  const metadata: WAVMetadata = {
    format,
  }

  // Parse chunks
  while (offset < arrayBuffer.byteLength) {
    // Read chunk ID
    const chunkId = readString(dataView, offset, 4)
    offset += 4

    // Read chunk size
    const chunkSize = dataView.getUint32(offset, true)
    offset += 4

    // Process chunk based on ID
    switch (chunkId) {
      case "fmt ":
        // Format chunk
        format.audioFormat = dataView.getUint16(offset, true)
        offset += 2

        format.numChannels = dataView.getUint16(offset, true)
        offset += 2

        format.sampleRate = dataView.getUint32(offset, true)
        offset += 4

        format.byteRate = dataView.getUint32(offset, true)
        offset += 4

        format.blockAlign = dataView.getUint16(offset, true)
        offset += 2

        format.bitsPerSample = dataView.getUint16(offset, true)
        offset += 2

        // Skip any extra format bytes
        offset += chunkSize - 16
        break

      case "data":
        // Audio data chunk
        dataOffset = offset
        dataLength = chunkSize
        offset += chunkSize
        break

      case "LIST":
        // LIST chunk (may contain metadata)
        const listType = readString(dataView, offset, 4)
        offset += 4

        if (listType === "INFO") {
          // Parse INFO subchunks
          const endOfList = offset + chunkSize - 4
          while (offset < endOfList) {
            const infoId = readString(dataView, offset, 4)
            offset += 4

            const infoSize = dataView.getUint32(offset, true)
            offset += 4

            const infoValue = readString(dataView, offset, infoSize)
            offset += infoSize

            // Align to even byte boundary
            if (infoSize % 2 !== 0) offset++

            // Store metadata
            switch (infoId) {
              case "INAM":
                metadata.title = infoValue
                break
              case "IART":
                metadata.artist = infoValue
                break
              case "IPRD":
                metadata.album = infoValue
                break
              case "ICRD":
                metadata.year = infoValue
                break
              default:
                break
            }
          }
        } else {
          // Skip unknown LIST type
          offset += chunkSize - 4
        }
        break

      default:
        // Skip unknown chunks
        offset += chunkSize
        break
    }

    // Ensure we're aligned to even byte boundary
    if (chunkSize % 2 !== 0) offset++
  }

  metadata.format = format
  return { format, dataOffset, dataLength, metadata }
}

// Extract PCM data from WAV buffer
function extractPCMFromWAV(
  arrayBuffer: ArrayBuffer,
  format: WAVFormat,
  dataOffset: number,
  dataLength: number,
): Float32Array[] {
  const dataView = new DataView(arrayBuffer)
  const numChannels = format.numChannels
  const bitsPerSample = format.bitsPerSample
  const bytesPerSample = bitsPerSample / 8
  const samplesPerChannel = dataLength / (numChannels * bytesPerSample)

  // Create output arrays for each channel
  const channelData: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) {
    channelData.push(new Float32Array(samplesPerChannel))
  }

  // Extract samples
  let offset = dataOffset
  for (let i = 0; i < samplesPerChannel; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = 0

      // Read sample based on bit depth
      if (bitsPerSample === 8) {
        // 8-bit samples are unsigned
        sample = dataView.getUint8(offset) / 128.0 - 1.0
        offset += 1
      } else if (bitsPerSample === 16) {
        // 16-bit samples are signed
        sample = dataView.getInt16(offset, true) / 32768.0
        offset += 2
      } else if (bitsPerSample === 24) {
        // 24-bit samples are signed
        const byte1 = dataView.getUint8(offset)
        const byte2 = dataView.getUint8(offset + 1)
        const byte3 = dataView.getUint8(offset + 2)

        // Combine bytes into a 24-bit signed integer, then convert to float
        let value = (byte3 << 16) | (byte2 << 8) | byte1
        // If the highest bit is set, convert to negative value
        if (value & 0x800000) {
          value = value | ~0xffffff // Sign extension
        }
        sample = value / 8388608.0 // 2^23
        offset += 3
      } else if (bitsPerSample === 32) {
        // 32-bit samples could be signed int or float
        if (format.audioFormat === 1) {
          // PCM
          sample = dataView.getInt32(offset, true) / 2147483648.0 // 2^31
        } else if (format.audioFormat === 3) {
          // IEEE float
          sample = dataView.getFloat32(offset, true)
        }
        offset += 4
      }

      // Store sample
      channelData[c][i] = sample
    }
  }

  return channelData
}

// Process WAV file
function processWAVFile(arrayBuffer: ArrayBuffer): {
  pcmData: Float32Array[]
  samplesPerChannel: number
  duration: number
  metadata: WAVMetadata
} {
  try {
    // Parse WAV header
    const { format, dataOffset, dataLength, metadata } = parseWAVHeader(arrayBuffer)

    // Extract PCM data
    const pcmData = extractPCMFromWAV(arrayBuffer, format, dataOffset, dataLength)

    // Calculate duration
    const samplesPerChannel = pcmData[0].length
    const duration = samplesPerChannel / format.sampleRate

    return {
      pcmData,
      samplesPerChannel,
      duration,
      metadata,
    }
  } catch (error) {
    console.error("Error processing WAV file:", error)
    throw error
  }
}

// Handle messages from main thread
self.onmessage = (event) => {
  const { type, payload } = event.data

  switch (type) {
    case "INIT_BUFFER":
      // Initialize buffer
      channels = payload.channels
      bufferSize = payload.bufferSize

      // Create empty audio buffer
      audioBuffer = []
      for (let c = 0; c < channels; c++) {
        audioBuffer.push(new Float32Array(bufferSize))
      }

      // Notify main thread
      self.postMessage({
        type: "BUFFER_INITIALIZED",
        payload: {
          channels,
          bufferSize,
        },
      })
      break

    case "PROCESS_AUDIO":
      try {
        // Process WAV file
        const { pcmData, samplesPerChannel, duration, metadata } = processWAVFile(payload.arrayBuffer)

        // Send processed audio to main thread
        self.postMessage({
          type: "PROCESSED_AUDIO",
          payload: {
            pcmData,
            samplesPerChannel,
            duration,
            metadata,
          },
        })

        // Also send metadata separately for clarity
        self.postMessage({
          type: "METADATA",
          payload: {
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
            year: metadata.year,
            image: metadata.image,
            sampleRate: metadata.format.sampleRate,
            channels: metadata.format.numChannels,
            bitsPerSample: metadata.format.bitsPerSample,
          },
        })
      } catch (error) {
        self.postMessage({
          type: "ERROR",
          payload: error,
        })
      }
      break

    default:
      console.warn("Unknown message type:", type)
      break
  }
}

