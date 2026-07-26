import { generateInviteHash } from './invite';
import { sessionStorage, getInviteData } from './session';
import { generateVaultId } from './vaultid';

import {
    assertCheckAuthArgs, assertCreateVaultArgs, assertRevealVaultArgs, assertCreateInviteArgs,
    assertCreateVaultResult, assertRevealVaultResult
} from '#shared/validators.js';
import { CheckAuthResult, CreateInviteResult, CreateVaultResult, FunctionHandler, RevealVaultResult } from '#shared/schema.js';
import { ApiError } from '#shared/ApiError.js';

import cfg from './config/config';

/* file system */
import { BaseFileSystemWrapper } from './infrastructure/drivers/storage/base';
let fswrapper: BaseFileSystemWrapper | null = null;

export async function initStorage(): Promise<BaseFileSystemWrapper> {
    const DEFAULT_DRIVER = './infrastructure/drivers/storage/s3.js';
    const driverPath = cfg.storage?.driverPath || DEFAULT_DRIVER;

    // const module = await import(driverPath);
    // const DriverClass = module.default || module;
    // return new DriverClass();
    const DriverClass = require(driverPath)?.default || require(driverPath);
    
    return new DriverClass();
}


/* endpoints */
export const checkAuth: FunctionHandler = async (req) => {
    const store = sessionStorage.getStore();
    const cache_allowed = store?.session.cache_allowed || false;
    const invite_vault_id = store?.invite.is_valid ? store?.invite.vault_id : undefined

    const result: CheckAuthResult = { cache_allowed, invite_vault_id }
    return { status: 200, body: result }
}

export const createVault: FunctionHandler = async (req) => {
    if (fswrapper === null) fswrapper = await initStorage();
    const { files, vault_id } = assertCreateVaultArgs(req.body);

    const invite_hash_data = getInviteData();
    let finalVaultId = invite_hash_data.is_valid
        ? invite_hash_data.vault_id
        : vault_id ? vault_id : generateVaultId();

    /* custom function */
    const url = await fswrapper.getUploadFileURLs(files, finalVaultId, {
        expiresIn: invite_hash_data.is_valid
            ? Math.max(1, invite_hash_data.expires_in_sec)
            : cfg.options.uploadURLLifetime
    });

    /* output validation */
    const result: CreateVaultResult = assertCreateVaultResult({ vault_id: finalVaultId, url })
    return { status: 200, body: result };
}

export const revealVault: FunctionHandler = async (req) => {
    if (fswrapper === null) fswrapper = await initStorage();
    const { vault_id } = assertRevealVaultArgs(req.body);
    const invite_hash_data = getInviteData();

    if (invite_hash_data.is_valid && vault_id !== invite_hash_data.vault_id) throw new ApiError({
        error: 'Vault ID mismatch.',
        details: `Entered Vault ID must match the ID from the invite. hash.is_valid=${invite_hash_data.is_valid};hash.vault_id=${invite_hash_data.vault_id};vault_id=${vault_id}`,
        type: 'VALIDATION'
    });

    /* custom function */
    const files = await fswrapper.getFiles(vault_id, {
        expiresIn: invite_hash_data.is_valid
            ? Math.max(1, invite_hash_data.expires_in_sec)
            : cfg.options.readURLLifetime
    });

    /* output validation */
    let result: RevealVaultResult = assertRevealVaultResult(files);
    return { status: 200, body: result }
}

export const createInvite: FunctionHandler = async (req) => {
    const { vault_id } = assertCreateInviteArgs(req.body);

    const store = sessionStorage.getStore();
    const expires_at = Date.now() + cfg.options.inviteURLLifetime * 1000;

    let authorized_hash;
    if (store && typeof store.session.passcode === 'string') authorized_hash
        = generateInviteHash({ vault_id, expires_at, passcode: store.session.passcode });

    const hash = generateInviteHash({ vault_id, expires_at });

    const result: CreateInviteResult = { hash, authorized_hash }
    return { status: 200, body: result }
}