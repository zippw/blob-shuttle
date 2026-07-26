interface BaseVaultFile {
    // filename (e.x. "image.png")
    name: string;
    // file size in bytes
    size: number;
}

export type VaultFile<Config extends { withUrl: boolean } = { withUrl: true }> =
    BaseVaultFile & (Config['withUrl'] extends true ? { url: string } : { url?: string });

/* REQUESTS */
export type Authorization = AuthorizationByRootInvite | AuthorizationByInvite | AuthorizationByPasscode;
export type AuthorizedRequest = { auth: Authorization; }

// invite with embedded passcode doesn't require passcode field.
// Invite purpose is to autofill inputs.
interface AuthorizationByRootInvite { invite: string; }
interface AuthorizationByInvite { invite: string; passcode: string; }
interface AuthorizationByPasscode { passcode: string; }


/* ?path=reveal-vault */
export interface RevealVaultArgs extends AuthorizedRequest { vault_id: string; }
export type RevealVaultResult = VaultFile<{ withUrl: true }>[];


/* ?path=create-vault */
export interface CreateVaultArgs extends AuthorizedRequest {
    // optional vault_id. If no vault_id was passed - server will generate random.
    vault_id?: string;
    files: VaultFile<{ withUrl: false }>[];
}

export type CreateVaultResult = {
    url: { [filename: string]: string }
    // final vault_id either generated or passed through
    vault_id: string;
}


/* ?path=check-auth */
export interface CheckAuthArgs extends AuthorizedRequest { }
export type CheckAuthResult = { cache_allowed: boolean; invite_vault_id?: string }


/* ?path=create-invite */
export interface CreateInviteArgs extends AuthorizedRequest { vault_id: string; }
export type CreateInviteResult = { hash: string, authorized_hash?: string };



export interface StructuredApiErr {
    // error shown to client
    error: string;
    // debug
    details?: string;

    type: string
}










/* ----------------- HTTP Function Handler ----------------- */
export interface RequestQuery {
    path?: string;
    invite?: string;
    file?: string;
    [key: string]: string | undefined;
}

export interface Request {
    // 'GET' | 'POST'
    method: string;
    query: RequestQuery;
    body?: unknown;

    middleware?: () => Promise<void>
}


type ResponseBody = CheckAuthResult | CreateVaultResult | RevealVaultResult | CreateInviteResult | string | StructuredApiErr;
interface Response {
    status: number;
    body: ResponseBody;
    isBase64Encoded?: boolean;
    // headers?: {
    //     'Content-Type'?: 'application/json' | 'image/png' | 'application/javascript' | 'text/html; charset=UTF-8';
    //     'Content-Security-Policy'?: string;
    //     'Cache-Control'?: string;
    // }
    headers?: Record<string, string>
}

export type FunctionHandler = (req: Request) => Promise<Response>