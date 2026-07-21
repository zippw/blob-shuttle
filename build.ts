import { compile } from 'pug';
import esbuild from 'esbuild';
import glob from 'fast-glob';
import path from 'node:path';
import fs from 'node:fs';
import sass from 'sass';
import { config } from 'dotenv';
config();

const assetCache = new Map<string, string>();
let outputDir = 'src/views';
const entry = {
    scss: 'frontend/styles/main.scss',
    ts: 'frontend/scripts/main.ts',
    pug: 'frontend/views/index.pug'
};

const normalizePath = (p: string) => p.replace(/\\/g, '/');

const gray = '\x1b[90m';
const blue = '\x1b[34m';
const red = '\x1b[31m';
const reset = '\x1b[0m';

let lastChanged = '';

const buildStyles = () => {
    const start = Date.now();
    const result = sass.compile(entry.scss, { style: 'compressed' });
    assetCache.set(normalizePath(entry.scss), result.css);
    return Date.now() - start;
};

const buildScripts = async () => {
    const start = Date.now();
    const result = await esbuild.build({
        entryPoints: [entry.ts],
        bundle: true,
        format: 'iife',
        minify: true,
        target: 'es2020',
        write: false,
        alias: { '@shared': path.resolve(process.cwd(), 'src/shared') }
    });
    const text = result.outputFiles?.[0]?.text;
    if (text) {
        assetCache.set(normalizePath(entry.ts), text);
    }
    return Date.now() - start;
};

import * as consts from '#shared/constants.js';
import { formatBytes } from '#shared/utils.js';

const buildTemplates = () => {
    const start = Date.now();
    const source = fs.readFileSync(entry.pug, 'utf-8');
    const compiled = compile(source, {
        filename: entry.pug,
        compileDebug: false,
        filters: {
            css: (text: string, opts: { path: string }) => {
                const key = normalizePath(opts?.path || '');
                return assetCache.get(key) || '';
            },
            js: (text: string, opts: { path: string }) => {
                const key = normalizePath(opts?.path || '');
                return assetCache.get(key) || '';
            }
        }
    });

    const html = compiled({
        consts, env: process.env,
        formatted: { MAX_FILE_SIZE: formatBytes(consts.MAX_FILE_SIZE) }
    });

    const outPath = path.join(outputDir, 'index.html');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html);
    return Date.now() - start;
};

let isBuilding = false;

const build = async () => {
    if (isBuilding) return;
    isBuilding = true;

    const start = Date.now();
    let scssTime = 0, tsTime = 0, pugTime = 0;
    let hasError = false;

    try {
        scssTime = buildStyles();
    } catch (err: any) {
        console.log(`${red}scss error${reset} ${gray}${err.message?.split('\n')[0] || err}${reset}`);
        hasError = true;
    }

    if (!hasError) {
        try {
            tsTime = await buildScripts();
        } catch (err: any) {
            console.log(`${red}typescript error${reset} ${gray}${err.message?.split('\n')[0] || err}${reset}`);
            hasError = true;
        }
    }

    if (!hasError) {
        try {
            pugTime = buildTemplates();
        } catch (err: any) {
            console.log(`${red}pug error${reset} ${gray}${err.message?.split('\n')[0] || err}${reset}`);
            hasError = true;
        }
    }

    if (hasError) {
        console.log(`${red}build failed${reset} ${gray}${(Date.now() - start).toFixed(0)}ms${reset}`);
    } else {
        const pad = (v: number) => v.toFixed(0);
        const isChanged = (label: string) => lastChanged === label ? blue : gray;
        console.log(
            `${blue}built ${pad(Date.now() - start)}ms${reset} ` +
            `${isChanged('scss')}scss ${pad(scssTime)}ms${reset} ` +
            `${isChanged('ts')}ts ${pad(tsTime)}ms${reset} ` +
            `${isChanged('pug')}pug ${pad(pugTime)}ms${reset}`
        );
    }

    lastChanged = '';
    isBuilding = false;
};

const watch = async () => {
    console.log(`${gray}watching...${reset}`);
    await build();

    let timeout: NodeJS.Timeout | null = null;
    const rebuild = (file: string) => {
        const ext = path.extname(file).slice(1);
        if (ext === 'scss') lastChanged = 'scss';
        else if (ext === 'ts') lastChanged = 'ts';
        else if (ext === 'pug') lastChanged = 'pug';

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            timeout = null;
            build();
        }, 50);
    };

    const files = glob.sync(['frontend/**/*.scss', 'frontend/**/*.ts', 'frontend/**/*.pug']);
    for (const file of files) {
        fs.watch(file, { persistent: true }, () => rebuild(file));
    }
};

const args = process.argv.slice(2);
const mode = args.includes('--watch') ? 'watch' : 'build';

(async () => {
    if (mode === 'build') {
        await fs.rmSync('dist', { recursive: true, force: true });
        await fs.mkdirSync('dist');

        const pkg = require('./package.json');
        delete pkg.devDependencies;
        delete pkg.scripts;
        if (pkg.imports && pkg.imports['#shared/*.js']) {
            pkg.imports['#shared/*.js'] = pkg.imports['#shared/*.js'].replace('./src/shared', './shared');
        }
        fs.writeFileSync('dist/package.json', JSON.stringify(pkg, null, 2));

        fs.cpSync('src/static', 'dist/static', { recursive: true, force: true });

        outputDir = 'dist/views';
        await build();
    } else {
        await watch();
    }
})();