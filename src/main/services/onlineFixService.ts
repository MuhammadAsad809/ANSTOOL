import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import AdmZip from "adm-zip";

export class OnlineFixService {
  public async downloadOnlineFix(
    gameName: string,
    targetDirectory: string,
    password?: string
  ): Promise<{ success: boolean; message: string }> {
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
        const zip = new AdmZip(tempFile);
        if (password) {
          // If password protected
          zip.extractAllTo(targetDirectory, true, false, password);
        } else {
          zip.extractAllTo(targetDirectory, true);
        }
      } catch (zipErr: any) {
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
    } finally {
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch {}
    }
  }
}
