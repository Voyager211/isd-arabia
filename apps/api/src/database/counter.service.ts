import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Counter, CounterDocument } from './counter.schema';

@Injectable()
export class CounterService {
  constructor(@InjectModel(Counter.name) private readonly counterModel: Model<CounterDocument>) {}

  /**
   * Allocates the next value in a named sequence.
   *
   * `findOneAndUpdate` with `$inc` and `upsert` is a single atomic document
   * operation. The alternative that looks obvious — `countDocuments() + 1` —
   * races under concurrent submissions and produces duplicate quote numbers,
   * which is exactly what acceptance criterion #28 tests for.
   */
  async next(sequenceId: string): Promise<number> {
    const counter = await this.counterModel
      .findOneAndUpdate(
        { _id: sequenceId },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after', new: true },
      )
      .lean()
      .exec();

    return counter.seq;
  }

  /**
   * Formats a quote number: QT-2026-0001.
   *
   * The sequence is per-year, so the counter resets naturally at the year
   * boundary and the number stays short and readable on a printed quotation.
   */
  async nextQuoteNumber(now = new Date()): Promise<string> {
    const year = now.getUTCFullYear();
    const seq = await this.next(`quotation-${year}`);
    return `QT-${year}-${String(seq).padStart(4, '0')}`;
  }
}
