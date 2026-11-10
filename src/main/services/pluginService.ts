import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { spawn } from "child_process";
import AdmZip from "adm-zip";
import { SteamService } from "./steamService";

export class PluginService {
  constructor(private steamService: SteamService) {}

  public async installMillennium(): Promise<{ success: boolean; message: string }> {
    const tempDir = os.tmpdir();
    const installerPath = path.join(tempDir, "MillenniumInstaller.exe");

    try {
      const url = "https://github.com/SteamClientHomebrew/Installer/releases/latest/download/MillenniumInstaller-Windows.exe";
      const res = await fetch(url, {
        headers: { "User-Agent": "OpenSteam-Manager/1.0" }
      });

      if (!res.ok) {
        throw new Error(`Failed to download Millennium: HTTP ${res.status}`);
      }

      const buf = await res.arrayBuffer();
      fs.writeFileSync(installerPath, Buffer.from(buf));

      if (os.platform() === "win32") {
        const child = spawn(installerPath, [], { detached: true, stdio: "ignore" });
        child.unref();
        return {
          success: true,
          message: "Millennium installer launched successfully. Complete the setup wizard in Windows."
        };
      } else {
        return {
          success: true,
          message: `Millennium installer downloaded to ${installerPath}. Execute via Wine or your Windows host.`
        };
      }
    } catch (err: any) {
      return { success: false, message: `Millennium installation failed: ${err.message}` };
    }
  }

  public async installLuaManager(): Promise<{ success: boolean; message: string }> {
    const steamPath = await this.steamService.getSteamPath();
    if (!fs.existsSync(steamPath)) {
      throw new Error(`Steam directory not found at: ${steamPath}`);
    }

    const pluginsFolder = path.join(steamPath, "plugins");
    const targetPluginDir = path.join(pluginsFolder, "LuaManager");
    const tempZip = path.join(os.tmpdir(), "LuaManager_Temp.zip");

    try {
      if (!fs.existsSync(pluginsFolder)) {
        fs.mkdirSync(pluginsFolder, { recursive: true });
      }

      const url = "https://github.com/Abrahamqb/OpenSteam/raw/refs/heads/master/Plugins/LuaManager.zip";
      const res = await fetch(url, {
        headers: { "User-Agent": "OpenSteamManager" }
      });

      if (!res.ok) {
        throw new Error(`Failed to download LuaManager plugin: HTTP ${res.status}`);
      }

      const buf = await res.arrayBuffer();
      fs.writeFileSync(tempZip, Buffer.from(buf));

      if (fs.existsSync(targetPluginDir)) {
        fs.rmSync(targetPluginDir, { recursive: true, force: true });
      }

      const zip = new AdmZip(tempZip);
      zip.extractAllTo(pluginsFolder, true);

      return {
        success: true,
        message: "LuaManager plugin successfully installed into Steam/plugins! Activate it inside Millennium settings."
      };
    } finally {
      try {
        if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
      } catch {}
    }
  }
}
