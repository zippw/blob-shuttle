import { ApiError } from "@shared/ApiError";
import { AuthService } from "../AuthService";
import ShareInvite from "../components/ShareInvite";
import ClientApi from "../ClientApi";
import { setQueryParam } from "../utils/dom";
import { validatePasscode } from "@shared/validators";

export default class LoginForm {
    private readonly passcode_input: HTMLInputElement;
    private readonly passcode_btn: HTMLButtonElement;
    private readonly loginForm: HTMLFormElement;
    private readonly error_el: HTMLElement;
    private readonly onLogin: () => void;

    constructor(onLogin = () => { }) {
        this.onLogin = onLogin;

        this.loginForm = document.getElementById('auth') as HTMLFormElement;
        this.passcode_input = document.getElementById('passcode') as HTMLInputElement;
        this.passcode_btn = document.getElementById('passcode_btn') as HTMLButtonElement;
        this.error_el = this.loginForm.querySelector('small.error') as HTMLElement;

        // if the server already authorized this session (e.g. valid invite link with a password embedded)
        if (document.body.classList.contains('authorized')) {
            console.debug('[LoginForm] app already authorized by server. Skipping LoginForm init.');
            return;
        }

        console.debug('[LoginForm] init');
        this.bind();
        this.autoLogin();
    }

    public disableForm(toDisable: boolean): void {
        console.debug(`[LoginForm] setting inputs disabled state to: ${toDisable}`);
        this.passcode_btn.disabled = toDisable;
        this.passcode_input.disabled = toDisable;
    }

    /**
     * Performs automatic sign-in if a passcode is cached in localStorage or local memory
     */
    private async autoLogin(): Promise<void> {
        const authData = await AuthService.getAuth();
        if ('passcode' in authData && authData.passcode !== undefined) {
            console.debug('[LoginForm] attempting auto login');
            this.passcode_input.value = '********';
            this.onSubmit(false)
        }
    }

    private async onSubmit(isManual: boolean = false) {
        this.loginForm.classList.remove('error');
        this.disableForm(true);

        let passcode: string;
        try {
            if (isManual) {
                console.debug('[LoginForm] manual input detected');
                if (!this.passcode_input.value.length) throw new ApiError({ error: 'Empty field', type: 'CLIENT' });
                passcode = validatePasscode(String(this.passcode_input.value));
            }

            console.debug('[LoginForm] sending check-auth...', { isManual });

            if (isManual) AuthService.passcode = passcode;
            const { cache_allowed } = await ClientApi.checkAuth({ auth: await AuthService.getAuth() });

            console.debug('[LoginForm] check-auth OK');

            if (cache_allowed) AuthService.save();

            ShareInvite.current_vault_id = document.body.getAttribute('data-current_vault_id');
            this.disableForm(true);

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
            this.disableForm(false);
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
