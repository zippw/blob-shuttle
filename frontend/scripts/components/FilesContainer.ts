import { RevealVaultResult } from "#shared/schema.js";
import { formatBytes } from "@shared/utils";
import { escapeHtml } from "../utils/dom";
import { changeBtnContent } from "./btn-content-transition";
import { setProgress } from "./progress-ring";
import { downloadZip } from "client-zip";
import { delay } from "../utils/time";

declare function getClass(filename: string, options?: any): Promise<string | null>;

export default class FilesContainer {
    public readonly el: HTMLElement;
    private readonly grid: HTMLElement;
    private readonly panel: {
        download_all: HTMLButtonElement;
        search_input: HTMLInputElement;
        sort_select: HTMLSelectElement;
        layout_type: NodeListOf<HTMLInputElement>;
    };

    private _files: RevealVaultResult;
    private readonly settings: {
        filters: { name?: RegExp },
        sort: { by: string, order: string },
        layout: { type: string }
    } = {
            filters: {},
            sort: { by: 'fn', order: 'asc' },
            layout: { type: 'grid' }
        }

    constructor() {
        this.el = document.getElementById('files_container') as HTMLElement;
        this.grid = document.getElementById('files_container_grid') as HTMLElement;

        this.panel = {
            download_all: document.getElementById('files_download_all') as HTMLButtonElement,
            search_input: document.getElementById('files_search') as HTMLInputElement,
            sort_select: document.getElementById('files_sortby') as HTMLSelectElement,
            layout_type: document.querySelectorAll('.radio .radio-input input[name="files_layout"]')
        }

        this.panel.sort_select.value = `${this.settings.sort.by}_${this.settings.sort.order}`;
        this.panel.layout_type.forEach(radio => {
            radio.checked = radio.id === `files_fl_${this.settings.layout.type}`;
        });
        this.changeGridLayout();

        this.bind();
    }

    private bind() {
        this.panel.download_all.addEventListener('click', async () => {
            const files = this.applyFilters(this._files);

            this.panel.download_all.disabled = true;
            changeBtnContent(this.panel.download_all, 'Packing... <div id="download_btn_progress_ring" class="progress-ring"></div>')
            setProgress(0, 'download_btn_progress_ring');

            await delay(1000);

            let loaded = 0;
            const total = files.length;

            const filePromises = files.map(async (file) => {
                const response = await fetch(file.url);

                loaded++;
                console.log(loaded / total)
                setProgress(loaded / total, 'download_btn_progress_ring');

                return response;
            });

            const responses = await Promise.all(filePromises);
            const blob = await downloadZip(responses).blob();

            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "files.zip";
            link.click();
            link.remove();

            changeBtnContent(this.panel.download_all, 'Downloading...')
        });

        this.panel.search_input.addEventListener('input', async () => {
            const val = this.panel.search_input.value;
            this.settings.filters.name = (!val || val === '') ? undefined : new RegExp(val, 'i');

            this.render();
        });

        this.panel.sort_select.addEventListener('change', () => {
            const val = this.panel.sort_select.value;
            const [by, order] = val.split('_');
            this.settings.sort = { by, order };

            this.render();
        });

        this.panel.layout_type.forEach(radio => radio.addEventListener('change', () => {
            const type = radio.id.replace('files_fl_', '');
            this.settings.layout.type = type;
            this.changeGridLayout();
        }))
    }

    private changeGridLayout() {
        this.panel.layout_type.forEach(radio => {
            const type = radio.id.replace('files_fl_', '');
            this.grid.classList.toggle(`--${type}`, radio.checked);
        });
    }

    private async render() {
        if (!this._files) return;
        const total_len = this._files.length;

        this.grid.innerHTML = '';

        const files = this.applyFilters(this._files);
        this.panel.download_all.disabled = !files.length;
        const newBtnContent = files.length === total_len
            ? `Download all (${total_len})`
            : `Download ${files.length} / ${total_len}`;

        changeBtnContent(this.panel.download_all, newBtnContent);

        this.grid.innerHTML = await this.renderFiles(files);
    }

    private applyFilters(files: RevealVaultResult): RevealVaultResult {
        if (this.settings.filters.name) files = files.filter(f => this.settings.filters.name.test(f.name));
        if (this.settings.sort) {
            switch (this.settings.sort.by) {
                case 'fn': files = files.sort((a, b) => {
                    const nameA = a.name.toUpperCase();
                    const nameB = b.name.toUpperCase();
                    if (nameA < nameB) return this.settings.sort.order === 'des' ? 1 : -1;
                    if (nameA > nameB) return this.settings.sort.order === 'des' ? -1 : 1;
                    return 0;
                }); break;

                case 'fs': files = files.sort((a, b) => {
                    if (this.settings.sort.order === 'des') return b.size - a.size;
                    return a.size - b.size
                }); break;

                default: break;
            }
        }

        return files;
    }

    private async renderFiles(files: RevealVaultResult) {
        const cardPromises = files.map(async (file: { url: string; name: string; size: number }, i) => {
            const iconClass = await getClass(file.name, { color: true }) || 'default-icon';

            const filenameHtml = this.settings.filters.name
                ? file.name.replace(this.settings.filters.name, '<strong>$&</strong>')
                : escapeHtml(file.name);

            return `<a class="file" data-ui-group="reveal-form-files" href="${file.url}" target="_blank" download="${file.name}" style="--i:${i}">
                        <div class="name">
                            <span class="file-icon ${iconClass}"></span>
                            <span class="filename">${filenameHtml}</span>
                        </div>
                        <div class="size">${formatBytes(file.size, 1)}</div>
                    </a>`;
        });

        const allCardsHtmlArray = await Promise.all(cardPromises);
        return allCardsHtmlArray.join('');
    }

    public set files(files: RevealVaultResult) {
        this._files = files;
        this.render();
    }
}