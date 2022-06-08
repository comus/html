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

import * as params from './params.js';
import {isMobile} from './util.js';

// These anchor points allow the pose pointcloud to resize according to its
// position in the input.
const ANCHOR_POINTS = [[0, 0, 0], [0, 1, 0], [-1, 0, 0], [-1, -1, 0]];

// #ffffff - White
// #800000 - Maroon
// #469990 - Malachite
// #e6194b - Crimson
// #42d4f4 - Picton Blue
// #fabed4 - Cupid
// #aaffc3 - Mint Green
// #9a6324 - Kumera
// #000075 - Navy Blue
// #f58231 - Jaffa
// #4363d8 - Royal Blue
// #ffd8b1 - Caramel
// #dcbeff - Mauve
// #808000 - Olive
// #ffe119 - Candlelight
// #911eb4 - Seance
// #bfef45 - Inchworm
// #f032e6 - Razzle Dazzle Rose
// #3cb44b - Chateau Green
// #a9a9a9 - Silver Chalice
const COLOR_PALETTE = [
  '#ffffff', '#800000', '#469990', '#e6194b', '#42d4f4', '#fabed4', '#aaffc3',
  '#9a6324', '#000075', '#f58231', '#4363d8', '#ffd8b1', '#dcbeff', '#808000',
  '#ffe119', '#911eb4', '#bfef45', '#f032e6', '#3cb44b', '#a9a9a9'
];
export class Camera {
  constructor(videoId, canvasId) {
    this.videoId = videoId
    this.canvasId = canvasId
    this.video = document.getElementById(videoId);
    this.canvas = new fabric.Canvas(canvasId, { selection: false });
  }

  /**
   * Initiate a Camera instance and wait for the camera stream to be ready.
   * @param cameraParam From app `STATE.camera`.
   */
  static async setupCamera(cameraParam, videoId, canvasId) {
    const camera = new Camera(videoId, canvasId);

    if (videoId === 'webcam') {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
            'Browser API navigator.mediaDevices.getUserMedia not available');
      }

      const {targetFPS, sizeOption} = cameraParam;
      const $size = params.VIDEO_SIZE[sizeOption];
      const videoConfig = {
        'audio': false,
        'video': {
          facingMode: 'user',
          // Only setting the video to a specified size for large screen, on
          // mobile devices accept the default size.
          width: isMobile() ? params.VIDEO_SIZE['360 X 270'].width : $size.width,
          height: isMobile() ? params.VIDEO_SIZE['360 X 270'].height :
                              $size.height,
          frameRate: {
            ideal: targetFPS,
          }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(videoConfig);

      camera.video.srcObject = stream;

      await new Promise((resolve) => {
        camera.video.onloadedmetadata = () => {
          resolve(video);
        };
      });

      camera.video.play();

      // const ctx = camera.canvas.getContext("2d");
      // ctx.translate(camera.video.videoWidth, 0);
      // ctx.scale(-1, 1);

      // camera.canvas.setViewportTransform([-1, 0, 0, 1, camera.video.videoWidth, 0]);

      // const videoWidth = camera.video.videoWidth;
      // const videoHeight = camera.video.videoHeight;
      // // Must set below two lines, otherwise video element doesn't show.
      // camera.video.width = videoWidth;
      // camera.video.height = videoHeight;
      // camera.canvas.setWidth(videoWidth);
      // camera.canvas.setHeight(videoHeight);
    } else {

    }

    // if (videoId === 'video') {
    //   const videoWidth = camera.video.videoWidth;
    //   const videoHeight = camera.video.videoHeight;
    //   // Must set below two lines, otherwise video element doesn't show.
    //   camera.video.width = videoWidth;
    //   camera.video.height = videoHeight;

    //   camera.canvas.setWidth(videoWidth);
    //   camera.canvas.setHeight(videoHeight);

    //   // Because the image from camera is mirrored, need to flip horizontally.
    //   // camera.ctx.translate(camera.video.videoWidth, 0);
    //   // camera.ctx.scale(-1, 1);
    // } else {
    //   camera.video.width = 1280;
    //   camera.video.height = 720;
    //   camera.canvas.setWidth(1280 / 2);
    //   camera.canvas.setHeight(720 / 2);
    // }

    return camera;
  }

  drawCtx() {
    if (this.videoId === 'webcam') {
      var imgInstance = new fabric.Image(this.video, {
        left: 0,
        top: 0,
        objectCaching: false,
        selectable: false,
        hoverCursor: 'default'
      });
      this.canvas.add(imgInstance);
    } else {

    }
  }

  /**
   * Draw the keypoints and skeleton on the video.
   * @param poses A list of poses to render.
   */
  drawResults(poses) {
    for (const pose of poses) {
      this.drawResult(pose);
    }
  }

  /**
   * Draw the keypoints and skeleton on the video.
   * @param pose A pose with keypoints to render.
   */
  drawResult(pose) {
    if (pose.keypoints != null) {
      this.drawKeypoints(pose.keypoints);
      this.drawSkeleton(pose.keypoints, pose.id);
    }
  }

  /**
   * Draw the keypoints on the video.
   * @param keypoints A list of keypoints.
   */
  drawKeypoints(keypoints) {
    const keypointInd =
        poseDetection.util.getKeypointIndexBySide(params.STATE.model);

    for (const i of keypointInd.middle) {
      this.drawKeypoint(keypoints[i], 'red');
    }

    for (const i of keypointInd.left) {
      this.drawKeypoint(keypoints[i], 'green');
    }

    for (const i of keypointInd.right) {
      this.drawKeypoint(keypoints[i], 'orange');
    }
  }

  drawKeypoint(keypoint, color) {
    // If score is null, just show the keypoint.
    const score = keypoint.score != null ? keypoint.score : 1;
    const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;

    if (score >= scoreThreshold) {
      var c = new fabric.Circle({
        left: keypoint.x,
        top: keypoint.y,
        strokeWidth: 2,
        radius: 4,
        fill: color,
        stroke: 'white',
        originX: "center",
        originY: "center"
      });
      c.hasControls = false
      c.hasBorders = false;
      this.canvas.add(c)
    }
  }

  /**
   * Draw the skeleton of a body on the video.
   * @param keypoints A list of keypoints.
   */
  drawSkeleton(keypoints, poseId) {
    // Each poseId is mapped to a color in the color palette.
    const color = params.STATE.modelConfig.enableTracking && poseId != null ?
        COLOR_PALETTE[poseId % 20] :
        'White';

    poseDetection.util.getAdjacentPairs(params.STATE.model)
      .forEach(([i, j]) => {
        const kp1 = keypoints[i];
        const kp2 = keypoints[j];

        // If score is null, just show the keypoint.
        const score1 = kp1.score != null ? kp1.score : 1;
        const score2 = kp2.score != null ? kp2.score : 1;
        const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;

        if (score1 >= scoreThreshold && score2 >= scoreThreshold) {
          const line = new fabric.Line([ kp1.x, kp1.y, kp2.x, kp2.y ], {
            fill: color,
            stroke: color,
            strokeWidth: 2,
            selectable: false,
            evented: false,
          });
          this.canvas.add(line)
        }
      });
  }
}
