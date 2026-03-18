const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const zlib = require('zlib');
const axios = require('axios');

async function startBot() {
    // --- Session Setup ---
    if (!fs.existsSync('./auth_info')) fs.mkdirSync('./auth_info');
    
    const sessionData = process.env.SESSION_ID;
    if (sessionData && sessionData.startsWith('Gifted~')) {
        try {
            const base64Data = sessionData.split('Gifted~')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const decodedSession = zlib.gunzipSync(buffer).toString();
            fs.writeFileSync('./auth_info/creds.json', decodedSession);
            console.log("✅ Session Loaded Successfully!");
        } catch (e) {
            console.log("❌ Session Decode Error:", e.message);
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["MFlix Bot", "Chrome", "1.0.0"],
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    // --- Connection Handling (Fixed 405 Loop) ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const statusCode = lastDisconnect.error?.output?.statusCode;
            console.log(`❌ Connection Closed. Status: ${statusCode}`);

            // 405 (Method Not Allowed) හෝ 401 (Unauthorized) නම් Reconnect වෙන්න එපා
            const shouldReconnect = statusCode !== 405 && statusCode !== 401 && statusCode !== DisconnectReason.loggedOut;
            
            if (shouldReconnect) {
                console.log('🔄 Reconnecting in 5 seconds...');
                setTimeout(() => startBot(), 5000);
            } else {
                console.log('🚫 Session Conflict or Expired. Stopping process to avoid loop.');
                process.exit(1); 
            }
        } else if (connection === 'open') {
            console.log('✅ Bot is Online and Ready!');
        }
    });

    // --- Message Handling (.tv command) ---
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (text.startsWith('.tv')) {
            const fileId = text.split(' ')[1];
            if (!fileId) return;

            await sock.sendMessage(from, { text: "⏳ Request එක ලැබුණා. පද්ධතියට යොමු කරමින්..." });

            const scriptUrl = "https://script.google.com/macros/s/AKfycbxt_uJxcAo5Q0YRFnJd8TxI1wBkwsMHDhvO1a8vt6z1uwkqLYVm7oQQEvJNHJBvnyme/exec";

            try {
                await axios.post(scriptUrl, { fileId: fileId, userJid: from });
                await sock.sendMessage(from, { text: "✅ සාර්ථකයි! වීඩියෝව සූදානම් කර එවනු ඇත." });
            } catch (error) {
                console.error("❌ Sheet Error:", error.message);
            }
        }
    });

    // GitHub Action එක ඉවර නොවී විනාඩි 2ක් පවත්වා ගැනීමට (වීඩියෝව යවන තුරු)
    setTimeout(() => {
        console.log("⏰ Task completed. Shutting down...");
        process.exit(0);
    }, 120000); 
}

startBot();
