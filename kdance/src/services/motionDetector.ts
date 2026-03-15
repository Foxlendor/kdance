import type { MotionEvent } from '../types';

class MotionDetector {
  private lastPoses: any[] = [];
  private lastTime: number = 0;
  // @ts-ignore
  private _currentBeat: number = 0; // In a real app, sync this with the music engine transport
  
  // State for specific gesture detection
  private leftWristVy: number = 0;
  private rightWristVy: number = 0;
  private leftWristVx: number = 0;
  private rightWristVx: number = 0;
  private ankleVy: number = 0;
  private ankleVx: number = 0;
  
  // Teaching states
  public teachingMode: 'none' | 'tutting' | 'footwork' = 'none';
  private teachingFrames = 0;
  private tempVelocity = 0;
  public taughtTuttingThreshold = 0.5; // default
  public taughtFootworkThreshold = 0.5; // default

  public startTeaching(move: 'tutting' | 'footwork') {
    this.teachingMode = move;
    this.teachingFrames = 60; // Approx 2 seconds at 30fps
    this.tempVelocity = 0;
  }

  public update(poses: any[], currentTime: number, currentBeatIndex: number): MotionEvent[] {
    const events: MotionEvent[] = [];
    
    if (!poses || poses.length === 0 || !poses[0].keypoints) {
      this.lastTime = currentTime;
      return events;
    }

    const kp = poses[0].keypoints;
    if (kp.length < 17) return events; // Require full pose (MoveNet standard 17 points)

    const dt = Math.max(currentTime - this.lastTime, 1);
    
    // Example: Detect a "Hit" from wrists moving fast downwards
    // Keypoint 9 = Left Wrist, 10 = Right Wrist
    const lWrist = kp[9];
    const rWrist = kp[10];
    
    // Example: Detect a "step" or "stomp" from ankles (15, 16)
    const lAnkle = kp[15];
    const rAnkle = kp[16];
    
    if (this.lastPoses.length > 0) {
      const lastKp = this.lastPoses[0].keypoints;
      
      const prevLWrist = lastKp[9];
      const prevRWrist = lastKp[10];
      const prevLAnkle = lastKp[15];
      const prevRAnkle = lastKp[16];

      // Calculate vertical velocity (pixels per ms)
      const curLeftVy = (lWrist.y - prevLWrist.y) / dt;
      const curRightVy = (rWrist.y - prevRWrist.y) / dt;
      const curLeftVx = (lWrist.x - prevLWrist.x) / dt;
      const curRightVx = (rWrist.x - prevRWrist.x) / dt;
      
      const curAnkleVy = Math.max((lAnkle.y - prevLAnkle.y) / dt, (rAnkle.y - prevRAnkle.y) / dt);
      const curAnkleVx = Math.max((lAnkle.x - prevLAnkle.x) / dt, (rAnkle.x - prevRAnkle.x) / dt);
      
      const wristSpeed = Math.max(Math.abs(curLeftVx), Math.abs(curRightVx), Math.abs(curLeftVy), Math.abs(curRightVy));
      const ankleSpeed = Math.max(Math.abs(curAnkleVx), Math.abs(curAnkleVy));
      
      if (this.teachingMode !== 'none') {
          this.teachingFrames--;
          if (this.teachingMode === 'tutting') {
              this.tempVelocity = Math.max(this.tempVelocity, wristSpeed);
          } else {
              this.tempVelocity = Math.max(this.tempVelocity, ankleSpeed);
          }
          
          if (this.teachingFrames <= 0) {
              if (this.teachingMode === 'tutting') this.taughtTuttingThreshold = Math.max(0.2, this.tempVelocity * 0.7);
              if (this.teachingMode === 'footwork') this.taughtFootworkThreshold = Math.max(0.2, this.tempVelocity * 0.7);
              console.log(`Finished teaching ${this.teachingMode}. Threshold set to ${this.tempVelocity * 0.7}`);
              this.teachingMode = 'none';
          }
      } else {
          // Tutting Detection (Fast wrist movement with slow ankle movement)
          if (wristSpeed > this.taughtTuttingThreshold && ankleSpeed < 0.2 && lWrist.score > 0.3) {
             // Only trigger if previous frame had low speed (stop-and-go motion typical of tutting)
             const prevWristSpeed = Math.max(Math.abs(this.leftWristVx), Math.abs(this.rightWristVx), Math.abs(this.leftWristVy), Math.abs(this.rightWristVy));
             if (prevWristSpeed < this.taughtTuttingThreshold * 0.5) {
                 events.push({
                     time: currentTime, beatIndex: currentBeatIndex,
                     type: 'tutting', bodyPart: 'fullBody', intensity: Math.min(wristSpeed, 1.0)
                 });
             }
          }
          
          // Footwork Detection (Fast ankle movement)
          if (ankleSpeed > this.taughtFootworkThreshold && (lAnkle.score > 0.3 || rAnkle.score > 0.3)) {
              events.push({
                 time: currentTime, beatIndex: currentBeatIndex,
                 type: 'footwork', bodyPart: 'leftLeg', intensity: Math.min(ankleSpeed, 1.0)
              });
          }

          // Make it slightly more sensitive to hits
          if (this.leftWristVy > 0.3 && curLeftVy < 0.1 && lWrist.score > 0.3) {
            events.push({
              time: currentTime, beatIndex: currentBeatIndex,
              type: 'hit', bodyPart: 'leftArm', intensity: Math.min(this.leftWristVy * 2, 1.0), direction: 'down'
            });
          }

          if (this.rightWristVy > 0.3 && curRightVy < 0.1 && rWrist.score > 0.3) {
            events.push({
              time: currentTime, beatIndex: currentBeatIndex,
              type: 'hit', bodyPart: 'rightArm', intensity: Math.min(this.rightWristVy * 2, 1.0), direction: 'down'
            });
          }
          
          if (this.ankleVy > 0.5 && curAnkleVy < 0.1 && (lAnkle.score > 0.3 || rAnkle.score > 0.3)) {
            events.push({
              time: currentTime, beatIndex: currentBeatIndex,
              type: 'step', bodyPart: 'leftLeg', intensity: Math.min(this.ankleVy * 2, 1.0), direction: 'down'
            });
          }
      }

      this.leftWristVy = curLeftVy;
      this.rightWristVy = curRightVy;
      this.leftWristVx = curLeftVx;
      this.rightWristVx = curRightVx;
      this.ankleVy = curAnkleVy;
      this.ankleVx = curAnkleVx;
      
      // Calculate overall energy (average velocity of wrists and ankles)
      const energy = (Math.abs(curLeftVy) + Math.abs(curRightVy) + Math.abs(curAnkleVy)) / 3;
      
      // If continuous movement is detected, classify as 'wave'
      if (this.teachingMode === 'none' && energy > 0.2 && energy < 0.5 && Math.random() < 0.1) {
          events.push({
              time: currentTime, beatIndex: currentBeatIndex,
              type: 'wave', bodyPart: 'fullBody', intensity: Math.min(energy * 2, 1.0)
          });
      }
    }

    this.lastPoses = poses;
    this.lastTime = currentTime;
    
    return events;
  }
}

export const motionDetector = new MotionDetector();
