# WABot Gemini

## :open_book: Description

Integrate WhatsApp Bot with Gemini API. This project is a simple WhatsApp bot that can interact with the Gemini API. This project is built using Node.js and whiskeysockets/baileys library.

:smile: Actually this is not a meaningful project, it's just that I was bored and wanted to make a bot on whatsapp. So, I made this project.

## :hammer_and_wrench: Requirements

- Node.js v18+

## :rocket: How to Install

1. Create API Key on [aistudio](https://aistudio.google.com/app/apikey)
2. Clone this repository
   ```bash
    git clone https://github.com/ferdyhape/Whatsapp-Bot-Gemini-Baileys.git
   ```
3. Go to the project directory and install the dependencies
   ```bash
    cd Whatsapp-Bot-Gemini-Baileys
    npm install
   ```
4. Copy `.env.example` to `.env` and paste your API Key to `GEMINI_API_KEY`
   ```bash
    cp .env.example .env
   ```
   ```env
    GEMINI_API_KEY = "YOUR_API_KEY"
   ```
5. Run the project
   ```bash
    npm start
   ```
6. Open your browser and go to `http://localhost:8000/scan` to scan the QR Code with your WhatsApp app (this device will integrate with the bot)
7. After scanning the QR Code, your whatsapp bot is ready to use
<!-- Kirim pesan ke bot WhatsApp Anda dengan pesan yang include `/bot` ke whatsapp yang sebelumnya telah di scan qr -->
8. Send a message to your WhatsApp bot with a message that includes `/bot` to the WhatsApp that has been scanned previously with the QR Code, for example:
   ```bash
    hello /bot, how are you?
   ```
9. Wait a moment, the bot will reply to your message.
10. Enjoy!

## :man: About Creator

[![linkedin](https://img.shields.io/badge/linkedin-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/ferdy-hahan-pradana)
[![instagram](https://img.shields.io/badge/instagram-833AB4?style=for-the-badge&logo=instagram&logoColor=white)](https://instagram.com/ferdyhape)
[![github](https://img.shields.io/badge/github-333?style=for-the-badge&logo=github&logoColor=white)](https://github.com/ferdyhape)
