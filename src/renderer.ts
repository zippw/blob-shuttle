import fs from 'node:fs';
import path from 'node:path';

// @ts-ignore
import wrap from 'pug-runtime/wrap';

async function renderFileRuntime(src: string, options: any) {
    try {
        const data = await fs.readFileSync(path.resolve(__dirname, src), { encoding: 'utf-8' });
        const fn = wrap(data, 'temp');
        const html = fn(options);

        return html
    } catch (error) {
        return `<h1>Error: ${error}</h1>`;
    }
}

export { renderFileRuntime }