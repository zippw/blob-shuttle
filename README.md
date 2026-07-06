# blob-shuttle

> personal file transfer tool. no signup, no qr codes, no cloud disk accounts.

---

## why

When you need to move a file from one device to any other - no USB cables, no multi-factor verification, no logging into cloud drives or messengers, no cleanup afterward. Just open a link, drop the file, and it's there.

---

## stack

- front: pug + scss + ts, gulp, [file-icons-js](https://github.com/exuanbo/file-icons-js)
- back: ts + node v22, pug-runtime (SSR), @aws-sdk/client-s3 + s3-request-presigner
- storage: aws s3 (yandex object storage)
- runtime: yandex cloud functions

---

## how it works

1. open site -> enter passcode (unless you came via authorized invite link)
2. create vault -> drop files -> upload -> get Vault ID
3. share invite -> copies link with encrypted token (1h lifetime)
4. anyone with link can view *and* upload to same vault
5. reveal vault -> paste 6-char Vault ID -> download files

---

## under the hood

**vault_id** = `[a-zA-Z0-9]{6}` id. generated via feistel network + hmac.  
26 bits = timestamp (10ms precision), 6 bits = checksum.  
validates via `decodeVaultId()`.

**invites** = aes-256-gcm. payload: `{ vault_id, expires_at, passcode? }`.  
if `passcode` included - auto-login. otherwise user types it manually.

**auth** = two passcodes from env:
- `PASSCODE` - regular passcode, not cached on client
- `LONG_TERM_PASSCODE` - optional, allows `cache_allowed: true` for auto-login via localStorage
  checked with `crypto.timingSafeEqual`.

**s3 presign**:  
- PUT: 20min (or invite remaining time)  
- GET: 1min (or invite remaining time)

---

## notes

- files may auto-delete via s3 lifecycle rules. not handled in code.

- yandex cloud functions strip custom headers and cookies.  
  auth lives in request body (`auth.passcode` / `auth.invite`) and localStorage.

- invite link gives **upload rights** too. not just view.

- no rate limiting. s3 pays for traffic.

- brute-forcing vault_id? `62^6` combos.

---


## install

1. create a bucket in yandex object storage
2. create a service account with `storage.uploader`, `storage.viewer`, and `storage.editor` roles.
3. generate a static access key for it.
4. adjust constants in `src/shared/constants.ts` (file size, count, etc.)
5. setup env (see below)
6. run `npm i`

## env

```env
# s3 access
STATIC_KEY_ID=...
STATIC_KEY_SECRET=...

# passcodes
PASSCODE=my_cool-passcode1234
LONG_TERM_PASSCODE=my_password_that_can_be_cached_on_the_client_for_auto-login_1234

# internal hashing keys
ENCRYPTION_KEY=8a...7
VAULT_SECRET_KEY=88...b
```

generate random 32 byte hex key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

don't forget to remove .example from .env.example file.



## run locally

```ts
// server.ts
import express from 'express';
import { handler } from './src';

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all('/function', async (req, res) => {
    const result = await handler({
        httpMethod: req.method,
        headers: req.headers,
        queryStringParameters: req.query,
        body: typeof req.body === 'object' ? JSON.stringify(req.body) : req.body
    }, {})

    if (result.statusCode) res.status(result.statusCode);
    if (result.headers) Object.entries(result.headers).forEach(([k, v]) => res.append(k, v));
    if (result.body) res.send(result.body);
    else res.end()
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`http://localhost:${PORT}`)
});
```

```bash
npm run build
```


## deploy
windows:
1. compile:
    ```bash
    npm run build:clean
    npm run build:frontend
    npm run build:backend
    npm run build:package
    ```
    or for windows:
    ```bash
    npm run build
    ```
2. create node.js yandex node.js serverless function
3. upload `/dist` as ZIP to yandex cloud function
4. set entry point: `index.handler`
5. set all .env variables
