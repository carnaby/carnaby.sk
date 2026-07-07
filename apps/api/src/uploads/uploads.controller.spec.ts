import { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { MulterError } from 'multer';
import { MulterErrorFilter } from './uploads.controller';

describe('MulterErrorFilter', () => {
  let filter: MulterErrorFilter;

  beforeEach(() => {
    filter = new MulterErrorFilter();
  });

  it('responds with 400 and "file too large (max 5MB)" for LIMIT_FILE_SIZE error', () => {
    const mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const mockHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: vi.fn().mockReturnValue(mockResponse),
      }),
    } as unknown as ArgumentsHost;

    const error = new MulterError('LIMIT_FILE_SIZE', 'fieldname');
    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'file too large (max 5MB)',
      error: 'Bad Request',
    });
  });

  it('responds with 400 and "invalid upload" for other error codes', () => {
    const mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const mockHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: vi.fn().mockReturnValue(mockResponse),
      }),
    } as unknown as ArgumentsHost;

    const error = new MulterError('LIMIT_FIELD_COUNT', 'fieldname');
    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'invalid upload',
      error: 'Bad Request',
    });
  });
});
