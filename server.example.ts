import express from 'express';
import { handler } from './src/infrastructure/yandex-cloud/handler';

const app = express();
const PORT = process.env.PORT || '8080';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* yc serverless function emulator */
let requestCounter = 0;
app.all('/files', async (req, res) => {
    const result = await handler({
        // @ts-ignore
        httpMethod: req.method, headers: req.headers, queryStringParameters: req.query,
        body: typeof req.body === 'object' ? JSON.stringify(req.body) : req.body
    }, {
        requestId: String(requestCounter++),
        functionName: 'e6...k',
        functionFolderId: 'g4...v',
        token: { access_token: '' }
    })

    if (result.statusCode) res.status(result.statusCode);
    if (result.headers) Object.entries(result.headers).forEach(([key, value]) => res.append(key, value));
    if (result.body) {
        res.send(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body);
    } else res.end()
});



/* custom wrapper/filesystem example (local storage) */
import { storageRouter } from './src/infrastructure/drivers/storage/index.example';
app.use(storageRouter);



app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`)
});