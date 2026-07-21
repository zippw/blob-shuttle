import { renderFileRuntime } from './renderer';
import { decodeInviteHash, extractInviteToken } from './invite';
import { createInvite, createVault, revealVault, checkAuth } from './routes';
import { verifySessionAuthority } from './auth';
import { SessionContext, sessionStorage } from './session';

import * as consts from '#shared/constants.js';
import { FunctionHandler } from '#shared/schema.js';
import { validateFileName } from '#shared/validators.js';
import { ApiError } from '#shared/ApiError.js';

import path from 'node:path';
import fs from 'node:fs';

export const fn: FunctionHandler = async (req) => {
    try {
        const method = req.method;
        const query = req.query;
        const body = req.body;

        const inviteHash = extractInviteToken(query, body);
        const decodedInvite = inviteHash ? decodeInviteHash(inviteHash) : { is_valid: false as const };

        const { authorized, verifiedPasscode, isManual, cache_allowed } = verifySessionAuthority(body, decodedInvite);
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
            } : { is_valid: false }
        };

        return sessionStorage.run(sessionContext, async () => {
            try {
                console.log(`${method} ?path=${query.path || ''}. Auth=${authorized}`, sessionContext.invite);

                if (req.middleware) await req.middleware();

                /* static logic (pwa purpose) */
                if (consts.HOST_SPA && query.path === 'static' && query.file) {
                    const fileName = validateFileName(path.basename(query.file));
                    if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) throw Error('Invalid file name');
                    const filePath = path.join(__dirname, 'static', fileName);

                    if (!fs.existsSync(filePath)) throw new ApiError({ error: `File doesn't exist`, type: 'NOTFOUND' })

                    const ext = path.extname(filePath).toLowerCase();
                    const contentType = {
                        '.png': 'image/png',
                        '.js': 'application/javascript'
                    }[ext] || 'application/octet-stream';
                    const file = await fs.readFileSync(filePath);

                    return {
                        status: 200,
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
                if (consts.HOST_SPA && method === 'GET') return {
                    status: 200, body: await renderFileRuntime('./views/index.html', {
                        self: true,
                        consts
                    }), headers: {
                        'Content-Type': 'text/html; charset=UTF-8',
                        'Content-Security-Policy': 'worker-src \'self\' blob: data:;',
                        ...consts.STATIC_CACHE_CONTROL
                            ? { 'Cache-Control': consts.STATIC_CACHE_CONTROL }
                            : {}
                    }
                }

                if (!authorized) throw new ApiError({ error: 'Authentication failed.', details: 'Missing token or invalid credentials.', type: 'UNAUTHORIZED' });

                // authorized endpoints
                if (method === 'POST' && query.path === 'check-auth') return await checkAuth(req);
                if (method === 'POST' && query.path === 'create-vault') return await createVault(req);
                if (method === 'POST' && query.path === 'reveal-vault') return await revealVault(req);
                if (method === 'POST' && query.path === 'create-invite') return await createInvite(req);

                throw new ApiError({ error: `Endpoint doesn't exist`, type: 'NOTFOUND' });

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

        let status: number = 500;
        if (codes[err.type]) status = codes[err.type];

        return {
            status,
            headers: { 'Content-Type': 'application/json' },
            body: { error: err.error, type: err.type }
        };
    }

    console.error(`[Server CRITICAL CRASH]:`, err);
    const rawMessage = err instanceof Error ? err.message : String(err);

    return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: {
            error: 'Internal Server Error',
            details: rawMessage,
            type: 'SERVER_CRASH'
        }
    };
}