import { OnlineSession as Session } from '/vision/online-session.js';
import { WorkerLocalAdapter } from '/perception/worker-adapter.js';

// Injected by E2E routing only; the product has no query flag or fake detector switch.
export class OnlineSession extends Session {
  constructor(video, hooks) {
    super(video, hooks, () => {
      const worker = new Worker(`/qa/local-worker.mjs?delay=${window.__localDelayMs ?? 600}`, {
        type: 'module',
      });
      window.__workers.push(worker);
      const send = worker.postMessage.bind(worker),
        terminate = worker.terminate.bind(worker);
      worker.postMessage = (frame, transfer) => {
        if (!frame.stamp) return send(frame, transfer);
        window.__localStamps.push({ ...frame.stamp });
        send(frame, transfer);
        if (frame.rgba.byteLength !== 0) throw new Error('Pixels were not transferred');
      };
      worker.terminate = () => {
        window.__terminated++;
        terminate();
      };
      return new WorkerLocalAdapter(
        worker,
        { id: 'h1-empty-fixture', revision: '1', simulated: true },
        { width: 32, height: 24 },
      );
    });
    window.__online = this;
  }
}
