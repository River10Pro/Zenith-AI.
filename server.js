const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Esto sirve tu index.html y CSS automáticamente

// Esta ruta reemplaza a chat.php
app.post('/chat', async (req, res) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Falta API Key en Render" });

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: req.body.messages,
                temperature: 0.7
            })
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Error conectando con Groq" });
    }
});

app.listen(port, () => console.log(`Zenith AI funcionando en puerto ${port}`));
