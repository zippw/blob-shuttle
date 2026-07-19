import { ValidationError } from "#shared/validators.js";
import { Http } from "@yandex-cloud/function-types/dist/src/http";

const bodyCache = new WeakMap<object, unknown>();

export const parseJSONBody = (event: Http.Event): unknown => {
    if (!event) return undefined;
    if (bodyCache.has(event)) return bodyCache.get(event);

    const body = event?.body;
    const isBase64Encoded = event?.isBase64Encoded;

    if (typeof body !== 'string') return undefined;
    if(!body || !body.length) return undefined;

    let rawString = body;

    if (isBase64Encoded) try {
        rawString = Buffer.from(body, 'base64').toString('utf-8');
    } catch (err) {
        throw ValidationError('Malformed Base64 payload encoding stream');
    }

    try {
        const parsed = JSON.parse(rawString);
        bodyCache.set(event, parsed);
        return parsed;
    } catch (err) {
        throw ValidationError('Invalid JSON syntax entity inside request body', `body=${JSON.stringify(event.body)}`);
    }
};