import { BaseForm } from "./base";
import { updateActiveForm } from "../main";
import { delay } from "../utils/time";
import { setProgress } from "../components/progress-ring";
import { changeBtnContent } from "../components/btn-content-transition";

import { AuthService } from "../AuthService";
import ShareInvite from "./ShareInvite";
import ClientApi from "../ClientApi";
import FileInput from "../components/FileInput";
import { ApiError } from "@shared/ApiError";
import cfg from '@config/config';
import { validateMimeType } from "@shared/validators";
import UIGroup from "../components/UIGroup";

export default class CreateForm extends BaseForm {
    private readonly uploadFileBtn: HTMLButtonElement;
    private readonly formErrorEl: HTMLElement;

    private uiGroup: UIGroup;

    public input: FileInput;

    constructor() {
        super();

        this.formEl = document.getElementById('create') as HTMLFormElement;
        this.uploadFileBtn = document.getElementById('upload_files_btn') as HTMLButtonElement;
        this.formErrorEl = this.formEl.querySelector('small.error');

        this.input = new FileInput(
            document.getElementById('files_input'),
            document.getElementById('files_dropzone'), {
            maxFileSize: cfg.options.maxFileSize,
            maxFileCount: cfg.options.maxFileCountPerUpload,
            onFileDragging: () => { updateActiveForm(); },
            onFileChange: () => { updateActiveForm(); },
            onFileChosen: () => {
                // switching input styles depending on whether files are selected or not
                this.formEl.classList.toggle('chosen', this.input.inputValidation.hasFiles);
                this.updateFormState();
            }
        });

        this.uiGroup = new UIGroup('create-form');

        console.debug('[CreateForm] Components mapped successfully. Initializing core layout hooks...');

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

        this.uiGroup.disableAll(this._isBusy, {
            'create-form-upload-btn': this._isBusy || !this.input.inputValidation.ok
        });
    }


    /* main events */
    protected bind(): void {
        this.formEl.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    private async handleFormSubmit(e: Event): Promise<void> {
        e.preventDefault();
        this.isBusy = true; // auto input/button block
        updateActiveForm(); // all above affects priority

        console.debug(`[CreateForm] Initiating upload pipeline for Vault context: ${ShareInvite.current_vault_id || 'NEW_VAULT'}`);
        // /create-vault request with an empty vault_id generates and returns a new vault_id.
        console.log(ShareInvite.current_vault_id);
        const vaultIdValidated = await this.uploadFiles(ShareInvite.current_vault_id);

        if (vaultIdValidated && typeof vaultIdValidated === 'string') {
            ShareInvite.current_vault_id = vaultIdValidated;
            await delay(1000);

            await changeBtnContent(this.uploadFileBtn, `Uploaded.`);

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
        console.debug(`[CreateForm] Opening ${this.input.filesChosen.length} concurrent pipeline streams to S3.`);
        const loaded_bytes = new Array(this.input.filesChosen.length).fill(0);

        await Promise.all(this.input.filesChosen.map((file, i): Promise<void> => {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.onprogress = (e) => {
                    if (!e.lengthComputable) return;
                    loaded_bytes[i] = e.loaded;
                    const perc = loaded_bytes.reduce((acc, x) => acc + x, 0) / total_bytes;
                    setProgress(perc, 'upload_btn_progress_ring');
                };

                xhr.open('PUT', urls[file.name]);

                const mime = file.type || 'application/octet-stream';
                xhr.setRequestHeader('Content-Type', validateMimeType(mime));

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
                vault_id, auth: await AuthService.getAuth(),
                files: this.input.filesChosen.map(({ name, size }) => ({ name, size }))
            });
            console.debug(`[CreateForm] Manifest successfully locked for target vault_id=${finalVaultId}`);

            // Safety Warning Logic: Inspecting pre-signed URL expiration threshold from first item
            const sampleUrl = Object.values(url)[0];
            if (sampleUrl) {
                const urlObj = new URL(sampleUrl);
                const expiresSec = Number(urlObj.searchParams.get('X-Amz-Expires') || 0);

                if (expiresSec > 0 && expiresSec < 60) {
                    // TODO: notify
                    console.warn(`[CreateForm] CRITICAL: Pre-signed signature life cycle is under 1 minute (${expiresSec}s). Network congestion might drop connections.`);
                }
            }

            await changeBtnContent(this.uploadFileBtn, 'Uploading... <div id="upload_btn_progress_ring" class="progress-ring"></div>');
            setProgress(0, 'upload_btn_progress_ring');

            await delay(1000);

            const total_bytes = this.input.filesChosen.reduce((acc, x) => acc + x.size, 0);

            // Method Split 2: Binary chunk upload trigger
            await this.transmitBinariesToS3(url, total_bytes);

            console.debug(`[CreateForm] All streams flushed. Total execution batch pipeline closed safely.`);
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