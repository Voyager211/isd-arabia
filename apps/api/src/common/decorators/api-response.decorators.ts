import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * Documents the success envelope from PROJECT_PLAN.md §8 in Swagger.
 *
 * Without this every endpoint documents the bare payload while actually
 * returning `{ success, data }`, which is how integration bugs start.
 */
export function ApiEnvelope<TModel extends Type<unknown>>(model: TModel, isArray = false) {
  const dataSchema = isArray
    ? { type: 'array', items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };

  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: dataSchema,
          meta: { type: 'object', nullable: true },
        },
      },
    }),
  );
}
