console.log('jjsdlkjflsdjf', _.filter)

tf.wasm.setWasmPaths(
    `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${
      tf.wasm.version_wasm}/dist/`);

import {Camera} from './camera.js';
import * as params from './params.js';
import {setupStats} from './stats_panel.js';
import {setBackendAndEnvFlags} from './util.js';

const STATE = params.STATE

let detector, detector2, camera, camera2, stats;
let startInferenceTime, numInferences = 0;
let inferenceTimeSum = 0, lastPanelUpdate = 0;
let rafId;

async function createDetector() {
  switch (STATE.model) {
    case poseDetection.SupportedModels.PoseNet:
      return poseDetection.createDetector(STATE.model, {
        quantBytes: 4,
        architecture: 'MobileNetV1',
        outputStride: 16,
        inputResolution: {width: 500, height: 500},
        multiplier: 0.75
      });
  }
}

function beginEstimatePosesStats() {
  startInferenceTime = (performance || Date).now();
}

function endEstimatePosesStats() {
  const endInferenceTime = (performance || Date).now();
  inferenceTimeSum += endInferenceTime - startInferenceTime;
  ++numInferences;

  const panelUpdateMilliseconds = 1000;
  if (endInferenceTime - lastPanelUpdate >= panelUpdateMilliseconds) {
    const averageInferenceTime = inferenceTimeSum / numInferences;
    inferenceTimeSum = 0;
    numInferences = 0;
    stats.customFpsPanel.update(
        1000.0 / averageInferenceTime, 120 /* maxValue */);
    lastPanelUpdate = endInferenceTime;
  }
}

async function renderResult(camera, detector) {
  if (camera.video.readyState < 2) {
    await new Promise((resolve) => {
      camera.video.onloadeddata = () => {
        resolve(video);
      };
    });
  }

  let poses = null;

  // Detector can be null if initialization failed (for example when loading
  // from a URL that does not exist).
  if (detector != null) {
    // FPS only counts the time it takes to finish estimatePoses.
    if (camera.videoId === 'webcam') {
      beginEstimatePosesStats();
    }

    // Detectors can throw errors, for example when using custom URLs that
    // contain a model that doesn't provide the expected output.
    try {
      poses = await detector.estimatePoses(
          camera.video,
          {maxPoses: STATE.modelConfig.maxPoses, flipHorizontal: false});
    } catch (error) {
      detector.dispose();
      detector = null;
      console.log(error);
    }

    if (camera.videoId === 'webcam') {
      endEstimatePosesStats();
    }
  }

  camera.canvas.clear();
  
  camera.drawCtx();

  // The null check makes sure the UI is not in the middle of changing to a
  // different model. If during model change, the result is from an old model,
  // which shouldn't be rendered.
  if (poses && poses.length > 0 && !STATE.isModelChanged) {
    camera.drawResults(poses);
  }
}

async function renderPrediction() {
  // await renderResult(camera2, detector2);

  fabric.util.requestAnimFrame(async function render() {
    await renderResult(camera, detector);
    camera.canvas.renderAll();
    fabric.util.requestAnimFrame(render);
  });
};

async function setup () {
  params.STATE.model = poseDetection.SupportedModels.PoseNet;
  params.STATE.modelConfig = { ...params.POSENET_CONFIG };

  const backends = params.MODEL_BACKEND_MAP[params.STATE.model];
  params.STATE.backend = backends[0];

  // Clean up the cache to query tunable flags' default values.
  let TUNABLE_FLAG_DEFAULT_VALUE_MAP = {};
  params.STATE.flags = {};
  for (const backend in params.BACKEND_FLAGS_MAP) {
    for (
      let index = 0;
      index < params.BACKEND_FLAGS_MAP[backend].length;
      index++
    ) {
      const flag = params.BACKEND_FLAGS_MAP[backend][index];
      TUNABLE_FLAG_DEFAULT_VALUE_MAP[flag] = await tf.env().getAsync(flag);
    }
  }

  // Initialize STATE.flags with tunable flags' default values.
  for (const flag in TUNABLE_FLAG_DEFAULT_VALUE_MAP) {
    if (params.BACKEND_FLAGS_MAP[params.STATE.backend].indexOf(flag) > -1) {
      params.STATE.flags[flag] = TUNABLE_FLAG_DEFAULT_VALUE_MAP[flag];
    }
  }
}

async function app() {
  await setup();
  stats = setupStats();
  

  camera = await Camera.setupCamera(STATE.camera, 'webcam', 'c');
  // // camera2 = await Camera.setupCamera(STATE.camera, 'v', 'o');

  await setBackendAndEnvFlags(STATE.flags, STATE.backend);

  detector = await createDetector();
  // // detector2 = await createDetector();

  renderPrediction();

  // var canvas = new fabric.Canvas('c');
  // var webcamEl = document.getElementById('webcam');

  // var webcam = new fabric.Image(webcamEl, {
  //   left: 0,
  //   top: 0,
  //   objectCaching: false,
  // });

  // // adding webcam video element
  // navigator.mediaDevices.getUserMedia({
  //   'audio': false,
  //   'video': {
  //     facingMode: 'user',
  //     width: 360,
  //     height: 270
  //   }
  // })
  // .then(function getWebcamAllowed(localMediaStream) {
  //   webcamEl.srcObject = localMediaStream;

  //   canvas.add(webcam);
  //   webcam.moveTo(0); // move webcam element to back of zIndex stack
  //   webcam.getElement().play();
  // }).catch(function getWebcamNotAllowed(e) {
  // // block will be hit if user selects "no" for browser "allow webcam access" prompt
  // });
};

app();
