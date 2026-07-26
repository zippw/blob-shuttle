import { copyToClipboard } from "../utils/dom";
import ClientApi from "../ClientApi";
import { AuthService } from "../AuthService";
import { toCanvas } from 'qrcode';
import UIGroup from "../components/UIGroup";
import cfg from '@config/config';
import TimestampElement from "../components/TimestampElement";
import CopyInput from "../components/CopyInput";

interface inviteUrl {
    default: string;
    authorized?: string;
}

interface CachedInvite {
    vault_id: string;
    url: inviteUrl;
    valid_until: number;
}

export default class ShareInvite {
    private readonly shareBtnEl: HTMLButtonElement;
    private modal: ShareModal;

    public static cache: CachedInvite | null = null;

    constructor(shareBtnEl: HTMLButtonElement) {
        this.shareBtnEl = shareBtnEl;
        console.debug('[ShareInvite] init');

        this.bind();
    }

    public static async getUrl(vault_id: string = ShareInvite.current_vault_id): Promise<inviteUrl> {
        console.debug(`[ShareInvite] generating hash link for ${vault_id}...`);

        const { hash, authorized_hash } = await ClientApi.createInvite({ vault_id, auth: await AuthService.getAuth() });

        const url: inviteUrl = { default: `${window.location.origin}${window.location.pathname}?invite=${hash}` };
        if (authorized_hash) url.authorized = `${window.location.origin}${window.location.pathname}?invite=${authorized_hash}`;

        return url;
    }

    private _last_vault_id: string | null;
    private async onShare() {
        this.modal = new ShareModal();
        this.modal.open();

        const vault_id = ShareInvite.current_vault_id;

        if (!ShareInvite.cache || this._last_vault_id !== vault_id || Date.now() > ShareInvite.cache.valid_until)
            await ShareInvite.refreshCache();

        this.modal.update(true);
        this._last_vault_id = vault_id;
    }

    public static async refreshCache() {
        const vault_id = ShareInvite.current_vault_id;
        const url = await ShareInvite.getUrl(vault_id);
        ShareInvite.cache = {
            vault_id, url, valid_until: Date.now() + cfg.options.inviteURLLifetime * 1000
        };
    }

    private bind() {
        this.shareBtnEl.addEventListener('click', async () => { await this.onShare() });
    }

    public static get current_vault_id(): string | null { return ShareInvite.cache?.vault_id || null }
    public static set current_vault_id(vault_id: string | null) {
        if (!ShareInvite.cache) {
            ShareInvite.cache = { vault_id, url: null, valid_until: null };
        } else {
            ShareInvite.cache.vault_id = vault_id;
        }
    }
}

class Modal {
    protected readonly overlayEl: HTMLElement;
    protected readonly modalEl: HTMLElement;
    protected readonly closeModalBtn: HTMLButtonElement;
    protected uiGroup: UIGroup;

    constructor() {
        this.overlayEl = document.getElementById('modals') as HTMLElement;
        this.modalEl = document.createElement('div');
        this.closeModalBtn = document.createElement('button');

        this.closeModalBtn.className = 'modal__close';
        this.closeModalBtn.setAttribute('type', 'button');
        this.closeModalBtn.setAttribute('aria-label', 'Close');
        this.closeModalBtn.innerHTML = '&times;';

        this.modalEl.appendChild(this.closeModalBtn);
        this.modalEl.className = 'modal';

        this.bind_main();
    }

    protected bind_main() {
        this.closeModalBtn.addEventListener('click', () => { this.close() }, { once: true });

        this.overlayEl.addEventListener('click', (e) => {
            const target = e.target;
            if (target !== this.overlayEl) return;
            this.close();
        });
    }

    protected beforeClose() { }

    public close() {
        this.beforeClose();
        this.overlayEl.style.pointerEvents = 'none';
        this.overlayEl.style.opacity = '0';
        if (this.uiGroup) this.uiGroup.disableAll();

        setTimeout(() => {
            this.modalEl.remove();
        }, 300);
    }

    public open() {
        this.overlayEl.innerHTML = '';
        this.overlayEl.style.pointerEvents = 'auto';
        this.overlayEl.style.opacity = '1';

        if (this.uiGroup) this.uiGroup.disableAll(false);

        this.overlayEl.append(this.modalEl);
    }
}

class ShareModal extends Modal {
    private readonly qrcanvasEl: HTMLCanvasElement;
    private readonly accessUrlCBEl: HTMLInputElement;
    private readonly copyInput: CopyInput;
    private readonly regenerateUrlBtn: HTMLButtonElement;

    private timestampEl: TimestampElement;

    constructor() {
        super();

        this.modalEl.classList.add('share');
        this.modalEl.insertAdjacentHTML('beforeend', `
            <div class="share__QR__wrapper">
                <canvas class="share__qr" width="324" height="324"></canvas>
            </div>
            <div class="share__wrapper scrollable">
                <h3 class="share__title">Share Vault</h3>
                <p class="share__subtitle">Scan QR-code or copy link</p>
                
                <label class="share__checkbox-label">
                    <input type="checkbox" name="share_access_cb" class="share__checkbox-real" />
                    <span class="share__checkbox-custom"></span>
                    <span class="share__checkbox-text">
                        <strong>Share full access</strong>
                        <span class="share__hint">Allows viewing without a password. Disabled if you haven't unlocked the vault yourself.</span>
                    </span>
                </label>

                <div class="share__input-wrapper copy-input-wrapper">
                    <input name="share-copy-input" class="compact" type="text" readonly />
                    <button class="compact" type="button" aria-label="Copy link">
                        Copy
                    </button>
                </div>
                
                <div class="share__footer">
                    <p class="share__countdown"></p>
                    <button type="button" class="share__refresh-btn">Generate new link</button>
                </div>
            </div>
        `);


        this.regenerateUrlBtn = this.modalEl.querySelector('.share__refresh-btn') as HTMLButtonElement;
        this.accessUrlCBEl = this.modalEl.querySelector('input[type="checkbox"]');
        this.copyInput = new CopyInput(this.modalEl.querySelector('.share__input-wrapper'));
        this.qrcanvasEl = this.modalEl.querySelector('canvas') as HTMLCanvasElement;

        this.bind();
    }

    private bind() {
        this.regenerateUrlBtn.addEventListener('click', async () => {
            this.regenerateUrlBtn.disabled = true;

            await ShareInvite.refreshCache();
            this.update(true);

            this.regenerateUrlBtn.disabled = false;
        });

        this.accessUrlCBEl.addEventListener('change', () => { this.update(); });
    }

    protected override beforeClose() {
        if (this.timestampEl) this.timestampEl.destroy();
    }

    public update(resetTimer: boolean = false) {
        const cache = ShareInvite.cache;
        if (!cache) return;

        /* timer */
        const timerContainer = this.modalEl.querySelector('.share__countdown');
        if (timerContainer && resetTimer === true) {
            if (this.timestampEl) this.timestampEl.destroy();
            timerContainer.replaceChildren();

            const timestampEl = document.createElement('span');
            timestampEl.setAttribute('data-timestamp', String(cache.valid_until));
            timestampEl.setAttribute('data-timestamp-type', 'countdown');

            timerContainer.appendChild(timestampEl);
            this.timestampEl = new TimestampElement(timestampEl);
        }

        const urlData = cache.url;
        if (!urlData.authorized) this.accessUrlCBEl.disabled = true;

        const url = this.accessUrlCBEl.checked && urlData.authorized
            ? urlData.authorized : urlData.default;

        this.copyInput.setValue(url);

        toCanvas(this.qrcanvasEl, url, {
            margin: 8,
            color: {
                dark: '#ffffff',
                light: '#121316'
            }
        }, (err) => {
            if (err) return console.error(err);
        });
    }
}







