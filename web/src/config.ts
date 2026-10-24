/** All tunable thresholds, with units and intent. Research hypotheses, not measured safety limits. */
export const CONFIG = Object.freeze({
  version: '0.3.0',
  online: {
    deliveryPolicyRevision: 'adr-046', // Exported in diagnostics to identify the local Luna build after cache updates.
    snapshotMaxAgeMs: 10000, // Explicitly aged snapshots only; never inserted into the live World.
    imageMaxSide: 1280,
    jpegQuality: 0.85,
    maxImageBytes: 1000000,
    statusTimeoutMs: 3000,
    clientTimeoutMs: 13000, // Gateway has 12 s; allow its error to reach the client.
    motionWidth: 32,
    motionHeight: 24, // Small RGB fingerprint, never uploaded or persisted.
    preferredHeight: 720,
    autoIntervalMs: 4500, // Faster continuity; above gateway 4 s cooldown, with single-flight and budget caps.
    autoChangeDelta: 0.04, // Mean RGB change versus the last dispatched view; experimental, not semantic proof.
    autoPixelDelta: 0.15,
    autoChangedFraction: 0.02, // Also notice localized changes affecting 2% of sampled RGB channels.
    autoTileSide: 4,
    autoTileDelta: 0.08,
    autoChangedTiles: 2, // Notice moderate localized changes hidden by global averaging; experimental.
    autoBroadFraction: 0.45, // A broadly changed view merits a new orientation, not proof of camera motion.
    autoStructureDelta: 0.06, // Ignore a uniform brightness/color offset when deciding that the view changed broadly.
    recoveryDelayMs: 15000,
    maxRecoveryAttempts: 1, // At most one fresh, budgeted capture after a transient failure; never an unbounded retry.
    obsoleteNoticeAfter: 2, // One capability notice after consecutive lost views, until a fresh description is delivered.
    autoMemoryLimit: 128, // Bound acknowledged label/sector groups during one session.
    snapshotRequestMemoryLimit: 16, // Bound replay IDs per frame; above the gateway's 15 requests/minute ceiling.
    referenceMemoryMs: 30000, // Drop unobserved discourse references; this never extends snapshot validity.
    sectorHysteresisDegrees: 5, // Ignore small box jitter across sector edges; a hypothesis pending human evaluation.
    sceneConfirmationFrames: 2, // Require distinct captures before renaming a place in the same view.
    sceneConfirmationGapMs: 30000, // Widely separated captures cannot accumulate scene confirmation.
  },
  motion: { maxYawRate: 15, settleMs: 1200, sensorStaleMs: 1500 }, // deg/s; settle before describing
  cameraRotation: {
    minRateDegPerSecond: 15, // Experimental camera rotation threshold, not body heading or walking detection.
    confirmations: 2, // Reject isolated sensor spikes; no position is restored by a later low reading.
    maxGapMs: 250, // Only adjacent distinct readings confirm rotation; long pauses reset confirmation.
    staleMs: 1500, // Report absent/expired readings honestly; no sensor implies no extra invalidation.
  },
  continuous: {
    minHits: 3, // Independent accepted frames, not duplicate frames or model votes; experimental association only.
    minIou: 0.3, // Conservative image overlap association; ambiguous crossings suspend association.
    maxGapMs: 2500, // Slow CPU observations cannot accumulate confirmation across longer gaps.
    maxAgeMs: 3000, // Local observations never extend the existing three-second evidence window.
    retentionMs: 5000, // Brief occlusion memory has no current direction and expires without claiming departure.
    maxTracks: 30, // Bound session-local associations; never persistent identities.
    sectorHysteresisDegrees: 5, // Ignore small image-box jitter; not calibrated body heading.
    derivativeCanvases: 2, // Retain RGB and detector resize surfaces only; no image history or frame queue.
  },
  speech: {
    briefingMs: 3800,
    gapMs: 2400,
    minGapMs: 600, // Brief pause for every voice channel; leaves up to 200 ms of the request latency budget.
    ttlMs: 7000,
    answerTtlMs: 4000,
    maxOnlineSpeechMs: 60000, // Stop a voice callback that never finishes; do not block automatic analysis forever.
    maxWords: 25,
    briefingWords: 45,
    maxItems: 3,
    maxHistory: 50,
    retryMs: 1800,
  },
  world: {
    minScore: 0.5,
    hits: 3,
    bearingGate: 12,
    rangeGate: 0.9,
    relativeRangeGate: 0.3,
    visibleMs: 2200,
    forgetStaticMs: 30000,
    forgetDynamicMs: 3000,
    oldMs: 8000,
    maxMisses: 12,
    approachSpeed: 0.5,
    approachRatio: 0.6,
    velocityEpsilon: 1e-9,
  }, // Floating point tolerance at the exact speed boundary, m/s.
  scene: { stableMs: 1800, minSamples: 2, maxSampleGapMs: 3500, maxEvidenceAgeMs: 6500 }, // Requires independent stable images; old evidence expires.
  classification: {
    size: 224,
    dimensions: 768,
    sampleMs: 2000,
    minSimilarity: 0.12,
    minMargin: 0.03,
    consensus: {
      topCandidates: 3,
      maxSimilarityGap: 0.015,
      minProbability: 0.3,
      minFamilyMargin: 0.15,
      placesClasses: 365,
      mean: [0.485, 0.456, 0.406],
      std: [0.229, 0.224, 0.225],
    }, // Frozen scene-consensus protocol: learned whole-image agreement, never object hints.
    minImageVariance: 0.0001,
    maxModelBytes: 128_000_000,
    loadTimeoutMs: 180000,
    inferenceTimeoutMs: 15000,
  }, // One scene inference in flight; slow results are discarded by the brain. Scores are not probabilities.
  space: {
    fov: 70,
    sectors: 8,
    maxDepthM: 20,
    minDepthM: 0.1,
    stepLength: 0.7,
    alertM: 1.8,
    frontDegrees: 25,
  },
  capture: {
    width: 640,
    height: 480,
    fps: 5,
    economyFps: 2,
    maxFrameAgeMs: 3000,
    futureToleranceMs: 100,
    maxInFlight: 1,
    motionSampleStride: 128,
    motionDelta: 0.08,
  }, // Image change is a conservative pause heuristic, not a gyro measurement.
  vision: {
    size: 416,
    verificationSize: 640,
    personConsensus: { minHeads: 2, minIou: 0.5 }, // Frozen person-consensus protocol; other objects keep Nano predictions.
    classes: 80,
    fields: 85,
    strides: [8, 16, 32],
    pad: 114,
    minScore: 0.45,
    nms: 0.45,
    maxDetections: 30,
    statusMaxChars: 512, // Bound worker status/protocol strings; never accept arbitrary provider payloads.
    workerTimeoutMs: 180000, // First access also downloads the two local person-verification models.
    inferenceTimeoutMs: 10000,
  },
  ui: {
    tickMs: 200,
    maxSessionMs: 30 * 60 * 1000,
    downloadTimeoutMs: 60000,
    toastMs: 6000,
    demoTurnMs: 800,
    demoTurnRate: 56.25,
    diagnosticSamples: 300,
  },
  storage: {
    preferences: 'visiora.preferences.v1',
    history: 'visiora.history.v1',
    maxBytes: 100000,
  },
});
