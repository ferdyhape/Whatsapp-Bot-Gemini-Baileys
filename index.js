const {
  default: makeWASocket,
  MessageType,
  MessageOptions,
  Mimetype,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  makeInMemoryStore,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");

const log = (pino = require("pino"));
const { session } = { session: "baileys_auth_info" };
const { Boom } = require("@hapi/boom");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");
const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = require("express")();
// enable files upload
app.use(
  fileUpload({
    createParentPath: true,
  })
);

const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function generate(prompt) {
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  return text;
}

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const port = process.env.PORT || 8000;
const qrcode = require("qrcode");

app.use("/assets", express.static(__dirname + "/client/assets"));

app.get("/scan", (req, res) => {
  res.sendFile("./client/server.html", {
    root: __dirname,
  });
});

app.get("/", (req, res) => {
  res.sendFile("./client/index.html", {
    root: __dirname,
  });
});

const store = makeInMemoryStore({
  logger: pino().child({ level: "silent", stream: "store" }),
});

let sock;
let qr;
let soket;

// Function to delete authentication data
function deleteAuthData() {
  try {
    fs.rmSync("baileys_auth_info", { recursive: true, force: true });
    console.log("Authentication data deleted.");
  } catch (error) {
    console.error("Error deleting authentication data:", error);
  }
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("baileys_auth_info");
  let { version, isLatest } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger: log({ level: "silent" }),
    version,
    shouldIgnoreJid: (jid) => isJidBroadcast(jid),
  });
  store.bind(sock.ev);
  sock.multi = true;
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      let reason = new Boom(lastDisconnect.error).output.statusCode;
      if (reason === DisconnectReason.badSession) {
        console.log(
          `Bad Session File, Please Delete ${session} and Scan Again`
        );
        deleteAuthData(); // Delete authentication data for bad session
      } else if (reason === DisconnectReason.connectionClosed) {
        console.log("Connection closed, reconnecting....");
        connectToWhatsApp(); // Reconnect on connection close
      } else if (reason === DisconnectReason.connectionLost) {
        console.log("Connection Lost from Server, reconnecting...");
        connectToWhatsApp(); // Reconnect on connection loss
      } else if (reason === DisconnectReason.connectionReplaced) {
        console.log(
          "Connection Replaced, Another New Session Opened, Please Close Current Session First"
        );
        deleteAuthData(); // Delete auth data for connection replaced
        connectToWhatsApp(); // Reconnect after deleting auth data
      } else if (reason === DisconnectReason.loggedOut) {
        console.log(
          `Device Logged Out, Please Delete ${session} and Scan Again.`
        );
        deleteAuthData(); // Delete authentication data for logout
        connectToWhatsApp(); // Reconnect after deleting auth data
      } else if (reason === DisconnectReason.restartRequired) {
        console.log("Restart Required, Restarting...");
        connectToWhatsApp(); // Reconnect on restart required
      } else if (reason === DisconnectReason.timedOut) {
        console.log("Connection TimedOut, Reconnecting...");
        connectToWhatsApp(); // Reconnect on timeout
      } else {
        console.log(
          `Unknown DisconnectReason: ${reason}|${lastDisconnect.error}`
        );
      }
    } else if (connection === "open") {
      console.log("opened connection");
      //   let getGroups = await sock.groupFetchAllParticipating();
      //   let groups = Object.values(await sock.groupFetchAllParticipating());
      //   for (let group of groups) {
      //     console.log(
      //       "id_group: " + group.id + " || Nama Group: " + group.subject
      //     );
      //   }
      return;
    }
    if (update.qr) {
      qr = update.qr;
      updateQR("qr");
    } else if ((qr = undefined)) {
      updateQR("loading");
    } else {
      if (update.connection === "open") {
        updateQR("qrscanned");
        return;
      }
    }
  });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type === "notify") {
      if (!messages[0].key.fromMe) {
        const pesan = messages[0].message.conversation;
        const noWa = messages[0].key.remoteJid;

        await sock.readMessages([messages[0].key]);

        // Check if the message contains '.bot'
        if (pesan.includes(".bot")) {
          const response = await generate(pesan);
          await sock.sendMessage(
            noWa,
            { text: response },
            { quoted: messages[0] }
          );
        }
      }
    }
  });
}

io.on("connection", async (socket) => {
  soket = socket;
  if (isConnected()) {
    updateQR("connected");
  } else if (qr) {
    updateQR("qr");
  }
});

// functions
const isConnected = () => {
  return sock.user;
};

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
      soket?.emit("log", "Registering QR Code , please wait!");
      break;
    default:
      break;
  }
};

// send text message to wa user
app.post("/send-message", async (req, res) => {
  const pesankirim = req.body.message;
  const number = req.body.number;
  const fileDikirim = req.files;

  let numberWA;
  try {
    if (!req.files) {
      if (!number) {
        res.status(500).json({
          status: false,
          response: "Nomor WA belum tidak disertakan!",
        });
      } else {
        numberWA = "62" + number.substring(1) + "@s.whatsapp.net";
        if (isConnected()) {
          const exists = await sock.onWhatsApp(numberWA);
          if (exists?.jid || (exists && exists[0]?.jid)) {
            sock
              .sendMessage(exists.jid || exists[0].jid, { text: pesankirim })
              .then((result) => {
                res.status(200).json({
                  status: true,
                  response: result,
                });
              })
              .catch((err) => {
                res.status(500).json({
                  status: false,
                  response: err,
                });
              });
          } else {
            res.status(500).json({
              status: false,
              response: `Nomor ${number} tidak terdaftar.`,
            });
          }
        } else {
          res.status(500).json({
            status: false,
            response: `WhatsApp belum terhubung.`,
          });
        }
      }
    } else {
      if (!number) {
        res.status(500).json({
          status: false,
          response: "Nomor WA belum tidak disertakan!",
        });
      } else {
        numberWA = "62" + number.substring(1) + "@s.whatsapp.net";
        if (isConnected()) {
          const exists = await sock.onWhatsApp(numberWA);
          if (exists?.jid || (exists && exists[0]?.jid)) {
            const file = req.files.file;
            await sock.sendMessage(exists.jid || exists[0].jid, {
              image: file.data,
              caption: pesankirim,
            });
            res.status(200).json({
              status: true,
              response: "Pesan gambar terkirim.",
            });
          } else {
            res.status(500).json({
              status: false,
              response: `Nomor ${number} tidak terdaftar.`,
            });
          }
        } else {
          res.status(500).json({
            status: false,
            response: `WhatsApp belum terhubung.`,
          });
        }
      }
    }
  } catch (e) {
    res.status(500).json({
      status: false,
      response: e.message,
    });
  }
});

// start server
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  connectToWhatsApp();
});
