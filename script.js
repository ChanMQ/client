import * as sdk from "matrix-js-sdk";
import { initAsync as initCryptoWasm } from "@matrix-org/matrix-sdk-crypto-wasm";
import { decodeRecoveryKey } from "matrix-js-sdk/lib/crypto-api";

const APP_NAME = "Ficus Matrix";
const STORAGE_KEYS = {
    session: "ficus_matrix_app_session_v3",
    settings: "ficus_matrix_app_settings_v3",
    ui: "ficus_matrix_app_ui_v3",
};
const SESSION_SECRET_STORAGE_KEY = "ficus_matrix_app_secret_storage_key";

const DEFAULT_SETTINGS = { enableCrypto: true };
const DEFAULT_UI = { pinnedRooms: [], blockedUsers: [], activeTab: "chats", lastRoomId: null };

const state = {
    client: null, session: null, settings: loadJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
    ui: loadJson(STORAGE_KEYS.ui, DEFAULT_UI), authMode: "login", syncState: "STOPPED", cryptoReady: false,
    cryptoStatus: { enabled: false, lastError: "" }, activeRoomId: null, activeMessageEvent: null,
    activeRoomContextId: null, currentPublicRooms: [], modalCloseTimer: null, replyToEventId: null, editEventId: null,
    secretStorageKey: loadSecretStorageKey(), mediaCache: new Map(),
};

const refs = {
    body: document.body, statusBanner: document.getElementById("statusBanner"),
    authScreen: document.getElementById("authScreen"), authForm: document.getElementById("authForm"),
    authTabs: Array.from(document.querySelectorAll(".auth-tab")), authHomeserver: document.getElementById("authHomeserver"),
    authUsername: document.getElementById("authUsername"), authPassword: document.getElementById("authPassword"),
    authDisplayName: document.getElementById("authDisplayName"), authDisplayNameField: document.getElementById("authDisplayNameField"),
    authEnableCrypto: document.getElementById("authEnableCrypto"), authError: document.getElementById("authError"),
    authSubmit: document.getElementById("authSubmit"), appShell: document.getElementById("appShell"),
    navItems: Array.from(document.querySelectorAll(".nav-item")), tabs: {
        chats: document.getElementById("tab-chats"), publics: document.getElementById("tab-publics"),
        privates: document.getElementById("tab-privates"), settings: document.getElementById("tab-settings"),
    },
    roomSearchInput: document.getElementById("roomSearchInput"), composeMenuBtn: document.getElementById("composeMenuBtn"),
    publicSearchInput: document.getElementById("publicSearchInput"), publicSearchBtn: document.getElementById("publicSearchBtn"),
    chatPinnedSection: document.getElementById("chatPinnedSection"), chatDmSection: document.getElementById("chatDmSection"),
    chatRoomsSection: document.getElementById("chatRoomsSection"), chatEmptyState: document.getElementById("chatEmptyState"),
    joinedPublicSection: document.getElementById("joinedPublicSection"), publicDirectorySection: document.getElementById("publicDirectorySection"),
    publicEmptyState: document.getElementById("publicEmptyState"), privateRoomsSection: document.getElementById("privateRoomsSection"),
    privateEmptyState: document.getElementById("privateEmptyState"), settingsProfileCard: document.getElementById("settingsProfileCard"),
    cryptoStatusValue: document.getElementById("cryptoStatusValue"), backupStatusValue: document.getElementById("backupStatusValue"),
    mxidInfoValue: document.getElementById("mxidInfoValue"), restoreKeysBtn: document.getElementById("restoreKeysBtn"),
    logoutBtn: document.getElementById("logoutBtn"), emptyState: document.getElementById("emptyState"),
    chatView: document.getElementById("chatView"), chatHeaderInfo: document.getElementById("chatHeaderInfo"),
    chatHeaderAvatar: document.getElementById("chatHeaderAvatar"), chatHeaderTitle: document.getElementById("chatHeaderTitle"),
    chatHeaderStatus: document.getElementById("chatHeaderStatus"), chatHeaderEncrypted: document.getElementById("chatHeaderEncrypted"),
    backBtn: document.getElementById("backBtn"), openRoomInfoBtn: document.getElementById("openRoomInfoBtn"),
    composerContext: document.getElementById("composerContext"), messageContainer: document.getElementById("messageContainer"),
    attachBtn: document.getElementById("attachBtn"), attachmentInput: document.getElementById("attachmentInput"),
    chatInput: document.getElementById("chatInput"), sendBtn: document.getElementById("sendBtn"),
    globalOverlay: document.getElementById("globalOverlay"), composeMenu: document.getElementById("composeMenu"),
    roomMenu: document.getElementById("roomMenu"), messageMenu: document.getElementById("messageMenu"),
    modalOverlay: document.getElementById("modalOverlay"), modalCard: document.getElementById("modalCard"),
    modalTitle: document.getElementById("modalTitle"), modalSubtitle: document.getElementById("modalSubtitle"),
    modalBody: document.getElementById("modalBody"), closeModalBtn: document.getElementById("closeModalBtn"),
};

init();

async function init() {
    bindStaticEvents();
    updateAuthMode(state.authMode);
    switchTab(state.ui.activeTab || "chats");

    const session = loadJson(STORAGE_KEYS.session, null);
    if (session?.accessToken && session?.userId && session?.baseUrl) {
        refs.authHomeserver.value = session.baseUrl;
        try {
            await startSession(session, { restoring: true });
            return;
        } catch (error) {
            clearSession();
            showStatus(`Сессия устарела: ${parseError(error)}`, "error");
        }
    }
    showAuth();
}

function bindStaticEvents() {
    refs.authTabs.forEach(btn => btn.addEventListener("click", () => updateAuthMode(btn.dataset.authMode)));
    refs.authForm.addEventListener("submit", handleAuthSubmit);
    refs.navItems.forEach(item => item.addEventListener("click", () => switchTab(item.dataset.tab)));
    refs.roomSearchInput.addEventListener("input", renderRooms);
    refs.publicSearchBtn.addEventListener("click", () => loadPublicRooms(refs.publicSearchInput.value.trim()));
    refs.composeMenuBtn.addEventListener("click", e => { e.stopPropagation(); openMenu(refs.composeMenu, e.currentTarget.getBoundingClientRect()); });
    refs.globalOverlay.addEventListener("click", closeMenus);
    refs.closeModalBtn.addEventListener("click", closeModal);
    refs.modalOverlay.addEventListener("click", e => { if (e.target === refs.modalOverlay) closeModal(); });
    refs.composeMenu.addEventListener("click", handleComposeMenu);
    refs.roomMenu.addEventListener("click", handleRoomMenu);
    refs.messageMenu.addEventListener("click", handleMessageMenu);
    refs.backBtn.addEventListener("click", () => refs.body.classList.remove("mobile-chat-active"));
    refs.openRoomInfoBtn.addEventListener("click", () => openRoomInfo(state.activeRoomId));
    refs.chatHeaderInfo.addEventListener("click", () => openRoomInfo(state.activeRoomId));
    refs.sendBtn.addEventListener("click", sendCurrentMessage);
    refs.attachBtn.addEventListener("click", () => refs.attachmentInput.click());
    refs.attachmentInput.addEventListener("change", handleAttachmentSelection);
    refs.chatInput.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCurrentMessage(); } });
    refs.chatInput.addEventListener("input", e => { e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 140)}px`; });
    refs.messageContainer.addEventListener("scroll", handleTimelineScroll);
    refs.messageContainer.addEventListener("contextmenu", handleMessageAreaContext);
    [refs.chatPinnedSection, refs.chatDmSection, refs.chatRoomsSection, refs.privateRoomsSection, refs.joinedPublicSection].forEach(c => {
        c.addEventListener("click", handleRoomListClick);
        c.addEventListener("contextmenu", handleRoomContextMenu);
    });
    refs.publicDirectorySection.addEventListener("click", handlePublicListClick);
    refs.restoreKeysBtn.addEventListener("click", openRestoreKeysModal);
    refs.logoutBtn.addEventListener("click", logout);
    refs.modalBody.addEventListener("click", handleModalActions);
    refs.modalBody.addEventListener("submit", handleModalSubmit);
}

function updateAuthMode(mode) {
    state.authMode = mode;
    refs.authTabs.forEach(b => b.classList.toggle("active", b.dataset.authMode === mode));
    refs.authDisplayNameField.classList.toggle("hidden", mode !== "register");
    refs.authSubmit.textContent = mode === "register" ? "Создать аккаунт" : "Войти";
    refs.authPassword.autocomplete = mode === "register" ? "new-password" : "current-password";
}

function showAuth() { refs.authScreen.classList.remove("hidden"); refs.appShell.classList.add("hidden"); }
function showApp() { refs.authScreen.classList.add("hidden"); refs.appShell.classList.remove("hidden"); }

async function handleAuthSubmit(event) {
    event.preventDefault();
    refs.authSubmit.disabled = true;
    refs.authSubmit.textContent = "Загрузка...";

    try {
        const baseUrl = new URL(refs.authHomeserver.value.trim()).origin;
        const usernameRaw = refs.authUsername.value.trim();
        const password = refs.authPassword.value;
        const tempClient = sdk.createClient({ baseUrl });
        let response;

        if (state.authMode === "register") {
            response = await tempClient.registerRequest({ username: usernameRaw.replace(/^@/, "").split(":")[0], password, initial_device_display_name: APP_NAME });
        } else {
            const user = usernameRaw.startsWith("@") ? usernameRaw : usernameRaw.replace(/^@/, "").split(":")[0];
            response = await tempClient.loginRequest({ type: "m.login.password", identifier: { type: "m.id.user", user }, password, initial_device_display_name: APP_NAME });
        }

        const session = { baseUrl, userId: response.user_id, accessToken: response.access_token, deviceId: response.device_id, enableCrypto: refs.authEnableCrypto.checked };
        saveJson(STORAGE_KEYS.session, session);
        await startSession(session);
        if (state.authMode === "register" && refs.authDisplayName.value) await state.client?.setDisplayName?.(refs.authDisplayName.value);
    } catch (error) {
        refs.authError.textContent = parseError(error);
        refs.authError.classList.remove("hidden");
    } finally {
        refs.authSubmit.disabled = false;
        refs.authSubmit.textContent = state.authMode === "register" ? "Создать аккаунт" : "Войти";
    }
}

async function startSession(session, opts = {}) {
    if(state.client) state.client.stopClient();
    state.session = session;
    const client = sdk.createClient({ ...session, timelineSupport: true, cryptoCallbacks: { getSecretStorageKey, cacheSecretStorageKey } });
    state.client = client;

    if (session.enableCrypto !== false) await initCrypto(client);
    showApp();
    renderSettings();

    client.on(sdk.ClientEvent?.Sync ?? "sync", syncState => {
        if (["PREPARED", "SYNCING"].includes(syncState)) { renderRooms(); renderChat(); renderSettings(); }
    });
    client.on(sdk.ClientEvent?.Room ?? "Room", () => { renderRooms(); renderChat(); });
    client.on(sdk.ClientEvent?.Event ?? "event", () => { renderRooms(); renderChat(); renderSettings(); });
    client.startClient({ initialSyncLimit: 40 });
}

async function initCrypto(client) {
    try {
        await initCryptoWasm();
        await client.initRustCrypto({ useIndexedDB: true });
        state.cryptoReady = true;
        const crypto = client.getCrypto?.();
        if(crypto) await crypto.loadSessionBackupPrivateKeyFromSecretStorage().catch(()=>{});
    } catch (error) { console.error("Crypto error", error); }
}

function switchTab(tab) {
    state.ui.activeTab = tab; saveJson(STORAGE_KEYS.ui, state.ui);
    refs.navItems.forEach(i => i.classList.toggle("active", i.dataset.tab === tab));
    Object.entries(refs.tabs).forEach(([k, n]) => n.classList.toggle("active", k === tab));
}

function renderSettings() {
    const me = state.session?.userId || "—";
    refs.settingsProfileCard.innerHTML = `
        <div style="display:flex; gap:12px; align-items:center;">
            <div class="profile-avatar">${initialsFromName(me)}</div>
            <div>
                <div style="font-weight:700;">${escapeHtml(state.client?.getUser?.(me)?.displayName || me)}</div>
                <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(me)}</div>
            </div>
        </div>
    `;
    refs.mxidInfoValue.textContent = me;
    refs.cryptoStatusValue.textContent = state.cryptoReady ? "Активно" : "Отключено";
}

function renderRooms() {
    if(!state.client) return;
    const rooms = state.client.getRooms().filter(r => r.getMyMembership() === "join").sort((a,b) => getRoomSortTimestamp(b) - getRoomSortTimestamp(a));
    const query = refs.roomSearchInput.value.trim().toLowerCase();
    const filtered = rooms.filter(r => getRoomName(r).toLowerCase().includes(query));

    fillRoomSection(refs.chatRoomsSection, filtered, "");
}

function fillRoomSection(node, rooms, title) {
    node.innerHTML = title && rooms.length ? `<div class="section-title">${title}</div>` : "";
    rooms.forEach(r => {
        const item = document.createElement("div");
        item.className = `room-item ${r.roomId === state.activeRoomId ? "active" : ""}`;
        item.dataset.roomId = r.roomId;
        item.innerHTML = `
            <div class="room-avatar">${initialsFromName(getRoomName(r))}</div>
            <div class="room-main">
                <div class="room-top">
                    <div class="room-name">${escapeHtml(getRoomName(r))}</div>
                </div>
                <div class="room-preview">${escapeHtml(getPreviewText(getLastRenderableMessage(r), r))}</div>
            </div>
        `;
        node.appendChild(item);
    });
}

function openRoom(roomId) {
    state.activeRoomId = roomId;
    refs.emptyState.classList.add("hidden");
    refs.chatView.classList.remove("hidden");
    refs.body.classList.add("mobile-chat-active");
    renderRooms(); renderChat();
    refs.messageContainer.scrollTop = refs.messageContainer.scrollHeight;
}

function renderChat() {
    const room = state.activeRoomId ? state.client?.getRoom(state.activeRoomId) : null;
    refs.composerContext.classList.toggle("hidden", !state.replyToEventId && !state.editEventId);
    if(!room) return;

    refs.chatHeaderAvatar.textContent = initialsFromName(getRoomName(room));
    refs.chatHeaderTitle.textContent = getRoomName(room);
    refs.chatHeaderEncrypted.classList.toggle("hidden", !room.currentState?.getStateEvents?.("m.room.encryption", ""));

    const timeline = (room.timeline || []).filter(e => ["m.room.message", "m.room.encrypted"].includes(e.getType()));
    refs.messageContainer.innerHTML = "";

    let prevSender = null;
    timeline.forEach(event => {
        const sender = event.getSender();
        const isMine = sender === state.session.userId;
        const isContinuation = prevSender === sender;
        const row = document.createElement("div");
        row.className = `msg-row ${isMine ? "mine" : ""} ${isContinuation ? "continuation" : ""}`;
        row.dataset.eventId = event.getId();

        row.innerHTML = `
            <div class="member-avatar ${isContinuation ? "spacer" : ""}">${isMine ? "" : initialsFromName(sender)}</div>
            <div class="msg-bubble">
                ${!isMine && !isContinuation ? `<div class="msg-author">${escapeHtml(sender)}</div>` : ""}
                <div>${escapeHtml(getEventBody(event))}</div>
            </div>
        `;
        if(isMine) row.querySelector('.member-avatar').remove();
        refs.messageContainer.appendChild(row);
        prevSender = sender;
    });
}

async function sendCurrentMessage() {
    if(!state.activeRoomId) return;
    const text = refs.chatInput.value.trim();
    if(!text) return;
    await state.client.sendEvent(state.activeRoomId, "m.room.message", { msgtype: "m.text", body: text }, "");
    refs.chatInput.value = ""; refs.chatInput.style.height = "auto";
    renderChat(); refs.messageContainer.scrollTop = refs.messageContainer.scrollHeight;
}

/* Modals & Helpers */
function openModal(title, subtitle, html) {
    refs.modalTitle.textContent = title;
    refs.modalSubtitle.textContent = subtitle;
    refs.modalBody.innerHTML = html;
    refs.modalOverlay.classList.add("active");
}
function closeModal() { refs.modalOverlay.classList.remove("active"); }
function handleRoomListClick(e) { const item = e.target.closest(".room-item"); if(item) openRoom(item.dataset.roomId); }
function handleRoomContextMenu(e) { e.preventDefault(); const item = e.target.closest(".room-item"); if(item) { state.activeRoomContextId = item.dataset.roomId; openMenu(refs.roomMenu, e.currentTarget.getBoundingClientRect()); } }
function handleMessageAreaContext(e) { e.preventDefault(); const row = e.target.closest(".msg-row"); if(row) { state.activeMessageEvent = row.dataset.eventId; openMenu(refs.messageMenu, { left: e.clientX, top: e.clientY }); } }
function openMenu(menu, rect) { closeMenus(); refs.globalOverlay.classList.add("active"); menu.classList.add("active"); menu.style.left = `${rect.left || rect.x}px`; menu.style.top = `${rect.top || rect.y}px`; }
function closeMenus() { refs.globalOverlay.classList.remove("active"); [refs.composeMenu, refs.roomMenu, refs.messageMenu].forEach(m => m.classList.remove("active")); }

function openRoomInfo(roomId) {
    const room = state.client?.getRoom(roomId); if(!room) return;
    openModal("Room Info", room.roomId, `
        <div class="modal-hero">
            <div class="room-avatar-xl">${initialsFromName(getRoomName(room))}</div>
            <div class="modal-hero-copy">
                <div class="modal-hero-title">${escapeHtml(getRoomName(room))}</div>
            </div>
        </div>
        <div class="detail-grid">
            <div class="detail-card"><div class="info-label">Members</div><div class="info-value">${room.getJoinedMembers().length}</div></div>
            <div class="detail-card"><div class="info-label">Encryption</div><div class="info-value">${room.currentState?.getStateEvents?.("m.room.encryption", "") ? "Enabled" : "Disabled"}</div></div>
        </div>
    `);
}

function openRestoreKeysModal() {
    openModal("Key Backup", "Restore encryption keys", `
        <form class="fieldset" data-modal-form="restore-keys-from-recovery">
            <div class="field">
                <span>Recovery Key</span>
                <textarea name="recoveryKey" placeholder="EsTc ..."></textarea>
            </div>
            <button class="primary-btn" type="submit">Restore</button>
        </form>
    `);
}

async function handleModalSubmit(e) {
    e.preventDefault(); const form = e.target;
    if(form.dataset.modalForm === "restore-keys-from-recovery") {
        const decoded = decodeRecoveryKey(form.recoveryKey.value.trim());
        state.secretStorageKey = { keyId: null, privateKey: decoded };
        persistSecretStorageKey(state.secretStorageKey);
        closeModal(); showStatus("Keys updated.");
    }
}
function handleModalActions(e) { if(e.target.closest("[data-inline-action='close-modal']")) closeModal(); }
function handleComposeMenu(e) {} function handleRoomMenu(e) {} function handleMessageMenu(e) {} function handleAttachmentSelection(e) {} function handleTimelineScroll() {} function handlePublicListClick(e) {} function loadPublicRooms() {}

function getRoomName(r) { return r?.name || r?.roomId || "Room"; }
function getPreviewText(e, r) { return e ? getEventBody(e) : "No messages"; }
function getEventBody(e) { const content = e?.getContent() || {}; return e.getType() === "m.room.encrypted" ? "Encrypted" : (content.body || ""); }
function getLastRenderableMessage(r) { return [...(r?.timeline||[])].reverse().find(e => ["m.room.message", "m.room.encrypted"].includes(e.getType())); }
function getRoomSortTimestamp(r) { return getLastRenderableMessage(r)?.getTs() || 0; }
function initialsFromName(n) { return (n||"?").replace(/^[@#!]/,"").trim()[0]?.toUpperCase() || "?"; }
function escapeHtml(v) { return String(v||"").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function parseError(e) { return e?.message || String(e); }
function showStatus(t, m="info") { refs.statusBanner.textContent = t; refs.statusBanner.classList.remove("hidden"); setTimeout(()=>refs.statusBanner.classList.add("hidden"), 3000); }
function loadJson(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch { return f; } }
function saveJson(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function getSecretStorageKey() { return state.secretStorageKey?.privateKey ? [state.secretStorageKey.keyId, state.secretStorageKey.privateKey] : null; }
function cacheSecretStorageKey(keyId, _, key) { state.secretStorageKey = { keyId, privateKey: key }; persistSecretStorageKey(state.secretStorageKey); }
function persistSecretStorageKey(payload) { sessionStorage.setItem(SESSION_SECRET_STORAGE_KEY, JSON.stringify({ keyId: payload.keyId, privateKey: btoa(String.fromCharCode(...payload.privateKey)) })); }
function loadSecretStorageKey() { try { const p = JSON.parse(sessionStorage.getItem(SESSION_SECRET_STORAGE_KEY)); return p ? { keyId: p.keyId, privateKey: Uint8Array.from(atob(p.privateKey), c => c.charCodeAt(0)) } : null; } catch { return null; } }
async function logout() { localStorage.removeItem(STORAGE_KEYS.session); location.reload(); }