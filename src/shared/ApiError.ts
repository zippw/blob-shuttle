import { StructuredApiErr } from "./schema";

export class ApiError extends Error implements StructuredApiErr {
    public readonly error: string;
    public readonly details: string;
    public readonly type: StructuredApiErr['type'];

    constructor(payload: StructuredApiErr) {
        super(`[${payload.type}] ${payload.error}${payload.details ? `\nDetails: ${payload.details}` : ''}`);
        this.name = 'ApiError';
        this.error = payload.error;
        this.details = payload.details || 'No additional debug context provided.';
        this.type = payload.type;

        Object.setPrototypeOf(this, ApiError.prototype);
    }
}