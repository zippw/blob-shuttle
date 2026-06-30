import express from 'express';
import { handler } from './src';

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all('/function', async (req, res) => {
    const result = await handler({
        // @ts-ignore
        httpMethod: req.method, headers: req.headers, queryStringParameters: req.query,
        body: typeof req.body === 'object' ? JSON.stringify(req.body) : req.body
    }, {})

    if (result.statusCode) res.status(result.statusCode);
    if (result.headers) Object.entries(result.headers).forEach(([key, value]) => res.append(key, value));
    if (result.body) {
        res.send(result.body);
    } else res.end()
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
});