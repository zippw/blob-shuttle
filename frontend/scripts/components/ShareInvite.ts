import { copyToClipboard, setQueryParam } from "../utils/dom";
import { changeBtnContent } from "./btn-content-transition";
import ClientApi from "../ClientApi";
import { AuthService } from "../AuthService";
import { validateVaultId } from "@shared/validators";

export default class ShareInvite {
    private static _vault_id: string = null;
    private readonly btnEl: HTMLButtonElement;

    constructor(btnEl: HTMLButtonElement, vault_id: string) {
        this.btnEl = btnEl;
        console.debug('[ShareInvite] init');

        this.bind();
        try {
            if (!vault_id) return;
            ShareInvite.current_vault_id = validateVaultId(vault_id);
        } catch (error) {
            console.error('[ShareInvite]', error);
            this.btnEl.disabled = true;
            setQueryParam('invite', null);
        }
    }

    private bind() {
        this.btnEl.addEventListener('click', async () => {
            console.debug('[ShareInvite] generating hash link...');
            this.btnEl.disabled = true;

            const vault_id = ShareInvite.current_vault_id;
            const { hash } = await ClientApi.createInvite({ vault_id, auth: await AuthService.getAuth() });

            console.debug('[ShareInvite] Server response payload:', hash);

            copyToClipboard(`${window.location.origin}${window.location.pathname}?invite=${hash}`).then(x => {
                changeBtnContent(this.btnEl, 'Copied!')
            }).catch(() => {
                this.btnEl.disabled = false;
                changeBtnContent(this.btnEl, 'Failed')
            })
        });
    }

    public static get current_vault_id() { return this._vault_id }

    public static set current_vault_id(vault_id) {
        // TODO: show share button
        this._vault_id = vault_id;
    }
}