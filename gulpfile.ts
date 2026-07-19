import gulp from 'gulp';
// @ts-ignore
import pugRuntime from 'pug';
import gulpSass from 'gulp-sass';
import dartSass from 'sass';
import esbuild from 'esbuild';
import glob from 'fast-glob';
import path from 'node:path';
import rename from 'gulp-rename';
import { Transform } from 'node:stream';
import fs from 'node:fs';

import { tsconfigPathsPlugin } from 'esbuild-plugin-tsconfig-paths';

const sass = gulpSass(dartSass);
const assetCache = new Map<string, string>();

// Global flag to change output directory dynamically
let outputDir = 'src/views';

// Standardizes path separators for Windows compatibility
const normalizePath = (p: string) => p.replace(/\\/g, '/');

// SCSS -> Cache by original source path
const styles = () => gulp.src('frontend/styles/**/*.scss')
    .pipe(sass({ style: 'compressed' }).on('error', sass.logError))
    .pipe(new Transform({
        objectMode: true,
        transform(file, encoding, callback) {
            if (file.isBuffer()) {
                const key = normalizePath(path.relative(process.cwd(), file.history[0]));
                assetCache.set(key, file.contents.toString());
            }
            callback(null, file);
        }
    }));

// TS -> Cache by original source path (1:1 strict mapping)
const scripts = async () => {
    const entryPoints = await glob('frontend/scripts/**/*.ts');
    await Promise.all(entryPoints.map(async (entry) => {
        try {
            const result = await esbuild.build({
                plugins: [
                    tsconfigPathsPlugin({ tsconfig: 'frontend/tsconfig.json' })
                ],
                write: false,
                entryPoints: [entry],
                target: 'es2020',
                format: 'iife',
                minify: true,
                bundle: true,
                sourcemap: false
            });
            if (result.outputFiles?.[0]) {
                const key = normalizePath(entry);
                assetCache.set(key, result.outputFiles[0].text);
            }
        } catch (err) { }
    }));
};

// Pug Template compiler pipeline
const templates = () => gulp.src('frontend/views/**/*.pug')
    .pipe(new Transform({
        objectMode: true,
        transform(file, encoding, callback) {
            if (file.isBuffer()) try {
                const compiled = pugRuntime.compileClient(file.contents.toString(), {
                    filename: file.path,
                    compileDebug: false,
                    externalRuntime: true,
                    name: 'temp',
                    filters: {
                        css: (text: string, opt: { path: string }) => {
                            const key = normalizePath(opt.path || '');
                            return assetCache.get(key) || `/* Error: Source CSS "${key}" not found in cache */`;
                        },
                        js: (text: string, opt: { path: string }) => {
                            const key = normalizePath(opt.path || '');
                            return assetCache.get(key) || `/* Error: Source JS/TS "${key}" not found in cache */`;
                        },
                        base64: function (text: string, opts: { path: string; type: string }) {
                            if (!opts || !opts.path) throw new Error('Filter :base64 requires path="..."');

                            const fileBuffer = fs.readFileSync(opts.path);
                            const base64String = fileBuffer.toString('base64');

                            let mimeType = opts.type;
                            if (!mimeType) throw new Error('Filter :base64 requires (Mime type) type="..."');

                            const dataUri = `data:${mimeType};base64,${base64String}`;
                            return text.replaceAll('<BASE64_PLACEHOLDER>', dataUri);
                        }
                    }
                });
                file.contents = Buffer.from(compiled);
            } catch (err: any) {
                console.error('Pug Error:', err.toString());
            }

            callback(null, file);
        }
    }))
    .pipe(rename({ extname: '.js' }))
    .pipe(gulp.dest(() => outputDir)); // Dynamically resolves destination folder

// Helper task to switch output to production dist/views
const setProdEnv = (done: () => void) => {
    outputDir = 'dist/views';
    done();
};

// Main pipelines
const corePipeline = gulp.series(gulp.parallel(styles, scripts), templates);

const watchFiles = (done: () => void) => {
    gulp.watch(['frontend/**/*', '!frontend/dist/**/*'], corePipeline);
    done();
};

// Public task exports
export const build = gulp.series(setProdEnv, corePipeline);
export const watch = gulp.series(corePipeline, watchFiles);
export default build;
