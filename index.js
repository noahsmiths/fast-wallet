const { app, BrowserWindow } = require('electron');
const electronRemote = require('@electron/remote/main');
electronRemote.initialize();

function createWindow () {
    const win = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    electronRemote.enable(win.webContents);
    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
});