import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs-core';

class PoseService {
  private detector: poseDetection.PoseDetector | null = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    await tf.ready();
    await tf.setBackend('webgl');
    const model = poseDetection.SupportedModels.MoveNet;
    const detectorConfig = {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      enableSmoothing: true
    };
    this.detector = await poseDetection.createDetector(model, detectorConfig);
    this.isInitialized = true;
  }

  async estimatePose(video: HTMLVideoElement) {
    if (!this.detector || video.readyState < 2) return [];
    try {
      const poses = await this.detector.estimatePoses(video, {
        flipHorizontal: false,
        maxPoses: 1
      });
      return poses;
    } catch (e) {
      console.error(e);
      return [];
    }
  }
}

export const poseService = new PoseService();
