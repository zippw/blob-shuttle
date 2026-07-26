import fs from 'node:fs';
import path from 'node:path';
import { ApiError } from '#shared/ApiError.js';

async function renderFileRuntime(src: string): Promise<string> {
    try {
        const data = await fs.readFileSync(path.resolve(__dirname, src), { encoding: 'utf-8' });
        return data;
    } catch (error) {
        throw new ApiError({
            error: 'Failed to render page',
            details: error instanceof Error ? error.message : String(error),
            type: 'UNEXPECTED'
        })
    }
}

export { renderFileRuntime }