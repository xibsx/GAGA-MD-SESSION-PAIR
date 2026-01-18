const { giftedid } = require('./id'); 
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const { Storage } = require("megajs");

const {
    default: Gifted_Tech,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

/*// Array of Mega credentials
const megaCredentials = [
    { email: 'vincentgaga46@gmail.com', password: 'gagamd2026' },
    { email: '', password: '' }
];
*/
// Array of Mega credentials
const megaCredentials = [
  { email: 'vincentgaga46@gmail.com', password: 'Gaga@2010' }
];


// Group and Channel IDs
const GROUP_INVITE_CODE = "120363421900340047@g.us";
const CHANNEL_JID = "120363421253418589@newsletter";

// Custom pairing code
const CUSTOM_PAIRING_CODE = "GAGAMDV1";

// Function to generate a random Mega ID
function randomMegaId(length = 6, numberLength = 4) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const number = Math.floor(Math.random() * Math.pow(10, numberLength));
    return `${result}${number}`;
}

// Function to upload credentials to Mega
async function uploadCredsToMega(credsPath) {
    try {
        const chosenCreds = megaCredentials[Math.floor(Math.random() * megaCredentials.length)];
        const storage = await new Storage({
            email: chosenCreds.email,
            password: chosenCreds.password
        }).ready;
        console.log('Mega storage initialized.');

        if (!fs.existsSync(credsPath)) {
            throw new Error(`File not found: ${credsPath}`);
        }

        const fileSize = fs.statSync(credsPath).size;
        const uploadResult = await storage.upload({
            name: `${randomMegaId()}.json`,
            size: fileSize
        }, fs.createReadStream(credsPath)).complete;

        console.log('Session successfully uploaded to Mega.');
        const fileNode = storage.files[uploadResult.nodeId];
        const megaUrl = await fileNode.link();
        console.log(`Session Url: ${megaUrl}`);
        return megaUrl;
    } catch (error) {
        console.error('Error uploading to Mega:', error);
        throw error;
    }
}

// Function to remove a file
function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

// Router to handle pairing code generation
router.get('/', async (req, res) => {
    const id = giftedid(); 
    let num = req.query.number;

    async function GIFTED_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

        try {
            let Gifted = Gifted_Tech({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari")
            });

            if (!Gifted.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                
                // Use custom pairing code here
                const code = await Gifted.requestPairingCode(num, CUSTOM_PAIRING_CODE);
                console.log(`Your Code: ${code}`);

                if (!res.headersSent) {
                    res.send({ code });
                }
            }

            Gifted.ev.on('creds.update', saveCreds);
            Gifted.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    await delay(5000);
                    const filePath = __dirname + `/temp/${id}/creds.json`;

                    if (!fs.existsSync(filePath)) {
                        console.error("File not found:", filePath);
                        return;
                    }

                    // Upload session to Mega
                    const megaUrl = await uploadCredsToMega(filePath);
                    const sid = megaUrl.includes("https://mega.nz/file/")
                        ? 'GAGA-MD;;;' + megaUrl.split("https://mega.nz/file/")[1]
                        : 'Error: Invalid URL';

                    console.log(`Session ID: ${sid}`);

                    // Send session ID first
                    await Gifted.sendMessage(Gifted.user.id, { text: sid });

                    // Auto join group
                    try {
                        await Gifted.groupAcceptInvite(GROUP_INVITE_CODE);
                        console.log("Successfully joined GAGA-MD group");
                    } catch (groupError) {
                        console.error("Group join error:", groupError.message);
                        await Gifted.sendMessage(Gifted.user.id, {
                            text: "Couldn't auto-join group. Please join manually: https://chat.whatsapp.com/HKHFUb0ThuzKF8AoPztVjZ"
                        });
                    }

                    // Auto follow channel
                    try {
                        const metadata = await Gifted.newsletterMetadata(CHANNEL_JID);
                        if (metadata.viewer_metadata === null) {
                            await Gifted.newsletterFollow(CHANNEL_JID);
                            console.log("GAGA MD CHANNEL FOLLOW ✅");
                        }
                    } catch (channelError) {
                        console.error("Channel follow error:", channelError.message);
                    }

                    // Send success message with image
                    const successMessage = `
🎉 *Welcome to GAGA-MD!* 🚀  

✅ *Successfully Configured!*
✔️ Session Created & Secured
✔️ Added to Support Group
✔️ Subscribed to Updates Channel

🔒 *Your Session ID* is ready!  
⚠️ _Keep it private and secure - don't share it with anyone._ 

💡 *What's Next?* 
1️⃣ Explore all the cool features
2️⃣ Check /menu for commands
3️⃣ Enjoy seamless automation! 🤖  

🔗 *Support Channel:* 
👉 https://whatsapp.com/channel/0029Vb6njtcG3R3n7HS5Vs0P

⭐ *GitHub:* 
👉 https://github.com/LGT09/  

🚀 _Thanks for choosing GAGA-MD-BOT!_ ✨`;

                    await Gifted.sendMessage(Gifted.user.id, {
                        image: { url: "https://files.catbox.moe/hvljlp.jpg" },
                        caption: successMessage.trim()
                    });

                    await delay(100);
                    await Gifted.ws.close();
                    return removeFile('./temp/' + id);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    GIFTED_PAIR_CODE();
                }
            });
        } catch (err) {
            console.error("Service Has Been Restarted:", err);
            removeFile('./temp/' + id);

            if (!res.headersSent) {
                res.send({ code: "Service is Currently Unavailable" });
            }
        }
    }

    await GIFTED_PAIR_CODE();
});

module.exports = router;
