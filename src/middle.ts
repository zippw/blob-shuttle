import { Http } from '@yandex-cloud/function-types/dist/src/http';

const parseJSONBody = (body: any, isBase64Encoded: boolean): any | null => {
    if (!body) return null;

    let data = body;
    if (isBase64Encoded) try {
        data = Buffer.from(data, 'base64').toString('utf-8');
    } catch (err) { return null }

    let args: any;
    try {
        args = JSON.parse(data);
    } catch (err) { return null }

    return args;
}

const isAuthorized = (event: Http.Event): boolean => {
    const args = parseJSONBody(event.body, event.isBase64Encoded);
    if (!args) return false;
    if (!args.passcode) return false;

    return args.passcode === process.env.PASSCODE;
};

export { parseJSONBody, isAuthorized }