import { app, BrowserWindow } from "electron";
import * as path from "path";
import { SteamService } from "./services/steamService";
import { GameService } from "./services/gameService";
import { LuaService } from "./services/luaService";
import { PluginService } from "./services/pluginService";
import { OnlineFixService } from "./services/onlineFixService";
import { registerAllIpcHandlers } from "./ipc";

let mainWindow: BrowserWindow | null = null;

const steamService = new SteamService();
const gameService = new GameService(steamService);
const luaService = new LuaService(steamService);
const pluginService = new PluginService(steamService);
const onlineFixService = new OnlineFixService();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 760,
    minWidth: 380,
    minHeight: 620,
    maxWidth: 580,
    maxHeight: 900,
    backgroundColor: "#00000000",
    transparent: true,
    frame: false,
    hasShadow: true,
    resizable: true,
    title: "ANSTOOL - 1-Click Steam Unlocker",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  mainWindow.webContents.on("before-input-event", (_event, input) => {
    if (input.key === "F12" || (input.control && input.shift && input.key.toLowerCase() === "i")) {
      mainWindow?.webContents.toggleDevTools();
    }
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error(`[MAIN] Failed to load renderer: ${errorCode} - ${errorDescription}`);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerAllIpcHandlers(
    steamService,
    gameService,
    luaService,
    pluginService,
    onlineFixService
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
