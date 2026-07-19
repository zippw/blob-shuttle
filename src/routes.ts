import { Handler } from '@yandex-cloud/function-types';
import { S3Client, PutObjectCommand, GetObjectCommand, paginateListObjectsV2 } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createSessionInviteToken } from './invite';
import { sessionStorage, getInviteData } from './session';
import { parseJSONBody } from './utils';
import { generateVaultId } from './vaultid';

import { GET_URL_EXPTIME_SEC, PUT_URL_EXPTIME_SEC } from '#shared/constants.js';
import {
    assertCheckAuthArgs, assertCreateInviteArgs, assertCreateVaultArgs, assertRevealVaultArgs,
    validateFileName, validateFileSize, validateUrl
} from '#shared/validators.js';
import { CheckAuthResult, CreateInviteResult, CreateVaultResult, RevealVaultResult, StructuredApiErr } from '#shared/schema.js';
import { ApiError } from '#shared/ApiError.js';

const Bucket = 'zw-space';
const ProjectKey = 'blob-shuttle';

const accessKeyId = process.env.STATIC_KEY_ID;
const secretAccessKey = process.env.STATIC_KEY_SECRET;

if (!accessKeyId || !secretAccessKey) throw new Error(
    `Critical Configuration Error: Missing S3 credentials. ` +
    `Please ensure process.env.STATIC_KEY_ID and process.env.STATIC_KEY_SECRET are set.`
);

const s3Client = new S3Client({
    region: "ru-central1",
    endpoint: "https://s3.yandexcloud.net",
    credentials: { accessKeyId, secretAccessKey }
});

export const checkAuth: Handler.Http = async (event) => {
    const store = sessionStorage.getStore();
    const cache_allowed = store?.session.cache_allowed || false;

    const result: CheckAuthResult = { cache_allowed }
    return { statusCode: 200, body: JSON.stringify(result) }
}

export const createVault: Handler.Http = async (event) => {
    const bodyJSON = parseJSONBody(event);
    const { files, vault_id } = assertCreateVaultArgs(bodyJSON);

    const invite_hash_data = getInviteData();
    let finalVaultId = invite_hash_data.is_valid
        ? invite_hash_data.vault_id
        : vault_id ? vault_id : generateVaultId();

    const urlPromises = files.map(async ({ name, size }) => {
        const safeName = validateFileName(name);
        const command = new PutObjectCommand({ Bucket, Key: `${ProjectKey}/vault-${finalVaultId}/${safeName}` });
        const signedUrl = validateUrl(
            await getSignedUrl(s3Client, command, {
                expiresIn: invite_hash_data.is_valid
                    ? Math.max(1, invite_hash_data.expires_in_sec)
                    : PUT_URL_EXPTIME_SEC
            })
        );

        return [name, signedUrl] as const;
    });

    const url = Object.fromEntries(await Promise.all(urlPromises));
    const result: CreateVaultResult = { vault_id: finalVaultId, url }
    return { statusCode: 200, body: JSON.stringify(result) };
}

export const revealVault: Handler.Http = async (event) => {
    const bodyJSON = parseJSONBody(event);
    const { vault_id } = assertRevealVaultArgs(bodyJSON);
    const invite_hash_data = getInviteData();

    if (invite_hash_data.is_valid && vault_id !== invite_hash_data.vault_id) throw new ApiError({
        error: 'Vault ID mismatch.',
        details: `Entered Vault ID must match the ID from the invite. hash.is_valid=${invite_hash_data.is_valid};hash.vault_id=${invite_hash_data.vault_id};vault_id=${vault_id}`,
        type: 'VALIDATION'
    });


    let result: RevealVaultResult = [];
    const Prefix = `${ProjectKey}/vault-${vault_id}/`;
    const paginator = paginateListObjectsV2({ client: s3Client }, { Bucket, Prefix });

    for await (const page of paginator) {
        const objects = page.Contents;

        if (objects && objects.length > 0) {
            const pagePromises = objects.map(async (obj) => {
                try {
                    const size = validateFileSize(obj.Size);

                    if (typeof obj.Key !== 'string') return null;
                    const command = new GetObjectCommand({ Bucket, Key: obj.Key });
                    const url = await getSignedUrl(s3Client, command, {
                        expiresIn: invite_hash_data.is_valid
                            ? Math.max(1, invite_hash_data.expires_in_sec)
                            : GET_URL_EXPTIME_SEC
                    });

                    return { name: obj.Key.replace(Prefix, ''), url, size };
                } catch (err) { return null }
            });

            const resolvedObjects = await Promise.all(pagePromises);
            resolvedObjects.filter(x => x !== null).forEach(item => result.push(item));
        }
    }

    if (!result || !result.length) throw new ApiError({
        error: 'Vault is empty.', details: `This Vault is empty. vault_id=${vault_id}`, type: 'NOTFOUND'
    });

    return { statusCode: 200, body: JSON.stringify(result) };
}

export const createInvite: Handler.Http = async (event) => {
    const bodyJSON = parseJSONBody(event);
    const { vault_id } = assertCreateInviteArgs(bodyJSON);

    const hash = createSessionInviteToken(vault_id);
    const result: CreateInviteResult = { hash }
    return { statusCode: 200, body: JSON.stringify(result) }
}