export default async function disableFunction(token: string, functionId: string) {
    const fdis = await fetch(`https://serverless-functions.api.cloud.yandex.net/functions/v1/functions/${functionId}:updateAccessBindings`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "accessBindingDeltas": [{
                "action": "REMOVE",
                "accessBinding": {
                    "roleId": "functions.functionInvoker",
                    "subject": {
                        "id": "allUsers",
                        "type": "system"
                    }
                }
            }]
        })
    });

    if (!fdis.ok) throw new Error(`[fdis] ${fdis.status}\n${await fdis.text()}`);
}