const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const webRoutes = require("./routes/webRoute"); // Import the routes

const {
  connectToWhatsApp,
  setSocket,
  isConnected,
  getQR,
  updateQR,
} = require("./controllers/whatsappController");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = process.env.PORT || 8000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/assets", express.static(path.join(__dirname, "client/assets")));
app.use("/", webRoutes); // Use the routes

io.on("connection", (socket) => {
  setSocket(socket);
  if (isConnected()) {
    updateQR("connected");
  } else if (getQR()) {
    updateQR("qr");
  }
});

// Start the server
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  connectToWhatsApp();
});
