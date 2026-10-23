declare module '*ort.wasm.min.mjs' {
  export const env: {
    wasm: { wasmPaths: string; numThreads: number; proxy: boolean };
    logLevel: string;
  };
  export class Tensor {
    constructor(type: string, data: Float32Array, dimensions: number[]);
    data: Float32Array;
    dispose(): void;
  }
  export class InferenceSession {
    static create(
      url: string | Uint8Array,
      options: { executionProviders: string[]; graphOptimizationLevel: string },
    ): Promise<InferenceSession>;
    inputNames: string[];
    outputNames: string[];
    run(input: Record<string, Tensor>): Promise<Record<string, Tensor>>;
    release(): Promise<void>;
  }
}

declare module '*ort.webgpu.min.mjs' {
  export const env: {
    wasm: { wasmPaths: string; numThreads: number; proxy: boolean };
    logLevel: string;
  };
  export class Tensor {
    constructor(type: string, data: Float32Array, dimensions: number[]);
    data: Float32Array;
    dispose(): void;
  }
  export class InferenceSession {
    static create(
      url: string | Uint8Array,
      options: { executionProviders: string[]; graphOptimizationLevel: string },
    ): Promise<InferenceSession>;
    inputNames: string[];
    outputNames: string[];
    run(input: Record<string, Tensor>): Promise<Record<string, Tensor>>;
    release(): Promise<void>;
  }
}
