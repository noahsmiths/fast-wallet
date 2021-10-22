const { dialog } = require("@electron/remote");
const reqBase = require("request-promise-native");
const fs = require("fs");
const certFolder = `${process.env.APPDATA}\\Daedalus Mainnet\\tls\\client\\`;

const modeDialog = {
    message: "Are you using Daedalus or Server mode?",
    buttons: ["Server", "Daedalus"],
    defaultId: 0
}

let request;

const logEl = document.getElementById("logging");
const ipEl = document.getElementById("ip");
const portEl = document.getElementById("port");
const walletEl = document.getElementById("walletID");
const lovelaceEl = document.getElementById("lovelace");
const transactionEl = document.getElementById("transaction");
const passphraseEl = document.getElementById("passphrase");
const addressEl = document.getElementById("address");

let ip, port;

let httpScheme;

const log = (text) => {
    logEl.value += `${text}\n`;
}

const clearLog = () => {
    logEl.value = "";
}

if (dialog.showMessageBoxSync(modeDialog) === 1) {
    httpScheme = "https";
    request = reqBase.defaults({
        cert: fs.readFileSync(certFolder + "client.pem"),
        key: fs.readFileSync(certFolder + "client.key"),
        ca: fs.readFileSync(certFolder + "ca.crt"),
    });
    ipEl.value = "localhost";
    ip = "localhost";
    log("Daedalus mode selected.");
} else {
    httpScheme = "http";
    request = reqBase;
    log("Server mode selected.");
}

const getWalletData = async () => {
    try {
        let walletData = await request({
            method: "GET",
            uri: `${httpScheme}://${ip}:${port}/v2/wallets`,
            strictSSL: false,
            json: true
        });
    
        let wallets = "";
            
        for (let i = 0; i < walletData.length; i++) {
            let wallet = walletData[i];
            wallets += `${wallet.id} - ${wallet.name} (${(wallet.balance.available.quantity/1000000).toFixed(6)}) ADA\n`;
        }
    
        log(wallets.substring(0, wallets.length - 1));
    } catch (e) {
        log(e);
    }
}

const sendTransaction = async (passphrase, lovelaceAmount, transactionAmount, toAddress, chosenWalletID) => {
    console.log(passphrase);
    console.log(lovelaceAmount);
    console.log(transactionAmount);
    console.log(toAddress);
    console.log(chosenWalletID);

    let confirmationDialog = {
        message: `You have entered ${transactionAmount} transaction(s) for ${lovelaceAmount} Lovelace (~${(lovelaceAmount/1000000).toFixed(2)} ADA) to ${toAddress}. Continue?`,
        buttons: ["Yes", "No"],
        defaultId: 0
    }

    if (dialog.showMessageBoxSync(confirmationDialog) === 0) {
        log(`Authorized ${transactionAmount} transaction(s) for ${lovelaceAmount} Lovelace (~${(lovelaceAmount/1000000).toFixed(2)} ADA) to ${toAddress}.`);
        for (let j = 0; j < transactionAmount; j++) {
            try {
                let transaction = await request({
                    method: "POST",
                    uri: `${httpScheme}://${ip}:${port}/v2/wallets/${chosenWalletID}/transactions`,
                    json: true,
                    strictSSL: false,
                    body: {
                        "passphrase": passphrase,
                        "payments": [
                            {
                                "address": toAddress,
                                "amount": {
                                    "quantity": lovelaceAmount,
                                    "unit": "lovelace"
                                }
                            }
                        ],
                        "withdrawal": "self"
                    }
                });
                log(`Transaction ${j} sent!`);
            } catch (tErr) {
                console.log(tErr);
                log(`Error processing transaction ${j}`);
            }
        }
    }
}

lovelaceEl.addEventListener("change", () => {
    document.getElementById("conversion").innerText = `${(lovelaceEl.value/1000000).toFixed(6)} ADA`;
});

portEl.addEventListener("change", () => {
    port = portEl.value.trim();
});

ipEl.addEventListener("change", () => {
    ip = ipEl.value.trim();
});

document.getElementById("clear").addEventListener("click", clearLog);

addressEl.addEventListener("keydown", (e) => {
    if (e.keyCode === 13) {
        sendTransaction(passphraseEl.value.trim(), +lovelaceEl.value.trim(), +transactionEl.value.trim(), addressEl.value.trim(), walletEl.value.trim());
    }
});

document.getElementById("send").addEventListener("click", () => {
    sendTransaction(passphraseEl.value.trim(), +lovelaceEl.value.trim(), +transactionEl.value.trim(), addressEl.value.trim(), walletEl.value.trim());
});

document.getElementById("connect").addEventListener("click", () => {
    getWalletData();
});