import { applyDecorators, Body, Query } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { z, ZodObject, ZodType } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

export const ZodBody = (schema: ZodType) => Body(new ZodValidationPipe(schema));
export const ZodQuery = (schema: ZodType) => Query(new ZodValidationPipe(schema));

function toJsonSchema(schema: ZodType) {
  try {
    return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, any>;
  } catch {
    return { type: 'object' };
  }
}

/** Documents a Zod body schema in Swagger. */
export const ApiZodBody = (schema: ZodType) => applyDecorators(ApiBody({ schema: toJsonSchema(schema) }));

/** Documents each property of a Zod object query schema in Swagger. */
export const ApiZodQuery = (schema: ZodObject<any>) => {
  const json = toJsonSchema(schema);
  const props = (json.properties ?? {}) as Record<string, any>;
  const required = new Set<string>((json.required ?? []) as string[]);
  return applyDecorators(
    ...Object.entries(props).map(([name, s]) => ApiQuery({ name, required: required.has(name), schema: s })),
  );
};
