"use strict";
// ANSTOOL 1-Click Fast Game Unlocker Client
let installedLuaSet = new Set();
let searchDebounceTimer = null;
let currentSearchQuery = "";
// Toast Notification
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container)
        return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
    <span>${type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}</span>
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
function initNavigation() {
    const navStoreBtn = document.getElementById("navStoreBtn");
    const navLibraryBtn = document.getElementById("navLibraryBtn");
    const viewStore = document.getElementById("viewStore");
    const viewLibrary = document.getElementById("viewLibrary");
    const goToStoreBtn = document.getElementById("goToStoreBtn");
    function switchTo(view) {
        if (view === "store") {
            navStoreBtn?.classList.add("active");
            navLibraryBtn?.classList.remove("active");
            viewStore?.classList.add("active");
            viewLibrary?.classList.remove("active");
        }
        else {
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
}
// 2. Steam Status & Settings
async function checkSteamStatus() {
    const indicator = document.getElementById("steamStatusIndicator");
    const text = document.getElementById("steamStatusText");
    const settingsPath = document.getElementById("settingsSteamPath");
    const hookPill = document.getElementById("settingsHookStatus");
    if (!window.openSteamAPI) {
        if (indicator)
            indicator.className = "status-indicator status-missing";
        if (text)
            text.textContent = "IPC Error";
        return;
    }
    try {
        const [pathInfo, procStatus] = await Promise.all([
            window.openSteamAPI.getSteamPathInfo(),
            window.openSteamAPI.getProcessStatus()
        ]);
        if (!pathInfo.exists) {
            if (indicator)
                indicator.className = "status-indicator status-missing";
            if (text)
                text.textContent = "Steam Not Found";
        }
        else if (procStatus.steamRunning) {
            if (indicator)
                indicator.className = "status-indicator status-ready";
            if (text)
                text.textContent = "Steam Ready";
        }
        else {
            if (indicator)
                indicator.className = "status-indicator status-stopped";
            if (text)
                text.textContent = "Steam Closed";
        }
        if (settingsPath)
            settingsPath.textContent = pathInfo.path;
        if (hookPill) {
            if (pathInfo.isPatched) {
                hookPill.className = "hook-pill patched";
                hookPill.textContent = "Active (Patched)";
            }
            else {
                hookPill.className = "hook-pill unpatched";
                hookPill.textContent = "Not Patched";
            }
        }
    }
    catch { }
}
function initSettings() {
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
        if (e.target === modal)
            modal.classList.add("hidden");
    });
    changePathBtn?.addEventListener("click", async () => {
        if (!window.openSteamAPI)
            return;
        const selected = await window.openSteamAPI.selectDirectory();
        if (selected) {
            await window.openSteamAPI.setCustomSteamPath(selected);
            showToast("Steam path updated!", "info");
            checkSteamStatus();
        }
    });
    reapplyHookBtn?.addEventListener("click", async () => {
        if (!window.openSteamAPI)
            return;
        try {
            showToast("Deploying Steam proxy hook...", "info");
            const res = await window.openSteamAPI.patchSteam(1);
            showToast(res.message, res.success ? "success" : "error");
            checkSteamStatus();
        }
        catch (err) {
            showToast(`Hook error: ${err.message}`, "error");
        }
    });
    unpatchBtn?.addEventListener("click", async () => {
        if (!window.openSteamAPI)
            return;
        try {
            showToast("Removing hooks and cleaning up...", "info");
            const res = await window.openSteamAPI.unpatchSteam();
            showToast(res.message, res.success ? "success" : "error");
            checkSteamStatus();
        }
        catch (err) {
            showToast(`Unpatch error: ${err.message}`, "error");
        }
    });
    restartBtn?.addEventListener("click", async () => {
        if (!window.openSteamAPI)
            return;
        showToast("Restarting Steam...", "info");
        await window.openSteamAPI.restartSteam();
        setTimeout(checkSteamStatus, 2500);
    });
    killBtn?.addEventListener("click", async () => {
        if (!window.openSteamAPI)
            return;
        showToast("Stopping Steam...", "info");
        await window.openSteamAPI.killSteamProcesses();
        setTimeout(checkSteamStatus, 1500);
    });
}
// 3. Search & 1-Click Game Action
async function refreshInstalledLuas() {
    if (!window.openSteamAPI)
        return;
    try {
        const luas = await window.openSteamAPI.listInstalledLuas();
        installedLuaSet = new Set(luas.map((f) => f.replace(".lua", "")));
        const badge = document.getElementById("libraryBadge");
        if (badge)
            badge.textContent = String(installedLuaSet.size);
    }
    catch { }
}
async function performSearch(query) {
    const clean = query.trim();
    currentSearchQuery = clean;
    const loading = document.getElementById("searchLoadingState");
    const emptyState = document.getElementById("searchEmptyState");
    const grid = document.getElementById("gamesGrid");
    const clearBtn = document.getElementById("clearSearchBtn");
    if (clearBtn) {
        if (clean)
            clearBtn.classList.remove("hidden");
        else
            clearBtn.classList.add("hidden");
    }
    if (loading)
        loading.classList.remove("hidden");
    if (emptyState)
        emptyState.classList.add("hidden");
    if (grid)
        grid.innerHTML = "";
    try {
        const games = await window.openSteamAPI.searchCatalog(clean, 30);
        if (loading)
            loading.classList.add("hidden");
        if (!games || games.length === 0) {
            if (emptyState)
                emptyState.classList.remove("hidden");
            return;
        }
        if (!grid)
            return;
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
            ${isAlreadyAdded ? "▶ Added (Launch)" : "⚡ Add Game"}
          </button>
        </div>
      `;
            const actionBtn = card.querySelector(".card-action-btn");
            actionBtn?.addEventListener("click", async () => {
                if (!window.openSteamAPI)
                    return;
                actionBtn.disabled = true;
                actionBtn.classList.add("loading");
                actionBtn.innerHTML = `<span>⏳</span> Adding...`;
                try {
                    const res = await window.openSteamAPI.oneClickInstall(game.appid, game.name);
                    actionBtn.classList.remove("loading");
                    actionBtn.classList.add("btn-installed");
                    actionBtn.innerHTML = `<span>✅</span> Done! Check Steam`;
                    showToast(`🎉 "${game.name}" added to Steam! Download started.`);
                    await refreshInstalledLuas();
                    setTimeout(() => {
                        actionBtn.disabled = false;
                        actionBtn.innerHTML = `<span>▶</span> Added (Launch)`;
                    }, 3500);
                }
                catch (err) {
                    actionBtn.classList.remove("loading");
                    actionBtn.innerHTML = `<span>❌</span> Failed`;
                    showToast(`Failed to add game: ${err.message}`, "error");
                    setTimeout(() => {
                        actionBtn.disabled = false;
                        actionBtn.innerHTML = isAlreadyAdded ? "▶ Added (Launch)" : "⚡ Add Game";
                    }, 3000);
                }
            });
            grid.appendChild(card);
        });
    }
    catch (err) {
        if (loading)
            loading.classList.add("hidden");
        showToast(`Search error: ${err.message}`, "error");
    }
}
function initSearch() {
    const searchInput = document.getElementById("gameSearchInput");
    const searchBtn = document.getElementById("searchSubmitBtn");
    const clearBtn = document.getElementById("clearSearchBtn");
    searchInput?.addEventListener("input", () => {
        if (searchDebounceTimer)
            clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            performSearch(searchInput.value);
        }, 350);
    });
    searchInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            if (searchDebounceTimer)
                clearTimeout(searchDebounceTimer);
            performSearch(searchInput.value);
        }
    });
    searchBtn?.addEventListener("click", () => {
        if (searchDebounceTimer)
            clearTimeout(searchDebounceTimer);
        performSearch(searchInput?.value || "");
    });
    clearBtn?.addEventListener("click", () => {
        if (searchInput)
            searchInput.value = "";
        performSearch("");
    });
    // Trending Tag Pills
    const tagPills = document.querySelectorAll(".tag-pill");
    tagPills.forEach((pill) => {
        pill.addEventListener("click", () => {
            const name = pill.getAttribute("data-name") || "";
            if (searchInput)
                searchInput.value = name;
            performSearch(name);
        });
    });
}
// 4. Library View
async function loadLibrary() {
    const container = document.getElementById("libraryGrid");
    const emptyState = document.getElementById("libraryEmptyState");
    if (!container || !window.openSteamAPI)
        return;
    container.innerHTML = "";
    try {
        const luas = await window.openSteamAPI.listInstalledLuas();
        installedLuaSet = new Set(luas.map((f) => f.replace(".lua", "")));
        const badge = document.getElementById("libraryBadge");
        if (badge)
            badge.textContent = String(luas.length);
        if (luas.length === 0) {
            emptyState?.classList.remove("hidden");
            return;
        }
        emptyState?.classList.add("hidden");
        luas.forEach((file) => {
            const appId = file.replace(".lua", "");
            const card = document.createElement("div");
            card.className = "lib-card";
            card.innerHTML = `
        <div class="lib-info">
          <span class="lib-appid-pill">${appId}</span>
          <span class="lib-name" id="libName-${appId}">Game AppID ${appId}</span>
        </div>
        <div class="lib-controls">
          <button class="btn-icon-action" data-appid="${appId}" title="Install / Run in Steam">
            <span>📥</span> Steam
          </button>
          <button class="btn-del-action" data-appid="${appId}" title="Remove Game">✕</button>
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
                    showToast(`Removed AppID ${appId} from Steam config.`, "info");
                    card.remove();
                    refreshInstalledLuas();
                }
            });
            container.appendChild(card);
            // Async fetch official game title
            fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`)
                .then((r) => r.json())
                .then((data) => {
                if (data[appId]?.success && data[appId]?.data?.name) {
                    const nameEl = document.getElementById(`libName-${appId}`);
                    if (nameEl)
                        nameEl.textContent = data[appId].data.name;
                }
            })
                .catch(() => { });
        });
    }
    catch (err) {
        showToast(`Error loading library: ${err.message}`, "error");
    }
}
// Bootstrap
async function bootstrap() {
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
}
else {
    bootstrap();
}
