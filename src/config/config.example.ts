import { Config } from "./base";

const config: Config = {
    mode: 'spa',
    apiUrl: process.env.NODE_ENV !== 'development'
        ? ''
        : 'http://localhost:8080/files',
    staticUrl: process.env.NODE_ENV !== 'development'
        ? undefined
        : undefined,
    options: {
        maxPasscodeLength: 1024,
        maxFileSize: 1024 * 1024 * 50,
        maxFileCountPerUpload: 20,
        inviteURLLifetime: 60 * 60,
        staticCacheControl: 'public, max-age=86400',
        readURLLifetime: 60,
        uploadURLLifetime: 60 * 20
    },
    storage: {
        driverPath: './infrastructure/drivers/storage/s3.js'
    }
};

export default config;