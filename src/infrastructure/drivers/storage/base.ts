import { VaultFile } from "#shared/schema.js";

export abstract class BaseFileSystemWrapper {
    abstract getUploadFileURLs: (
        files: VaultFile<{ withUrl: false }>[],
        vault_id: string,
        options?: { expiresIn?: number }
    ) => Promise<Record<string, string>>;

    abstract getFiles: (
        vault_id: string,
        options?: { expiresIn?: number }
    ) => Promise<VaultFile<{ withUrl: true }>[]>;
}