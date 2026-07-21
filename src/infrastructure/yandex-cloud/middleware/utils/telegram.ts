const telegram = {
    send: async (text: string) => {
        try {
            const tg_response = await fetch(`https://api.telegram.org/bot${process.env.tg_tkn}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, chat_id: process.env.tg_cid, })
            });
            if (!tg_response.ok) throw new Error(`[tg] error: ${await tg_response.text()}`);

            return { statusCode: 204 };
        } catch (error) {
            return { statusCode: 500 };
        };
    }
}

export default telegram;