const {app, ipcMain, session, Notification} = require('electron')
const {BrowserWindow} = require('electron-acrylic-window')
const fetch = require('node-fetch')
const {ElectronBlocker, fullLists, Request} = require('@cliqz/adblocker-electron');

let win, awin;

ipcMain.on('close', () => {
    if (win) {
        win.hide();
        let notification = new Notification({
            title: '유튜브 뮤직이 트레이로 최소화 되었습니다.',
            body: '설정에서 백그라운드 재생을 켜거나 끌 수 있습니다.'/*,
            icon: 'C:\\Program Files\\IP\\res\\ipLogo.ico'*/
        });
        notification.show();
        setTimeout(() => {
            win.show();
        }, 5000);
    }
});

function getFramePath(resName) {
    let locale = app.getLocale();
    let supportedLanguage = ['ko'];
    if (!supportedLanguage.includes(locale)) locale = 'ko';
    return `file://${__dirname}/frame.html?locale=${locale}&resName=${resName}.html`;
}

function signinWindow(signinUrl) {
    awin = new BrowserWindow({
        width: 400,
        height: 600
        /*, icon: path.join(__dirname, 'logo.ico')*/,
        frame: false,
        backgroundColor: '#00000000',
        alwaysOnTop: true
    });
    awin.setMenu(null);
    awin.setResizable(false);
    //awin.webContents.openDevTools({mode: "detach"});
    awin.loadURL(signinUrl, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36'
    });
    awin.once('closed', () => {
        awin = null;
    });
    awin.webContents.on('did-finish-load', function () {
        awin.webContents.insertCSS(`
        html,body,#initialView,body>div>div { 
            background-color: #00000000 !important;
        }
        * {
            color:white;
        }
        input{
            color:white !important;
        }
        ytmusic-nav-bar{
            -webkit-app-region: drag;
            background:#00000000;
        }
        input ~ div{
            background:#00000000 !important;
        }`)
        awin.setVibrancy('dark')
        awin.webContents.executeJavaScript(``);
        awin.show();
    });
}

async function createWindow() {
    win = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
            zoomFactor: 0.8
        }/*, icon: path.join(__dirname, 'logo.ico')*/,
        frame: false,
        backgroundColor: '#00000000'
    });
    win.setMenu(null);
    win.loadURL('https://music.youtube.com');
    win.webContents.openDevTools({mode: "detach"});
    win.once('closed', () => {
        win = null;
    });

    const blocker = await ElectronBlocker.fromLists(fetch, fullLists, {
        enableCompression: true,
    });

    blocker.enableBlockingInSession(session.defaultSession);


    win.webContents.on('did-finish-load', function () {
        if (win.webContents.getURL().includes('https://accounts.google.com/')) {
            signinWindow(win.webContents.getURL());
            win.webContents.goBack();
            return;
        }
        win.webContents.insertCSS(`
        html,body { 
            background-color: #00000000 !important;
        }
        ytmusic-nav-bar {
            -webkit-app-region: drag;
            background: #00000000;
        }
        #nav-bar-background {
            background: #00000099 !important;
        }
        ytmusic-nav-bar div * {
            -webkit-app-region: no-drag;
        }
        ytmusic-player-page {
            background: #00000000 !important;
        }`)
        win.webContents.executeJavaScript(`document.querySelector('ytmusic-nav-bar .right-content').innerHTML = document.querySelector('ytmusic-nav-bar .right-content').innerHTML + \`<paper-icon-button id="close-button" icon="yt-icons:close" class="style-scope ytmusic-nav-bar" title="닫기" aria-label="닫기" role="button" tabindex="1" aria-disabled="false" onclick="require('electron').ipcRenderer.send('close');"></paper-icon-button>\`;`);
        win.webContents.executeJavaScript(`setInterval(()=>{
            try {
                if (window.pageYOffset !== 0) document.querySelector('ytmusic-header-renderer').style.background='#00000099';
                else document.querySelector('ytmusic-header-renderer').style.background='';
            } catch(e) {
            }
        }, 100);`);
        win.show();
        win.setVibrancy('dark');
    });
}

app.on('ready', createWindow);


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (win === null) {
        createWindow();
    }
});
