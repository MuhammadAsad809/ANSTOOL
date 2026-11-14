const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;
const rootDir = path.resolve(__dirname, '..');
const distRenderer = path.join(rootDir, 'dist', 'renderer');

const mockApiScript = `
<script>
  window.openSteamAPI = {
    oneClickInstall: async (appId, gameName) => {
      await new Promise(r => setTimeout(r, 900));
      let list = JSON.parse(localStorage.getItem("mock_installed_luas") || "[]");
      if (!list.some(g => g.appId === String(appId))) {
        list.push({ appId: String(appId), name: gameName || ("AppID " + appId) });
        localStorage.setItem("mock_installed_luas", JSON.stringify(list));
      }
      return { success: true, appId: String(appId), gameName, message: '"' + gameName + '" added to your Steam library!' };
    },
    searchCatalog: async (query, limit) => {
      const catalog = [
        { appid: "2358720", name: "Black Myth: Wukong" },
        { appid: "1245620", name: "ELDEN RING" },
        { appid: "1091500", name: "Cyberpunk 2077" },
        { appid: "271590", name: "Grand Theft Auto V" },
        { appid: "1551360", name: "Forza Horizon 5" },
        { appid: "730", name: "Counter-Strike 2" },
        { appid: "252490", name: "Rust" },
        { appid: "1172470", name: "Apex Legends" },
        { appid: "1086940", name: "Baldur's Gate 3" },
        { appid: "814380", name: "Sekiro: Shadows Die Twice" },
        { appid: "1151640", name: "Horizon Zero Dawn" },
        { appid: "1817070", name: "Marvel’s Spider-Man Remastered" },
        { appid: "1174180", name: "Red Dead Redemption 2" },
        { appid: "1238810", name: "Battlefield V" },
        { appid: "570", name: "Dota 2" }
      ];
      if (!query || !query.trim()) return catalog;
      const q = query.toLowerCase().trim();
      const filtered = catalog.filter(g => g.name.toLowerCase().includes(q) || g.appid.includes(q));
      if (filtered.length > 0) return filtered;
      if (/^\\d+$/.test(q)) return [{ appid: q, name: "Steam App " + q }];
      return [{ appid: "999999", name: query.trim() }];
    },
    getInstalledLuasWithNames: async () => {
      const stored = localStorage.getItem("mock_installed_luas");
      if (!stored) {
        const initial = [{ appId: "2358720", name: "Black Myth: Wukong" }, { appId: "1091500", name: "Cyberpunk 2077" }];
        localStorage.setItem("mock_installed_luas", JSON.stringify(initial));
        return initial;
      }
      return JSON.parse(stored);
    },
    removeLua: async (appId) => {
      let list = JSON.parse(localStorage.getItem("mock_installed_luas") || "[]");
      list = list.filter(g => g.appId !== String(appId));
      localStorage.setItem("mock_installed_luas", JSON.stringify(list));
      return true;
    },
    getSteamPathInfo: async () => ({
      path: "C:\\\\Program Files (x86)\\\\Steam",
      exists: true,
      isPatched: true,
      isDefault: true,
      injectedFiles: ["OpenSteamTool.dll", "dwmapi.dll"],
      luaPath: "C:\\\\Program Files (x86)\\\\Steam\\\\stplug-in",
      depotCachePath: "C:\\\\Program Files (x86)\\\\Steam\\\\depotcache"
    }),
    getProcessStatus: async () => ({ steamRunning: true, helperRunning: true }),
    launchSteamInstall: async (appId) => {
      alert("Mobile Preview: In Windows, this executes steam://install/" + appId);
      return true;
    },
    patchSteam: async () => ({ success: true, message: "Steam successfully patched via OpenSteamTool!" }),
    unpatchSteam: async () => ({ success: true, message: "Hooks removed." }),
    restartSteam: async () => true,
    startSteam: async () => true,
    killSteamProcesses: async () => true,
    selectDirectory: async () => "C:\\\\Program Files (x86)\\\\Steam",
    selectFile: async () => null,
    windowMinimize: async () => alert("Minimize clicked (Mobile Preview)"),
    windowClose: async () => alert("Close clicked (Mobile Preview)"),
    onLog: () => {}
  };
</script>
`;

const server = http.createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;

  if (url === '/index.html') {
    const htmlPath = path.join(distRenderer, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Build not found. Run npm run build first.');
    }
    let html = fs.readFileSync(htmlPath, 'utf-8');
    // Inject mock script and relax CSP for browser preview
    html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
    html = html.replace('</head>', `${mockApiScript}</head>`);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  const filePath = path.join(distRenderer, url);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    return fs.createReadStream(filePath).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[ANSTOOL PREVIEW] Server running at http://localhost:${PORT}`);
  console.log(`[ANSTOOL PREVIEW] Open http://localhost:${PORT} or http://127.0.0.1:${PORT} in your phone's browser!`);
});
