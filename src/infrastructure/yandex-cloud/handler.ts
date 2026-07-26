import { Handler } from "@yandex-cloud/function-types";
import { Http } from "@yandex-cloud/function-types/dist/src/http";
import Context from "@yandex-cloud/function-types/dist/src/context";

/* middle imports */
import { setup_rpm } from './middleware/rpm';

/* necessary imports */
import { ValidationError } from "#shared/validators.js";
import { Request } from "#shared/schema.js";
import { fn } from '../../index';

const rateLimit = async (context: Context) => {
    /* rate limitting */
    const MAX_RPM: number = 40; // RPM > MAX_RPM -> disableFunction
    if (process.env.NODE_ENV !== 'development') await setup_rpm(context, MAX_RPM);
}

export const handler = async (event: Http.Event, context: Context): Promise<Http.Result> => {
    try {
        const method = event.httpMethod;
        const query = event.queryStringParameters || {};

        if (event.httpMethod === 'OPTIONS') {
            await rateLimit(context);

            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Max-Age': '86400'
                },
                isBase64Encoded: false,
                body: ''
            }
        }

        /* request object formation */
        const req: Request = method === 'GET'
            ? { method, query }
            : { method, query, body: parseJSONBody(event, context) }

        /* optional middleware */
        // TODO: implement next() function
        req.middleware = async () => {
            await rateLimit(context);
        }

        /* API response */
        const res = await fn(req);


        /* yc serverless functions response object formation */
        return {
            statusCode: res.status,
            body: typeof res.body === 'string'
                ? res.body
                : JSON.stringify(res.body),
            isBase64Encoded: res.isBase64Encoded,
            headers: {
                'Access-Control-Allow-Origin': '*',
                ...res.headers
            }
        }
    } catch (error) {
        console.error(error);
        return { statusCode: 500 }
    }
}



/* yc event.body > JSON parser with cache */
const bodyCache = new Map<string, unknown>();

const parseJSONBody = (event: Http.Event, context: Context): unknown => {
    if (bodyCache.has(context.requestId)) return bodyCache.get(context.requestId);

    const body = event?.body;
    const isBase64Encoded = event?.isBase64Encoded;

    if (typeof body !== 'string') return undefined;
    if (!body || !body.length) return undefined;

    let rawString = body;

    if (isBase64Encoded) try {
        rawString = Buffer.from(body, 'base64').toString('utf-8');
    } catch (err) {
        throw ValidationError('Malformed Base64 payload encoding stream');
    }


    try {
        const parsed = JSON.parse(rawString);
        bodyCache.set(context.requestId, parsed);
        return parsed;
    } catch (err) {
        throw ValidationError('Invalid JSON syntax entity inside request body', `body=${JSON.stringify(event.body)}`);
    }
};