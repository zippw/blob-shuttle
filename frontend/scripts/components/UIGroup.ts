interface UIGroupOptions {
    /** defines wether elements can be added/removed from dom (e.x.: files container file anchors) */
    dynamicGroupElements?: boolean;
}

export default class UIGroup {
    private group: string;
    private options: UIGroupOptions;

    private _els: NodeListOf<HTMLElement>;

    constructor(group: string, options?: UIGroupOptions) {
        this.group = group;

        this.options = Object.assign({
            dynamicGroupElements: false,
        }, options);

        this.init();
    }

    init() {
        if (this.options.dynamicGroupElements === false) this._els = document.querySelectorAll(`[data-ui-group=${this.group}]`);
    }

    public get els(): NodeListOf<HTMLElement> {
        if (this.options.dynamicGroupElements === false && this._els) return this._els;
        return document.querySelectorAll(`[data-ui-group=${this.group}]`);
    }

    public disableAll(toDisable: boolean = true, exceptions?: Record<string, boolean>) {
        this.els.forEach(el => {
            const shouldDisable = exceptions && exceptions[el.getAttribute('data-ui-id')]
                ? exceptions[el.getAttribute('data-ui-id')]
                : toDisable;
            this.setDisabled(el, shouldDisable);
        });
    }

    private setDisabled(el: HTMLElement, disabled: boolean) {
        switch (true) {
            case el instanceof HTMLInputElement:
            case el instanceof HTMLButtonElement:
            case el instanceof HTMLSelectElement:
            case el instanceof HTMLTextAreaElement:
                el.disabled = disabled;
                el.setAttribute('tabindex', disabled ? '-1' : '0');
                break;

            case el instanceof HTMLAnchorElement:
            case el instanceof HTMLDivElement:
            case el instanceof HTMLElement:
                el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
                el.setAttribute('tabindex', disabled ? '-1' : '0');
                break;

            default:
                break;
        }
    }
}