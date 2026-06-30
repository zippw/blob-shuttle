import { Handler } from '@yandex-cloud/function-types';
import { renderFileRuntime } from './renderer';
import { getInvocationSource } from './invocsrc';
import { isAuthorized } from './middle';
import { deleteVault, createVault, revealVault, auth } from './routes';


export const handler: Handler.Http = async (event, context) => {
    const method = event.httpMethod;
    const query = event.queryStringParameters;
    const source = getInvocationSource(event);

    // await new Promise(res => setTimeout(res, 1000));

    // 24 hour auto delete trigger
    if (source.source === 'trigger' && source.id === process.env.AUTODELETE_TRIGGER_ID) return await deleteVault(event, context);

    // client authorization
    const authorized = isAuthorized(event);
    if (method === 'GET') return {
        statusCode: 200, body: await renderFileRuntime('./views/authorized.js', { authorized }),
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    }

    if (!authorized) return { statusCode: 401, body: 'Invalid Passcode.' }

    // authorized endpoints
    if (method === 'POST' && query.path === 'check-auth') return { statusCode: 200 }
    if (method === 'POST' && query.path === 'create-vault') return await createVault(event, context);
    if (method === 'POST' && query.path === 'reveal-vault') return await revealVault(event, context);

    return { statusCode: 404 };
};