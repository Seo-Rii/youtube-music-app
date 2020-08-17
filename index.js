const {app, ipcMain, session, Notification, BrowserWindow: eBrowserWindow, screen} = require('electron')
const {BrowserWindow} = require('electron-acrylic-window')
const fetch = require('node-fetch')
const {ElectronBlocker, fullLists} = require('@cliqz/adblocker-electron');
const url = require('url');
const path = require('path');

let win, awin, lwin, pwin;

function backgroundPlayHandler() {
    win.hide();
    let notification = new Notification({
        title: '유튜브 뮤직이 트레이로 최소화 되었습니다.',
        body: '설정에서 백그라운드 재생을 켜거나 끌 수 있습니다.'/*,
            icon: 'C:\\Program Files\\IP\\res\\ipLogo.ico'*/
    });
    notification.show();
}

ipcMain.on('close', () => {
    if (win) {
        backgroundPlayHandler();
    }
});

ipcMain.on('closeLoginWindow', () => {
    if (awin) {
        awin.close();
        awin = null;
    }
});

ipcMain.on('pip', () => {
    if (win) {
        win.hide();
        win.webContents.executeJavaScript(`document.querySelector('video').requestPictureInPicture();`);
    }
})

ipcMain.on('minimize', () => {
    if (win) {
        win.minimize();
    }
});

ipcMain.on('toggleMaximize', () => {
    if (win) {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
    }
});

function getFramePath(resName) {
    let locale = app.getLocale();
    let supportedLanguage = ['ko'];
    if (!supportedLanguage.includes(locale)) locale = 'ko';
    return `file://${__dirname}/frame.html?locale=${locale}&resName=${resName}.html`;
}

function injectElement(win, selector, element) {
    win.webContents.executeJavaScript(`
        tNode=document.createElement('div');
        tNode.innerHTML=\`${element}\`;
        document.querySelector('${selector}').appendChild(tNode);
    `);
}

function signinWindow(signinUrl) {
    awin = new BrowserWindow({
        width: 400,
        height: 600,
        icon: path.join(__dirname, 'res/logo.ico'),
        frame: false,
        backgroundColor: '#00000000',
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false
        }
    });
    awin.setMenu(null);
    awin.setResizable(false);
    //awin.webContents.openDevTools({mode: "detach"});
    awin.once('closed', () => {
        awin = null;
    });
    awin.webContents.session.setUserAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/71.0');
    awin.loadURL(signinUrl);
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
                input ~ div{
                    background:#00000000 !important;
                }
                body>div:nth-child( 5 ) {
                    display: none;
                }
                html {
                    -webkit-app-region: drag;
                }
                #view_container, #auth-close-button, .yt-dialog, .yt-dialog * {
                    -webkit-app-region: no-drag;
                }
            `)
        awin.setVibrancy('dark')
        const closeButton = `
            <a style='font-family: "Segoe MDL2 Assets";position:fixed;right: 10px;top:10px;padding:10px;font-size: 20px;color:white;z-index: 50000;' 
                id="auth-close-button">&#xE8BB;</a>`
        injectElement(awin, 'body', closeButton);
        awin.webContents.executeJavaScript(`
            document.getElementById('auth-close-button').addEventListener('click', ()=>{
                require('electron').ipcRenderer.send('closeLoginWindow');
            });`)
        awin.show();
    });
    awin.webContents.on('did-finish-load', (e) => {
        if (awin.webContents.getURL().includes('https://music.youtube.com/')) {
            awin.close();
            awin = null;
            win.webContents.reload();
        }
    });
}

function showLoading() {
    lwin = new eBrowserWindow({
        width: 600,
        height: 300,
        icon: path.join(__dirname, 'res/logo.ico'),
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false
    });
    lwin.setMenu(null);
    lwin.webContents.session.setUserAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/71.0');
    lwin.loadURL(url.format({
        pathname: path.join(__dirname, 'splash.html'),
        protocol: 'file:',
        slashes: true
    }));
}

async function createWindow() {
    win = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
            zoomFactor: 0.8
        }, icon: path.join(__dirname, 'res/logo.ico'),
        frame: false,
        backgroundColor: '#00000000'
    });
    win.setMenu(null);
    win.webContents.session.setUserAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/71.0');
    win.loadURL('https://music.youtube.com');
    //win.webContents.openDevTools({mode: "detach"});
    win.once('close', e => {
        e.preventDefault();
        backgroundPlayHandler();
        return false;
    });
    const blocker = await ElectronBlocker.fromLists(fetch, fullLists, {
        enableCompression: true,
    });

    blocker.enableBlockingInSession(session.defaultSession);

    win.webContents.on('will-navigate', (e, redirectUrl) => {
        if (redirectUrl.includes('https://accounts.google.com/')) {
            signinWindow(redirectUrl);
            e.preventDefault();
            return;
        }
    });

    win.webContents.on('did-finish-load', () => {
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
        }
        *::selection {
            background:#00000055;
        }
        #player-bar-background {
            background:#00000099 !important;
        }
        ytmusic-player-bar {
            background:#00000000 !important;
        }
        ytmusic-dialog {
            background:#00000055 !important;
        }`)

        const closeButton = `<paper-icon-button class="style-scope ytmusic-player" icon="yt-icons:close" 
            title="닫기" aria-label="닫기" role="button" tabindex="1" aria-disabled="false" 
            onclick="require('electron').ipcRenderer.send('close');"></paper-icon-button>`;

        const minimizeButton = `<paper-icon-button class="style-scope ytmusic-player" icon="yt-icons:minimize" 
            title="최소화" aria-label="최소화" role="button" tabindex="0" aria-disabled="false" 
            style="margin:5px;" onclick="require('electron').ipcRenderer.send('minimize');"></paper-icon-button>`;

        const maximizeButton = `<paper-icon-button class="style-scope ytmusic-player" icon="yt-icons:fullscreen" 
            title="최대화" aria-label="최대화" role="button" tabindex="0" aria-disabled="false" 
            onclick="require('electron').ipcRenderer.send('toggleMaximize');"></paper-icon-button>`;

        const pipButton = `<paper-icon-button class="style-scope ytmusic-player" icon="yt-icons:music_miniplayer" 
            title="PIP 재생" aria-label="PIP 재생" role="button" tabindex="0" aria-disabled="false"
            style="margin:5px;" onclick="require('electron').ipcRenderer.send('pip');"></paper-icon-button>`;

        injectElement(win, 'ytmusic-nav-bar .right-content', '<div style="width:10px;"></div>')
        injectElement(win, 'ytmusic-nav-bar .right-content', minimizeButton);
        injectElement(win, 'ytmusic-nav-bar .right-content', maximizeButton);
        injectElement(win, 'ytmusic-nav-bar .right-content', closeButton);
        injectElement(win, 'ytmusic-player-bar .right-controls-buttons', pipButton);

        win.webContents.executeJavaScript(`setInterval(()=>{
            try {
                if (window.pageYOffset !== 0) document.querySelector('ytmusic-header-renderer').style.background='#00000099';
                else document.querySelector('ytmusic-header-renderer').style.background='';
            } catch(e) {
            }
        }, 100);`);

        win.webContents.executeJavaScript(`document.querySelector('.player-minimize-button').onclick=()=>{require('electron').ipcRenderer.send('pip');}`);
        setTimeout(() => {
            if (lwin) {
                lwin.close();
                lwin = null;
            }
            win.show();
            win.setVibrancy('dark');
        }, 100);
    });
}

function init() {
    showLoading();
    createWindow();
}

app.on('ready', init);


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


const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

app.on('second-instance', createWindow);
