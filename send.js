const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    delay,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

async function startBot() {
    // Session Setup
    if (!fs.existsSync('./auth_info')) fs.mkdirSync('./auth_info');
    const sessionData = process.env.SESSION_ID;
    if (sessionData && sessionData.startsWith('Gifted~')) {
        try {
            const base64Data = sessionData.split('Gifted~')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const decodedSession = zlib.gunzipSync(buffer).toString();
            fs.writeFileSync('./auth_info/creds.json', decodedSession);
        } catch (e) { console.log("Session Error"); }
    }

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        connectTimeoutMs: 180000,
    });

    sock.ev.on('creds.update', saveCreds);

    // --- Status Messages යැවීමේ Function එක ---
    async function sendStatus(jid, text) {
        await sock.sendMessage(jid, { text: text });
    }

    async function processAndSend() {
        const userJid = process.env.USER_JID;
        const fileNameFile = 'filename.txt';

        // 1. මුලින්ම Request එක ලැබුණු බව දැනුම් දීම
        await sendStatus(userJid, "🎬 *MFlix Request Received!*\n\nඔබේ ඉල්ලීම සාර්ථකව ලැබුණා. පද්ධතිය දැන් ක්‍රියාත්මකයි. කරුණාකර රැඳී සිටින්න... ⏳");
        await delay(3000);

        if (fs.existsSync(fileNameFile)) {
            const fileName = fs.readFileSync(fileNameFile, 'utf-8').trim();
            
            // 2. ෆයිල් එක බාන අතරතුර පණිවිඩය (Download check)
            await sendStatus(userJid, `📥 *Processing File:* ${fileName}\n\nදැන් ෆයිල් එක සූදානම් කරමින් පවතියි... 🚀`);
            await delay(2000);

            if (fs.existsSync(fileName)) {
                const extension = path.extname(fileName).toLowerCase();
                let mime = 'application/octet-stream';

                if (extension === '.mp4') mime = 'video/mp4';
                else if (extension === '.mkv') mime = 'video/x-matroska';
                else if (extension === '.srt') mime = 'text/plain';

                // 3. Upload වෙන්න කලින් පණිවිඩය
                await sendStatus(userJid, `📤 *Uploading to WhatsApp...*\n\nඔබේ ${extension.toUpperCase()} ෆයිල් එක දැන් වට්සැප් වෙත අප්ලෝඩ් වෙමින් පවතියි. කරුණාකර රැඳී සිටින්න.`);

                try {
                    await sock.sendMessage(userJid, { 
                        document: { url: `./${fileName}` }, 
                        fileName: fileName, 
                        mimetype: mime,
                        caption: `✅ *MFlix File Delivered!*\n\n📂 *Name:* ${fileName}\n🍿 *MFlix Engine*`
                    });

                    console.log("✅ Sent!");
                    fs.unlinkSync(fileName);
                    fs.unlinkSync(fileNameFile);
                    
                    await delay(2000);
                    await sendStatus(userJid, "✨ *Task Completed!* \nඔබට තවත් වීඩියෝ අවශ්‍ය නම් .tv කමාන්ඩ් එක භාවිතා කරන්න.");
                    
                    setTimeout(() => process.exit(0), 5000);
                } catch (err) {
                    await sendStatus(userJid, "❌ *Upload Error:* පද්ධතියේ දෝෂයක් ඇති විය. පසුව උත්සාහ කරන්න.");
                    process.exit(1);
                }
            }
        }
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('✅ Connected!');
            await processAndSend();
        } else if (connection === 'close') {
            startBot();
        }
    });
}

startBot();
