export type Authorization = AuthorizationByRootInvite | AuthorizationByInvite | AuthorizationByPasscode;
type AuthorizedRequest = { auth: Authorization; }

// invite with embedded passcode doesn't require passcode field.
// Invite purpose is to autofill inputs.
interface AuthorizationByRootInvite { invite: string; }
interface AuthorizationByInvite { invite: string; passcode: string; }
interface AuthorizationByPasscode { passcode: string; }


/* ?path=reveal-vault */
export interface RevealVaultArgs extends AuthorizedRequest { vault_id: string; }
export type RevealVaultResult = VaultFile[];

interface VaultFile {
    // pre signed S3 GetObject
    url: string;
    // filename (e.x. "image.png")
    name: string;
    // file size in bytes
    size: number;
}


/* ?path=create-vault */
export interface CreateVaultArgs extends AuthorizedRequest {
    // optional vault_id. If no vault_id was passed - server will generate random.
    vault_id?: string;
    files: { name: string; size: number }[];
}

export type CreateVaultResult = {
    url: { [filename: string]: string }
    // final vault_id either generated or passed through
    vault_id: string;
}


/* ?path=check-auth */
export interface CheckAuthArgs extends AuthorizedRequest { }
export type CheckAuthResult = { cache_allowed: boolean; }


/* ?path=create-invite */
export interface CreateInviteArgs extends AuthorizedRequest { vault_id: string; }
export type CreateInviteResult = { hash: string };



export interface StructuredApiErr {
    // error shown to client
    error: string;
    // debug
    details?: string;

    type: string
}