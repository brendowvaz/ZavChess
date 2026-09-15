import { Injectable, HttpException } from '@nestjs/common';
import { EngineService } from '../engine/engine.service';
import { TrainingCore, TrainingError, type Theme, type TrainingInput } from './domain';

@Injectable()
export class EndgameTrainingService {
  private readonly training: TrainingCore;
  constructor(engine: EngineService) { this.training = new TrainingCore(engine); }
  private async respond<T>(work: () => Promise<T>) {
    try { return await work(); }
    catch (error) {
      if (error instanceof TrainingError) throw new HttpException(error.message, error.status);
      throw error;
    }
  }
  generate(theme: Theme, excludeFen?: string, lesson?: string) { return this.respond(() => this.training.generate(theme, excludeFen, lesson)); }
  position(input: TrainingInput) { return this.respond(() => this.training.position(input)); }
  turn(input: TrainingInput & { move: string }) { return this.respond(() => this.training.turn(input)); }
}
