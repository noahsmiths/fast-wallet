const { app, dialog } = require("@electron/remote");
const { version } = require("./package.json");
const reqBase = require("request-promise-native");
const fs = require("fs");
const path = require("path");
const certFolder = path.normalize(`${app.getPath("userData")}/../Daedalus Mainnet/tls/client/`);

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
const confirmEl = document.getElementById("confirm-tx");
const highlightOnFocusEl = document.getElementById("highlight-on-focus");
const initialDelayEl = document.getElementById("initial-delay");
const betweenTransactionDelayEl = document.getElementById("between-tx-delay");

let ip, port;
let sendOnPaste = false;
let httpScheme;

const log = (text) => {
    logEl.value += `${text}\n`;
}

const clearLog = () => {
    logEl.value = "";
}

const wait = (time) => {
    return new Promise((res) => {
        setTimeout(res, time);
    });
}

log(`Running version ${version}`);

if (dialog.showMessageBoxSync(modeDialog) === 1) {
    httpScheme = "https";
    request = reqBase.defaults({
        cert: fs.readFileSync(path.resolve(certFolder + "client.pem")),
        key: fs.readFileSync(path.resolve(certFolder + "client.key")),
        ca: fs.readFileSync(path.resolve(certFolder + "ca.crt")),
    });
    ipEl.value = "localhost";
    ip = "localhost";
    log("Daedalus mode selected.");
} else {
    httpScheme = "https";
    if (app.isPackaged) {
        request = reqBase.defaults({
            cert: fs.readFileSync(path.resolve(process.resourcesPath + "/certs/client.pem")),
            key: fs.readFileSync(path.resolve(process.resourcesPath + "/certs/client.key")),
            ca: fs.readFileSync(path.resolve(process.resourcesPath + "/certs/ca.crt")),
        });
    } else {
        request = reqBase.defaults({
            cert: fs.readFileSync(path.resolve("certs/client.pem")),
            key: fs.readFileSync(path.resolve("certs/client.key")),
            ca: fs.readFileSync(path.resolve("certs/ca.crt")),
        });
    }
    
    let lastIp = localStorage.getItem("lastIp");
    let lastPort = localStorage.getItem("lastPort");

    if (lastIp) {
        ipEl.value = lastIp;
        ip = lastIp;
    }
    if (lastPort) {
        portEl.value = lastPort;
        port = lastPort;
    }
    
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
    
        //let wallets = "";

        walletEl.innerHTML = "";
        walletEl.size = walletData.length;
            
        for (let i = 0; i < walletData.length; i++) {
            let wallet = walletData[i];
            let option = document.createElement("option");
            option.value = wallet.id;
            option.innerHTML = `${wallet.id} - ${wallet.name} (${(wallet.balance.available.quantity/1000000).toFixed(6)}) ADA`;
            walletEl.appendChild(option);

            //wallets += `${wallet.id} - ${wallet.name} (${(wallet.balance.available.quantity/1000000).toFixed(6)}) ADA\n`;
        }
    
        //log(wallets.substring(0, wallets.length - 1));
        log("Loaded wallets.");
    } catch (e) {
        log(e);
    }
}

const sendTransaction = async (passphrases, lovelaceAmount, transactionAmount, toAddress, chosenWallets, confirmTx, initialDelay = false, betweenTransactionDelay = false) => {
    console.log(passphrases);
    console.log(lovelaceAmount);
    console.log(transactionAmount);
    console.log(toAddress);
    console.log(chosenWallets);
    console.log(confirmTx);

    let confirmationDialog = {
        message: `You have entered ${transactionAmount} transaction(s) for ${lovelaceAmount} Lovelace (${(lovelaceAmount/1000000).toFixed(6)} ADA) to ${toAddress} on ${chosenWallets.length} wallet(s). Continue?`,
        buttons: ["Yes", "No"],
        defaultId: 0
    }

    if (confirmTx) {
        if (dialog.showMessageBoxSync(confirmationDialog) === 0) {
            if (initialDelay) {
                log(`Delaying ${initialDelay}ms...`);
                await wait(initialDelay);
            }
            log(`Authorized ${transactionAmount} transaction(s) for ${lovelaceAmount} Lovelace (${(lovelaceAmount/1000000).toFixed(6)} ADA) to ${toAddress} on ${chosenWallets.length} wallet(s).`);
            
            for (let j = 0; j < transactionAmount; j++) {
                for (let c = 0; c < chosenWallets.length; c++) {
                    let chosenWalletID = chosenWallets[c];
                    let passphrase = passphrases[c];
                    console.log(`${chosenWalletID} with passphrase ${passphrase}`);

                    log(`Attempting to send transaction ${j + 1}...`);

                    request({
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
                    })
                    .then((r) => {
                        log(`Transaction ${j + 1} sent!`);
                    })
                    .catch((tErr) => {
                        console.log(tErr);
                        log(`Error processing transaction ${j + 1}`);
                    });
                }
                
                if (betweenTransactionDelay) {
                    log(`Delaying ${betweenTransactionDelay}ms...`);
                    await wait(betweenTransactionDelay);
                }
            }
        }
    } else {
        if (initialDelay) {
            log(`Delaying ${initialDelay}ms...`);
            await wait(initialDelay);
        }
        log(`Authorized ${transactionAmount} transaction(s) for ${lovelaceAmount} Lovelace (${(lovelaceAmount/1000000).toFixed(6)} ADA) to ${toAddress} on ${chosenWallets.length} wallet(s).`);
        
        for (let j = 0; j < transactionAmount; j++) {
            for (let c = 0; c < chosenWallets.length; c++) {
                let chosenWalletID = chosenWallets[c];
                let passphrase = passphrases[c];
                console.log(`${chosenWalletID} with passphrase ${passphrase}`);

                log(`Attempting to send transaction ${j + 1}...`);

                request({
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
                })
                .then((r) => {
                    log(`Transaction ${j + 1} sent!`);
                })
                .catch((tErr) => {
                    console.log(tErr);
                    log(`Error processing transaction ${j + 1}`);
                });
            }
            
            if (betweenTransactionDelay) {
                log(`Delaying ${betweenTransactionDelay}ms...`);
                await wait(betweenTransactionDelay);
            }
        }
    }
}

lovelaceEl.addEventListener("change", () => {
    document.getElementById("conversion").innerText = `${(lovelaceEl.value/1000000).toFixed(6)} ADA`;
});

portEl.addEventListener("change", () => {
    port = portEl.value.trim();
    localStorage.setItem("lastPort", port);
});

ipEl.addEventListener("change", () => {
    ip = ipEl.value.trim();
    localStorage.setItem("lastIp", ip);
});

document.getElementById("clear").addEventListener("click", clearLog);

addressEl.addEventListener("keydown", (e) => {
    if (e.keyCode === 13) {
        sendTransaction(passphraseEl.value.trim().split(" "), +lovelaceEl.value.trim(), +transactionEl.value.trim(), addressEl.value.trim(), [...walletEl.options].filter(opt => opt.selected).map(opt => opt.value), confirmEl.checked, +initialDelayEl.value, +betweenTransactionDelayEl.value);
    }
});

document.getElementById("send").addEventListener("click", () => {
    sendTransaction(passphraseEl.value.trim().split(" "), +lovelaceEl.value.trim(), +transactionEl.value.trim(), addressEl.value.trim(), [...walletEl.options].filter(opt => opt.selected).map(opt => opt.value), confirmEl.checked, +initialDelayEl.value, +betweenTransactionDelayEl.value);
});

document.getElementById("connect").addEventListener("click", () => {
    getWalletData();
});

document.getElementById("send-on-paste").addEventListener("change", (e) => {
    sendOnPaste = e.target.checked;
});

window.addEventListener("focus", (e) => {
    if (highlightOnFocusEl.checked) {
        addressEl.focus();
    }
});

addressEl.addEventListener("paste", (e) => {
    if (sendOnPaste) {
        addressEl.value = e.clipboardData.getData("text");
        //console.log();
        sendTransaction(passphraseEl.value.trim().split(" "), +lovelaceEl.value.trim(), +transactionEl.value.trim(), addressEl.value.trim(), [...walletEl.options].filter(opt => opt.selected).map(opt => opt.value), confirmEl.checked);
        e.preventDefault();
    }
});