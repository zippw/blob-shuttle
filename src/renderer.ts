import fs from 'node:fs';
import path from 'node:path';
import { ApiError } from '#shared/ApiError.js';

// @ts-ignore
import wrap from 'pug-runtime/wrap';

async function renderFileRuntime(src: string, options: any) {
    try {
        const data = await fs.readFileSync(path.resolve(__dirname, src), { encoding: 'utf-8' });
        const fn = wrap(data, 'temp');
        const html = fn(options);

        return html
    } catch (error) {
        throw new ApiError({
            error: 'Failed to render page',
            details: error instanceof Error ? error.message : String(error),
            type: 'UNEXPECTED'
        })
    }
}

export { renderFileRuntime }