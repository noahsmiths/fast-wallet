const { app, dialog } = require("@electron/remote");
const { version } = require("./package.json");
const request = require("request-promise-native");
const fs = require("fs");
const path = require("path");

const logEl = document.getElementById("logging");
const walletEl = document.getElementById("walletID");
const lovelaceEl = document.getElementById("lovelace");
const transactionEl = document.getElementById("transaction");
const passphraseEl = document.getElementById("passphrase");
const addressEl = document.getElementById("address");
const confirmEl = document.getElementById("confirm-tx");
const highlightOnFocusEl = document.getElementById("highlight-on-focus");
const initialDelayEl = document.getElementById("initial-delay");
const betweenTransactionDelayEl = document.getElementById("between-tx-delay");

let sendOnPaste = false;

const server = require('http').createServer();
const io = require('socket.io')(server);

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

let hasClientConnected = false;

io.on("connection", (client) => {
    if (!hasClientConnected) {
        hasClientConnected = true;

        client.on("accounts", (data) => {
            let keys = Object.keys(data);
            //console.log(data);
            walletEl.innerHTML = "";
            walletEl.size = keys.length;

            for (let key of keys) {
                let wallet = data[key];
                let option = document.createElement("option");
                option.value = key;
                option.innerHTML = `${wallet.index} - ${wallet.name} (${(wallet.lovelace/1000000).toFixed(6)}) ADA`;
                walletEl.appendChild(option);
            }

            log("Loaded wallets");
        });

        client.on("tx-sent", (data) => {
            log(`Transaction successfully sent on "${data.walletName}" with the following hash:\n${data.hash}`);
            console.log(data);
        });

        client.on("error-sending-tx", (data) => {
            log(`Error processing transaction on account id ${data.accountIndex}`);
        })

        client.on("error-priming", () => {
            log(`Error priming accounts. If this continues, just send transactions normally without priming.`);
        });

        client.on("primed-successfully", () => {
            log(`Nami primed and ready.`);
        })

        client.on("disconnect", () => {
            walletEl.innerHTML = "";
            //walletEl.size = 0;
            hasClientConnected = false;
            log("Nami disconnected");
        });

        io.emit("get-accounts");

        log("Nami connected");
    }
});

const primeNami = async () => {
    io.emit("prime", [...walletEl.options].filter(opt => opt.selected).map(opt => opt.value));
    log("Priming...");
}

const getWalletData = async () => {
    try {
        io.emit("get-accounts");
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
        message: `You have entered ${transactionAmount} transaction(s) for ${lovelaceAmount} ADA to ${toAddress} on ${chosenWallets.length} wallet(s). Continue?`,
        buttons: ["Yes", "No"],
        defaultId: 0
    }

    if (confirmTx) {
        if (dialog.showMessageBoxSync(confirmationDialog) === 0) {
            if (initialDelay) {
                log(`Delaying ${initialDelay}ms...`);
                await wait(initialDelay);
            }
            log(`Authorized ${transactionAmount} transaction(s) for ${lovelaceAmount} ADA to ${toAddress} on ${chosenWallets.length} wallet(s).`);
            
            for (let j = 0; j < transactionAmount; j++) {
                for (let c = 0; c < chosenWallets.length; c++) {
                    let chosenWalletID = chosenWallets[c];
                    let passphrase = passphrases.length > 1 ? passphrases[c] : passphrases[0];
                    console.log(`${chosenWalletID} with passphrase ${passphrase}`);

                    log(`Attempting to send transaction ${j + 1}...`);

                    io.emit("send-to-address", {
                        accountIndex: chosenWalletID,
                        address: toAddress,
                        amount: lovelaceAmount,
                        password: passphrase
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
        log(`Authorized ${transactionAmount} transaction(s) for ${lovelaceAmount} ADA to ${toAddress} on ${chosenWallets.length} wallet(s).`);
        
        for (let j = 0; j < transactionAmount; j++) {
            for (let c = 0; c < chosenWallets.length; c++) {
                let chosenWalletID = chosenWallets[c];
                let passphrase = passphrases.length > 1 ? passphrases[c] : passphrases[0];
                console.log(`${chosenWalletID} with passphrase ${passphrase}`);

                log(`Attempting to send transaction ${j + 1}...`);

                io.emit("send-to-address", {
                    accountIndex: chosenWalletID,
                    address: toAddress,
                    amount: lovelaceAmount,
                    password: passphrase
                });
            }
            
            if (betweenTransactionDelay) {
                log(`Delaying ${betweenTransactionDelay}ms...`);
                await wait(betweenTransactionDelay);
            }
        }
    }
}

document.getElementById("clear").addEventListener("click", clearLog);

addressEl.addEventListener("keydown", (e) => {
    if (e.keyCode === 13) {
        sendTransaction(passphraseEl.value.trim().split(" "), lovelaceEl.value.trim(), +transactionEl.value.trim(), addressEl.value.trim(), [...walletEl.options].filter(opt => opt.selected).map(opt => opt.value), confirmEl.checked, +initialDelayEl.value, +betweenTransactionDelayEl.value);
    }
});

document.getElementById("send").addEventListener("click", () => {
    sendTransaction(passphraseEl.value.trim().split(" "), lovelaceEl.value.trim(), +transactionEl.value.trim(), addressEl.value.trim(), [...walletEl.options].filter(opt => opt.selected).map(opt => opt.value), confirmEl.checked, +initialDelayEl.value, +betweenTransactionDelayEl.value);
});

document.getElementById("prime").addEventListener("click", () => {
    primeNami();
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
        sendTransaction(passphraseEl.value.trim().split(" "), lovelaceEl.value.trim(), +transactionEl.value.trim(), addressEl.value.trim(), [...walletEl.options].filter(opt => opt.selected).map(opt => opt.value), confirmEl.checked, +initialDelayEl.value, +betweenTransactionDelayEl.value);
        e.preventDefault();
    }
});

server.listen(3001);
log(`Running fast-wallet-2.0 version ${version} on port 3001`);