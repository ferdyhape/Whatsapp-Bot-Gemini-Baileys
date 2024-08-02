const express = require("express");
const path = require("path");
const router = express.Router();

router.get("/scan", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/server.html"));
});

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

module.exports = router;
