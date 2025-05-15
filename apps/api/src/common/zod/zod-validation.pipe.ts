import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

/** Validates request bodies / queries with the shared Zod contracts (single source of validation). */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}
  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'VALIDATION_ERROR',
        message: result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '),
        details: result.error.issues,
      });
    }
    return result.data;
  }
}
