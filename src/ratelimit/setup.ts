import { ApiError } from '../shared/ApiError';
import disableFunction from './disableFunction';
import telegram from './telegram';
import RPM from "./rpm";
import { MAX_RPM } from '../shared/constants';

interface StupidYandexRequestContext {
    functionName?: string;
    functionFolderId?: string;
    token?: {
        access_token?: string;
    };
}

let blockedUntil: number | null = null;
const run = async (context: StupidYandexRequestContext) => {
    const token = context?.token?.access_token || '';
    const functionId = context.functionName;
    const folderId = context.functionFolderId;
    const ydb_endpoint = process.env.ydb_endpoint || '';

    if (typeof functionId !== 'string' || !functionId.length) throw new Error('Invalid functionId');
    if (typeof folderId !== 'string' || !folderId.length) throw new Error('Invalid folderId');

    const now = Date.now();
    if (typeof blockedUntil === 'number' && now <= blockedUntil) throw new ApiError({
        error: 'Too many requests',
        details: `blockedUntil=${blockedUntil};timeleft=${blockedUntil - now}`,
        type: 'UNEXPECTED'
    });

    await new RPM({
        token, triggers: [{
            condition: (rpm) => rpm >= MAX_RPM && (rpm - MAX_RPM) % MAX_RPM === 0,
            callback: async (rpm) => {
                blockedUntil = now + (2 * 60 * 1000);
                await disableFunction(token, functionId);
                await telegram.send(`[fdis] (blob-shuttle) success https://console.yandex.cloud/folders/${folderId}/functions/functions/${functionId}/overview`);
            }
        }], database: {
            endpoint: ydb_endpoint,
            tableName: 'prod/zw-space-api-requests',
            rpmKeyPrefix: 'bs'
        }
    }).execute('DB').catch(err => {
        throw new ApiError({
            error: 'RPM Error',
            details: (err instanceof Error ? err.message : String(err)) || 'unknown error',
            type: 'UNEXPECTED'
        })
    });
}

export default run;