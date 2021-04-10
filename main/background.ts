import { app, screen, ipcRenderer, dialog } from 'electron';
import serve from 'electron-serve';
import { createWindow } from './helpers';
import log from "electron-log"
import {autoUpdater} from "electron-updater"
import path from "path"

const gotTheLock = app.requestSingleInstanceLock()
const APP_PROTOCOL = 'bgms-remote-control';

const isProd: boolean = process.env.NODE_ENV === 'production';

if (isProd) {
  serve({ directory: 'app' });
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`);
}


export default class AppUpdater {
  constructor(){
    if(process.env.NODE_ENV !== 'production'){
      autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml')
    }

    
  
    log.transports.file.level = 'info'
  
    
    autoUpdater.logger = log;
    autoUpdater.allowDowngrade = true;
    autoUpdater.autoDownload = true;
    autoUpdater.checkForUpdatesAndNotify();
  }
}



let width, height, mainWindow, url;

app.whenReady();
app.setName('BGMs')

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

// 앱 켜져 있을 때 다시 앱 실행 시 기존 앱 quit
if (gotTheLock) {
  app.on('second-instance', (event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized() || !mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
      const query = argv[2] ? argv[2].split('//')[1] : "";

      if (mainWindow.webContents) mainWindow.webContents.send('pageComponent', query.split('/')[0]);
    }
  });
} else {
  app.quit();

}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createMainWindow = async() => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  let windowWidth = screen.getPrimaryDisplay().workAreaSize.width;
  let windowHeight = screen.getPrimaryDisplay().workAreaSize.height;
  if (windowWidth <= 1280 && windowHeight <= 800) {
    width = 1024;
    height = 642;
  } else if (windowWidth <= 1680 && windowHeight <= 1050) {
    width = 1200;
    height = 750;
  } else if (windowWidth <= 1920 && windowHeight <= 1080) {
    width = 1400;
    height = 878;
  } else {
  }
  width = 1630;
  height = 1022;

  mainWindow = createWindow('main', {
    width,
    height,
    frame: process.platform === 'darwin' ? false : true,
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    minWidth: 1024,
    minHeight: 750,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      webSecurity: false,
      nodeIntegration: true,
      enableRemoteModule: true,
      nodeIntegrationInWorker: true,
    }
  });

  

  if (isProd) {
    const query = process.argv[1] ? "?" + process.argv[1].split('//')[1] : "";

    mainWindow.loadURL('app://./index.html' + query.split('/')[0]);
    //  if(mainWindow && mainWindow.webContents) mainWindow.webContents.openDevTools();
  } else {
    const port = process.argv[2];

    mainWindow.loadURL(`http://localhost:${port}`);
    if (mainWindow && mainWindow.webContents) mainWindow.webContents.openDevTools();
  }
  sendMessage(url)



  if (process.platform === 'darwin') {
    var forceQuit = false;
    app.on('before-quit', function () {
      forceQuit = true;
    });
    mainWindow.on('close', function (e) {
      if (!forceQuit) {
        e.preventDefault()
        mainWindow.hide()
      }
    });
  }
   
   autoUpdater.checkForUpdates()

   new AppUpdater();
}

app.on('ready', createMainWindow)

app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin')
    app.quit()
})

app.on('activate', function (e) {
  e.preventDefault()
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.

  if (mainWindow) {
    mainWindow.show()
  }
})

if (!app.isDefaultProtocolClient(APP_PROTOCOL)) {
  app.setAsDefaultProtocolClient(APP_PROTOCOL);
}

app.on('will-finish-launching', () => {
  app.on('open-url', (event, argv) => {
    event.preventDefault()
    let query = argv.split('//')[1]
    url = query
    sendMessage(query)
  })
})

app.on('open-url', (event, argv) => {
  event.preventDefault()
  let query = argv.split('//')[1]
  if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('pageComponent', query);
})

function sendMessage(s) {
  if (mainWindow && mainWindow.webContents) {

    mainWindow.webContents.on('did-finish-load', function () {
      mainWindow.webContents.send('pageComponent', s);
    });
  }
}

/*  업데이트 관련 */

// 업데이트 감지
app.on("ready", async() => {
  // createMainWindow();
  autoUpdater.setFeedURL({
    "owner":"github",
    "provider": "github",
    "repo": "BGMs",
    "token": "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"
  })
  autoUpdater.checkForUpdates();
})

// 업데이트 오류시
autoUpdater.on('error', function(error) {
  console.error('error', error);
});

// 업데이트 체크
autoUpdater.on('checking-for-update', async () => {
  console.log('Checking-for-update');
});

// 업데이트할 내용이 있을 때
autoUpdater.on('update-available', async () => {
  console.log('A new update is available');
});

// 업데이트할 내용이 없을 때
autoUpdater.on('update-not-available', async () => {
  console.log('update-not-available');
});

autoUpdater.on("download-progress", progressObj => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + parseInt(progressObj.percent) + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    mainWindow.webContents.send('progress', log_message);
 });
 


//다운로드 완료되면 업데이트
autoUpdater.on('update-downloaded', async (event, releaseNotes, releaseName) => {
  const options = {
      type: 'info',
      buttons: ['재시작', '종료'],
      title: '업데이트 중입니다.',
      message: process.platform === 'win32' ? releaseNotes : releaseName,
      detail: '새로운 버전이 다운로드 되었습니다. 애플리케이션을 재시작하여 업데이트를 적용해 주세요.'
  };
  const response = await dialog.showMessageBox(mainWindow, options);
  console.log('updateTest', response)
  if (response.response === 0) {
      autoUpdater.quitAndInstall();
  } else {
      app.quit();
      app.exit();
  }
});
