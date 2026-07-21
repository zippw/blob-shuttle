import { ApiError } from "#shared/ApiError.js";
import { VaultFile } from "#shared/schema.js";
import { BaseFileSystemWrapper } from "./base";

import { S3Client, PutObjectCommand, GetObjectCommand, paginateListObjectsV2 } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";



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


export default class FileSystemWrapper extends BaseFileSystemWrapper {
    constructor() { super(); }

    public getUploadFileURLs: BaseFileSystemWrapper['getUploadFileURLs'] = async (files, vault_id, options) => {
        const urlPromises = files.map(async file => {
            const command = new PutObjectCommand({ Bucket, Key: `${ProjectKey}/vault-${vault_id}/${file.name}` });
            const url = await getSignedUrl(s3Client, command, {
                expiresIn: options?.expiresIn
            });

            return [file.name, url] as [string, string];
        });

        const res = await Promise.all(urlPromises)
        return Object.fromEntries(res);
    }

    public getFiles: BaseFileSystemWrapper['getFiles'] = async (vault_id, options) => {
        const result: VaultFile<{ withUrl: true }>[] = [];

        const Prefix = `${ProjectKey}/vault-${vault_id}/`;
        const paginator = paginateListObjectsV2({ client: s3Client }, { Bucket, Prefix });

        for await (const page of paginator) {
            const objects = page.Contents;

            if (objects && objects.length > 0) {
                const pagePromises = objects.map(async (obj) => {
                    try {
                        if (typeof obj.Size !== 'number') return null;
                        if (typeof obj.Key !== 'string') return null;

                        const command = new GetObjectCommand({ Bucket, Key: obj.Key });
                        const url = await getSignedUrl(s3Client, command, {
                            expiresIn: options?.expiresIn
                        });

                        return { name: obj.Key.replace(Prefix, ''), url, size: obj.Size };
                    } catch (err) { return null }
                });

                const resolvedObjects = await Promise.all(pagePromises);
                resolvedObjects.filter(x => x !== null).forEach(item => result.push(item));
            }
        }

        if (!result || !result.length) throw new ApiError({ error: 'Vault is empty.', details: `This Vault is empty. vault_id=${vault_id}`, type: 'NOTFOUND' });

        return result
    }
}