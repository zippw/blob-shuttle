import { Handler } from '@yandex-cloud/function-types';
import { renderFileRuntime } from './renderer';
import { decodeInviteHash, extractInviteToken } from './invite';
import { parseJSONBody } from './utils';
import { createInvite, createVault, revealVault, checkAuth } from './routes';
import { verifySessionAuthority } from './auth';

import * as consts from '#shared/constants.js';
import { StructuredApiErr } from '#shared/schema.js';
import { validateFileName } from '#shared/validators.js';
import { ApiError } from '#shared/ApiError.js';

import { SessionContext, sessionStorage } from './session';
import rpm_run from './ratelimit/setup';

import path from 'node:path';
import fs from 'node:fs';

export const handler: Handler.Http = async (event, context) => {
    try {
        const method = event.httpMethod;
        const query = event.queryStringParameters || {};
        const bodyJSON = parseJSONBody(event); // yandex cloud specific parsing method

        const inviteHash = extractInviteToken(query, bodyJSON);
        const decodedInvite = inviteHash ? decodeInviteHash(inviteHash) : { is_valid: false as const };

        const { authorized, verifiedPasscode, isManual, cache_allowed } = verifySessionAuthority(bodyJSON, decodedInvite);
        const sessionContext: SessionContext = {
            session: {
                authorized, cache_allowed: authorized ? cache_allowed : false,
                passcode: isManual ? verifiedPasscode : undefined,
            },
            invite: decodedInvite.is_valid ? {
                is_valid: true,
                vault_id: decodedInvite.vault_id,
                expires_at: decodedInvite.expires_at,
                expires_in_sec: decodedInvite.expires_in_sec
            } : {
                is_valid: false
            }
        };

        return sessionStorage.run(sessionContext, async () => {
            try {
                console.log(`${method} ?path=${query.path || ''}. Auth=${authorized}`, sessionContext.invite);

                /* rate limitting */
                if (process.env.NODE_ENV !== 'development' && consts.MAX_RPM !== -1) await rpm_run(context as any);

                /* static logic (pwa purpose) */
                if (consts.ENABLE_STATIC && query.path === 'static' && query.file) {
                    const fileName = validateFileName(path.basename(query.file));
                    if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) throw Error('Invalid file name');
                    const filePath = path.join(__dirname, 'static', fileName);

                    const notFoundErr: StructuredApiErr = { error: 'Not Found.', details: `File doesn't exist`, type: 'NOTFOUND' }
                    if (!fs.existsSync(filePath)) return { statusCode: 404, body: JSON.stringify(notFoundErr) }

                    const ext = path.extname(filePath).toLowerCase();
                    const contentType = {
                        '.png': 'image/png',
                        '.js': 'application/javascript'
                    }[ext] || 'application/octet-stream';
                    const file = await fs.readFileSync(filePath);

                    return {
                        statusCode: 200,
                        body: file.toString('base64'),
                        isBase64Encoded: true,
                        headers: {
                            'Content-Type': contentType,
                            ...consts.STATIC_CACHE_CONTROL
                                ? { 'Cache-Control': consts.STATIC_CACHE_CONTROL }
                                : {}
                        }
                    }
                }


                /* main */
                if (method === 'GET') return {
                    statusCode: 200, body: await renderFileRuntime('./views/authorized.js', { authorized, consts, sessionContext }),
                    headers: {
                        'Content-Type': 'text/html; charset=UTF-8',
                        'Content-Security-Policy': 'worker-src \'self\' blob: data:;'
                    }
                }

                if (!authorized) {
                    const err: StructuredApiErr = { error: 'Authentication failed.', details: 'Missing token or invalid credentials.', type: 'UNAUTHORIZED' }
                    return { statusCode: 401, body: JSON.stringify(err) };
                }

                // authorized endpoints
                if (method === 'POST' && query.path === 'check-auth') return await checkAuth(event, context);
                if (method === 'POST' && query.path === 'create-vault') return await createVault(event, context);
                if (method === 'POST' && query.path === 'reveal-vault') return await revealVault(event, context);
                if (method === 'POST' && query.path === 'create-invite') return await createInvite(event, context);

                const notFoundErr: StructuredApiErr = { error: 'Not Found.', details: `Endpoint doesn't exist`, type: 'NOTFOUND' }
                return { statusCode: 404, body: JSON.stringify(notFoundErr) };

            } catch (innerErr) {
                return formatServerErrorResponse(innerErr)
            }
        });

    } catch (err) {
        return formatServerErrorResponse(err)
    } finally { }
};








function formatServerErrorResponse(err: unknown) {
    if (err instanceof ApiError) {
        console.error(`[Server ${err.type}]: ${err.error}`);

        const codes: Record<string, number> = {
            'VALIDATION': 400,
            'UNAUTHORIZED': 401,
            'NOTFOUND': 404,
            'UNEXPECTED': 500
        }

        let statusCode: number = 500;
        if (codes[err.type]) statusCode = codes[err.type];

        console.error(err.type, err.details);

        return {
            statusCode,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: err.error, type: err.type })
        };
    }

    const rawMessage = err instanceof Error ? err.message : String(err);
    console.error(`[Server CRITICAL CRASH]:`, err);

    return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            error: 'Internal Server Error',
            details: rawMessage,
            type: 'SERVER_CRASH'
        })
    };
}