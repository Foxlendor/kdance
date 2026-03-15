import type { MotionEvent } from '../types';

// Smoothing helper
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

class MotionDetector {
  private lastPoses: any[] = [];
  private lastTime: number = 0;
  
  // Velocity tracking per joint
  private leftWristVy: number = 0;
  private rightWristVy: number = 0;
  private leftWristVx: number = 0;
  private rightWristVx: number = 0;
  private ankleVy: number = 0;
  private ankleVx: number = 0;
  private coreVy: number = 0;
  private coreVx: number = 0;
  private prevCoreY: number = 0;
  private headVy: number = 0;
  
  // Smoothed energy for UI
  private _smoothedEnergy: number = 0;
  private _peakEnergy: number = 0;
  private _moveCount: number = 0;
  private _lastMoveName: string = 'idle';
  
  // Freeze detection
  private freezeStartTime: number = 0;
  private isCurrentlyFrozen: boolean = false;
  
  // Jump detection
  private baselineAnkleY: number = 0;
  private baselineFrames: number = 0;
  
  // Spin detection
  private shoulderHistory: number[] = [];
  
  // Pop detection (sudden stop after fast movement)
  private prevWristSpeed: number = 0;
  
  // Teaching states
  public teachingMode: 'none' | 'tutting' | 'footwork' = 'none';
  private teachingFrames = 0;
  private tempVelocity = 0;
  public taughtTuttingThreshold = 0.4;
  public taughtFootworkThreshold = 0.4;

  // Getters for UI
  get smoothedEnergy(): number { return this._smoothedEnergy; }
  get peakEnergy(): number { return this._peakEnergy; }
  get moveCount(): number { return this._moveCount; }
  get lastMoveName(): string { return this._lastMoveName; }

  public startTeaching(move: 'tutting' | 'footwork') {
    this.teachingMode = move;
    this.teachingFrames = 60;
    this.tempVelocity = 0;
  }
  
  public update(poses: any[], currentTime: number, currentBeatIndex: number): MotionEvent[] {
    const events: MotionEvent[] = [];
    
    if (!poses || poses.length === 0 || !poses[0].keypoints) {
      this.lastTime = currentTime;
      return events;
    }

    const kp = poses[0].keypoints;
    if (kp.length < 17) return events;

    const dt = Math.max(currentTime - this.lastTime, 1);
    
    // Key points (MoveNet 17-point model)
    const nose = kp[0];
    const lShoulder = kp[5];
    const rShoulder = kp[6];
    const lElbow = kp[7];
    const rElbow = kp[8];
    const lWrist = kp[9];
    const rWrist = kp[10];
    const lHip = kp[11];
    const rHip = kp[12];
    const lKnee = kp[13];
    const rKnee = kp[14];
    const lAnkle = kp[15];
    const rAnkle = kp[16];
    
    // Core position
    const coreX = (lHip.x + rHip.x) / 2;
    const coreY = (lHip.y + rHip.y) / 2;
    
    if (this.lastPoses.length > 0) {
      const lastKp = this.lastPoses[0].keypoints;
      const prevLWrist = lastKp[9];
      const prevRWrist = lastKp[10];
      const prevLAnkle = lastKp[15];
      const prevRAnkle = lastKp[16];
      const prevLShoulder = lastKp[5];
      const prevRShoulder = lastKp[6];
      const prevNose = lastKp[0];
      const prevCoreX = (lastKp[11].x + lastKp[12].x) / 2;
      const prevCoreYVal = (lastKp[11].y + lastKp[12].y) / 2;

      // ===== VELOCITY CALCULATIONS =====
      const curLeftVy = (lWrist.y - prevLWrist.y) / dt;
      const curRightVy = (rWrist.y - prevRWrist.y) / dt;
      const curLeftVx = (lWrist.x - prevLWrist.x) / dt;
      const curRightVx = (rWrist.x - prevRWrist.x) / dt;
      const curAnkleVy = Math.max(
        Math.abs((lAnkle.y - prevLAnkle.y) / dt),
        Math.abs((rAnkle.y - prevRAnkle.y) / dt)
      );
      const curAnkleVx = Math.max(
        Math.abs((lAnkle.x - prevLAnkle.x) / dt),
        Math.abs((rAnkle.x - prevRAnkle.x) / dt)
      );
      const curCoreVy = (coreY - prevCoreYVal) / dt;
      const curCoreVx = (coreX - prevCoreX) / dt;
      const curHeadVy = (nose.y - prevNose.y) / dt;
      
      const wristSpeed = Math.max(
        Math.abs(curLeftVx), Math.abs(curRightVx),
        Math.abs(curLeftVy), Math.abs(curRightVy)
      );
      const ankleSpeed = Math.max(curAnkleVx, curAnkleVy);
      const totalEnergy = (wristSpeed + ankleSpeed + Math.abs(curCoreVy) + Math.abs(curCoreVx)) / 4;
      
      // Update smoothed energy
      this._smoothedEnergy = lerp(this._smoothedEnergy, Math.min(totalEnergy * 3, 1), 0.15);
      this._peakEnergy = Math.max(this._peakEnergy, this._smoothedEnergy);
      
      // ===== SHOULDER WIDTH for SPIN detection =====
      const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
      this.shoulderHistory.push(shoulderWidth);
      if (this.shoulderHistory.length > 30) this.shoulderHistory.shift();

      // ===== BASELINE ANKLE Y for JUMP detection =====
      if (this.baselineFrames < 30) {
        this.baselineAnkleY = lerp(this.baselineAnkleY, Math.max(lAnkle.y, rAnkle.y), 0.1);
        this.baselineFrames++;
      }

      // ===== TEACHING MODE =====
      if (this.teachingMode !== 'none') {
        this.teachingFrames--;
        if (this.teachingMode === 'tutting') {
          this.tempVelocity = Math.max(this.tempVelocity, wristSpeed);
        } else {
          this.tempVelocity = Math.max(this.tempVelocity, ankleSpeed);
        }
        if (this.teachingFrames <= 0) {
          if (this.teachingMode === 'tutting') this.taughtTuttingThreshold = Math.max(0.15, this.tempVelocity * 0.6);
          if (this.teachingMode === 'footwork') this.taughtFootworkThreshold = Math.max(0.15, this.tempVelocity * 0.6);
          this.teachingMode = 'none';
        }
        // Don't emit events during teaching
        this.lastPoses = poses;
        this.lastTime = currentTime;
        return events;
      }

      // ===== MOVE DETECTION =====

      // 1. HIT (wrist slamming down)
      if (this.leftWristVy > 0.25 && curLeftVy < 0.05 && lWrist.score > 0.3) {
        events.push({
          time: currentTime, beatIndex: currentBeatIndex,
          type: 'hit', bodyPart: 'leftArm',
          intensity: Math.min(this.leftWristVy * 2, 1.0), direction: 'down'
        });
      }
      if (this.rightWristVy > 0.25 && curRightVy < 0.05 && rWrist.score > 0.3) {
        events.push({
          time: currentTime, beatIndex: currentBeatIndex,
          type: 'hit', bodyPart: 'rightArm',
          intensity: Math.min(this.rightWristVy * 2, 1.0), direction: 'down'
        });
      }

      // 2. STEP / STOMP (ankle slam)
      if (this.ankleVy > 0.35 && curAnkleVy < 0.05 && (lAnkle.score > 0.3 || rAnkle.score > 0.3)) {
        events.push({
          time: currentTime, beatIndex: currentBeatIndex,
          type: 'step', bodyPart: 'leftLeg',
          intensity: Math.min(this.ankleVy * 2, 1.0), direction: 'down'
        });
      }

      // 3. TUTTING (fast angular wrist, slow feet, stop-and-go)
      if (wristSpeed > this.taughtTuttingThreshold && ankleSpeed < 0.15 && lWrist.score > 0.3) {
        const prevSpeed = Math.max(
          Math.abs(this.leftWristVx), Math.abs(this.rightWristVx),
          Math.abs(this.leftWristVy), Math.abs(this.rightWristVy)
        );
        if (prevSpeed < this.taughtTuttingThreshold * 0.4) {
          events.push({
            time: currentTime, beatIndex: currentBeatIndex,
            type: 'tutting', bodyPart: 'fullBody',
            intensity: Math.min(wristSpeed * 1.5, 1.0)
          });
        }
      }

      // 4. FOOTWORK (fast feet)
      if (ankleSpeed > this.taughtFootworkThreshold && (lAnkle.score > 0.3 || rAnkle.score > 0.3)) {
        events.push({
          time: currentTime, beatIndex: currentBeatIndex,
          type: 'footwork', bodyPart: 'leftLeg',
          intensity: Math.min(ankleSpeed * 1.5, 1.0)
        });
      }

      // 5. ARM RAISE (both wrists above shoulders)
      if (lWrist.y < lShoulder.y - 30 && rWrist.y < rShoulder.y - 30 &&
          lWrist.score > 0.3 && rWrist.score > 0.3) {
        const raiseIntensity = Math.min(
          ((lShoulder.y - lWrist.y) + (rShoulder.y - rWrist.y)) / 300, 1.0
        );
        if (raiseIntensity > 0.3 && Math.random() < 0.15) {
          events.push({
            time: currentTime, beatIndex: currentBeatIndex,
            type: 'armRaise', bodyPart: 'fullBody',
            intensity: raiseIntensity, direction: 'up'
          });
        }
      }

      // 6. DROP (core drops fast)
      if (curCoreVy > 0.5 && this.coreVy < 0.2) {
        events.push({
          time: currentTime, beatIndex: currentBeatIndex,
          type: 'drop', bodyPart: 'core',
          intensity: Math.min(curCoreVy * 1.5, 1.0), direction: 'down'
        });
      }

      // 7. JUMP (both ankles rise significantly above baseline)
      if (this.baselineFrames >= 30) {
        const ankleRise = this.baselineAnkleY - Math.max(lAnkle.y, rAnkle.y);
        if (ankleRise > 30 && curAnkleVy < 0.1) {
          events.push({
            time: currentTime, beatIndex: currentBeatIndex,
            type: 'jump', bodyPart: 'fullBody',
            intensity: Math.min(ankleRise / 100, 1.0), direction: 'up'
          });
        }
      }

      // 8. BODY ROLL (core oscillating vertically with smooth motion)
      if (Math.abs(curCoreVy) > 0.15 && Math.abs(curCoreVy) < 0.5 &&
          wristSpeed < 0.3 && Math.random() < 0.08) {
        events.push({
          time: currentTime, beatIndex: currentBeatIndex,
          type: 'bodyRoll', bodyPart: 'core',
          intensity: Math.min(Math.abs(curCoreVy) * 2, 1.0)
        });
      }

      // 9. ISOLATION (single body part moving while rest is still)
      const leftOnly = Math.abs(curLeftVx) + Math.abs(curLeftVy) > 0.3 &&
                       Math.abs(curRightVx) + Math.abs(curRightVy) < 0.1;
      const rightOnly = Math.abs(curRightVx) + Math.abs(curRightVy) > 0.3 &&
                        Math.abs(curLeftVx) + Math.abs(curLeftVy) < 0.1;
      if ((leftOnly || rightOnly) && ankleSpeed < 0.1 && Math.random() < 0.12) {
        events.push({
          time: currentTime, beatIndex: currentBeatIndex,
          type: 'isolation', bodyPart: leftOnly ? 'leftArm' : 'rightArm',
          intensity: 0.6
        });
      }

      // 10. POP (sudden velocity spike then immediate stop)
      if (this.prevWristSpeed < 0.1 && wristSpeed > 0.6) {
        events.push({
          time: currentTime, beatIndex: currentBeatIndex,
          type: 'pop', bodyPart: 'fullBody',
          intensity: Math.min(wristSpeed, 1.0)
        });
      }

      // 11. SPIN (shoulder width shrinks dramatically = turning sideways)
      if (this.shoulderHistory.length >= 20) {
        const avgWidth = this.shoulderHistory.slice(-20, -5).reduce((a, b) => a + b, 0) / 15;
        const currentWidth = this.shoulderHistory[this.shoulderHistory.length - 1];
        if (currentWidth < avgWidth * 0.5 && avgWidth > 20) {
          events.push({
            time: currentTime, beatIndex: currentBeatIndex,
            type: 'spin', bodyPart: 'fullBody',
            intensity: Math.min((avgWidth - currentWidth) / avgWidth, 1.0)
          });
          this.shoulderHistory = []; // Reset to avoid re-triggering
        }
      }

      // 12. FREEZE (very low movement for sustained period)
      if (totalEnergy < 0.03) {
        if (!this.isCurrentlyFrozen) {
          this.freezeStartTime = currentTime;
          this.isCurrentlyFrozen = true;
        } else if (currentTime - this.freezeStartTime > 500 && currentTime - this.freezeStartTime < 600) {
          // Trigger freeze event once after 500ms of stillness
          events.push({
            time: currentTime, beatIndex: currentBeatIndex,
            type: 'freeze', bodyPart: 'fullBody',
            intensity: 0.8
          });
        }
      } else {
        this.isCurrentlyFrozen = false;
      }

      // 13. WAVE (smooth continuous medium movement)
      if (totalEnergy > 0.15 && totalEnergy < 0.4 && Math.random() < 0.08) {
        events.push({
          time: currentTime, beatIndex: currentBeatIndex,
          type: 'wave', bodyPart: 'fullBody',
          intensity: Math.min(totalEnergy * 2, 1.0)
        });
      }

      // Update tracking state
      this.leftWristVy = curLeftVy;
      this.rightWristVy = curRightVy;
      this.leftWristVx = curLeftVx;
      this.rightWristVx = curRightVx;
      this.ankleVy = curAnkleVy;
      this.ankleVx = curAnkleVx;
      this.coreVy = curCoreVy;
      this.coreVx = curCoreVx;
      this.prevCoreY = coreY;
      this.headVy = curHeadVy;
      this.prevWristSpeed = wristSpeed;
    }

    // Track move count
    if (events.length > 0) {
      this._moveCount += events.length;
      this._lastMoveName = events[events.length - 1].type;
    }

    this.lastPoses = poses;
    this.lastTime = currentTime;
    
    return events;
  }
}

export const motionDetector = new MotionDetector();
