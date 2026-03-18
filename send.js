const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const zlib = require('zlib');

async function sendMovie() {
    if (!fs.existsSync('./auth_info')) fs.mkdirSync('./auth_info');
    
    const sessionData = process.env.SESSION_ID;
    try {
        const base64Data = sessionData.split('Gifted~')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const decodedSession = zlib.gunzipSync(buffer).toString();
        fs.writeFileSync('./auth_info/creds.json', decodedSession);
    } catch (e) {
        console.log("❌ Session Error: " + e.message);
        process.exit(1);
    }

    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        
        if (connection === 'open') {
            console.log("✅ WhatsApp එකට සම්බන්ධ වුණා!");
            const userJid = process.env.USER_JID;
            const filePath = './movie_mflix.mp4';

            if (fs.existsSync(filePath)) {
                console.log("📤 වීඩියෝ එක යවනවා... (මඳක් රැඳී සිටින්න)");
                
                await sock.sendMessage(userJid, { 
                    video: fs.readFileSync(filePath), 
                    caption: "🎬 *MFlix Video Delivery*\n\nමෙන්න ඔයා ඉල්ලපු වීඩියෝ එක සාර්ථකව ලැබුණා. රසවිඳින්න!\n\nPowered by edulk.xyz",
                    mimetype: 'video/mp4',
                    fileName: 'MFlix_Movie.mp4'
                });

                console.log("🚀 වීඩියෝ එක සාර්ථකව යැව්වා!");
                await delay(10000); // Upload එක ස්ථිර වීමට තත්පර 10ක් රැඳී සිටීම
                process.exit(0);
            } else {
                console.log("❌ වීඩියෝ ෆයිල් එක සොයාගත නොහැක!");
                process.exit(1);
            }
        }
    });
}

sendMovie();
