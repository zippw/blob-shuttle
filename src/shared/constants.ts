// shared universal server/client (!) config
export const PUT_URL_EXPTIME_SEC = 60 * 20;
export const GET_URL_EXPTIME_SEC = 60;
export const MAX_BUCKET_SIZE = 1024 * 1024 * 1024 // 1 GiB (in bytes)
export const MAX_FILE_SIZE = 1024 * 1024 * 50 // 200 MiB
export const MAX_FILE_COUNT = Math.floor(MAX_BUCKET_SIZE / MAX_FILE_SIZE);

import { formatBytes } from './utils'
export const MAX_FILE_SIZE_PARSED = formatBytes(MAX_FILE_SIZE)
