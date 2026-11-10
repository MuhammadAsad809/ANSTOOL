// OpenSteam Desktop Client Script

function addLog(message: string, level: "info" | "success" | "warn" | "error" = "info"): void {
  const container = document.getElementById("logConsoleOutput");
  if (!container) return;

  const time = new Date().toISOString().split("T")[1].slice(0, 8);
  const div = document.createElement("div");
  div.className = `log-entry ${level}`;
  div.textContent = `[${time}] [${level.toUpperCase()}] ${message}`;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// 1. Navigation
function initNav(): void {
  const navBtns = document.querySelectorAll<HTMLButtonElement>(".nav-btn");
  const tabPanes = document.querySelectorAll<HTMLElement>(".tab-pane");
  const pageTitle = document.getElementById("pageTitle");

  const titles: Record<string, string> = {
    dashboard: "Dashboard & Operations",
    store: "Lua Store & Game Unlocker",
    library: "Installed Steam Games Library",
    manifests: "Manifest Synchronizer & Lua Inspector",
    plugins: "Millennium Loader & LuaManager Plugins",
    onlinefix: "Online-Fix Multiplayer Bypass",
    manual: "Manual Lua Loader",
    console: "System Runtime Console"
  };

  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      if (!target) return;

      navBtns.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const activePane = document.getElementById(`tab-${target}`);
      if (activePane) activePane.classList.add("active");

      if (pageTitle && titles[target]) {
        pageTitle.textContent = titles[target];
      }

      if (target === "manifests") loadInstalledLuas();
      if (target === "library") loadInstalledGames();
    });
  });
}

// 2. Steam State & Path
async function refreshSteamInfo(): Promise<OpenSteamPathInfo | null> {
  const hookBadge = document.getElementById("hookStatusBadge");
  const procBadge = document.getElementById("processStatusBadge");

  const banner = document.getElementById("ipcErrorBanner");

  if (!window.openSteamAPI) {
    if (banner) banner.classList.remove("hidden");
    if (hookBadge) {
      hookBadge.className = "badge badge-unpatched";
      hookBadge.textContent = "IPC ERROR";
    }
    if (procBadge) {
      procBadge.className = "badge badge-inactive";
      procBadge.textContent = "DISCONNECTED";
    }
    addLog("Preload IPC bridge not found. openSteamAPI is undefined.", "error");
    return null;
  }

  if (banner) banner.classList.add("hidden");

  try {
    const info = await window.openSteamAPI.getSteamPathInfo();
    const proc = await window.openSteamAPI.getProcessStatus();

    // Badges
    if (hookBadge) {
      if (info.isPatched) {
        hookBadge.className = "badge badge-patched";
        hookBadge.textContent = "[PATCHED]";
      } else {
        hookBadge.className = "badge badge-unpatched";
        hookBadge.textContent = "[NOT PATCHED]";
      }
    }

    if (procBadge) {
      if (proc.steamRunning) {
        procBadge.className = "badge badge-active";
        procBadge.textContent = "RUNNING";
      } else {
        procBadge.className = "badge badge-inactive";
        procBadge.textContent = "STOPPED";
      }
    }

    // Dashboard values
    const dashSteamValid = document.getElementById("dashSteamValid");
    const dashSteamPathText = document.getElementById("dashSteamPathText");
    const sidebarSteamPath = document.getElementById("sidebarSteamPath");
    const dashDllCount = document.getElementById("dashDllCount");
    const dashDllList = document.getElementById("dashDllList");

    if (dashSteamValid) dashSteamValid.textContent = info.exists ? "FOUND" : "NOT FOUND";
    if (dashSteamPathText) dashSteamPathText.textContent = info.path;
    if (sidebarSteamPath) sidebarSteamPath.textContent = `Steam: ${info.path}`;

    if (dashDllCount) dashDllCount.textContent = `${info.injectedFiles.length} DLL(s)`;
    if (dashDllList) {
      dashDllList.textContent = info.injectedFiles.length > 0
        ? info.injectedFiles.join(", ")
        : "None (Standard Steam)";
    }

    return info;
  } catch (err: any) {
    addLog(`Error checking Steam path info: ${err.message}`, "error");
    return null;
  }
}

// 3. Quick Actions
function initQuickActions(): void {
  const quickPatchBtn = document.getElementById("quickPatchBtn");
  const quickUnpatchBtn = document.getElementById("quickUnpatchBtn");
  const quickRestartBtn = document.getElementById("quickRestartBtn");
  const quickKillBtn = document.getElementById("quickKillBtn");
  const patchMode1Btn = document.getElementById("patchMode1Btn");
  const patchMode0Btn = document.getElementById("patchMode0Btn");
  const changePathBtn = document.getElementById("changePathBtn");

  async function handlePatch(mode: number): Promise<void> {
    if (!window.openSteamAPI) return;
    try {
      addLog(`Initiating Steam patch (Mode ${mode})...`, "info");
      const res = await window.openSteamAPI.patchSteam(mode);
      addLog(res.message, res.success ? "success" : "error");
      await refreshSteamInfo();
    } catch (err: any) {
      addLog(`Patch error: ${err.message}`, "error");
    }
  }

  async function handleUnpatch(): Promise<void> {
    if (!window.openSteamAPI) return;
    try {
      addLog("Initiating Steam unpatch...", "info");
      const res = await window.openSteamAPI.unpatchSteam();
      addLog(res.message, res.success ? "success" : "error");
      await refreshSteamInfo();
    } catch (err: any) {
      addLog(`Unpatch error: ${err.message}`, "error");
    }
  }

  quickPatchBtn?.addEventListener("click", () => handlePatch(1));
  patchMode1Btn?.addEventListener("click", () => handlePatch(1));
  patchMode0Btn?.addEventListener("click", () => handlePatch(0));
  quickUnpatchBtn?.addEventListener("click", handleUnpatch);

  quickRestartBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    addLog("Restarting Steam client...", "info");
    await window.openSteamAPI.restartSteam();
    setTimeout(refreshSteamInfo, 2500);
  });

  quickKillBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    addLog("Stopping all Steam processes...", "info");
    await window.openSteamAPI.killSteamProcesses();
    setTimeout(refreshSteamInfo, 1000);
  });

  changePathBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    const selected = await window.openSteamAPI.selectDirectory();
    if (selected) {
      addLog(`Setting custom Steam path: ${selected}`, "info");
      await window.openSteamAPI.setCustomSteamPath(selected);
      await refreshSteamInfo();
    }
  });
}

let activeModalAppId: string | number | null = null;

function showGameUnlockedModal(appId: string | number, gameTitle?: string): void {
  activeModalAppId = appId;
  const modal = document.getElementById("gameUnlockedModal");
  const modalTitle = document.getElementById("modalGameTitle");
  const modalAppId = document.getElementById("modalGameAppId");

  if (modalTitle) modalTitle.textContent = gameTitle ? `Unlocked: ${gameTitle}` : "Game Unlocked & Injected!";
  if (modalAppId) modalAppId.textContent = `Steam AppID: ${appId}`;

  if (modal) modal.classList.remove("hidden");
}

function initModal(): void {
  const modal = document.getElementById("gameUnlockedModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const modalDoneBtn = document.getElementById("modalDoneBtn");
  const modalRestartSteamBtn = document.getElementById("modalRestartSteamBtn");
  const modalInstallSteamBtn = document.getElementById("modalInstallSteamBtn");

  function hideModal() {
    if (modal) modal.classList.add("hidden");
  }

  closeModalBtn?.addEventListener("click", hideModal);
  modalDoneBtn?.addEventListener("click", hideModal);

  modalRestartSteamBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    addLog("Restarting Steam client...", "info");
    await window.openSteamAPI.restartSteam();
    addLog("Steam restart command sent.", "success");
    setTimeout(refreshSteamInfo, 2500);
  });

  modalInstallSteamBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI || !activeModalAppId) return;
    addLog(`Launching official Steam installation for AppID ${activeModalAppId}...`, "info");
    await window.openSteamAPI.launchSteamInstall(activeModalAppId);
    addLog(`Dispatched steam://install/${activeModalAppId}. Check your Steam window.`, "success");
  });
}

// 4. Lua Store & Game Unlocker
function initStore(): void {
  const storeSearchInput = document.getElementById("storeSearchInput") as HTMLInputElement | null;
  const storeSearchBtn = document.getElementById("storeSearchBtn");
  const storeSyncCatalogBtn = document.getElementById("storeSyncCatalogBtn");
  const directAppIdInput = document.getElementById("directAppIdInput") as HTMLInputElement | null;
  const directUnlockBtn = document.getElementById("directUnlockBtn");
  const resultsGrid = document.getElementById("storeResultsGrid");
  const loading = document.getElementById("catalogLoading");

  async function performSearch(): Promise<void> {
    if (!window.openSteamAPI) return;
    const query = storeSearchInput?.value.trim() || "";
    if (loading) loading.classList.remove("hidden");
    if (resultsGrid) resultsGrid.innerHTML = "";

    try {
      const games = await window.openSteamAPI.searchCatalog(query, 36);
      if (loading) loading.classList.add("hidden");

      if (!resultsGrid) return;

      if (!games || games.length === 0) {
        resultsGrid.innerHTML = `<div class="loading-state">No games found matching "${query}". Try searching by numeric AppID.</div>`;
        return;
      }

      games.forEach((game) => {
        const card = document.createElement("div");
        card.className = "game-card";

        const bannerUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`;

        card.innerHTML = `
          <img class="game-thumb" src="${bannerUrl}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'240\\' height=\\'115\\' viewBox=\\'0 0 240 115\\'><rect fill=\\'%23070a13\\' width=\\'240\\' height=\\'115\\'/><text fill=\\'%2364748b\\' x=\\'50%\\' y=\\'50%\\' text-anchor=\\'middle\\' font-family=\\'monospace\\' font-size=\\'12\\'>NO STEAM BANNER</text></svg>'" alt="${game.name}" />
          <div class="game-info">
            <div class="game-name" title="${game.name}">${game.name}</div>
            <div class="game-appid">AppID: ${game.appid}</div>
            <div style="display: flex; gap: 8px; margin-top: auto;">
              <button class="btn btn-emerald unlock-btn" style="flex: 1;" data-appid="${game.appid}">⚡ Unlock</button>
              <button class="btn btn-sky store-install-btn" title="Launch Steam Install" data-appid="${game.appid}">📥</button>
            </div>
          </div>
        `;

        const unlockBtn = card.querySelector<HTMLButtonElement>(".unlock-btn");
        const storeInstallBtn = card.querySelector<HTMLButtonElement>(".store-install-btn");

        unlockBtn?.addEventListener("click", async () => {
          if (!window.openSteamAPI) return;
          unlockBtn.disabled = true;
          unlockBtn.textContent = "Syncing...";
          try {
            const res = await window.openSteamAPI.generateAndInstallLua(game.appid);
            addLog(res.message, res.success ? "success" : "error");
            unlockBtn.textContent = "✔ Unlocked";
            showGameUnlockedModal(game.appid, game.name);
          } catch (err: any) {
            addLog(`Unlock failed for ${game.name}: ${err.message}`, "error");
            unlockBtn.textContent = "Failed";
          } finally {
            setTimeout(() => {
              unlockBtn.disabled = false;
              unlockBtn.textContent = "⚡ Unlock";
            }, 3000);
          }
        });

        storeInstallBtn?.addEventListener("click", async () => {
          if (!window.openSteamAPI) return;
          addLog(`Triggering install for ${game.name} (AppID ${game.appid})...`, "info");
          await window.openSteamAPI.launchSteamInstall(game.appid);
        });

        resultsGrid.appendChild(card);
      });
    } catch (err: any) {
      if (loading) loading.classList.add("hidden");
      addLog(`Catalog search error: ${err.message}`, "error");
    }
  }

  storeSearchBtn?.addEventListener("click", performSearch);
  storeSearchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") performSearch();
  });

  storeSyncCatalogBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    addLog("Updating local game catalog cache...", "info");
    const res = await window.openSteamAPI.syncCatalog();
    addLog(`Catalog synchronized with ${res.totalGames} entries.`, res.success ? "success" : "error");
    performSearch();
  });

  directUnlockBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    const appId = directAppIdInput?.value.trim();
    if (!appId) {
      addLog("Please enter a valid Steam AppID.", "warn");
      return;
    }

    addLog(`Triggering direct unlock for AppID ${appId}...`, "info");
    try {
      const res = await window.openSteamAPI.generateAndInstallLua(appId);
      addLog(res.message, res.success ? "success" : "error");
      if (directAppIdInput) directAppIdInput.value = "";
      showGameUnlockedModal(appId, `Steam AppID ${appId}`);
    } catch (err: any) {
      addLog(`Direct unlock error: ${err.message}`, "error");
    }
  });

  // Initial populate
  performSearch();
}

// 5. Installed Games Library
async function loadInstalledGames(): Promise<void> {
  const container = document.getElementById("installedGamesList");
  const countText = document.getElementById("libraryCountText");
  if (!container) return;

  if (!window.openSteamAPI) {
    container.innerHTML = `<div class="loading-state error">IPC API bridge unavailable.</div>`;
    return;
  }

  container.innerHTML = `<div class="loading-state">Scanning local Steam library folders...</div>`;

  try {
    const games = await window.openSteamAPI.getInstalledGames();
    if (countText) countText.textContent = `${games.length} games installed`;

    if (!games || games.length === 0) {
      container.innerHTML = `<div class="loading-state">No installed Steam games detected in default library paths.</div>`;
      return;
    }

    container.innerHTML = "";
    games.forEach((g) => {
      const row = document.createElement("div");
      row.className = "installed-row";
      row.innerHTML = `
        <div class="installed-meta">
          <span class="installed-appid">${g.appid}</span>
          <div>
            <div class="installed-name">${g.name}</div>
            <div class="installed-path">${g.installPath || "Steam/steamapps/common"}</div>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-sky lib-install-btn" data-appid="${g.appid}">📥 Install</button>
          <button class="btn btn-emerald lib-unlock-btn" data-appid="${g.appid}">⚡ Sync Lua</button>
        </div>
      `;

      row.querySelector<HTMLButtonElement>(".lib-install-btn")?.addEventListener("click", async () => {
        if (!window.openSteamAPI) return;
        addLog(`Triggering Steam install for ${g.name} (AppID ${g.appid})...`, "info");
        await window.openSteamAPI.launchSteamInstall(g.appid);
      });

      const btn = row.querySelector<HTMLButtonElement>(".lib-unlock-btn");
      btn?.addEventListener("click", async () => {
        if (!window.openSteamAPI) return;
        btn.disabled = true;
        btn.textContent = "Syncing...";
        try {
          const res = await window.openSteamAPI.generateAndInstallLua(g.appid);
          addLog(res.message, res.success ? "success" : "error");
          btn.textContent = "✔ Synced";
          showGameUnlockedModal(g.appid, g.name);
        } catch (err: any) {
          addLog(`Sync error: ${err.message}`, "error");
          btn.textContent = "Failed";
        } finally {
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = "⚡ Sync Lua";
          }, 3000);
        }
      });

      container.appendChild(row);
    });
  } catch (err: any) {
    container.innerHTML = `<div class="loading-state error">Failed to scan library: ${err.message}</div>`;
  }
}

// 6. Manifest Manager
async function loadInstalledLuas(): Promise<void> {
  const container = document.getElementById("installedLuasContainer");
  if (!container) return;
  if (!window.openSteamAPI) return;

  try {
    const luas = await window.openSteamAPI.listInstalledLuas();
    if (!luas || luas.length === 0) {
      container.innerHTML = `<span class="text-dim">No Lua scripts currently installed in Steam plugin directory.</span>`;
      return;
    }

    container.innerHTML = "";
    luas.forEach((fileName) => {
      const appId = fileName.replace(".lua", "");
      const tag = document.createElement("div");
      tag.className = "lua-tag";
      tag.style.display = "inline-flex";
      tag.style.alignItems = "center";
      tag.style.gap = "8px";

      tag.innerHTML = `
        <span style="font-weight: 700; color: #fff;">${fileName}</span>
        <button class="btn-xs btn-emerald lua-install-btn" title="Launch Steam Install" data-appid="${appId}">📥 Install in Steam</button>
        <button class="btn-xs lua-steps-btn" title="View Instructions" data-appid="${appId}">ℹ️ Steps</button>
        <span class="lua-tag-del" title="Delete Lua config" data-appid="${appId}">✕</span>
      `;

      tag.querySelector(".lua-install-btn")?.addEventListener("click", async () => {
        if (!window.openSteamAPI) return;
        addLog(`Triggering install for AppID ${appId}...`, "info");
        await window.openSteamAPI.launchSteamInstall(appId);
      });

      tag.querySelector(".lua-steps-btn")?.addEventListener("click", () => {
        showGameUnlockedModal(appId, `AppID ${appId}`);
      });

      tag.querySelector(".lua-tag-del")?.addEventListener("click", async () => {
        if (!window.openSteamAPI) return;
        const ok = await window.openSteamAPI.removeLua(appId);
        if (ok) {
          addLog(`Removed ${fileName}`, "info");
          loadInstalledLuas();
        }
      });

      container.appendChild(tag);
    });
  } catch (err: any) {
    container.innerHTML = `<span class="text-dim">Error reading Luas: ${err.message}</span>`;
  }
}

function initManifestManager(): void {
  const batchBtn = document.getElementById("batchFixManifestsBtn");
  const summaryBox = document.getElementById("manifestFixSummary");

  batchBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    if (batchBtn) (batchBtn as HTMLButtonElement).disabled = true;
    addLog("Beginning batch manifest scan and synchronization...", "info");

    try {
      const res = await window.openSteamAPI.fixAllManifests();
      if (summaryBox) {
        summaryBox.classList.remove("hidden");
        summaryBox.innerHTML = `
          <strong>Batch Fix Complete:</strong><br>
          • Scanned Lua scripts: ${res.scannedCount}<br>
          • Depots verified: Active (setManifestid configured)<br>
          • Manifests updated: ${res.luaFilesUpdated}<br>
          <div style="margin-top: 8px; padding: 8px; background: rgba(56, 189, 248, 0.1); border-radius: 4px; color: #38bdf8;">
            💡 <strong>Next Step:</strong> Click <strong>"📥 Install in Steam"</strong> on any script below or in the popup to trigger Steam's official installation prompt!
          </div>
        `;
      }
      addLog(`Manifest batch sync finished: ${res.luaFilesUpdated} updated.`, "success");
      loadInstalledLuas();
    } catch (err: any) {
      addLog(`Batch manifest error: ${err.message}`, "error");
    } finally {
      if (batchBtn) (batchBtn as HTMLButtonElement).disabled = false;
    }
  });
}

// 7. Plugins & Millennium
function initPlugins(): void {
  const installMillenniumBtn = document.getElementById("installMillenniumBtn");
  const installLuaManagerBtn = document.getElementById("installLuaManagerBtn");

  installMillenniumBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    addLog("Downloading Millennium installer...", "info");
    const res = await window.openSteamAPI.installMillennium();
    addLog(res.message, res.success ? "success" : "error");
  });

  installLuaManagerBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    addLog("Downloading and installing LuaManager plugin...", "info");
    const res = await window.openSteamAPI.installLuaManager();
    addLog(res.message, res.success ? "success" : "error");
  });
}

// 8. Online-Fix
function initOnlineFix(): void {
  const ofGameName = document.getElementById("ofGameName") as HTMLInputElement | null;
  const ofGamePath = document.getElementById("ofGamePath") as HTMLInputElement | null;
  const ofPassword = document.getElementById("ofPassword") as HTMLInputElement | null;
  const ofBrowsePathBtn = document.getElementById("ofBrowsePathBtn");
  const ofDeployBtn = document.getElementById("ofDeployBtn");

  ofBrowsePathBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    const dir = await window.openSteamAPI.selectDirectory();
    if (dir && ofGamePath) {
      ofGamePath.value = dir;
    }
  });

  ofDeployBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    const game = ofGameName?.value.trim() || "";
    const pathVal = ofGamePath?.value.trim() || "";
    const pass = ofPassword?.value.trim() || "online-fix.me";

    if (!game) {
      addLog("Game title is required for Online-Fix query.", "warn");
      return;
    }
    if (!pathVal) {
      addLog("Game destination path is required.", "warn");
      return;
    }

    addLog(`Searching and applying Online-Fix for "${game}"...`, "info");
    try {
      const res = await window.openSteamAPI.downloadOnlineFix(game, pathVal, pass);
      addLog(res.message, res.success ? "success" : "error");
    } catch (err: any) {
      addLog(`Online-Fix error: ${err.message}`, "error");
    }
  });
}

// 9. Manual Lua
function initManualLua(): void {
  const selectFileBtn = document.getElementById("selectLuaFileBtn");
  const dropZone = document.getElementById("luaDropZone");

  async function handleImport(filePath: string): Promise<void> {
    if (!window.openSteamAPI) return;
    addLog(`Importing manual Lua file: ${filePath}`, "info");
    try {
      const res = await window.openSteamAPI.importManualLua(filePath);
      addLog(res.message, res.success ? "success" : "error");
      loadInstalledLuas();
    } catch (err: any) {
      addLog(`Failed to import Lua: ${err.message}`, "error");
    }
  }

  selectFileBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    const file = await window.openSteamAPI.selectFile(["lua"]);
    if (file) handleImport(file);
  });

  dropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone?.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".lua")) {
        const filePath = (file as any).path;
        if (filePath) handleImport(filePath);
      } else {
        addLog("Only .lua files are supported.", "warn");
      }
    }
  });
}

// 10. Console
function initConsole(): void {
  const clearBtn = document.getElementById("clearLogBtn");
  clearBtn?.addEventListener("click", () => {
    const container = document.getElementById("logConsoleOutput");
    if (container) container.innerHTML = "";
    addLog("Console log cleared.", "info");
  });

  // Listen to IPC backend logs
  if (window.openSteamAPI?.onLog) {
    window.openSteamAPI.onLog((data) => {
      addLog(data.message, data.level);
    });
  }
}

// Bootstrap
function bootstrap(): void {
  console.log("[RENDERER] Bootstrapping UI...");
  initNav();
  initQuickActions();
  initModal();
  initStore();
  initManifestManager();
  initPlugins();
  initOnlineFix();
  initManualLua();
  initConsole();

  document.getElementById("refreshLibraryBtn")?.addEventListener("click", loadInstalledGames);

  refreshSteamInfo();
  // Poll Steam state every 5 seconds
  setInterval(refreshSteamInfo, 5000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
