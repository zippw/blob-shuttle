import { BaseForm } from "./base";
import { updateActiveForm } from "../main";
import { setQueryParam, delay, setProgress, changeBtnContent } from "../utils";
import { AuthService } from "../AuthService";
import ShareInvite from "../components/ShareInvite";
import ClientApi from "../ClientApi";
import FileInput from "../components/FileInput";
import { ApiError } from "../../../src/shared/ApiError";
import { MAX_FILE_COUNT, MAX_FILE_SIZE } from "../../../src/shared/constants";

export default class CreateForm extends BaseForm {
    private readonly uploadFileBtn: HTMLButtonElement;
    private readonly formErrorEl: HTMLElement;

    input: FileInput;

    constructor() {
        super();

        this.formEl = document.getElementById('create') as HTMLFormElement;
        this.uploadFileBtn = document.getElementById('upload_files_btn') as HTMLButtonElement;
        this.formErrorEl = this.formEl.querySelector('small.error');

        this.input = new FileInput(
            document.getElementById('files_input'),
            document.getElementById('files_dropzone'), {
            maxFileSize: MAX_FILE_SIZE,
            maxFileCount: MAX_FILE_COUNT,
            onFileDragging: () => { updateActiveForm(); },
            onFileChange: () => { updateActiveForm(); },
            onFileChosen: () => {
                // switching input styles depending on whether files are selected or not
                this.formEl.classList.toggle('chosen', this.input.inputValidation.hasFiles);
                this.updateFormState();
            }
        });

        console.log('[CreateForm] Components mapped successfully. Initializing core layout hooks...');

        // init
        this.bind();
        this.updateFormState();
    }

    // base methods

    public get ac(): Record<string, boolean> {
        const active = document.activeElement;

        const hasFocusedEls =
            (active instanceof HTMLButtonElement && active === this.uploadFileBtn) ||
            (active instanceof HTMLInputElement && active === this.input.inputEl && active.matches(':focus-visible'));

        return {
            hasFocusedEls,
            hasFilesChosen: this.input.inputValidation.hasFiles,
            isBusy: this.isBusy,
            isDraggingFiles: this.input.isDraggingFiles,
        };
    }

    protected onStateUpdate(): void {
        console.debug(`[CreateForm] updating upload UI states. isBusy=${this._isBusy}, valid=${this.input.inputValidation.ok}`);

        this.uploadFileBtn.disabled = this._isBusy || !this.input.inputValidation.ok;
        this.input.inputEl.disabled = this._isBusy;
    }


    /* main events */
    protected bind(): void {
        this.formEl.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    private async handleFormSubmit(e: Event): Promise<void> {
        e.preventDefault();
        this.isBusy = true; // auto input/button block
        updateActiveForm(); // all above affects priority

        console.log(`[CreateForm] Initiating upload pipeline for Vault context: ${ShareInvite.current_vault_id || 'NEW_VAULT'}`);
        // /create-vault request with an empty vault_id generates and returns a new vault_id.
        const vaultIdValidated = await this.uploadFiles(ShareInvite.current_vault_id);

        if (vaultIdValidated && typeof vaultIdValidated === 'string') {
            ShareInvite.current_vault_id = vaultIdValidated;
            await delay(1000);

            await changeBtnContent(this.uploadFileBtn, `Uploaded to ${vaultIdValidated}`);

            document.dispatchEvent(new CustomEvent('vault:uploaded', { detail: { vault_id: vaultIdValidated } }));
            updateActiveForm();
        }

        await delay(1000);

        this.formEl.reset();
        this.formEl.classList.remove('chosen');
        this.input.clear();

        this.isBusy = false; // Gracefully unlocks form bindings and constraints
        updateActiveForm();
        await changeBtnContent(this.uploadFileBtn, 'Upload');
    }


    private async transmitBinariesToS3(urls: Record<string, string>, total_bytes: number): Promise<void> {
        console.log(`[CreateForm] Opening ${this.input.filesChosen.length} concurrent pipeline streams to S3.`);
        const loaded_bytes = new Array(this.input.filesChosen.length).fill(0);

        await Promise.all(this.input.filesChosen.map((file, i): Promise<void> => {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.onprogress = (e) => {
                    if (!e.lengthComputable) return;
                    loaded_bytes[i] = e.loaded;
                    const perc = loaded_bytes.reduce((acc, x) => acc + x, 0) / total_bytes;
                    setProgress(perc);
                };

                xhr.open('PUT', urls[file.name]);
                xhr.setRequestHeader('Content-Type', file.type);

                xhr.onload = () => {
                    loaded_bytes[i] = xhr.status === 200 ? file.size : 0;
                    if (xhr.status === 200) {
                        console.debug(`[CreateForm] Chunk stream transfer complete for: ${file.name}`);
                        resolve();
                    } else {
                        reject(new Error(`S3 rejected ${file.name} transmission with status: ${xhr.status}`));
                    }
                };

                xhr.onerror = () => {
                    loaded_bytes[i] = 0;
                    reject(new Error(`Network layer exception during transmission of ${file.name}`));
                };

                xhr.send(file);
            });
        }));
    }

    private async uploadFiles(vault_id?: string): Promise<string | null> {
        try {
            this.formEl.classList.remove('error')

            await changeBtnContent(this.uploadFileBtn, 'Verifying...');

            // Method Split 1: Metadata resolution
            const { url, vault_id: finalVaultId } = await ClientApi.createVault({
                vault_id, auth: AuthService.auth,
                files: this.input.filesChosen.map(({ name, size }) => ({ name, size }))
            });
            console.log(`[CreateForm] Manifest successfully locked for target Vault: ${finalVaultId}`);

            // Safety Warning Logic: Inspecting pre-signed URL expiration threshold from first item
            const sampleUrl = Object.values(url)[0];
            if (sampleUrl) {
                const urlObj = new URL(sampleUrl);
                const expiresSec = Number(urlObj.searchParams.get('X-Amz-Expires') || 0);

                if (expiresSec > 0 && expiresSec < 60) {
                    console.warn(`[CreateForm] CRITICAL: Pre-signed signature life cycle is under 1 minute (${expiresSec}s). Network congestion might drop connections.`);
                }
            }

            await changeBtnContent(this.uploadFileBtn, 'Uploading... <div class="progress-ring"></div>');
            setProgress(0);
            await delay(1000);

            const total_bytes = this.input.filesChosen.reduce((acc, x) => acc + x.size, 0);

            // Method Split 2: Binary chunk upload trigger
            await this.transmitBinariesToS3(url, total_bytes);

            console.log(`[CreateForm] All streams flushed. Total execution batch pipeline closed safely.`);
            return finalVaultId;
        } catch (error) {
            updateActiveForm();
            await changeBtnContent(this.uploadFileBtn, 'Error');

            this.formEl.classList.add('error');
            if (error instanceof ApiError) {
                this.formErrorEl.innerText = error.error;
                console.error(error.details);
                return null;
            }

            this.formErrorEl.innerText = 'Unexpected Error';
            console.error(error);
            return null;
        }
    }
}











// import { BaseForm } from "./base";
// import { updateActiveForm } from "../main";
// import { setQueryParam, delay, setProgress, changeBtnContent } from "../utils";
// import { AuthService, ShareInvite } from "../AuthService";
// import ClientApi from "../ClientApi";

// export default class CreateForm extends BaseForm {
//     private readonly dropzone: HTMLLabelElement;
//     private readonly uploadFileBtn: HTMLButtonElement;
//     private readonly filesInput: HTMLInputElement;
//     private readonly labelH1El: HTMLElement;
//     private readonly labelH2El: HTMLElement;
//     private readonly maxFileSize: number;
//     private readonly maxFileCount: number;

//     private readonly labelContents: readonly [string, string];
//     private _isDraggingFiles: boolean = false;
//     private _filesChosen: File[] = [];

//     constructor() {
//         super();

//         this.formEl = document.getElementById('create') as HTMLFormElement;
//         this.dropzone = document.getElementById('file_dropzone') as HTMLLabelElement;
//         this.uploadFileBtn = document.getElementById('upload_files_btn') as HTMLButtonElement;
//         this.filesInput = document.getElementById('files_input') as HTMLInputElement;
//         this.labelH1El = this.formEl.querySelector('h1') as HTMLElement;
//         this.labelH2El = this.formEl.querySelector('h2') as HTMLElement;

//         // reading injected validations
//         this.maxFileSize = Number(this.filesInput.getAttribute('data-max-file-size'));
//         this.maxFileCount = Number(this.filesInput.getAttribute('data-max-file-count'));

//         // caching default state inner text
//         this.labelContents = Object.freeze([
//             this.labelH1El.innerHTML,
//             this.labelH2El.innerHTML
//         ]);

//         console.log('[CreateForm] Components mapped successfully. Initializing core layout hooks...');

//         // init
//         this.bind();
//         this.updateFormState();
//     }

//     // base methods

//     public get ac(): Record<string, boolean> {
//         const active = document.activeElement;

//         const hasFocusedEls =
//             (active instanceof HTMLButtonElement && active === this.uploadFileBtn) ||
//             (active instanceof HTMLInputElement && active === this.filesInput && active.matches(':focus-visible'));

//         return {
//             hasFocusedEls,
//             hasFilesChosen: this.inputValidation.hasFiles,
//             isBusy: this.isBusy,
//             isDraggingFiles: this._isDraggingFiles
//         };
//     }

//     protected onStateUpdate(): void {
//         console.debug(`[CreateForm] updating upload UI states. isBusy=${this._isBusy}, valid=${this.inputValidation.ok}`);

//         this.uploadFileBtn.disabled = this._isBusy || !this.inputValidation.ok;
//         this.filesInput.disabled = this._isBusy;
//     }





//     /* main events */
//     protected bind(): void {
//         // prevent default browser activities  across viewport
//         ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
//             this.dropzone.addEventListener(eventName, (e) => e.preventDefault(), false);
//             document.body.addEventListener(eventName, (e) => e.preventDefault(), false);
//         });

//         ['dragenter', 'dragover'].forEach(eventName => {
//             this.dropzone.addEventListener(eventName, () => this.isDraggingFiles = true, false);
//         });

//         ['dragleave', 'drop'].forEach(eventName => {
//             this.dropzone.addEventListener(eventName, () => this.isDraggingFiles = false, false);
//         });

//         this.dropzone.addEventListener('drop', (e: DragEvent) => this.handleFileDrop(e));
//         this.filesInput.addEventListener('cancel', () => this.filesInput.dispatchEvent(new Event('change')));
//         this.filesInput.addEventListener('change', () => this.handleFileSelectionChange());
//         this.formEl.addEventListener('submit', (e) => this.handleFormSubmit(e));
//     }


//     private handleFileDrop(e: DragEvent): void {
//         const dt = e.dataTransfer;
//         if (!dt || !dt.files.length) return;

//         console.log(`[CreateForm] Batch files dropped: ${dt.files.length} items detected.`);
//         this.filesInput.files = dt.files;
//         this.filesInput.dispatchEvent(new Event('change'));
//     }

//     private handleFileSelectionChange(): void {
//         this.filesChosen = this.filesInput.files || [];
//         this.filesInput.value = ''; // allow identical re-selections

//         if (!this.inputValidation.hasFiles) this.filesInput.blur();
//         updateActiveForm(); // all above affects priority
//     }

//     private async handleFormSubmit(e: Event): Promise<void> {
//         e.preventDefault();
//         this.isBusy = true; // auto input/button block
//         updateActiveForm(); // all above affects priority

//         console.log(`[CreateForm] Initiating upload pipeline for Vault context: ${ShareInvite.current_vault_id || 'NEW_VAULT'}`);
//         // /create-vault request with an empty vault_id generates and returns a new vault_id.
//         const vaultIdValidated = await this.uploadFiles(ShareInvite.current_vault_id);

//         if (vaultIdValidated && typeof vaultIdValidated === 'string') {
//             ShareInvite.current_vault_id = vaultIdValidated;
//             await delay(1000);

//             setQueryParam('vault_id', vaultIdValidated);
//             await changeBtnContent(this.uploadFileBtn, `Uploaded to ${vaultIdValidated}`);

//             document.dispatchEvent(new CustomEvent('vault:uploaded', { detail: { vault_id: vaultIdValidated } }));
//             updateActiveForm();
//         }

//         await delay(1000);

//         this.formEl.reset();
//         this.formEl.classList.remove('chosen');
//         this.filesChosen = [];

//         this.isBusy = false; // Gracefully unlocks form bindings and constraints
//         updateActiveForm();
//         await changeBtnContent(this.uploadFileBtn, 'Upload');
//     }






//     private async transmitBinariesToS3(urls: Record<string, string>, total_bytes: number): Promise<void> {
//         console.log(`[CreateForm] Opening ${this.filesChosen.length} concurrent pipeline streams to S3.`);
//         const loaded_bytes = new Array(this.filesChosen.length).fill(0);

//         await Promise.all(this.filesChosen.map((file, i): Promise<void> => {
//             return new Promise((resolve, reject) => {
//                 const xhr = new XMLHttpRequest();

//                 xhr.upload.onprogress = (e) => {
//                     if (!e.lengthComputable) return;
//                     loaded_bytes[i] = e.loaded;
//                     const perc = loaded_bytes.reduce((acc, x) => acc + x, 0) / total_bytes;
//                     setProgress(perc);
//                 };

//                 xhr.open('PUT', urls[file.name]);
//                 xhr.setRequestHeader('Content-Type', file.type);

//                 xhr.onload = () => {
//                     loaded_bytes[i] = xhr.status === 200 ? file.size : 0;
//                     if (xhr.status === 200) {
//                         console.debug(`[CreateForm] Chunk stream transfer complete for: ${file.name}`);
//                         resolve();
//                     } else {
//                         reject(new Error(`S3 rejected ${file.name} transmission with status: ${xhr.status}`));
//                     }
//                 };

//                 xhr.onerror = () => {
//                     loaded_bytes[i] = 0;
//                     reject(new Error(`Network layer exception during transmission of ${file.name}`));
//                 };

//                 xhr.send(file);
//             });
//         }));
//     }

//     // Private Step 3: Core orchestrator matching the 3-method split structure
//     private async uploadFiles(vault_id?: string): Promise<string | null> {
//         try {
//             if (!this.inputValidation.hasFiles) throw new Error('No files chosen');

//             await changeBtnContent(this.uploadFileBtn, 'Verifying...');

//             // Method Split 1: Metadata resolution
//             const { url, vault_id: finalVaultId } = await ClientApi.createVault({
//                 vault_id, auth: AuthService.auth,
//                 files: this.filesChosen.map(({ name, size }) => ({ name, size }))
//             });
//             console.log(`[CreateForm] Manifest successfully locked for target Vault: ${finalVaultId}`);

//             // Safety Warning Logic: Inspecting pre-signed URL expiration threshold from first item
//             const sampleUrl = Object.values(url)[0];
//             if (sampleUrl) {
//                 const urlObj = new URL(sampleUrl);
//                 const expiresSec = Number(urlObj.searchParams.get('X-Amz-Expires') || 0);

//                 if (expiresSec > 0 && expiresSec < 60) {
//                     console.warn(`[CreateForm] CRITICAL: Pre-signed signature life cycle is under 1 minute (${expiresSec}s). Network congestion might drop connections.`);
//                 }
//             }

//             await changeBtnContent(this.uploadFileBtn, 'Uploading... <div class="progress-ring"></div>');
//             setProgress(0);
//             await delay(1000);

//             const total_bytes = this.filesChosen.reduce((acc, x) => acc + x.size, 0);

//             // Method Split 2: Binary chunk upload trigger
//             await this.transmitBinariesToS3(url, total_bytes);

//             console.log(`[CreateForm] All streams flushed. Total execution batch pipeline closed safely.`);
//             return finalVaultId;

//         } catch (error) {
//             const err = error instanceof Error ? error.message : String(error);
//             console.error(`[CreateForm] Upload routine rejected:`, err);

//             updateActiveForm();
//             await changeBtnContent(this.uploadFileBtn, 'Error');
//             return null;
//         }
//     }





//     /* main validation methods */
//     private get inputValidation() {
//         const isOverSize = this._filesChosen.find(file => file.size > this.maxFileSize);
//         const chosenTooManyFiles = this._filesChosen.length > this.maxFileCount;
//         const hasFiles = this._filesChosen.length > 0;

//         return {
//             isOverSize, chosenTooManyFiles, hasFiles,
//             ok: !isOverSize && !chosenTooManyFiles && hasFiles
//         };
//     }

//     private set isDraggingFiles(val: boolean) {
//         if (val !== this._isDraggingFiles) {
//             this.dropzone.classList.toggle('drop-zone--hover', val);
//             this._isDraggingFiles = val;
//             updateActiveForm();
//         }
//     }


//     /* main FileList processing */
//     private get filesChosen(): File[] { return this._filesChosen; }

//     private set filesChosen(files: FileList | File[]) {
//         this._filesChosen = files instanceof FileList ? Array.from(files) : files;

//         // switching input styles depending on whether files are selected or not
//         this.formEl.classList.toggle('chosen', this.inputValidation.hasFiles);

//         if (this.inputValidation.hasFiles) {
//             this.labelH1El.innerHTML = this.inputValidation.ok ? 'Files successfully added' : 'File validation failed';

//             const tooManyClass = this.inputValidation.chosenTooManyFiles ? ' class="error"' : '';
//             const filePlural = this.filesChosen.length > 1 ? 's' : '';
//             const overSizeError = this.inputValidation.isOverSize ? ` <span class="error">${this.inputValidation.isOverSize.name} is too big</span>.` : '';

//             this.labelH2El.innerHTML = `<span${tooManyClass}>${this.filesChosen.length} / ${this.maxFileCount}</span> file${filePlural} chosen.${overSizeError}`;
//         } else {
//             // reset to default state values
//             this.labelH1El.innerHTML = this.labelContents[0];
//             this.labelH2El.innerHTML = this.labelContents[1];
//         }

//         this.updateFormState();
//     }
// }


