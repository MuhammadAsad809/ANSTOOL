// ANSTOOL 1-Click Fast Game Unlocker Client

let installedLuaSet = new Set<string>();
let searchDebounceTimer: any = null;
let currentSearchQuery = "";

// Universal SVG Icons
const SVG_ICONS = {
  check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  lightning: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  play: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  download: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  cross: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  info: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
};

// Toast Notification with SVG Icons
function showToast(message: string, type: "success" | "error" | "info" = "success"): void {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = type === "success" ? SVG_ICONS.check : type === "error" ? SVG_ICONS.cross : SVG_ICONS.info;
  toast.innerHTML = `
    <span style="display: flex; align-items: center;">${icon}</span>
    <div>${message}</div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// 1. Navigation & View Switching
function initNavigation(): void {
  const navStoreBtn = document.getElementById("navStoreBtn");
  const navLibraryBtn = document.getElementById("navLibraryBtn");
  const viewStore = document.getElementById("viewStore");
  const viewLibrary = document.getElementById("viewLibrary");
  const goToStoreBtn = document.getElementById("goToStoreBtn");

  function switchTo(view: "store" | "library") {
    if (view === "store") {
      navStoreBtn?.classList.add("active");
      navLibraryBtn?.classList.remove("active");
      viewStore?.classList.add("active");
      viewLibrary?.classList.remove("active");
    } else {
      navLibraryBtn?.classList.add("active");
      navStoreBtn?.classList.remove("active");
      viewLibrary?.classList.add("active");
      viewStore?.classList.remove("active");
      loadLibrary();
    }
  }

  navStoreBtn?.addEventListener("click", () => switchTo("store"));
  navLibraryBtn?.addEventListener("click", () => switchTo("library"));
  goToStoreBtn?.addEventListener("click", () => switchTo("store"));
  document.getElementById("refreshLibraryBtn")?.addEventListener("click", loadLibrary);
}

// 2. Steam Status & Settings
async function checkSteamStatus(): Promise<void> {
  const indicator = document.getElementById("steamStatusIndicator");
  const text = document.getElementById("steamStatusText");
  const settingsPath = document.getElementById("settingsSteamPath");
  const hookPill = document.getElementById("settingsHookStatus");

  if (!window.openSteamAPI) {
    if (indicator) indicator.className = "status-indicator status-missing";
    if (text) text.textContent = "IPC Error";
    return;
  }

  try {
    const [pathInfo, procStatus] = await Promise.all([
      window.openSteamAPI.getSteamPathInfo(),
      window.openSteamAPI.getProcessStatus()
    ]);

    if (!pathInfo.exists) {
      if (indicator) indicator.className = "status-indicator status-missing";
      if (text) text.textContent = "Steam Not Found";
    } else if (procStatus.steamRunning) {
      if (indicator) indicator.className = "status-indicator status-ready";
      if (text) text.textContent = "Steam Ready";
    } else {
      if (indicator) indicator.className = "status-indicator status-stopped";
      if (text) text.textContent = "Steam Closed";
    }

    if (settingsPath) settingsPath.textContent = pathInfo.path;
    if (hookPill) {
      if (pathInfo.isPatched) {
        hookPill.className = "hook-pill patched";
        hookPill.textContent = "Active (Patched)";
      } else {
        hookPill.className = "hook-pill unpatched";
        hookPill.textContent = "Not Patched";
      }
    }
  } catch {}
}

function initSettings(): void {
  const modal = document.getElementById("settingsModal");
  const openBtn = document.getElementById("openSettingsBtn");
  const closeBtn = document.getElementById("closeSettingsBtn");
  const changePathBtn = document.getElementById("changeSteamPathBtn");
  const reapplyHookBtn = document.getElementById("reapplyHookBtn");
  const unpatchBtn = document.getElementById("unpatchBtn");
  const restartBtn = document.getElementById("restartSteamBtn");
  const killBtn = document.getElementById("killSteamBtn");

  openBtn?.addEventListener("click", () => modal?.classList.remove("hidden"));
  closeBtn?.addEventListener("click", () => modal?.classList.add("hidden"));

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  changePathBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    const selected = await window.openSteamAPI.selectDirectory();
    if (selected) {
      await window.openSteamAPI.setCustomSteamPath(selected);
      showToast("Steam path updated!", "info");
      checkSteamStatus();
    }
  });

  reapplyHookBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    try {
      showToast("Deploying Steam proxy hook...", "info");
      const res = await window.openSteamAPI.patchSteam(1);
      showToast(res.message, res.success ? "success" : "error");
      checkSteamStatus();
    } catch (err: any) {
      showToast(`Hook error: ${err.message}`, "error");
    }
  });

  unpatchBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    try {
      showToast("Removing hooks and cleaning up...", "info");
      const res = await window.openSteamAPI.unpatchSteam();
      showToast(res.message, res.success ? "success" : "error");
      checkSteamStatus();
    } catch (err: any) {
      showToast(`Unpatch error: ${err.message}`, "error");
    }
  });

  restartBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    showToast("Restarting Steam...", "info");
    await window.openSteamAPI.restartSteam();
    setTimeout(checkSteamStatus, 3000);
  });

  killBtn?.addEventListener("click", async () => {
    if (!window.openSteamAPI) return;
    showToast("Stopping Steam processes...", "info");
    await window.openSteamAPI.killSteamProcesses();
    setTimeout(checkSteamStatus, 1500);
  });
}

// 3. Search & 1-Click Game Action
async function refreshInstalledLuas(): Promise<void> {
  if (!window.openSteamAPI) return;
  try {
    const luas = await window.openSteamAPI.listInstalledLuas();
    installedLuaSet = new Set(luas.map((f) => f.replace(".lua", "")));
    const badge = document.getElementById("libraryBadge");
    if (badge) badge.textContent = String(installedLuaSet.size);
  } catch {}
}

async function performSearch(query: string): Promise<void> {
  const clean = query.trim();
  currentSearchQuery = clean;

  const loading = document.getElementById("searchLoadingState");
  const emptyState = document.getElementById("searchEmptyState");
  const grid = document.getElementById("gamesGrid");
  const clearBtn = document.getElementById("clearSearchBtn");

  if (clearBtn) {
    if (clean) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }

  if (loading) loading.classList.remove("hidden");
  if (emptyState) emptyState.classList.add("hidden");
  if (grid) grid.innerHTML = "";

  try {
    const games = await window.openSteamAPI.searchCatalog(clean, 30);
    if (loading) loading.classList.add("hidden");

    if (!games || games.length === 0) {
      if (emptyState) emptyState.classList.remove("hidden");
      return;
    }

    if (!grid) return;
    grid.innerHTML = "";

    games.forEach((game) => {
      const isAlreadyAdded = installedLuaSet.has(String(game.appid));
      const card = document.createElement("div");
      card.className = "game-card";

      const bannerUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`;

      card.innerHTML = `
        <div class="game-banner-box">
          <img
            class="game-banner"
            src="${bannerUrl}"
            alt="${game.name}"
            loading="lazy"
            onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'280\\' height=\\'140\\' viewBox=\\'0 0 280 140\\'><rect fill=\\'%23070a13\\' width=\\'280\\' height=\\'140\\'/><text fill=\\'%2364748b\\' x=\\'50%\\' y=\\'50%\\' text-anchor=\\'middle\\' font-family=\\'sans-serif\\' font-size=\\'13\\'>STEAM GAME</text></svg>'"
          />
          <span class="card-appid-badge">ID: ${game.appid}</span>
        </div>
        <div class="game-body">
          <h4 class="game-title" title="${game.name}">${game.name}</h4>
          <button class="card-action-btn ${isAlreadyAdded ? "btn-installed" : ""}" data-appid="${game.appid}" data-name="${game.name}">
            ${isAlreadyAdded ? `${SVG_ICONS.play} Launch in Steam` : `${SVG_ICONS.lightning} Add Game`}
          </button>
        </div>
      `;

      const actionBtn = card.querySelector<HTMLButtonElement>(".card-action-btn");
      actionBtn?.addEventListener("click", async () => {
        if (!window.openSteamAPI) return;

        actionBtn.disabled = true;
        actionBtn.classList.add("loading");
        actionBtn.innerHTML = `<span class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></span> Adding...`;

        try {
          const res = await window.openSteamAPI.oneClickInstall(game.appid, game.name);
          actionBtn.classList.remove("loading");
          actionBtn.classList.add("btn-installed");
          actionBtn.innerHTML = `${SVG_ICONS.check} Added to Steam!`;

          showToast(`"${game.name}" added to Steam! Download launched.`);
          await refreshInstalledLuas();

          setTimeout(() => {
            actionBtn.disabled = false;
            actionBtn.innerHTML = `${SVG_ICONS.play} Launch in Steam`;
          }, 3500);
        } catch (err: any) {
          actionBtn.classList.remove("loading");
          actionBtn.innerHTML = `${SVG_ICONS.cross} Failed`;
          showToast(`Failed to add game: ${err.message}`, "error");
          setTimeout(() => {
            actionBtn.disabled = false;
            actionBtn.innerHTML = isAlreadyAdded ? `${SVG_ICONS.play} Launch in Steam` : `${SVG_ICONS.lightning} Add Game`;
          }, 3000);
        }
      });

      grid.appendChild(card);
    });
  } catch (err: any) {
    if (loading) loading.classList.add("hidden");
    showToast(`Search error: ${err.message}`, "error");
  }
}

function initSearch(): void {
  const searchInput = document.getElementById("gameSearchInput") as HTMLInputElement | null;
  const searchBtn = document.getElementById("searchSubmitBtn");
  const clearBtn = document.getElementById("clearSearchBtn");

  searchInput?.addEventListener("input", () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      performSearch(searchInput.value);
    }, 350);
  });

  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      performSearch(searchInput.value);
    }
  });

  searchBtn?.addEventListener("click", () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    performSearch(searchInput?.value || "");
  });

  clearBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    performSearch("");
  });

  // Trending Tag Pills
  const tagPills = document.querySelectorAll<HTMLButtonElement>(".tag-pill");
  tagPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const name = pill.getAttribute("data-name") || "";
      if (searchInput) searchInput.value = name;
      performSearch(name);
    });
  });
}

// 4. Library View
async function loadLibrary(): Promise<void> {
  const container = document.getElementById("libraryGrid");
  const emptyState = document.getElementById("libraryEmptyState");
  if (!container || !window.openSteamAPI) return;

  container.innerHTML = "";

  try {
    const items = await window.openSteamAPI.getInstalledLuasWithNames();
    installedLuaSet = new Set(items.map((i) => i.appId));

    const badge = document.getElementById("libraryBadge");
    if (badge) badge.textContent = String(items.length);

    if (items.length === 0) {
      emptyState?.classList.remove("hidden");
      return;
    }

    emptyState?.classList.add("hidden");

    items.forEach(({ appId, name }) => {
      const card = document.createElement("div");
      card.className = "lib-card";

      card.innerHTML = `
        <div class="lib-info">
          <span class="lib-appid-pill">${appId}</span>
          <span class="lib-name" id="libName-${appId}" title="${name}">${name}</span>
        </div>
        <div class="lib-controls">
          <button class="btn-icon-action" data-appid="${appId}" title="Install / Run in Steam">
            ${SVG_ICONS.download} Steam
          </button>
          <button class="btn-del-action" data-appid="${appId}" title="Remove Game">
            ${SVG_ICONS.trash}
          </button>
        </div>
      `;

      // Launch button
      card.querySelector(".btn-icon-action")?.addEventListener("click", async () => {
        showToast(`Launching Steam installer for AppID ${appId}...`, "info");
        await window.openSteamAPI.launchSteamInstall(appId);
      });

      // Delete button
      card.querySelector(".btn-del-action")?.addEventListener("click", async () => {
        const ok = await window.openSteamAPI.removeLua(appId);
        if (ok) {
          showToast(`Removed ${name} from Steam config.`, "info");
          card.remove();
          refreshInstalledLuas();
        }
      });

      container.appendChild(card);
    });
  } catch (err: any) {
    showToast(`Error loading library: ${err.message}`, "error");
  }
}

// Bootstrap
async function bootstrap(): Promise<void> {
  initNavigation();
  initSearch();
  initSettings();

  await refreshInstalledLuas();
  await checkSteamStatus();

  // Load initial popular games list
  performSearch("");

  // Periodically check Steam state
  setInterval(checkSteamStatus, 5000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
