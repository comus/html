/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

tf.wasm.setWasmPaths(
    `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${
      tf.wasm.version_wasm}/dist/`);

import {Camera} from './camera.js';
import {setupDatGui} from './option_panel.js';
import {STATE} from './params.js';
import {setupStats} from './stats_panel.js';
import {setBackendAndEnvFlags} from './util.js';

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
    case poseDetection.SupportedModels.BlazePose:
      const runtime = STATE.backend.split('-')[0];
      if (runtime === 'tfjs') {
        return poseDetection.createDetector(
            STATE.model, {runtime, modelType: STATE.modelConfig.type});
      }
    case poseDetection.SupportedModels.MoveNet:
      let modelType;
      if (STATE.modelConfig.type == 'lightning') {
        modelType = poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING;
      } else if (STATE.modelConfig.type == 'thunder') {
        modelType = poseDetection.movenet.modelType.SINGLEPOSE_THUNDER;
      } else if (STATE.modelConfig.type == 'multipose') {
        modelType = poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING;
      }
      const modelConfig = {modelType};

      if (STATE.modelConfig.customModel !== '') {
        modelConfig.modelUrl = STATE.modelConfig.customModel;
      }
      if (STATE.modelConfig.type === 'multipose') {
        modelConfig.enableTracking = STATE.modelConfig.enableTracking;
      }
      return poseDetection.createDetector(STATE.model, modelConfig);
  }
}

// async function checkGuiUpdate() {
//   if (STATE.isTargetFPSChanged || STATE.isSizeOptionChanged) {
//     camera = await Camera.setupCamera(STATE.camera);
//     STATE.isTargetFPSChanged = false;
//     STATE.isSizeOptionChanged = false;
//   }

//   if (STATE.isModelChanged || STATE.isFlagChanged || STATE.isBackendChanged) {
//     STATE.isModelChanged = true;

//     window.cancelAnimationFrame(rafId);

//     if (detector != null) {
//       detector.dispose();
//     }

//     if (STATE.isFlagChanged || STATE.isBackendChanged) {
//       await setBackendAndEnvFlags(STATE.flags, STATE.backend);
//     }

//     try {
//       detector = await createDetector(STATE.model);
//     } catch (error) {
//       detector = null;
//       alert(error);
//     }

//     STATE.isFlagChanged = false;
//     STATE.isBackendChanged = false;
//     STATE.isModelChanged = false;
//   }
// }

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
      alert(error);
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
  // await checkGuiUpdate();

  // if (!STATE.isModelChanged) {
  //   await renderResult(camera, detector);
  // }

  // rafId = requestAnimationFrame(renderPrediction);

  fabric.util.requestAnimFrame(async function render() {
    await renderResult(camera, detector);
    camera.canvas.renderAll();
    fabric.util.requestAnimFrame(render);
  });
};

async function app() {
  const urlParams = {
    get: () => 'movenet'
  }

  await setupDatGui(urlParams);

  stats = setupStats();

  camera = await Camera.setupCamera(STATE.camera, 'webcam', 'c');

  await setBackendAndEnvFlags(STATE.flags, STATE.backend);

  detector = await createDetector();

  renderPrediction();
};

app();
