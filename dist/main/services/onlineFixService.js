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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnlineFixService = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const adm_zip_1 = __importDefault(require("adm-zip"));
class OnlineFixService {
    async downloadOnlineFix(gameName, targetDirectory, password) {
        if (!gameName.trim()) {
            throw new Error("Game name is required.");
        }
        if (!fs.existsSync(targetDirectory)) {
            throw new Error(`Target game folder does not exist: ${targetDirectory}`);
        }
        const tempFile = path.join(os.tmpdir(), `of_fix_${Date.now()}.zip`);
        try {
            const apiUrl = `https://scrappingfix.vercel.app/download?game=${encodeURIComponent(gameName.trim())}`;
            const res = await fetch(apiUrl, {
                headers: { "User-Agent": "OpenSteam-Manager/1.0" }
            });
            if (!res.ok) {
                throw new Error(`Online-Fix API returned HTTP ${res.status}. Service may be busy or game not found.`);
            }
            const buf = await res.arrayBuffer();
            fs.writeFileSync(tempFile, Buffer.from(buf));
            // Attempt extraction
            try {
                const zip = new adm_zip_1.default(tempFile);
                if (password) {
                    // If password protected
                    zip.extractAllTo(targetDirectory, true, false, password);
                }
                else {
                    zip.extractAllTo(targetDirectory, true);
                }
            }
            catch (zipErr) {
                // If it's a rar file or requires external unarchiver
                return {
                    success: true,
                    message: `Fix downloaded to ${tempFile}. If extraction requires unrar/7zip with password "${password || "online-fix.me"}", please extract it directly to ${targetDirectory}.`
                };
            }
            return {
                success: true,
                message: `Online-Fix successfully downloaded and deployed to ${targetDirectory}!`
            };
        }
        finally {
            try {
                if (fs.existsSync(tempFile))
                    fs.unlinkSync(tempFile);
            }
            catch { }
        }
    }
}
exports.OnlineFixService = OnlineFixService;
