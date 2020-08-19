const {app, ipcMain, session, Notification, BrowserWindow: eBrowserWindow, Tray, nativeImage, Menu} = require('electron')
const {BrowserWindow} = require('electron-acrylic-window')
const fetch = require('node-fetch')
const {ElectronBlocker, fullLists} = require('@cliqz/adblocker-electron');
const url = require('url');
const path = require('path');
const setting = require('electron-settings')
const {autoUpdater} = require("electron-updater");
const isDev = require('electron-is-dev');

const logoPath = path.join(__dirname, 'res/logo.ico');
let mainWindow, signinWindow, splashWindow, settingWindow;
let mainTray;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
}

app.on('second-instance', createMainWindow);

function createNewNotification(title, body) {
    let notification = new Notification({
        title: title,
        body: body,
        icon: logoPath
    });
    notification.show();
    return notification;
}

function backgroundHandler() {
    mainWindow.hide();
    let isBackgroundPlayKnown = setting.getSync('isBackgroundPlayKnown');
    if (!isBackgroundPlayKnown) {
        createNewNotification('유튜브 뮤직이 트레이로 최소화 되었습니다.', '설정에서 백그라운드 재생을 켜거나 끌 수 있습니다.')
    }
    setting.setSync('isBackgroundPlayKnown', true);
}

//
//ipc Event
//

ipcMain.on('closeMainWindow', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.on('closeLoginWindow', () => {
    if (signinWindow) {
        signinWindow.close();
        signinWindow = null;
    }
});

ipcMain.on('enterPIPMode', () => {
    if (mainWindow) {
        mainWindow.hide();
        mainWindow.webContents.executeJavaScript(`
            document.querySelector('video').addEventListener("leavepictureinpicture", (e) => {
                let wasMuted=document.querySelector('video').muted, wasPaused=document.querySelector('video').paused;
                if (wasPaused) {
                    document.querySelector('video').muted = true;;
                    document.querySelector('video').play();
                }
                require('electron').ipcRenderer.send('exitPIPMode', wasPaused, wasMuted);
                e.preventDefault=false;
            }, { once: true });
        `);
        mainWindow.webContents.executeJavaScript(`document.querySelector('video').requestPictureInPicture();`);
    }
})

ipcMain.on('exitPIPMode', (e, wasPaused, wasMuted) => {
    if (mainWindow) {
        setTimeout(() => {
            mainWindow.webContents.executeJavaScript(`document.querySelector('video').paused`).then((nowPaused) => {
                if (nowPaused && !wasPaused) mainWindow.webContents.executeJavaScript(`document.querySelector('video').play()`);
                else mainWindow.show();
                if (wasPaused) mainWindow.webContents.executeJavaScript(`document.querySelector('video').pause()`);
                mainWindow.webContents.executeJavaScript(`document.querySelector('video').muted = ` + wasMuted.toString());
            })
        }, 200);
    }
})

ipcMain.on('minimizeMainWindow', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('toggleMaximizeMainWindow', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    }
});

ipcMain.on('openSettingWindow', () => {
    if (settingWindow) settingWindow.focus();
    else createSettingWindow();
});

//
//Inject elements into browserWindow
//

function injectElement(win, selector, element, insertPlace = -1) {
    let insertMethod;
    if (insertPlace === -1) insertMethod = `document.querySelector('${selector}').appendChild(tNode);`;
    else insertMethod = `document.querySelector('${selector}').insertBefore(tNode, document.querySelector('${selector}').children[${insertPlace}]);`;
    win.webContents.executeJavaScript(`
        tNode=document.createElement('div');
        tNode.innerHTML=\`${element}\`;
        ${insertMethod}
    `);
}

//
//Creates windows
//

function createSigninWindow(signinUrl) {
    signinWindow = new BrowserWindow({
        width: 400,
        height: 600,
        icon: logoPath,
        frame: false,
        backgroundColor: '#00000000',
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false
        }
    });
    signinWindow.setMenu(null);
    signinWindow.setResizable(false);
    if (isDev) signinWindow.webContents.openDevTools({mode: "detach"});
    signinWindow.once('closed', () => {
        signinWindow = null;
    });
    signinWindow.webContents.session.setUserAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/71.0');
    signinWindow.loadURL(signinUrl);
    signinWindow.webContents.on('did-finish-load', function () {
        signinWindow.webContents.insertCSS(`
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
        signinWindow.setVibrancy('dark')
        const closeButton = `
            <a style='font-family: "Segoe MDL2 Assets";position:fixed;right: 10px;top:10px;padding:10px;font-size: 20px;color:white;z-index: 50000;'  id="auth-close-button">&#xE8BB;</a>`
        injectElement(signinWindow, 'body', closeButton);
        signinWindow.webContents.executeJavaScript(`
            document.getElementById('auth-close-button').addEventListener('click', ()=>{
                require('electron').ipcRenderer.send('closeLoginWindow');
            });
        `)
        signinWindow.show();
    });
    signinWindow.webContents.on('did-finish-load', () => {
        if (signinWindow.webContents.getURL().includes('https://music.youtube.com/')) {
            signinWindow.close();
            signinWindow = null;
            mainWindow.webContents.reload();
        }
    });
}

function createSplashWindow() {
    splashWindow = new eBrowserWindow({
        width: 600,
        height: 300,
        icon: logoPath,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false
    });
    splashWindow.setMenu(null);
    splashWindow.webContents.session.setUserAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/71.0');
    splashWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'splash.html'),
        protocol: 'file:',
        slashes: true
    }));
}

function createSettingWindow() {
    settingWindow = new BrowserWindow({
        width: 600,
        height: 300,
        icon: logoPath,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false
    });
    settingWindow.setMenu(null);
    settingWindow.webContents.session.setUserAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/71.0');
    settingWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'setting.html'),
        protocol: 'file:',
        slashes: true
    }));
}

async function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
            zoomFactor: 0.8
        }, icon: logoPath,
        frame: false,
        backgroundColor: '#00000000'
    });
    mainWindow.setMenu(null);
    mainWindow.webContents.session.setUserAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/71.0');
    mainWindow.loadURL('https://music.youtube.com');

    if (isDev) mainWindow.webContents.openDevTools({mode: "detach"});

    mainWindow.on('close', e => {
        e.preventDefault();
        backgroundHandler();
        return false;
    });

    const blocker = await ElectronBlocker.fromLists(fetch, fullLists, {
        enableCompression: true
    });

    blocker.enableBlockingInSession(session.defaultSession);

    mainWindow.webContents.on('will-navigate', (e, redirectUrl) => {
        if (redirectUrl.includes('https://accounts.google.com/')) {
            createSigninWindow(redirectUrl);
            e.preventDefault();
        }
    });

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.insertCSS(`
            html,body { 
                background-color: #00000000 !important;
            }
            html {
                overflow-y: overlay !important;
                --ytmusic-scrollbar-width: 0px !important;
            }
            #nav-bar-background {
                width: 100vw !important;
            }
            #nav-bar-shadow {
                width: 100vw !important;
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
            *::-webkit-scrollbar-track {
                background-color: #00000000;
            }
            *::-webkit-scrollbar {
                width: 10px;
                background-color: #00000000;
            }
            *::-webkit-scrollbar-thumb {
                background-color: #444444;
            }
            #player-bar-background {
                width: 100 vw;
            }
        `)

        const closeButton = `<paper-icon-button class="style-scope ytmusic-player" icon="yt-icons:close" 
            title="닫기" aria-label="닫기" role="button" tabindex="1" aria-disabled="false"
            onclick="require('electron').ipcRenderer.send('closeMainWindow');"></paper-icon-button>`;

        const minimizeButton = `<paper-icon-button class="style-scope ytmusic-player" icon="yt-icons:minimize" 
            title="최소화" aria-label="최소화" role="button" tabindex="2" aria-disabled="false" 
            style="margin:5px;" onclick="require('electron').ipcRenderer.send('minimizeMainWindow');"></paper-icon-button>`;

        const maximizeButton = `<paper-icon-button class="style-scope ytmusic-player" icon="yt-icons:fullscreen" 
            title="최대화" aria-label="최대화" role="button" tabindex="3" aria-disabled="false" 
            onclick="require('electron').ipcRenderer.send('toggleMaximizeMainWindow');"></paper-icon-button>`;

        const pipButton = `<paper-icon-button class="style-scope ytmusic-player" icon="yt-icons:music_miniplayer" 
            title="PIP 재생" aria-label="PIP 재생" role="button" tabindex="0" aria-disabled="false"
            style="margin:5px;" onclick="require('electron').ipcRenderer.send('enterPIPMode');"></paper-icon-button>`;

        const settingButton = `<paper-icon-button class="style-scope ytmusic-player" icon="yt-icons:settings" 
            title="설정" aria-label="설정" role="button" tabindex="6" aria-disabled="false"
            style="margin:5px;" onclick="require('electron').ipcRenderer.send('openSettingWindow');"></paper-icon-button>`;

        injectElement(mainWindow, 'ytmusic-nav-bar .right-content', '<div style="width:10px;"></div>')
        injectElement(mainWindow, 'ytmusic-nav-bar .right-content', settingButton, 4);
        injectElement(mainWindow, 'ytmusic-nav-bar .right-content', minimizeButton);
        injectElement(mainWindow, 'ytmusic-nav-bar .right-content', maximizeButton);
        injectElement(mainWindow, 'ytmusic-nav-bar .right-content', closeButton);
        injectElement(mainWindow, 'ytmusic-player-bar .right-controls-buttons', pipButton);

        mainWindow.webContents.executeJavaScript(`
            setInterval(()=>{
                try {
                    if (window.pageYOffset !== 0) document.querySelector('ytmusic-header-renderer').style.background='#00000099';
                    else document.querySelector('ytmusic-header-renderer').style.background='';
                } catch(e) {
                
                }
            }, 50);
        `);

        mainWindow.webContents.executeJavaScript(`document.querySelector('.player-minimize-button').onclick=()=>{require('electron').ipcRenderer.send('enterPIPMode');}`);

        setTimeout(() => {
            if (splashWindow) {
                splashWindow.close();
                splashWindow = null;
            }
            mainWindow.show();
            mainWindow.setVibrancy('dark');
            mainWindow.focus();
        }, 100);
    });
}

//
//Sets Tray
//

function setTrayContext(musicName, isPlaying) {
    let menuItem = [{
        label: 'Youtube Music', click: () => {
            mainWindow.show();
            mainWindow.focus();
        }
    }];
    if (musicName) menuItem.push({label: musicName, enabled: false});
    if (isPlaying) menuItem.push({label: '일시정지'});
    else menuItem.push({label: '재생'});
    menuItem.push({label: '종료', click: app.exit})
    let contextMenu = Menu.buildFromTemplate(menuItem);
    mainTray.setContextMenu(contextMenu);
}

function createMainTray() {
    const iconPath = path.join(__dirname, 'res/logo.png');
    mainTray = new Tray(nativeImage.createFromPath(iconPath));
    mainTray.on('click', () => {
        mainWindow.show();
        mainWindow.focus();
    });
    mainTray.setToolTip('Youtube Music');
    mainTray = new Tray(nativeImage.createFromPath(iconPath));
    mainTray.on('click', () => {
        mainWindow.show();
        mainWindow.focus();
    });
    setTrayContext('', false);
}

//
//On first run
//

function init() {
    createSplashWindow();
    createMainWindow();
    createMainTray();
    if (process.platform === 'win32') {
        app.setAppUserModelId("seorii.youtube.music");
    }
    autoUpdater.checkForUpdates();
}

//
//APP Event Listner
//

app.on('ready', init);


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    }
});

autoUpdater.on('update-available', () => {
    createNewNotification('업데이트 다운로드 중...', '새 버전을 자동으로 다운받고 설치하고 있습니다.')
});

autoUpdater.on('update-downloaded', () => {
    createNewNotification('업데이트 설치 성공!', '앱을 다시 시작하면 업데이트가 적용됩니다.');
});

setInterval(() => {
    autoUpdater.checkForUpdates();
}, 600000);