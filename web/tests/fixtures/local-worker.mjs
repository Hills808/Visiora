// QA-only stateless empty observations. No detector, model, place or person is simulated as true.
const source = { id: 'h1-empty-fixture', revision: '1', simulated: true };
const delayMs = Number(new URL(self.location.href).searchParams.get('delay'));
let fail = false;
self.onmessage = ({ data }) => {
  if (data.control === 'fail') {
    fail = true;
    return;
  }
  if (fail) throw new Error('Intentional QA worker failure');
  const { stamp, transform, rgba } = data;
  if (rgba.byteLength !== transform.width * transform.height * 4)
    throw new Error('QA received wrong pixel dimensions');
  // A controlled processing delay to exercise backpressure, not a race workaround.
  setTimeout(
    () => self.postMessage({ schemaVersion: 1, stamp, transform, source, observations: [] }),
    delayMs,
  );
};
