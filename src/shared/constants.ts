// shared universal server/client (!) config
export const MAX_PASSCODE_LENGTH: number = 1024;
export const PUT_URL_EXPTIME_SEC: number = 60 * 20;
export const GET_URL_EXPTIME_SEC: number = 60;
export const MAX_BUCKET_SIZE: number = 1024 * 1024 * 1024 // 1 GiB (in bytes)
export const MAX_FILE_SIZE: number = 1024 * 1024 * 50 // 200 MiB
export const MAX_FILE_COUNT: number = Math.floor(MAX_BUCKET_SIZE / MAX_FILE_SIZE);
export const MAX_RPM: number = 40; // disableFunction RPM trigger threshold -1 to disable whole rpm system.

// allows to install app and use share_target API. 
// Insure your serverless function returns correct headers (Content-Security-Policy must have service workers enabled. Otherwise, use reverse proxy or API Gateway)
// Setup frontend/views/base64/manifest.json first. Replace all function URLs;

export const ENABLE_PWA: boolean = true;
export const ENABLE_STATIC: boolean = ENABLE_PWA || true; // for service-workers and icons routing to make PWA
export const STATIC_CACHE_CONTROL: string | undefined = 'public, max-age=86400';

// system util consts not intended for customization
import { formatBytes } from './utils';
export const MAX_FILE_SIZE_FORMATTED: string = formatBytes(MAX_FILE_SIZE);
