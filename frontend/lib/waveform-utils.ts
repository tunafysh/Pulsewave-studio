// Utility functions for audio waveform visualization

/**
 * Normalizes an array of numbers to a range between 0 and 1
 */
export function normalizeData(data: number[]): number[] {
    const maxValue = Math.max(...data);
    return data.map(point => point / maxValue);
  }
  
  /**
   * Smooths waveform data to create a more visually appealing waveform
   * Uses a simple moving average algorithm
   */
  export function smoothWaveform(data: number[], windowSize: number = 3): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(data.length - 1, i + windowSize); j++) {
        sum += data[j];
        count++;
      }
      
      result.push(sum / count);
    }
    
    return result;
  }
  
  /**
   * Creates a mirror effect for the waveform (top and bottom)
   */
  export function createMirroredWaveform(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, played: boolean): void {
    // Save the current state
    ctx.save();
    
    // Create gradient for played portion
    if (played) {
      const gradient = ctx.createLinearGradient(x, y, x, y + height);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.6)');
      ctx.fillStyle = gradient;
    } else {
      const gradient = ctx.createLinearGradient(x, y, x, y + height);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
      ctx.fillStyle = gradient;
    }
    
    // Draw the bar
    ctx.fillRect(x, y, width, height);
    
    // Restore the state
    ctx.restore();
  }
  