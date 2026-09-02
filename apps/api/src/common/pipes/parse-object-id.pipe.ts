import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

/**
 * Validates a path or body parameter is a real ObjectId before it reaches a
 * service.
 *
 * This is the NoSQL-injection guard from PROJECT_PLAN.md §12.3 at its most
 * common entry point: an unvalidated `:id` handed to `findById` lets a caller
 * pass `{ "$ne": null }` and match an arbitrary document.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value !== 'string' || !isValidObjectId(value)) {
      throw new BadRequestException('Invalid identifier.');
    }
    return value;
  }
}
