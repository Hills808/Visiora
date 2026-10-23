import { zipSync } from './vendor/fflate.mjs';
interface PackageManifest {
  files: { url: string; path: string }[];
  extra: { path: string; text: string }[];
}
const scope = self as unknown as {
  onmessage: (() => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};
scope.onmessage = async (): Promise<void> => {
  try {
    const response = await fetch('/local-package.json');
    if (!response.ok) throw new Error('O pacote local ainda não está disponível.');
    const manifest = (await response.json()) as PackageManifest;
    const files: Record<string, Uint8Array> = {};
    for (const [index, file] of manifest.files.entries()) {
      if (
        !file.url.startsWith('/') ||
        file.url.includes('..') ||
        !file.path.startsWith('visiora/dist/')
      )
        throw new Error('Lista de arquivos do pacote inválida.');
      const item = await fetch(file.url);
      if (!item.ok)
        throw new Error('Um arquivo do pacote não terminou de baixar. Tente novamente.');
      let data = new Uint8Array(await item.arrayBuffer());
      if (file.path.endsWith('/index.html'))
        data = new TextEncoder().encode(
          new TextDecoder()
            .decode(data)
            .replace('</head>', '<style>.download-link{display:none}</style></head>'),
        );
      files[file.path] = data;
      scope.postMessage({ type: 'progress', done: index + 1, total: manifest.files.length });
    }
    for (const extra of manifest.extra) {
      if (!extra.path.startsWith('visiora/') || extra.path.includes('..'))
        throw new Error('Caminho de pacote inválido.');
      files[extra.path] = new TextEncoder().encode(extra.text);
    }
    const bytes = zipSync(files, { level: 6, mtime: new Date('2026-10-17T00:00:00Z') });
    scope.postMessage({ type: 'ready', buffer: bytes.buffer }, [bytes.buffer]);
  } catch (error) {
    scope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Não consegui preparar o pacote local.',
    });
  }
};
