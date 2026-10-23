import { memoryTranscripts } from '../tests/fixtures/memory-scenarios.mjs';

// QA fixtures only; no model, camera, API or user data.
for (const scenario of memoryTranscripts()) console.log(JSON.stringify(scenario));
