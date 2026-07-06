interface FileInputOptions {
    maxFileSize?: number;
    maxFileCount?: number;
    onFileChange?: () => void;
    onFileChosen?: () => void;
    onFileDragging?: (isDragging: boolean) => void;
}

export default class FileInput {
    public readonly inputEl: HTMLInputElement;
    private readonly dropzoneEl: HTMLLabelElement;
    private readonly labelH1El: HTMLElement;
    private readonly labelH2El: HTMLElement;

    options: FileInputOptions;
    private readonly labelContents: readonly [string, string];
    private _isDraggingFiles: boolean = false;
    private _filesChosen: File[] = [];

    constructor(inputEl, dropzoneEl, options: FileInputOptions = {}) {
        this.inputEl = inputEl;
        this.dropzoneEl = dropzoneEl;
        this.labelH1El = this.dropzoneEl.querySelector('h1') as HTMLElement;
        this.labelH2El = this.dropzoneEl.querySelector('h2') as HTMLElement;

        // caching default state inner text
        this.labelContents = Object.freeze([
            this.labelH1El.innerHTML,
            this.labelH2El.innerHTML
        ]);
        this.options = Object.assign({ maxFileCount: 20, maxFileSize: 1024 }, options || {});

        this.bind();
    }

    private bind() {
        // prevent default browser activities  across viewport
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.dropzoneEl.addEventListener(eventName, (e) => e.preventDefault(), false);
            document.body.addEventListener(eventName, (e) => e.preventDefault(), false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            this.dropzoneEl.addEventListener(eventName, () => this.isDraggingFiles = true, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.dropzoneEl.addEventListener(eventName, () => this.isDraggingFiles = false, false);
        });

        this.dropzoneEl.addEventListener('drop', (e: DragEvent) => this.handleFileDrop(e));
        this.inputEl.addEventListener('cancel', () => this.inputEl.dispatchEvent(new Event('change')));
        this.inputEl.addEventListener('change', () => this.handleFileSelectionChange());
    }

    private handleFileSelectionChange(): void {
        this.filesChosen = this.inputEl.files || [];
        this.inputEl.value = ''; // allow identical re-selections

        if (!this.inputValidation.hasFiles) this.inputEl.blur();
        if (this.options.onFileChange) this.options.onFileChange()
    }

    private handleFileDrop(e: DragEvent): void {
        const dt = e.dataTransfer;
        if (!dt || !dt.files.length) return;

        console.log(`[FileInput] files dropped: ${dt.files.length} items.`);
        this.inputEl.files = dt.files;
        this.inputEl.dispatchEvent(new Event('change'));
    }


    public clear() {
        this.filesChosen = [];
    }


    // util
    private set isDraggingFiles(val: boolean) {
        if (val !== this._isDraggingFiles) {
            this.dropzoneEl.classList.toggle('drop-zone--hover', val);
            this._isDraggingFiles = val;
            if (this.options.onFileDragging) this.options.onFileDragging(this._isDraggingFiles);
        }
    }

    public get isDraggingFiles() { return this._isDraggingFiles }

    /* main FileList processing */
    public get filesChosen(): File[] { return this._filesChosen; }

    private set filesChosen(files: FileList | File[]) {
        this._filesChosen = files instanceof FileList ? Array.from(files) : files;

        if (this.inputValidation.hasFiles) {
            this.labelH1El.innerHTML = this.inputValidation.ok ? 'Files successfully added' : 'File validation failed';

            const tooManyClass = this.inputValidation.chosenTooManyFiles ? ' class="error"' : '';
            const filePlural = this.filesChosen.length > 1 ? 's' : '';
            const overSizeError = this.inputValidation.isOverSize ? ` <span class="error">${this.inputValidation.isOverSize.name} is too big</span>.` : '';

            this.labelH2El.innerHTML = `<span${tooManyClass}>${this.filesChosen.length} / ${this.options.maxFileCount}</span> file${filePlural} chosen.${overSizeError}`;
        } else {
            // reset to default state values
            this.labelH1El.innerHTML = this.labelContents[0];
            this.labelH2El.innerHTML = this.labelContents[1];
        }

        if (this.options.onFileChosen) this.options.onFileChosen();
    }

    /* main validation methods */
    public get inputValidation() {
        const isOverSize = this._filesChosen.find(file => file.size > this.options.maxFileSize);
        const chosenTooManyFiles = this._filesChosen.length > this.options.maxFileCount;
        const hasFiles = this._filesChosen.length > 0;

        return {
            isOverSize, chosenTooManyFiles, hasFiles,
            ok: !isOverSize && !chosenTooManyFiles && hasFiles
        };
    }
}