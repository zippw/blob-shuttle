interface RPMOptions {
    // IAM yandex cloud token
    token: string;
    triggers?: {
        condition: (rpm: number) => boolean;
        callback: (rpm: number) => void;
    }[];
    database: {
        // dynamodb endpoint
        endpoint: string;
        tableName: string;
        // used is table contains other RPM counters
        rpmKeyPrefix?: string;
    }
}

export default class RPM {
    private readonly options: RPMOptions;

    constructor(options: RPMOptions) {
        const baseOptions = {
            token: options.token,
            triggers: options.triggers || [],
            database: {
                endpoint: options.database.endpoint,
                rpmKeyPrefix: options.database.rpmKeyPrefix ?? "",
                tableName: options.database.tableName
            }
        };

        this.validateOptions(baseOptions);
        this.options = baseOptions;
    }

    // TODO: implement monitoring method
    public async execute(method: 'DB' = 'DB'): Promise<void> {
        let result;
        // if (method === 'DB')
        result = await this.getRPM();

        if (this.options.triggers) for (const trigger of this.options.triggers) {
            if (trigger.condition(result)) await trigger.callback(result);
        }
    }

    private async getRPM(): Promise<number> {
        let currentTime = Math.floor(Date.now() / 60000);

        const res = await fetch(process.env.ydb_endpoint!, {
            method: 'POST',
            headers: {
                'X-Amz-Target': 'DynamoDB_20120810.UpdateItem',
                'Authorization': `Bearer ${this.options.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                TableName: this.options.database.tableName,
                Key: { "t": { "N": String(currentTime) } },
                UpdateExpression: "ADD r :inc SET s = :sourceStr",
                ExpressionAttributeValues: {
                    ":inc": { "N": "1" },
                    ":sourceStr": { "S": this.options.database.rpmKeyPrefix }
                },
                ReturnValues: "UPDATED_NEW"
            })
        });

        if (!res.ok) throw new Error(`[rpm] ${res.status} Error ${await res.text()}`);
        const data = await res.json();
        return parseInt(data.Attributes.r.N);
    }

    private validateOptions(opts: any): asserts opts is RPMOptions {
        if (!opts || typeof opts !== 'object')
            throw new Error('RPM validation error: Options must be a valid object.');

        if (typeof opts.token !== 'string' || opts.token.trim() === '')
            throw new Error('RPM validation error: "options.token" must be a non-empty string.');

        // if (!Array.isArray(opts.triggers))
        //     throw new Error('RPM validation error: "options.trigger" must be a function.');

        if (!opts.database || typeof opts.database !== 'object')
            throw new Error('RPM validation error: "options.database" must be an object.');

        if (typeof opts.database.endpoint !== 'string' || opts.database.endpoint.trim() === '')
            throw new Error('RPM validation error: "options.database.endpoint" must be a non-empty string.');

        if (typeof opts.database.tableName !== 'string' || opts.database.tableName.trim() === '')
            throw new Error('RPM validation error: "options.database.tableName" must be a non-empty string.');

        if (typeof opts.database.rpmKeyPrefix !== 'string')
            throw new Error('RPM validation error: "options.database.rpmKeyPrefix" must be a string.');
    }
}

