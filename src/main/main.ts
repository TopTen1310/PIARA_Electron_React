/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import fs from 'fs';
import path from 'path';
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  screen,
  globalShortcut,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
// @ts-ignore
import { pipeline } from '@xenova/transformers';
import {
  NEREntity,
  ResultEntity,
  model,
  processNEREntities,
  task,
} from './ner';
import {
  UpdateInfo,
  convertHTMLtoDocxBuffer,
  modifyWordFile,
  writeDocxFileFromHTML,
} from './document';
import type { Category } from '../layout/MainLayout';
// @ts-ignore
import * as spacy from 'spacy-js';
import { spawn } from 'child_process';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let preMaximizeSize = [800, 600];
let draggedAfterMaximize = false;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const runServer = () => {
  let serverPath;
  if (app.isPackaged) {
    serverPath = path.join(process.resourcesPath, 'server', 'server.exe');
  } else {
    serverPath = path.join(__dirname, '../../server/server.exe');
  }

  const server = spawn(serverPath);

  server.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  server.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  server.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  // run server
  runServer();

  mainWindow = new BrowserWindow({
    show: false,
    width: 1500,
    height: 900,
    frame: false,
    transparent: true,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      defaultEncoding: 'UTF-8',
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('close', (e) => {
    if (mainWindow) {
      e.preventDefault();
      mainWindow.webContents.send('app-close-initiated');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('will-move', (event) => {
    if (mainWindow && mainWindow.isMaximized() && !draggedAfterMaximize) {
      event.preventDefault();

      const cursorPosition = screen.getCursorScreenPoint();
      const windowBounds = mainWindow.getBounds();

      // Calculate the relative position of the cursor inside the window as a ratio
      const relativeX =
        (cursorPosition.x - windowBounds.x) / windowBounds.width;
      const relativeY =
        (cursorPosition.y - windowBounds.y) / windowBounds.height;

      // Calculate the new position using the original size and the relative ratios
      const newPositionX = cursorPosition.x - preMaximizeSize[0] * relativeX;
      const newPositionY = cursorPosition.y - preMaximizeSize[1] * relativeY;

      mainWindow.unmaximize();

      // Resize and reposition the window
      mainWindow.setSize(preMaximizeSize[0], preMaximizeSize[1]);
      mainWindow.setPosition(
        Math.round(newPositionX),
        Math.round(newPositionY),
      );

      draggedAfterMaximize = true;
      mainWindow?.webContents.send('unmaximized');
    }
  });

  mainWindow.on('focus', () => {
    globalShortcut.register('CmdOrCtrl+Z', () => {
      mainWindow!.webContents.send('undo-command');
    });

    globalShortcut.register('CmdOrCtrl+Shift+Z', () => {
      mainWindow!.webContents.send('redo-command');
    });
  });

  mainWindow.on('blur', () => {
    globalShortcut.unregister('CmdOrCtrl+Z');
    globalShortcut.unregister('CmdOrCtrl+Shift+Z');
  });

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

async function replaceInDocx(
  inputPath: string,
  updateInformation: {
    headers: UpdateInfo[];
    footers: UpdateInfo[];
    footnotes: UpdateInfo[];
    body: UpdateInfo[];
  },
) {
  return await modifyWordFile(inputPath, updateInformation);
}

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(async () => {
    createWindow();

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);

app.on('will-quit', () => {
  // Unregister all shortcuts to avoid any potential issues.
  globalShortcut.unregisterAll();
});

ipcMain.on('minimize-to-taskbar', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('toggle-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      mainWindow?.webContents.send('unmaximized');
      draggedAfterMaximize = false;
    } else {
      preMaximizeSize = mainWindow.getSize();
      mainWindow.maximize();
      mainWindow?.webContents.send('maximized');
      draggedAfterMaximize = false;
    }
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('confirm-close-app', () => {
  if (mainWindow) {
    mainWindow.removeAllListeners('close');
    mainWindow.close();
    mainWindow = null;
  }
});

ipcMain.on('download-file', (event, filePath, updateInformation) => {
  if (filePath) {
    replaceInDocx(filePath, updateInformation).then((res) => {
      if (res) {
        mainWindow?.webContents.send('file-write-success', res);
      } else {
        mainWindow?.webContents.send('file-write-failed');
      }
    });
  }
});

ipcMain.on('process-paragraphs', async (event, paragraphs: string[]) => {
  const allowedSpacyEntities = [
    'ORG',
    'LOC',
    'PERSON',
    'DATE',
    'TIME',
    'GPE',
    'FAC',
  ];
  const spacyKeyMap: Record<string, string> = {
    ORG: 'ORG',
    LOC: 'LOC',
    PERSON: 'PER',
    DATE: 'DATE',
    TIME: 'TIME',
    GPE: 'LOC',
    FAC: 'FAC',
  };
  const nlp = spacy.load('en_core_web_sm');

  const spacyResult: ResultEntity[][] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const doc = await nlp(paragraphs[i]);
    const paragraphResult: ResultEntity[] = doc.ents
      .map((ent: any) => ({
        word: ent.text,
        entity: spacyKeyMap[ent.label as string],
      }))
      .filter((resultEntity: ResultEntity) =>
        allowedSpacyEntities.includes(resultEntity.entity),
      );

    spacyResult.push(paragraphResult);
  }

  let pipe = await pipeline(task, model);

  let bertResult = await Promise.all(
    paragraphs.map((paragraph) =>
      pipe(paragraph, { ignore_labels: ['I-MISC', 'B-MISC', 'O'] }),
    ),
  );

  if (bertResult && spacyResult) {
    const result: ResultEntity[][] = bertResult.map((out: NEREntity[]) =>
      processNEREntities(out),
    );

    mainWindow?.webContents.send('process-paragraphs-result', {
      bert: result,
      spacy: spacyResult,
    });
  }
});

ipcMain.on('convert-html-to-docx', async (event, html: string) => {
  const result = await convertHTMLtoDocxBuffer(html);
  mainWindow?.webContents.send('convert-html-result', result);
});

ipcMain.on('write-html-to-docx', async (event, html: string) => {
  try {
    const result = await writeDocxFileFromHTML(html);
    mainWindow?.webContents.send('file-write-success', result);
  } catch (err) {
    mainWindow?.webContents.send('file-write-failed');
  }
});

ipcMain.on('open-file', async (event, filePath: string) => {
  if (filePath) {
    shell.openPath(filePath).catch((error) => {
      console.error('Failed to open file:', error);
    });
  }
});

let categoryFilePath = '';
if (app.isPackaged) {
  categoryFilePath = path.join(
    process.resourcesPath,
    'settings',
    'category.json',
  );
} else {
  categoryFilePath = path.join(
    __dirname,
    '..',
    '..',
    'settings',
    'category.json',
  );
}

ipcMain.on('save-category', async (event, data: Category) => {
  fs.writeFile(categoryFilePath, JSON.stringify(data), (err) => {
    if (err) {
      console.error('Failed to save key map:', err);
      mainWindow?.webContents.send('save-category-result', {
        success: false,
        error: err.message,
      });
    } else {
      mainWindow?.webContents.send('save-category-result', {
        success: true,
      });
    }
  });
});

ipcMain.on('load-category', async (event) => {
  fs.readFile(categoryFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Failed to settings:', err);
      mainWindow?.webContents.send('load-category-result', {
        success: false,
        error: err.message,
      });
    } else {
      mainWindow?.webContents.send('load-category-result', {
        success: true,
        data: JSON.parse(data),
      });
    }
  });
});
