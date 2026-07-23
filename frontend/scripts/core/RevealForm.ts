import { AuthService } from "../AuthService";
import { updateActiveForm } from "../main";
import { BaseForm } from "./base";
import ClientApi from "../ClientApi";

import { ApiError } from "@shared/ApiError";
import { validateVaultId } from '@shared/validators';

import ShareInvite from "../components/ShareInvite";
import PinCodeInput from "../components/PinCodeInput";
import FilesContainer from "../components/FilesContainer";
import CopyInput from "../components/CopyInput";
import UIGroup from "../components/UIGroup";

import { delay } from "../utils/time";
import { setQueryParam } from "../utils/dom";


export default class RevealForm extends BaseForm {
    private readonly input: PinCodeInput;
    private readonly errorEl: HTMLElement;
    private readonly copyVaultidInput: CopyInput;
    private readonly filesContainer: FilesContainer;

    private readonly gobackBtn: HTMLButtonElement;
    private readonly shareBtn: HTMLButtonElement;

    private uiGroupEntrance: UIGroup;
    private uiGroupFiles: UIGroup;

    private _isFilesContainerOpened: boolean = false;

    constructor() {
        super();

        this.shareBtn = document.getElementById('share') as HTMLButtonElement;
        new ShareInvite(this.shareBtn);

        this.input = new PinCodeInput(document.getElementById('vault_id_pincodeinput'), {
            length: 6,
            pattern: /^[a-zA-Z0-9]{1}$/,
            pastePattern: /(?<=\bvault-|\/|^)[a-zA-Z0-9]{6}(?=\b|\/)/,
            onComplete: (code) => { this.onFullFilled(code); }
        });

        this.uiGroupEntrance = new UIGroup('reveal-form-entrance');
        this.uiGroupFiles = new UIGroup('reveal-form-files', { dynamicGroupElements: true });

        this.filesContainer = new FilesContainer();

        this.gobackBtn = document.getElementById('reveal_goback') as HTMLButtonElement;
        this.formEl = document.getElementById('reveal') as HTMLFormElement;
        this.copyVaultidInput = new CopyInput(document.getElementById('vaultid-copy-input-wrapper'));
        this.errorEl = this.formEl.querySelector('small.error') as HTMLElement;

        console.debug('[RevealForm] Init');
        this.bind();
        if (ShareInvite.current_vault_id) this.autoFill();
    }

    private set fileContainerOpen(toExpand: boolean) {
        this._isFilesContainerOpened = toExpand;
        this.filesContainer.el.parentElement.classList.toggle('expanded', toExpand);

        if (!toExpand) {
            ShareInvite.current_vault_id = undefined;
            setQueryParam('invite', null);
            this.input.value = '';
            this.isBusy = false;
        }

        this.uiGroupEntrance.disableAll(toExpand);
        this.uiGroupFiles.disableAll(!toExpand);
    }

    public get ac() {
        const hasFocusedEls = document.activeElement instanceof HTMLInputElement
            && this.input.isFocused

        return {
            hasFocusedEls,
            hasFileListRendered: this._isFilesContainerOpened,
            isBusy: this.isBusy
        };
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
        this.uiGroupEntrance.disableAll(this._isBusy || this._isFilesContainerOpened);
    }

    public bind() {
        this.gobackBtn.addEventListener('click', () => { this.fileContainerOpen = false });

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
        this.formEl.classList.remove('error');
        updateActiveForm();

        try {
            const files = await ClientApi.revealVault({ vault_id, auth: await AuthService.getAuth() });
            console.debug(`[RevealForm] Successfully received ${files.length} links from S3.`);

            this.filesContainer.files = files;

            ShareInvite.current_vault_id = vault_id;
            this.copyVaultidInput.setValue(vault_id);

            this.fileContainerOpen = true;
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
