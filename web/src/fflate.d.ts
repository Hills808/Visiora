declare module '*fflate.mjs' {
  export function zipSync(
    files: Record<string, Uint8Array>,
    options: { level: number; mtime: Date },
  ): Uint8Array<ArrayBuffer>;
}
