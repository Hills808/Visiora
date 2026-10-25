import { CONFIG } from '../config.js';
import type { LocalFrame } from './frame.js';

interface PreparedYolox {
  rgba: ArrayBuffer;
  verificationRgba: ArrayBuffer;
  bounds: { width: number; height: number; ratio: number };
}

/** Reusable surfaces only; input/output buffers are never kept in this object. */
export class YoloxPreparer {
  private source = document.createElement('canvas');
  private small = document.createElement('canvas');
  private large = document.createElement('canvas');
  private disposed = false;

  private resize(canvas: HTMLCanvasElement, width: number, height: number): void {
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }

  /** Same top-left letterbox, pad and smoothing as Camera; no crop or stretch. */
  prepare(frame: LocalFrame): PreparedYolox {
    if (this.disposed) throw new Error('Local image preparation stopped');
    const { width, height } = frame.transform;
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      Math.max(width, height) > CONFIG.vision.verificationSize ||
      frame.rgba.byteLength !== width * height * 4
    )
      throw new Error('Invalid YOLOX input');
    const source = this.source;
    this.resize(source, width, height);
    const sourceContext = source.getContext('2d');
    if (!sourceContext) throw new Error('Local image preparation unavailable');
    sourceContext.putImageData(
      new ImageData(new Uint8ClampedArray(frame.rgba), width, height),
      0,
      0,
    );
    const letterbox = (canvas: HTMLCanvasElement, size: number): ArrayBuffer => {
      this.resize(canvas, size, size);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Local image preparation unavailable');
      const ratio = Math.min(size / width, size / height);
      context.fillStyle = `rgb(${CONFIG.vision.pad},${CONFIG.vision.pad},${CONFIG.vision.pad})`;
      context.fillRect(0, 0, size, size);
      context.imageSmoothingEnabled = true;
      context.drawImage(source, 0, 0, Math.floor(width * ratio), Math.floor(height * ratio));
      return context.getImageData(0, 0, size, size).data.buffer as ArrayBuffer;
    };
    return {
      rgba: letterbox(this.small, CONFIG.vision.size),
      verificationRgba: letterbox(this.large, CONFIG.vision.verificationSize),
      bounds: {
        width,
        height,
        ratio: Math.min(CONFIG.vision.size / width, CONFIG.vision.size / height),
      },
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const canvas of [this.source, this.small, this.large]) canvas.width = canvas.height = 0;
  }
}

/** One-shot compatibility helper; continuous inference uses its adapter-owned preparer. */
export function prepareYolox(frame: LocalFrame): PreparedYolox {
  const preparer = new YoloxPreparer();
  try {
    return preparer.prepare(frame);
  } finally {
    preparer.dispose();
  }
}
