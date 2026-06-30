import { updateActiveForm } from "../main";
import { formatBytes, setQueryParam } from "../utils";
import { delay } from "../utils";
import { BaseForm } from "./base";
import { AuthService } from "../AuthService";

export default class CreateForm extends BaseForm {
    private readonly dropzone = document.getElementById('file_dropzone') as HTMLLabelElement;
    private readonly uploadFileBtn = document.getElementById('upload_files_btn') as HTMLButtonElement;
    private readonly filesInput = document.getElementById('files_input') as HTMLInputElement;
    private readonly formEl = document.getElementById('create') as HTMLFormElement;
    private readonly labelH1El = this.formEl.querySelector('h1') as HTMLElement;
    private readonly labelH2El = this.formEl.querySelector('h2') as HTMLElement;
    private readonly maxTotalFileSize = Number(this.labelH2El.querySelector('span[data-bytes]').getAttribute('data-bytes'));

    private readonly labelContents: readonly [string, string] = Object.freeze([
        this.labelH1El.innerHTML,
        this.labelH2El.innerHTML
    ]);

    private isBusy: boolean;
    private _isDraggingFiles: boolean;
    private _filesChosen: File[];

    constructor() {
        super();

        this.filesChosen = [];
        this.bind();
    }

    public get ac() {
        let hasFocusedEls = false;
        if (document.activeElement instanceof HTMLButtonElement && document.activeElement === this.uploadFileBtn) hasFocusedEls = true;
        if (document.activeElement instanceof HTMLInputElement && document.activeElement === this.filesInput
            && document.activeElement.matches(':focus-visible')
        ) hasFocusedEls = true;

        return {
            hasFocusedEls, hasFilesChosen: this.hasFiles, isBusy: this.isBusy,
            isDraggingFiles: this._isDraggingFiles
        }
    }

    public disableForm(toDisable: boolean = true) {
        const isOverSize = this.filesTotalSize > this.maxTotalFileSize;
        const btnShowConditions = !this.hasFiles || isOverSize;

        this.uploadFileBtn.disabled = btnShowConditions || toDisable;
        this.filesInput.disabled = toDisable;
    }

    public get hasFiles(): boolean {
        return this.filesChosen.length > 0;
    }

    private set isDraggingFiles(val: boolean) {
        if (val !== this._isDraggingFiles) {
            this.dropzone.classList.toggle('drop-zone--hover', val);
            this._isDraggingFiles = val;
            updateActiveForm();
        }
    }

    private get filesTotalSize(): number {
        return this.filesChosen.reduce((acc, x) => acc + x.size, 0);
    }

    private bind() {
        // prohibit throwing files past
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.dropzone.addEventListener(eventName, (e) => e.preventDefault(), false);
            document.body.addEventListener(eventName, (e) => e.preventDefault(), false);
        });

        ['dragenter', 'dragover'].forEach(eventName => this.dropzone.addEventListener(eventName, () => { this.isDraggingFiles = true; }, false));
        ['dragleave', 'drop'].forEach(eventName => this.dropzone.addEventListener(eventName, () => { this.isDraggingFiles = false; }, false));

        this.dropzone.addEventListener('drop', (e: DragEvent) => {
            const dt = e.dataTransfer;
            if (!dt || !dt.files.length) return;

            this.filesInput.files = dt.files;
            this.filesInput.dispatchEvent(new Event('change'));
        });

        this.filesInput.addEventListener('cancel', () => this.filesInput.dispatchEvent(new Event('change')));

        this.filesInput.addEventListener('change', async () => {
            this.filesChosen = this.filesInput.files;
            this.filesInput.value = ''; // in case of choosing same file

            const isOverSize = this.filesTotalSize > this.maxTotalFileSize;
            this.uploadFileBtn.disabled = this.uploadFileBtn.disabled || isOverSize;

            if (!this.hasFiles) {
                this.filesInput.blur();
            } else this.uploadFileBtn.focus();

            updateActiveForm(); // all above affects priority

        });

        let lastReturnedVaultID = null;
        this.formEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            this.disableForm(true);
            this.isBusy = true;
            updateActiveForm(); // all above affects priority

            const urlParams = new URLSearchParams(window.location.search);

            let vault_id_client: string | undefined;
            if (urlParams.has('vault_id')) {
                const vid_value = String(urlParams.get('vault_id'));
                if (vid_value === lastReturnedVaultID) vault_id_client = vid_value; // allows only auto-generated Vault IDs
            }
            console.debug(`Got ${vault_id_client} from query`);

            const vault_id_validated = await this.uploadFiles(vault_id_client);
            if (vault_id_validated && typeof vault_id_validated === 'string') {
                lastReturnedVaultID = vault_id_validated;
                await delay(1000);

                setQueryParam('vault_id', vault_id_validated);
                await changeBtnContent(this.uploadFileBtn, `Uploaded to ${vault_id_validated}`);
                updateActiveForm();
            }

            await delay(1000);

            this.formEl.reset();
            this.formEl.classList.remove('chosen');

            this.filesInput.disabled = false;
            this.uploadFileBtn.disabled = true; // btn is hidden from tabindex due to empty File[]
            this.isBusy = false;
            this.filesChosen = [];
            updateActiveForm();
            await changeBtnContent(this.uploadFileBtn, `Upload`)
        });
    }

    private async uploadFiles(vault_id?: string | undefined): Promise<string | null> {

        try {
            if (!this.hasFiles) throw new Error('no files chosen');

            await changeBtnContent(this.uploadFileBtn, 'Verifying...');
            const r = await fetch(window.location.pathname + '?path=create-vault', {
                method: 'POST',
                body: JSON.stringify({
                    passcode: AuthService.passcode,
                    vault_id, files: this.filesChosen.map(x => x.name)
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (!r.ok) throw new Error(await r.text());
            const res = await r.json();
            const { url } = res;
            vault_id = res.vault_id;

            await changeBtnContent(this.uploadFileBtn, 'Uploading... <div class="progress-ring"></div>');
            const progress_el = this.uploadFileBtn.querySelector('.progress-ring') as HTMLElement;
            setProgress(progress_el, 0);
            await delay(1000);

            let loaded_bytes = new Array(this.filesChosen.length).fill(0);
            const total_bytes = this.filesChosen.reduce((acc, x) => acc + x.size, 0);
            await Promise.all(this.filesChosen.map((file, i): Promise<void> => {
                return new Promise((res, rej) => {
                    const xhr = new XMLHttpRequest();

                    xhr.upload.onprogress = (e) => {
                        if (!e.lengthComputable) return;

                        loaded_bytes[i] = e.loaded;
                        const perc = loaded_bytes.reduce((acc, x) => acc + x, 0) / total_bytes;
                        setProgress(progress_el, perc);
                    };

                    xhr.open('PUT', url[file.name]);
                    xhr.setRequestHeader('Content-Type', file.type);

                    xhr.onload = () => {
                        loaded_bytes[i] = xhr.status === 200 ? file.size : 0;
                        xhr.status === 200 ? res() : rej();
                    }
                    xhr.onerror = () => { loaded_bytes[i] = 0; rej(); }

                    xhr.send(file);
                })
            }));

            return vault_id;
        } catch (error) {
            updateActiveForm();
            await changeBtnContent(this.uploadFileBtn, 'Error');
            this.disableForm(false);
            console.error(error);
            return null
        }
    }

    private set filesChosen(files: FileList | File[]) {
        this._filesChosen = files instanceof FileList ? Array.from(files) : files;

        this.formEl.classList.toggle('chosen', this.hasFiles);
        if (this.hasFiles) {
            this.labelH1El.innerHTML = 'Files successfully added';

            const isOverSize = this.filesTotalSize > this.maxTotalFileSize;

            this.labelH2El.innerHTML =
                `${this.filesChosen.length} file${this.filesChosen.length > 1 ? 's' : ''} chosen. `
                + `Total size: <span${isOverSize ? ` class="oversize"` : ''}> ${formatBytes(this.filesTotalSize, 1)} / ${formatBytes(this.maxTotalFileSize, 1)}</span>`;
        } else {
            this.labelH1El.innerHTML = this.labelContents[0];
            this.labelH2El.innerHTML = this.labelContents[1];
        }

        console.log(this.uploadFileBtn, this.hasFiles)
        this.uploadFileBtn.disabled = !this.hasFiles;
    }

    private get filesChosen(): File[] {
        return this._filesChosen
    }
}






async function changeBtnContent(
    btn: HTMLButtonElement,
    content = 'new content',
    duration = 400
) {
    const oldSpan = btn.querySelector('.content-old') as HTMLElement;
    const newSpan = btn.querySelector('.content-new') as HTMLElement;

    if (!oldSpan || !newSpan) return;

    btn.setAttribute('data-content-transition', '');

    const startRect = oldSpan.getBoundingClientRect();
    oldSpan.style.width = `${startRect.width}px`;
    oldSpan.style.height = `${startRect.height}px`;

    newSpan.innerHTML = content;
    const { width, height } = newSpan.getBoundingClientRect();

    oldSpan.style.transitionDuration = `${duration}ms`;

    oldSpan.offsetHeight;
    btn.classList.add('is-animating');

    oldSpan.style.width = `${width}px`;
    oldSpan.style.height = `${height}px`;

    await new Promise(resolve => setTimeout(resolve, duration));

    oldSpan.innerHTML = content;

    btn.classList.remove('is-animating');
    oldSpan.style.cssText = '';
    newSpan.innerHTML = '';
}


function setProgress(ringElement: HTMLElement, percent: number) {
    if (!ringElement) return;
    const validatedPercent = Math.max(0, Math.min(1, percent));
    ringElement.style.setProperty('--prog', `${validatedPercent * 360}deg`);
}