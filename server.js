const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 10000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

app.disable('x-powered-by');
app.use(cors(ALLOWED_ORIGIN ? { origin: ALLOWED_ORIGIN } : undefined));
app.use(express.json({ limit: "3mb" }));
app.use(express.static('.'));

app.get('/health', (_req, res) => {
    res.json({ status: "ok", service: "MelDya IA" });
});

app.post('/transcribe', express.raw({ type: "audio/*", limit: "15mb" }), async (req, res) => {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
        return res.status(503).json({ error: "El servicio de audio no está configurado." });
    }

    const mimeType = req.get("content-type")?.split(";")[0].trim().toLowerCase();
    const audioFormats = {
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/mp4": "m4a",
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/flac": "flac"
    };
    const extension = audioFormats[mimeType];

    if (!extension) {
        return res.status(415).json({ error: "Formato de audio no compatible." });
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: "No se recibió audio." });
    }

    try {
        const formData = new FormData();
        formData.append("model", process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo");
        formData.append(
            "file",
            new Blob([req.body], { type: mimeType }),
            `meldya-audio.${extension}`
        );

        const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${groqKey}` },
            body: formData,
            signal: AbortSignal.timeout(60000)
        });
        const data = await response.json();

        if (!response.ok) {
            const providerError = data?.error?.message || `El proveedor respondió con estado ${response.status}.`;
            console.error("Groq transcription error:", response.status, providerError);
            return res.status(502).json({ error: "No se pudo transcribir el audio. Inténtalo de nuevo." });
        }

        const text = typeof data?.text === "string" ? data.text.trim().slice(0, 4000) : "";
        if (!text) {
            return res.status(502).json({ error: "No se detectó voz clara en el audio." });
        }

        res.json({ text });
    } catch (error) {
        console.error("Audio transcription error:", error.name === "TimeoutError" ? "timeout" : error.message);
        const timedOut = error.name === "TimeoutError";
        res.status(timedOut ? 504 : 502).json({
            error: timedOut
                ? "La transcripción tardó demasiado. Inténtalo de nuevo."
                : "No se pudo procesar el audio. Inténtalo de nuevo."
        });
    }
});

app.post('/chat', async (req, res) => {
    const groqKey = process.env.GROQ_API_KEY;
    const visionModel = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";

    if (!groqKey) {
        return res.status(503).json({ error: "El servicio de IA no está configurado." });
    }

    const messages = req.body?.messages;
    const imageBase64 = req.body?.image;
    const memory = req.body?.memory;

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
        return res.status(400).json({ error: "Debes enviar entre 1 y 30 mensajes válidos." });
    }

    const validatedMessages = messages
        .filter((message) =>
            message &&
            ["user", "assistant", "system"].includes(message.role) &&
            typeof message.content === "string"
        )
        .map((message) => ({
            role: message.role,
            content: message.content.trim().slice(0, 4000)
        }))
        .filter((message) => message.content);

    if (validatedMessages.length === 0) {
        return res.status(400).json({ error: "El mensaje no puede estar vacío." });
    }

    const systemPrompt = {
        role: "system",
        content: "Eres MelDya, la creación digital original de Andrew Rivera. Hablas con calidez, confianza y personalidad propia: sabes cuándo ser breve y cuándo explicar con detalle. Eres leal a quien usa la app, no finges tener memoria que no te dieron y nunca afirmas que Andrew es otro creador. Responde en español por defecto, sé útil, honesto y creativo. Si analizas una imagen, describe primero lo visible y luego responde específicamente a la pregunta."
    };
    const memoryPrompt = typeof memory === "string" && memory.trim()
        ? { role: "system", content: `Contexto personal recordado por el usuario, úsalo solo si ayuda: ${memory.trim().slice(0, 1000)}` }
        : null;
    const outgoingMessages = [
        systemPrompt,
        ...(memoryPrompt ? [memoryPrompt] : []),
        ...validatedMessages.filter((message) => message.role !== "system")
    ];

    try {
        if (imageBase64) {
            if (typeof imageBase64 !== "string" || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageBase64)) {
                return res.status(400).json({ error: "Formato de imagen no válido." });
            }
            const lastUserMessage = outgoingMessages[outgoingMessages.length - 1];
            if (lastUserMessage?.role === "user") {
                outgoingMessages[outgoingMessages.length - 1] = {
                    role: "user",
                    content: [
                        { type: "text", text: lastUserMessage.content },
                        { type: "image_url", image_url: { url: imageBase64 } }
                    ]
                };
            }
        }

        const modelCandidates = [
            imageBase64 ? visionModel : process.env.GROQ_MODEL,
            imageBase64 ? "qwen/qwen3.8-27b" : "llama-3.3-70b-versatile",
            imageBase64
                ? "meta-models/muse-spark-open"
                : "openai/gpt-oss-20b"
        ].filter((model, index, models) => model && models.indexOf(model) === index);

        let data = null;
        let lastProviderError = null;

        for (const model of modelCandidates) {
            try {
                const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${groqKey}`
                    },
                    body: JSON.stringify({
                        model,
                        messages: outgoingMessages,
                        temperature: 0.7,
                        max_tokens: imageBase64 ? 800 : 1024
                    }),
                    signal: AbortSignal.timeout(45000)
                });

                data = await response.json();

                if (!response.ok) {
                    lastProviderError = data?.error?.message || `El proveedor respondió con estado ${response.status}.`;
                    const modelUnavailable = response.status === 404 ||
                        (response.status === 400 &&
                            /model.*(?:does not exist|not found|not available|do not have access|not have access|no access|decommissioned)/i
                                .test(lastProviderError));
                    if (!modelUnavailable) {
                        console.error("Groq error:", response.status, lastProviderError);
                        break;
                    }
                    console.warn("Groq model unavailable; trying fallback:", model);
                    continue;
                }

                const choice = data?.choices?.[0];
                const content = typeof choice?.message?.content === "string"
                    ? choice.message.content.trim()
                    : Array.isArray(choice?.message?.content)
                        ? choice.message.content
                            .filter((part) => typeof part?.text === "string")
                            .map((part) => part.text)
                            .join("\n")
                            .trim()
                        : "";

                if (content) {
                    data = { choices: [{ message: { role: "assistant", content } }] };
                    lastProviderError = null;
                    break;
                }

                lastProviderError = "El proveedor respondió sin texto.";
                console.error("Groq empty response:", model, choice?.finish_reason || "unknown");
            } catch (error) {
                if (error.name === "TimeoutError") {
                    lastProviderError = "La solicitud al proveedor tardó demasiado.";
                    break;
                }
                throw error;
            }
        }

        if (lastProviderError) {
            return res.status(502).json({ error: lastProviderError });
        }

        res.json(data);
    } catch (error) {
        console.error("Chat error:", error.name === "TimeoutError" ? "timeout" : error.message);
        res.status(504).json({ error: "La solicitud tardó demasiado. Inténtalo de nuevo." });
    }
});

app.use((error, req, res, next) => {
    if (req.path === "/transcribe" && error.type === "entity.too.large") {
        return res.status(413).json({ error: "El audio no puede superar 15 MB." });
    }
    if (req.path === "/transcribe" && error.type === "encoding.unsupported") {
        return res.status(415).json({ error: "La codificación del audio no es compatible." });
    }
    next(error);
});

app.listen(port, () => console.log(`MelDya IA funcionando en puerto ${port}`));