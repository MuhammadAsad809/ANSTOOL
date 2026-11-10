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
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#070a13",
    title: "OpenSteam Desktop",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

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
