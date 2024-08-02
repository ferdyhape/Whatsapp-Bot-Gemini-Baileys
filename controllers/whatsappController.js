const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  makeInMemoryStore,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode");
const fs = require("fs");
const pino = require("pino");

const { generate } = require("./googleController");

const store = makeInMemoryStore({
  logger: pino().child({ level: "silent", stream: "store" }),
});

let sock;
let qr;
let soket;

const connectToWhatsApp = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("baileys_auth_info");
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger: pino({ level: "silent" }),
    version,
    shouldIgnoreJid: (jid) => isJidBroadcast(jid),
  });

  store.bind(sock.ev);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const reason = new Boom(lastDisconnect.error).output.statusCode;
      switch (reason) {
        case DisconnectReason.badSession:
          console.log(`Bad Session File, Please Delete session and Scan Again`);
          deleteAuthData();
          break;
        case DisconnectReason.connectionClosed:
        case DisconnectReason.connectionLost:
        case DisconnectReason.restartRequired:
        case DisconnectReason.timedOut:
          console.log("Connection closed, reconnecting....");
          connectToWhatsApp();
          break;
        case DisconnectReason.connectionReplaced:
          console.log(
            "Connection Replaced, Please Close Current Session First"
          );
          deleteAuthData();
          connectToWhatsApp();
          break;
        case DisconnectReason.loggedOut:
          console.log(
            `Device Logged Out, Please Delete session and Scan Again.`
          );
          deleteAuthData();
          connectToWhatsApp();
          break;
        default:
          console.log(
            `Unknown DisconnectReason: ${reason}|${lastDisconnect.error}`
          );
      }
    } else if (connection === "open") {
      console.log("opened connection");
      return;
    }
    if (update.qr) {
      qr = update.qr;
      updateQR("qr");
    } else if ((qr = undefined)) {
      updateQR("loading");
    } else if (update.connection === "open") {
      updateQR("qrscanned");
    }
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type === "notify" && !messages[0].key.fromMe) {
      const pesan = messages[0].message.conversation;
      const noWa = messages[0].key.remoteJid;

      await sock.readMessages([messages[0].key]);

      // Check if the message contains '.bot'
      if (pesan.includes("/bot")) {
        const response = await generate(pesan);
        await sock.sendMessage(
          noWa,
          { text: response },
          { quoted: messages[0] }
        );
      }
    }
  });
};

const deleteAuthData = () => {
  try {
    fs.rmSync("baileys_auth_info", { recursive: true, force: true });
    console.log("Authentication data deleted.");
  } catch (error) {
    console.error("Error deleting authentication data:", error);
  }
};

const isConnected = () => !!sock?.user;

const updateQR = (data) => {
  switch (data) {
    case "qr":
      qrcode.toDataURL(qr, (err, url) => {
        soket?.emit("qr", url);
        soket?.emit("log", "QR Code received, please scan!");
      });
      break;
    case "connected":
      soket?.emit("qrstatus", "./assets/check.svg");
      soket?.emit("log", "WhatsApp terhubung!");
      break;
    case "qrscanned":
      soket?.emit("qrstatus", "./assets/check.svg");
      soket?.emit("log", "QR Code Telah discan!");
      break;
    case "loading":
      soket?.emit("qrstatus", "./assets/loader.gif");
      soket?.emit("log", "Registering QR Code, please wait!");
      break;
    default:
      break;
  }
};

const sendMessage = async (req, res) => {
  const pesankirim = req.body.message;
  const number = req.body.number;

  try {
    if (!number) {
      return res.status(500).json({
        status: false,
        response: "Nomor WA belum tidak disertakan!",
      });
    }

    const numberWA = `62${number.substring(1)}@s.whatsapp.net`;

    if (!isConnected()) {
      return res.status(500).json({
        status: false,
        response: `WhatsApp belum terhubung.`,
      });
    }

    const exists = await sock.onWhatsApp(numberWA);

    if (!exists?.jid && (!exists || !exists[0]?.jid)) {
      return res.status(500).json({
        status: false,
        response: `Nomor ${number} tidak terdaftar.`,
      });
    }

    if (req.files) {
      const file = req.files.file;
      await sock.sendMessage(exists.jid || exists[0].jid, {
        image: file.data,
        caption: pesankirim,
      });
      return res.status(200).json({
        status: true,
        response: "Pesan gambar terkirim.",
      });
    }

    await sock.sendMessage(exists.jid || exists[0].jid, { text: pesankirim });
    return res.status(200).json({
      status: true,
      response: "Pesan terkirim.",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      response: error.message,
    });
  }
};

const getQR = () => qr;

const setSocket = (socket) => {
  soket = socket;
};

module.exports = {
  connectToWhatsApp,
  sendMessage,
  updateQR,
  isConnected,
  setSocket,
  getQR,
};
