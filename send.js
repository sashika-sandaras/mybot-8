const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const zlib = require('zlib');
const axios = require('axios');

async function startBot() {
    if (!fs.existsSync('./auth_info')) fs.mkdirSync('./auth_info');
    const sessionData = process.env.SESSION_ID;
    
    try {
        if (sessionData) {
            const base64Data = sessionData.split('Gifted~')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const decodedSession = zlib.gunzipSync(buffer).toString();
            fs.writeFileSync('./auth_info/creds.json', decodedSession);
        }
    } catch (e) { console.log("❌ Session Error"); }

    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    const sock = makeWASocket({
        auth: state, version,
        logger: pino({ level: 'silent' }),
        connectTimeoutMs: 120000
    });

    sock.ev.on('creds.update', saveCreds);

    // --- වීඩියෝ එක එවීමේ කොටස (GitHub Action මගින් ක්‍රියාත්මක වේ) ---
    sock.ev.on('connection.update', async (update) => {
        if (update.connection === 'open') {
            console.log("✅ WhatsApp Connected!");
            const userJid = process.env.USER_JID;
            if (fs.existsSync('filename.txt') && userJid) {
                const fileName = fs.readFileSync('filename.txt', 'utf8').trim();
                if (fs.existsSync(`./${fileName}`)) {
                    await sock.sendMessage(userJid, { 
                        document: fs.readFileSync(`./${fileName}`), 
                        mimetype: fileName.endsWith('.mkv') ? 'video/x-matroska' : 'video/mp4',
                        fileName: fileName,
                        caption: `🎬 *MFlix Video Delivery*\n\n*File:* ${fileName}`
                    });
                    console.log("🚀 Sent!");
                    await delay(5000);
                    process.exit(0);
                }
            }
        }
    });

    // --- යූසර්ගේ මැසේජ් එක අරන් Google Sheet එකට යවන කොටස ---
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (text.startsWith('.tv')) {
            const fileId = text.split(' ')[1];
            if (!fileId) return sock.sendMessage(from, { text: "❌ ID එක ඇතුළත් කරන්න." });

            await sock.sendMessage(from, { text: "⏳ ඔබගේ ඉල්ලීම ලැබුණා. වීඩියෝව සූදානම් කරමින් පවතී..." });

            try {
                // මෙතනට ඔයාගේ Google Apps Script URL එක දාන්න
                const scriptUrl = "ඔයාගේ_APPS_SCRIPT_URL_එක";
                await axios.post(scriptUrl, { fileId: fileId, userJid: from });
            } catch (err) { console.log("❌ Error triggering script"); }
        }
    });
}
startBot();
