import { ArgumentsHost, BadGatewayException, BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { MulterError } from 'multer';
import { BlockedUrlError, InvalidImageError, NoShareImageError, UpstreamUnavailableError } from './errors';
import { MulterErrorFilter, UploadsController } from './uploads.controller';
import type { UploadsService } from './uploads.service';

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

describe('UploadsController.fromLink', () => {
  function controllerWith(impl: (url: string) => Promise<string>) {
    return new UploadsController({ saveImageFromLink: vi.fn(impl) } as unknown as UploadsService);
  }

  it('returns the saved filename', async () => {
    await expect(controllerWith(async () => 'link-1-abcdef.png').fromLink('https://a.sk/')).resolves.toEqual({ filename: 'link-1-abcdef.png' });
  });

  it.each([undefined, '', 'javascript:alert(1)', 'nope'])('rejects %s without fetching', async (url) => {
    const save = vi.fn();
    const controller = new UploadsController({ saveImageFromLink: save } as unknown as UploadsService);
    await expect(controller.fromLink(url)).rejects.toThrow('Táto adresa nie je povolená.');
    expect(save).not.toHaveBeenCalled();
  });

  it.each([
    [new NoShareImageError('x'), BadRequestException, 'Stránka nemá zdieľací obrázok (og:image).'],
    [new BlockedUrlError('x'), BadRequestException, 'Táto adresa nie je povolená.'],
    [new InvalidImageError('x'), BadRequestException, 'Obrázok nie je podporovaný (jpeg, png, gif, webp, max 10 MB).'],
    [new UpstreamUnavailableError('x'), BadGatewayException, 'Stránka alebo obrázok nie sú dostupné.'],
  ])('maps %s', async (error, type, message) => {
    const result = controllerWith(async () => { throw error; }).fromLink('https://a.sk/');
    await expect(result).rejects.toBeInstanceOf(type);
    await expect(result).rejects.toThrow(message);
  });
});
