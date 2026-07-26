import { ApiError } from "#shared/ApiError.js";
import { VaultFile } from "#shared/schema.js";
import { BaseFileSystemWrapper } from "./base";

/**
 * LOCAL DEVELOPMENT FILE SYSTEM WRAPPER EXAMPLE
 * 
 * Built for Express + node:fs. Used for:
 * - Local development environments without an S3 bucket.
 * - Demonstrating how to swap the S3 wrapper with a different storage backend.
 * - Visualizing the API contract between routes.ts and the file system layer.
 * 
 * Usage:
 * 1. Remove the ".example" extension from this file name.
 * 2. Run the Express server that serves files from the `./storage` folder.
 */

import fs from 'node:fs';
import path from 'node:path';

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const URL_PREFIX = 'http://localhost:8080/files';

export default class FileSystemWrapper extends BaseFileSystemWrapper {
    constructor() { super(); }

    public getUploadFileURLs: BaseFileSystemWrapper["getUploadFileURLs"] = async (files, vault_id, options) => {
        await this.ensureVaultDir(vault_id);
        const result: Record<string, string> = {};

        for (const file of files) {
            result[file.name] = `${URL_PREFIX}/vault-${vault_id}/${encodeURIComponent(file.name)}`;
        }

        return result;
    }

    public getFiles: BaseFileSystemWrapper['getFiles'] = async (vault_id, options) => {
        const vaultPath = this.getVaultPath(vault_id);

        try {
            await fs.accessSync(vaultPath);
        } catch {
            throw new ApiError({
                error: 'Vault is empty.',
                details: `Vault "${vault_id}" not found in storage`,
                type: 'NOTFOUND'
            });
        }

        const entries = await fs.readdirSync(vaultPath, { withFileTypes: true });
        const files = entries.filter(e => e.isFile());

        if (files.length === 0) throw new ApiError({
            error: 'Vault is empty.',
            details: `No files in vault "${vault_id}"`,
            type: 'NOTFOUND'
        });

        const result: VaultFile<{ withUrl: true }>[] = [];

        for (const file of files) {
            const filePath = path.join(vaultPath, file.name);
            const stat = await fs.statSync(filePath);

            result.push({
                name: file.name,
                size: stat.size,
                url: `${URL_PREFIX}/vault-${vault_id}/${encodeURIComponent(file.name)}`
            });
        }

        return result;
    }

    /* util methods */
    private getVaultPath(vaultId: string): string {
        return path.join(STORAGE_DIR, `vault-${vaultId}`);
    }

    private async ensureVaultDir(vaultId: string): Promise<unknown> {
        return fs.mkdirSync(this.getVaultPath(vaultId), { recursive: true });
    }
}



/* simple API example */
import { Router, raw } from "express";
export const storageRouter = Router();

console.log('started local storage', STORAGE_DIR);

new FileSystemWrapper();

storageRouter.use(raw({
    limit: '50mb',
    type: () => true // treat every Content-Type as Buffer
}));

storageRouter.get('/files/vault-:vaultId/:filename', async (req, res) => {
    const { vaultId, filename } = req.params;
    const filePath = path.join(STORAGE_DIR, `vault-${vaultId}`, filename);

    try {
        await fs.accessSync(filePath);
        res.sendFile(filePath);
    } catch {
        res.status(404).send('File not found');
    }
});

storageRouter.put('/files/vault-:vaultId/:filename', async (req, res) => {
    const { vaultId, filename } = req.params;
    const vaultPath = path.join(STORAGE_DIR, `vault-${vaultId}`);
    const filePath = path.join(vaultPath, filename);

    try {
        await fs.mkdirSync(vaultPath, { recursive: true });

        const data = req.body ?? req;

        await fs.writeFileSync(filePath, data);
        res.status(200).send('File uploaded');
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).send('Upload failed');
    }
});