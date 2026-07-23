import { ApiError } from "@shared/ApiError";
import { validatePasscode } from "@shared/validators";

import { AuthService } from "../AuthService";
import ShareInvite from "../components/ShareInvite";
import ClientApi from "../ClientApi";
import UIGroup from "../components/UIGroup";
import { setQueryParam } from "../utils/dom";

export default class LoginForm {
    private readonly passcode_input: HTMLInputElement;
    private readonly passcode_btn: HTMLButtonElement;
    private readonly loginForm: HTMLFormElement;
    private readonly error_el: HTMLElement;
    private readonly onLogin: () => void;

    private uiGroup: UIGroup;

    constructor(onLogin = () => { }) {
        this.onLogin = onLogin;

        this.loginForm = document.getElementById('auth') as HTMLFormElement;
        this.passcode_input = document.getElementById('passcode') as HTMLInputElement;
        this.passcode_btn = document.getElementById('passcode_btn') as HTMLButtonElement;
        this.error_el = this.loginForm.querySelector('small.error') as HTMLElement;

        this.uiGroup = new UIGroup('login-form');

        // if the server already authorized this session (e.g. valid invite link with a password embedded)
        if (document.body.classList.contains('authorized')) {
            console.debug('[LoginForm] app already authorized by server. Skipping LoginForm init.');
            return;
        }

        console.debug('[LoginForm] init');
        this.bind();
        this.autoLogin();
    }

    /**
     * Performs automatic sign-in if a passcode is cached in localStorage or local memory
     */
    private async autoLogin(): Promise<void> {
        const authData = await AuthService.getAuth();
        if (('passcode' in authData && authData.passcode !== undefined) || 'invite' in authData) {
            console.debug('[LoginForm] attempting auto login');
            this.passcode_input.value = '********';
            this.onSubmit(false)
        }
    }

    private async onSubmit(isManual: boolean = false) {
        this.loginForm.classList.remove('error');
        this.uiGroup.disableAll(true);

        let passcode: string;
        try {
            if (isManual) {
                console.debug('[LoginForm] manual input detected');
                if (!this.passcode_input.value.length) throw new ApiError({ error: 'Empty field', type: 'CLIENT' });
                passcode = validatePasscode(String(this.passcode_input.value));
            }

            console.debug('[LoginForm] sending check-auth...', { isManual });

            if (isManual) AuthService.passcode = passcode;
            const { cache_allowed, invite_vault_id } = await ClientApi.checkAuth({ auth: await AuthService.getAuth() });

            console.debug('[LoginForm] check-auth OK');

            if (cache_allowed) AuthService.save();
            if (invite_vault_id) {
                ShareInvite.current_vault_id = invite_vault_id;
            } else {
                setQueryParam('invite', null)
            }

            this.uiGroup.disableAll(true);

            document.body.classList.add('authorized');
            this.onLogin();

            setTimeout(() => {
                this.loginForm.remove();
                console.debug('[LoginForm] removed from DOM');
            }, 1000);

        } catch (error) {
            console.error(error);

            if (error instanceof ApiError) {
                this.error_el.innerText = error.error;
            } else this.error_el.innerText = 'Unexpected Error';

            AuthService.clear();
            this.uiGroup.disableAll(false);
            this.passcode_input.focus();
            this.passcode_input.value = '';
            this.loginForm.classList.add('error');
        }
    }

    private bind(): void {
        window.addEventListener('popstate', () => window.location.reload());

        this.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            this.onSubmit(true)
        });
    }
}
