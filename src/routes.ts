import { Handler } from '@yandex-cloud/function-types';
import { S3Client, PutObjectCommand, GetObjectCommand, paginateListObjectsV2, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { parseJSONBody } from './middle';

const Bucket = 'zw-space';
const ProjectKey = 'blob-shuttle';

const s3Client = new S3Client({
    region: "ru-central1",
    endpoint: "https://s3.yandexcloud.net",
    credentials: {
        accessKeyId: process.env.STATIC_KEY_ID!,
        secretAccessKey: process.env.STATIC_KEY_SECRET!,
    },
});

const deleteVault: Handler.Http = async (event) => {
    try {
        const paginator = paginateListObjectsV2({ client: s3Client }, { Bucket, Prefix: `${ProjectKey}/` });

        for await (const page of paginator) {
            const objects = page.Contents;

            if (objects && objects.length > 0) await s3Client.send(new DeleteObjectsCommand({
                Bucket, Delete: { Objects: objects.map(({ Key }) => ({ Key })), Quiet: true }
            }));
        }

        return { statusCode: 200 };
    } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        return { statusCode: 500, body: `UE#1003: ${err}` };
    }
}

const createVault: Handler.Http = async (event) => {
    const args = parseJSONBody(event.body, event.isBase64Encoded);
    if (!args) return { statusCode: 403, body: 'Error parsing body' }

    let { files, vault_id } = args;
    if (!Array.isArray(files) || !files.every(item => typeof item === "string") || !files.length) return { statusCode: 403, body: 'No valid filenames provided' }
    if (typeof vault_id !== 'string' || !/^[a-zA-Z0-9]{6}$/.test(vault_id)) vault_id = null;

    try {
        if (!vault_id) vault_id = Array.from({ length: 6 }, () => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 62)]).join('');

        const urlPromises = files.map(async (filename) => {
            const command = new PutObjectCommand({ Bucket, Key: `${ProjectKey}/vault-${vault_id}/${filename}` });
            const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

            return [filename, signedUrl] as const;
        });

        const url = Object.fromEntries(await Promise.all(urlPromises));
        return { statusCode: 200, body: JSON.stringify({ vault_id, url }) };
    } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        return { statusCode: 500, body: err };
    }
}

const revealVault: Handler.Http = async (event) => {
    const args = parseJSONBody(event.body, event.isBase64Encoded);
    if (!args) return { statusCode: 403, body: 'Error parsing body' }

    let { vault_id } = args;
    if (typeof vault_id !== 'string' || !/^[a-zA-Z0-9]{6}$/.test(vault_id)) return { statusCode: 403, body: 'No valid Vault ID provided' };

    let files: { name: string; url: string; size: number }[] = [];
    const Prefix = `${ProjectKey}/vault-${vault_id}/`;
    try {
        const paginator = paginateListObjectsV2({ client: s3Client }, { Bucket, Prefix });

        for await (const page of paginator) {
            const objects = page.Contents;

            if (objects && objects.length > 0) {
                const pagePromises = objects.map(async (obj) => {
                    if (typeof obj.Key !== 'string' || typeof obj.Size !== 'number') return null;
                    const command = new GetObjectCommand({ Bucket, Key: obj.Key });
                    const url = await getSignedUrl(s3Client, command, { expiresIn: 86400 });

                    return { name: obj.Key.replace(Prefix, ''), url, size: obj.Size };
                });

                const resolvedObjects = await Promise.all(pagePromises);
                resolvedObjects.filter(x => x !== null).forEach(item => files.push(item));
            }
        }

        if (!files || !files.length) return { statusCode: 404, body: 'This Vault is empty.' }
        return { statusCode: 200, body: JSON.stringify(files) };
    } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        return { statusCode: 500, body: `UE#1003: ${err}` };
    }
}

const auth: Handler.Http = (event) => {
    const passcode = event.headers['X-PassCode'] || event.headers['x-passcode'];
    if (passcode && passcode === process.env.PASSCODE) return {
        statusCode: 200,
        headers: { 'Set-Cookie': `passcode=${passcode};Expires=${new Date(Math.ceil(Date.now() / 86400000) * 86400000).toUTCString()};Path=/` }
    }

    return { statusCode: 401, body: `No valid passcode was provided. (${process.env.PASSCODE} / ${passcode})` }
}


export { auth, deleteVault, createVault, revealVault }