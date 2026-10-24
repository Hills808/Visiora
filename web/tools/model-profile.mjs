/** Reuse only the three existing object weights in the hosted Luna observer profile. */
export function includeLunaModel(relative) {
  const name = relative.replaceAll('\\', '/');
  return (
    name === '' ||
    name === 'manifest.json' ||
    name === 'yolox-nano.onnx' ||
    name === 'yolox-tiny' ||
    name.startsWith('yolox-tiny/') ||
    name === 'yolox-s' ||
    name.startsWith('yolox-s/')
  );
}
