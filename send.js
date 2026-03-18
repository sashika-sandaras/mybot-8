const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

async function sendMovie() {
    // Session ID එකෙන් Auth ෆෝල්ඩරය හදනවා
    if (!fs.existsSync('./auth_info')) {
        fs.mkdirSync('./auth_info');
    }
    
    // Gifted-Tech Session ID එකෙන් creds.json එක හදනවා
    const sessionData = process.env.SESSION_ID;
    // මෙතනදී Session එක decode කරලා creds.json එකට දාන්න ඕනේ
    // බොහොමයක් Session ID එන්නේ Base64 වලින්, අපි ඒක පාවිච්චි කරමු
    try {
        const decodedSession = Buffer.from(sessionData.split('Gifted~')[1], 'base64').toString();
        fs.writeFileSync('./auth_info/creds.json', decodedSession);
    } catch (e) {
        console.log("❌ Session ID එක Decode කිරීමේදී ගැටලුවක්: " + e.message);
    }

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log("✅ WhatsApp එකට සම්බන්ධ වුණා!");
            const userJid = process.env.USER_JID;
            const filePath = './movie_mflix.mp4';

            console.log("📤 වීඩියෝ එක අප්ලෝඩ් කරනවා...");
            await sock.sendMessage(userJid, { 
                video: fs.readFileSync(filePath), 
                caption: "🎬 මෙන්න ඔයා ඉල්ලපු MFlix වීඩියෝ එක!\n\nWebsite: edulk.xyz",
                mimetype: 'video/mp4',
                fileName: 'movie.mp4'
            });

            console.log("🚀 සාර්ථකව යැව්වා!");
            await delay(5000); // විනාඩි කිහිපයක් රැඳී සිටීම
            process.exit(0);
        } else if (connection === 'close') {
            console.log("❌ සම්බන්ධතාවය විසන්ධි වුණා.");
        }
    });
}

sendMovie();
