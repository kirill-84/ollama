import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { ForbiddenError, NotFoundError, ValidationError } from './errors';

export type ApiRouteHandler<TContext = unknown> = (
    request: NextRequest,
    context: TContext,
) => Promise<NextResponse> | NextResponse;

export function withApiHandler<TContext = unknown>(
    handler: ApiRouteHandler<TContext>,
): ApiRouteHandler<TContext> {
    return async (request, context) => {
        try {
            return await handler(request, context);
        } catch (error) {
            if (error instanceof ZodError) {
                return NextResponse.json(
                    { error: 'validation', issues: error.issues },
                    { status: 400 },
                );
            }

            if (error instanceof NotFoundError) {
                return NextResponse.json(
                    { error: 'not_found', message: error.message },
                    { status: 404 },
                );
            }

            if (error instanceof ValidationError) {
                return NextResponse.json(
                    { error: 'validation', message: error.message },
                    { status: 400 },
                );
            }

            if (error instanceof ForbiddenError) {
                return NextResponse.json(
                    { error: 'forbidden', message: error.message },
                    { status: 403 },
                );
            }

            if (error instanceof Error && error.name === 'AbortError') {
                throw error;
            }

            console.error('[api] unhandled error', error);
            return NextResponse.json(
                { error: 'internal' },
                { status: 500 },
            );
        }
    };
}
