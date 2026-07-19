// forms/RevealForm.ts
import { AuthService } from "../AuthService";
import ShareInvite from "../components/ShareInvite";
import { updateActiveForm } from "../main";
import { delay } from "../utils";
import { formatBytes } from "../../../src/shared/utils";
import { BaseForm } from "./base";

import PinCodeInput from "../components/PinCodeInput";

import { ApiError } from "../../../src/shared/ApiError";
import ClientApi from "../ClientApi";

import { } from '../../../src/shared/schema';
import { validateVaultId } from '../../../src/shared/validators';

declare function getClass(filename: string, options?: any): Promise<string | null>;

export default class RevealForm extends BaseForm {
    private readonly input: PinCodeInput;
    private readonly filesContainer: HTMLElement;
    private readonly errorEl: HTMLElement;
    private readonly pathEl: HTMLSpanElement;

    constructor() {
        super();

        this.input = new PinCodeInput(document.getElementById('vault_id_pincodeinput'), {
            length: 6,
            pattern: /^[a-zA-Z0-9]{1}$/,
            pastePattern: /(?<=\bvault-|\/|^)[a-zA-Z0-9]{6}(?=\b|\/)/,
            onComplete: (code) => { this.onFullFilled(code); }
        });

        this.formEl = document.getElementById('reveal') as HTMLFormElement;
        this.filesContainer = document.getElementById('files_container') as HTMLElement;
        this.pathEl = this.filesContainer.parentElement.querySelector('.nav #keypath') as HTMLSpanElement;
        this.errorEl = this.formEl.querySelector('small.error') as HTMLElement;

        console.debug('[RevealForm] Init');
        this.bind();
        if (ShareInvite.current_vault_id) this.autoFill();
    }

    public get ac() {
        const hasFocusedEls = document.activeElement instanceof HTMLInputElement
            && this.input.isFocused

        return {
            hasFocusedEls,
            hasFileListRendered: this.isExpanded,
            isBusy: this.isBusy
        };
    }

    private get isExpanded(): boolean {
        return this.filesContainer.parentElement.classList.contains('expanded');
    }


    public autoFill() {
        // tries getting vault_id from the DOM data attribute (rendered by server) first, then fallback to memory
        const targetVaultId = ShareInvite.current_vault_id

        try {
            const vault_id = validateVaultId(targetVaultId);
            console.debug(`[RevealForm] auto-filling inputs with vault_id: ${vault_id}`);
            this.input.value = vault_id;
        } catch (error) {
            console.debug(`[RevealForm] autoFill skipped. Reason: invalid or empty vault_id context.`);
        }
    }

    protected onStateUpdate(): void {
        console.debug(`[RevealForm] updating layout state. isBusy=${this._isBusy}`);
        this.input.disabled = this._isBusy || this.isExpanded;
    }

    public bind() {
        document.addEventListener('vault:uploaded', async (e: Event) => {
            const { vault_id } = (e as CustomEvent).detail;
            console.debug(`[RevealForm] vault:uploaded vault_id=${vault_id}`);
            try {
                // this.formEl.reset();
                this.onFullFilled(vault_id);
            } catch (error) {
                console.warn(`[RevealForm] Ignored vault:uploaded event due to validation failure.`);
            }
        });
    }


    private async onFullFilled(vault_id: string) {
        console.debug(`[RevealForm] Full code entered. Requesting S3 file list for vault=${vault_id}`);

        this.isBusy = true; // all lines above affects priority
        // this.filesContainer.parentElement.classList.remove('expanded');
        this.formEl.classList.remove('error');
        updateActiveForm();

        try {
            const files = await ClientApi.revealVault({ vault_id, auth: await AuthService.getAuth() });
            console.debug(`[RevealForm] Successfully received ${files.length} links from S3.`);

            this.filesContainer.innerHTML = '';
            const cardPromises = files.map(async (file: { url: string; name: string; size: number }) => {
                const iconClass = await getClass(file.name, { color: true }) || 'default-icon';

                return `<a class="file" href="${file.url}" target="_blank" download="${file.name}">
                    <div class="name">
                        <span class="file-icon ${iconClass}"></span>
                        <span>${file.name}</span>
                    </div>
                    <div class="size">${formatBytes(file.size, 1)}</div>
                </a>`;
            });

            const allCardsHtmlArray = await Promise.all(cardPromises);
            this.filesContainer.innerHTML = allCardsHtmlArray.join('');

            ShareInvite.current_vault_id = vault_id;
            this.pathEl.innerText = `Vault ID: ${vault_id}`;
            this.filesContainer.parentElement.classList.add('expanded');
        } catch (error) {
            console.error(error);

            if (error instanceof ApiError) {
                this.errorEl.textContent = error.error;
            } else this.errorEl.textContent = 'Unexpected Error';

            this.formEl.classList.add('error');
            await delay(400);

            this.formEl.reset();
            this.isBusy = false;
            this.input.focus();
        } finally {
            updateActiveForm();
        }
    }
}
