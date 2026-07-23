import {
    Authorization,
    RevealVaultArgs, CreateInviteArgs, CreateVaultArgs, CheckAuthArgs,
    RevealVaultResult, CreateInviteResult, CreateVaultResult, CheckAuthResult
} from './schema';
import { MAX_BUCKET_SIZE, MAX_FILE_COUNT, MAX_FILE_SIZE, MAX_PASSCODE_LENGTH } from './constants';
import { ApiError } from './ApiError';

export const ValidationError = (message: string, details?: string) => new ApiError({
    error: message, details, type: 'VALIDATION'
});

export const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

export const validateVaultId = (vault_id: unknown): string => {
    if (typeof vault_id !== 'string' || !/^[a-zA-Z0-9]{6}$/.test(vault_id))
        throw ValidationError('Invalid vault ID.', `Vault ID must be exactly 6 alphanumeric characters. vault_id=${vault_id}`);

    return vault_id;
}

export const validatePasscode = (passcode: unknown): string => {
    if (typeof passcode !== 'string' || passcode.length === 0)
        throw ValidationError('Invalid passcode.', `Passcode must be a non-empty string. passcode=${passcode}`);

    if (passcode.length > MAX_PASSCODE_LENGTH)
        throw ValidationError('Invalid passcode.', `Passcode is too big (>${MAX_PASSCODE_LENGTH}). passcode.length=${passcode.length}`);

    return passcode;
}

export const validateFileName = (name: unknown): string => {
    if (typeof name !== 'string' || name.length === 0)
        throw ValidationError('Invalid file name.');

    if (name.length > 255)
        throw ValidationError('File name too long.');

    if (/[<>:"/\\|?*]/.test(name))
        throw ValidationError('File name contains invalid characters.');

    return name;
}

export const validateFileSize = (size: unknown): number => {
    if (typeof size !== 'number' || size <= 0)
        throw ValidationError('Invalid file size.');

    if (size > MAX_FILE_SIZE) throw ValidationError('File is too big.');

    return size;
}

export const validateMimeType = (mime: unknown): string => {
    if (typeof mime !== 'string' || !mime.includes('/'))
        throw ValidationError('Invalid MIME type.');

    return mime;
}

export const validateTimestamp = (ts: unknown): number => {
    const num = Number(ts);
    if (isNaN(num) || num <= 0)
        throw ValidationError('Invalid timestamp.');

    return num;
}

export const validateUrl = (url: unknown): string => {
    try {
        const parsed = new URL(String(url));
        return parsed.toString();
    } catch {
        throw ValidationError('Invalid URL.');
    }
}


/* ----------------- INPUT -----------------*/

export const assertAuthorization = (auth: unknown): Authorization => {
    if (!isObject(auth)) throw ValidationError('Invalid authorization data.', 'Auth must be a valid JSON object.');

    const { invite, passcode } = auth;

    // AuthorizationByRootInvite
    if ('invite' in auth && !('passcode' in auth)) {
        if (typeof invite !== 'string' || invite.length === 0)
            throw ValidationError('Invalid invite code.', `AuthorizationByRootInvite: invite hash must be a non-empty string. invite=${invite}`);

        return { invite };
    }

    // AuthorizationByInvite
    if ('invite' in auth && 'passcode' in auth) {
        if (typeof invite !== 'string' || invite.length === 0)
            throw ValidationError('Invalid invite code.', `AuthorizationByInvite: invite hash must be a non-empty string. invite=${invite}`);

        return { invite, passcode: validatePasscode(passcode) };
    }

    // AuthorizationByPasscode
    if ('passcode' in auth && !('invite' in auth)) return { passcode: validatePasscode(passcode) };

    throw ValidationError('Invalid authorization.', 'Invalid authorization payload structure.');
}

export const assertRevealVaultArgs = (body: unknown): RevealVaultArgs => {
    if (!isObject(body)) throw ValidationError('Invalid request body.', 'Request body must be a valid JSON object.');

    return {
        vault_id: validateVaultId(body.vault_id),
        auth: assertAuthorization(body.auth)
    };
}

export const assertCreateVaultArgs = (body: unknown): CreateVaultArgs => {
    if (!isObject(body)) throw ValidationError('Invalid request body.', 'Request body must be a valid JSON object.');

    let vault_id: string | undefined = undefined;
    if ('vault_id' in body && body.vault_id !== undefined && body.vault_id !== null)
        vault_id = validateVaultId(body.vault_id);

    const validatedFiles: Array<{ name: string; size: number }> = [];
    if ('files' in body) {
        if (!Array.isArray(body.files)) throw ValidationError('Invalid file list.', 'No valid file list provided.');
        if (!body.files.length) throw ValidationError('File list is empty.', 'File list length is 0.');
        if (body.files.length > MAX_FILE_COUNT) throw ValidationError('Too many files.', `len=${body.files.length}/${MAX_FILE_COUNT}`);

        // we believe in yandex cloud storage size limiter.

        let totalFileSize = 0;
        for (const file of body.files) {
            if (!('size' in file) || !('name' in file)) throw ValidationError('Invalid file data.', 'Missing file params (name or size).');

            validateFileName(file.name);
            validateFileSize(file.size);

            totalFileSize += file.size;
            if (totalFileSize > MAX_BUCKET_SIZE) throw ValidationError('Total size limit exceeded.', `Total file size exceeds maximum bucket size limit. totalFileSize=${totalFileSize}/${MAX_BUCKET_SIZE}`);

            validatedFiles.push({ name: file.name, size: file.size });
        }
    } else throw ValidationError('No files provided.', 'The files field is missing in body.');

    return {
        vault_id, files: validatedFiles,
        auth: assertAuthorization(body.auth)
    };
}

export const assertCheckAuthArgs = (body: unknown): CheckAuthArgs => {
    if (!isObject(body)) throw ValidationError('Invalid request body.', 'Request body must be a valid JSON object.');

    return { auth: assertAuthorization(body.auth) };
};

export const assertCreateInviteArgs = (body: unknown): CreateInviteArgs => {
    if (!isObject(body)) throw ValidationError('Invalid request body.', 'Request body must be a valid JSON object.');

    return {
        vault_id: validateVaultId(body.vault_id),
        auth: assertAuthorization(body.auth)
    }
}


/* ----------------- OUTPUT -----------------*/

export const assertRevealVaultResult = (response: unknown): RevealVaultResult => {
    if (!Array.isArray(response)) throw ValidationError('Invalid response format.', 'RevealVault response must be an array of files.');

    return response.map((file, i) => {
        if (!isObject(file)) throw ValidationError('Invalid file data.', `File token at index ${i} is not a valid object.`);

        return {
            url: validateUrl(file.url),
            name: validateFileName(file.name),
            size: validateFileSize(file.size)
        };
    });
};

export const assertCreateVaultResult = (response: unknown): CreateVaultResult => {
    if (!isObject(response)) throw ValidationError('Invalid response format.', 'CreateVault response must be a valid object.');
    if (!isObject(response.url)) throw ValidationError('Invalid response format.', 'CreateVault response must contain a URL dictionary map.');

    const urlMap: Record<string, string> = {};
    for (const [filename, url] of Object.entries(response.url)) {
        urlMap[validateFileName(filename)] = validateUrl(url);
    }

    return {
        url: urlMap,
        vault_id: validateVaultId(response.vault_id)
    };
};

export const assertCheckAuthResult = (response: unknown): CheckAuthResult => {
    if (!isObject(response)) throw ValidationError('Invalid response format.', 'CheckAuth response must be a valid object.');

    if (typeof response.cache_allowed !== 'boolean')
        throw ValidationError('Invalid response data.', `cache_allowed state layout missing or unmapped. cache_allowed=${response.cache_allowed}`);

    let result: CheckAuthResult = {
        cache_allowed: response.cache_allowed
    };

    if ('invite_vault_id' in response && typeof response.invite_vault_id === 'string') {
        result.invite_vault_id = validateVaultId(response.invite_vault_id);
    }

    return result
};

export const assertCreateInviteResult = (response: unknown): CreateInviteResult => {
    if (!isObject(response)) throw ValidationError('Invalid response format.', 'CreateInvite response must be a valid object.');

    if (!('hash' in response) || typeof response.hash !== 'string' || response.hash.length === 0)
        throw ValidationError('Invalid response data.', 'Missing valid hash.');

    let result: CreateInviteResult = { hash: response.hash }
    if ('authorized_hash' in response) {
        if (typeof response.authorized_hash !== 'string')
            throw ValidationError('Invalid response data.', 'Invalid authorized hash.');

        result.authorized_hash = response.authorized_hash;
    }

    return result;
};