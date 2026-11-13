"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const steamService_1 = require("./services/steamService");
const gameService_1 = require("./services/gameService");
const luaService_1 = require("./services/luaService");
const pluginService_1 = require("./services/pluginService");
const onlineFixService_1 = require("./services/onlineFixService");
const ipc_1 = require("./ipc");
let mainWindow = null;
const steamService = new steamService_1.SteamService();
const gameService = new gameService_1.GameService(steamService);
const luaService = new luaService_1.LuaService(steamService);
const pluginService = new pluginService_1.PluginService(steamService);
const onlineFixService = new onlineFixService_1.OnlineFixService();
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 960,
        minHeight: 640,
        backgroundColor: "#070a13",
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
electron_1.app.whenReady().then(() => {
    (0, ipc_1.registerAllIpcHandlers)(steamService, gameService, luaService, pluginService, onlineFixService);
    createWindow();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
