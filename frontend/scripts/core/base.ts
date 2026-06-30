export abstract class BaseForm {
    constructor() { }

    abstract ac: Record<string, boolean>;
    abstract disableForm(toDisable: boolean): void;
}