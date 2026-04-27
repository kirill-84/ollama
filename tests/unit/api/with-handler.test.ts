import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { withApiHandler } from '@/lib/api/with-handler';
import {
    ForbiddenError,
    NotFoundError,
    ValidationError,
} from '@/lib/api/errors';

const mkRequest = () => new NextRequest('http://localhost/api/test');

describe('withApiHandler', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('возвращает результат handler без обёртки', async () => {
        const handler = withApiHandler(async () =>
            NextResponse.json({ ok: true }, { status: 201 }),
        );

        const response = await handler(mkRequest(), undefined);

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({ ok: true });
    });

    it('маппит ZodError в 400 с issues', async () => {
        const schema = z.object({ value: z.string() });
        const handler = withApiHandler(async () => {
            schema.parse({ value: 123 });
            return NextResponse.json({});
        });

        const response = await handler(mkRequest(), undefined);

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('validation');
        expect(Array.isArray(body.issues)).toBe(true);
        expect(body.issues.length).toBeGreaterThan(0);
    });

    it('маппит NotFoundError в 404', async () => {
        const handler = withApiHandler(async () => {
            throw new NotFoundError('chat not found');
        });

        const response = await handler(mkRequest(), undefined);

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({
            error: 'not_found',
            message: 'chat not found',
        });
    });

    it('маппит ValidationError в 400', async () => {
        const handler = withApiHandler(async () => {
            throw new ValidationError('bad input');
        });

        const response = await handler(mkRequest(), undefined);

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            error: 'validation',
            message: 'bad input',
        });
    });

    it('маппит ForbiddenError в 403', async () => {
        const handler = withApiHandler(async () => {
            throw new ForbiddenError('forbidden');
        });

        const response = await handler(mkRequest(), undefined);

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({
            error: 'forbidden',
            message: 'forbidden',
        });
    });

    it('пробрасывает AbortError наружу', async () => {
        const abortError = Object.assign(new Error('aborted'), {
            name: 'AbortError',
        });
        const handler = withApiHandler(async () => {
            throw abortError;
        });

        await expect(handler(mkRequest(), undefined)).rejects.toBe(abortError);
    });

    it('возвращает 500 для прочих ошибок и логирует', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const handler = withApiHandler(async () => {
            throw new Error('boom');
        });

        const response = await handler(mkRequest(), undefined);

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: 'internal' });
        expect(errorSpy).toHaveBeenCalled();
    });

    it('пробрасывает context во вложенный handler', async () => {
        type Context = { params: Promise<{ id: string }> };
        const handler = withApiHandler<Context>(async (_req, ctx) => {
            const { id } = await ctx.params;
            return NextResponse.json({ id });
        });

        const response = await handler(mkRequest(), {
            params: Promise.resolve({ id: 'abc' }),
        });

        expect(await response.json()).toEqual({ id: 'abc' });
    });

    it('ZodError по проверке: пример распарсенного issue', async () => {
        const handler = withApiHandler(async () => {
            const error = new ZodError([
                {
                    code: 'invalid_type',
                    expected: 'string',
                    path: ['title'],
                    message: 'Required',
                    input: undefined,
                },
            ]);
            throw error;
        });

        const response = await handler(mkRequest(), undefined);
        const body = await response.json();
        expect(body.issues[0]).toMatchObject({ path: ['title'] });
    });
});
