import * as sdk from "matrix-js-sdk";
import { initAsync as initCryptoWasm } from "@matrix-org/matrix-sdk-crypto-wasm";
import { decodeRecoveryKey } from "matrix-js-sdk/lib/crypto-api";

const APP_NAME = "Ficus Matrix App";
const STORAGE_KEYS = {
    session: "ficus_matrix_app_session_v4",
    settings: "ficus_matrix_app_settings_v4",
    ui: "ficus_matrix_app_ui_v4",
    drafts: "ficus_matrix_app_drafts_v1",
    homeservers: "ficus_matrix_app_homeservers_v1",
};
const SESSION_SECRET_STORAGE_KEY = "ficus_matrix_app_secret_storage_key";

const DEFAULT_SETTINGS = {
    enableCrypto: true,
    sendReadReceipts: true,
    sendTyping: true,
    compactMode: false,
    showMutedRooms: true,
    showAvatars: true,
    use24HourTime: true,
    confirmLeaveRoom: false,
    preserveDrafts: true,
};

const DEFAULT_UI = {
    pinnedRooms: [],
    mutedRooms: [],
    blockedUsers: [],
    activeTab: "chats",
    lastRoomId: null,
    chatFolder: "all",
};

const state = {
    client: null,
    session: null,
    settings: loadJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
    ui: loadJson(STORAGE_KEYS.ui, DEFAULT_UI),
    drafts: loadJson(STORAGE_KEYS.drafts, {}),
    recentHomeservers: loadJson(STORAGE_KEYS.homeservers, []),
    authMode: "login",
    syncState: "STOPPED",
    cryptoReady: false,
    cryptoStatus: {
        enabled: false,
        secretStorageReady: false,
        keyBackupReady: false,
        keyBackupVersion: null,
        keyBackupTrusted: false,
        lastError: "",
    },
    authServerMeta: null,
    authUsernameStatus: null,
    activeRoomId: null,
    activeMessageEvent: null,
    activeRoomContextId: null,
    messageSearchResults: [],
    currentPublicRooms: [],
    replyToEventId: null,
    editEventId: null,
    typingTimeout: null,
    secretStorageKey: loadSecretStorageKey(),
    mediaCache: new Map(),
};

const refs = {
    body: document.body,
    statusBanner: document.getElementById("statusBanner"),

    authScreen: document.getElementById("authScreen"),
    authForm: document.getElementById("authForm"),
    authTabs: Array.from(document.querySelectorAll(".auth-tab")),
    authHomeserver: document.getElementById("authHomeserver"),
    authUsername: document.getElementById("authUsername"),
    authPassword: document.getElementById("authPassword"),
    authPasswordConfirm: document.getElementById("authPasswordConfirm"),
    authPasswordConfirmField: document.getElementById("authPasswordConfirmField"),
    authDisplayName: document.getElementById("authDisplayName"),
    authDisplayNameField: document.getElementById("authDisplayNameField"),
    authDeviceName: document.getElementById("authDeviceName"),
    authEnableCrypto: document.getElementById("authEnableCrypto"),
    authError: document.getElementById("authError"),
    authSubmit: document.getElementById("authSubmit"),
    checkServerBtn: document.getElementById("checkServerBtn"),
    checkUsernameBtn: document.getElementById("checkUsernameBtn"),
    authServerMeta: document.getElementById("authServerMeta"),
    authServerHistory: document.getElementById("authServerHistory"),
    authUsernameHint: document.getElementById("authUsernameHint"),

    appShell: document.getElementById("appShell"),
    navItems: Array.from(document.querySelectorAll(".nav-item")),
    tabs: {
        chats: document.getElementById("tab-chats"),
        publics: document.getElementById("tab-publics"),
        privates: document.getElementById("tab-privates"),
        settings: document.getElementById("tab-settings"),
    },

    roomSearchInput: document.getElementById("roomSearchInput"),
    composeMenuBtn: document.getElementById("composeMenuBtn"),
    publicSearchInput: document.getElementById("publicSearchInput"),
    publicSearchBtn: document.getElementById("publicSearchBtn"),
    chatFolderChips: document.getElementById("chatFolderChips"),

    chatPinnedSection: document.getElementById("chatPinnedSection"),
    chatDmSection: document.getElementById("chatDmSection"),
    chatRoomsSection: document.getElementById("chatRoomsSection"),
    chatEmptyState: document.getElementById("chatEmptyState"),
    joinedPublicSection: document.getElementById("joinedPublicSection"),
    publicDirectorySection: document.getElementById("publicDirectorySection"),
    publicEmptyState: document.getElementById("publicEmptyState"),
    privateRoomsSection: document.getElementById("privateRoomsSection"),
    privateEmptyState: document.getElementById("privateEmptyState"),

    settingsProfileCard: document.getElementById("settingsProfileCard"),
    cryptoStatusValue: document.getElementById("cryptoStatusValue"),
    backupStatusValue: document.getElementById("backupStatusValue"),
    homeserverInfoValue: document.getElementById("homeserverInfoValue"),
    mxidInfoValue: document.getElementById("mxidInfoValue"),
    deviceInfoValue: document.getElementById("deviceInfoValue"),
    editProfileBtn: document.getElementById("editProfileBtn"),
    openOwnProfileBtn: document.getElementById("openOwnProfileBtn"),
    restoreKeysBtn: document.getElementById("restoreKeysBtn"),
    checkBackupBtn: document.getElementById("checkBackupBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    reconnectBtn: document.getElementById("reconnectBtn"),
    copySessionBtn: document.getElementById("copySessionBtn"),
    clearDraftsBtn: document.getElementById("clearDraftsBtn"),
    resetUiBtn: document.getElementById("resetUiBtn"),
    settingReadReceipts: document.getElementById("settingReadReceipts"),
    settingTyping: document.getElementById("settingTyping"),
    settingCompactMode: document.getElementById("settingCompactMode"),
    settingShowMutedRooms: document.getElementById("settingShowMutedRooms"),
    settingShowAvatars: document.getElementById("settingShowAvatars"),
    settingUse24HourTime: document.getElementById("settingUse24HourTime"),
    settingConfirmLeaveRoom: document.getElementById("settingConfirmLeaveRoom"),

    emptyState: document.getElementById("emptyState"),
    chatView: document.getElementById("chatView"),
    chatHeaderInfo: document.getElementById("chatHeaderInfo"),
    chatHeaderAvatar: document.getElementById("chatHeaderAvatar"),
    chatHeaderTitle: document.getElementById("chatHeaderTitle"),
    chatHeaderStatus: document.getElementById("chatHeaderStatus"),
    chatHeaderEncrypted: document.getElementById("chatHeaderEncrypted"),
    backBtn: document.getElementById("backBtn"),
    toggleRoomSearchBtn: document.getElementById("toggleRoomSearchBtn"),
    openRoomInfoBtn: document.getElementById("openRoomInfoBtn"),
    roomSearchPanel: document.getElementById("roomSearchPanel"),
    messageSearchInput: document.getElementById("messageSearchInput"),
    messageSearchBtn: document.getElementById("messageSearchBtn"),
    messageSearchResults: document.getElementById("messageSearchResults"),
    composerContext: document.getElementById("composerContext"),
    messageContainer: document.getElementById("messageContainer"),
    typingBar: document.getElementById("typingBar"),
    attachmentInput: document.getElementById("attachmentInput"),
    attachBtn: document.getElementById("attachBtn"),
    chatInput: document.getElementById("chatInput"),
    sendBtn: document.getElementById("sendBtn"),

    globalOverlay: document.getElementById("globalOverlay"),
    composeMenu: document.getElementById("composeMenu"),
    roomMenu: document.getElementById("roomMenu"),
    messageMenu: document.getElementById("messageMenu"),
    retryMessageMenuItem: document.getElementById("retryMessageMenuItem"),

    modalOverlay: document.getElementById("modalOverlay"),
    modalCard: document.getElementById("modalCard"),
    modalTitle: document.getElementById("modalTitle"),
    modalSubtitle: document.getElementById("modalSubtitle"),
    modalBody: document.getElementById("modalBody"),
    closeModalBtn: document.getElementById("closeModalBtn"),
};

const CLIENT_EVENT_SYNC = sdk.ClientEvent?.Sync ?? "sync";
const CLIENT_EVENT_EVENT = sdk.ClientEvent?.Event ?? "event";
const CLIENT_EVENT_ROOM = sdk.ClientEvent?.Room ?? "Room";
const CLIENT_EVENT_ACCOUNT_DATA = sdk.ClientEvent?.AccountData ?? "accountData";
const ROOM_EVENT_TIMELINE = sdk.RoomEvent?.Timeline ?? "Room.timeline";
const ROOM_EVENT_RECEIPT = sdk.RoomEvent?.Receipt ?? "Room.receipt";
const ROOM_MEMBER_EVENT_TYPING = sdk.RoomMemberEvent?.Typing ?? "RoomMember.typing";

init();

async function init() {
    bindStaticEvents();
    applyLocalSettings();
    syncSettingsUI();
    renderRecentHomeservers();
    renderChatFolderChips();
    updateAuthMode(state.authMode);
    switchTab(state.ui.activeTab || "chats");

    const session = loadJson(STORAGE_KEYS.session, null);
    if (session?.accessToken && session?.userId && session?.baseUrl) {
        refs.authHomeserver.value = session.baseUrl;
        try {
            await startSession(session, { restoring: true });
            return;
        } catch (error) {
            console.error(error);
            clearSession();
            showStatus(`Сохранённая сессия не восстановилась: ${parseError(error)}`, "error");
        }
    }

    showAuth();
}

function bindStaticEvents() {
    refs.authTabs.forEach((button) => {
        button.addEventListener("click", () => updateAuthMode(button.dataset.authMode || "login"));
    });

    refs.authForm.addEventListener("submit", handleAuthSubmit);
    refs.checkServerBtn.addEventListener("click", () => verifyHomeserver(refs.authHomeserver.value.trim(), { showToast: true }));
    refs.checkUsernameBtn.addEventListener("click", () => checkUsernameAvailability(true));
    refs.authHomeserver.addEventListener("change", () => {
        refs.authUsernameHint.classList.add("hidden");
        verifyHomeserver(refs.authHomeserver.value.trim()).catch(() => {});
    });
    refs.authUsername.addEventListener("blur", () => {
        if (state.authMode === "register") checkUsernameAvailability(false).catch(() => {});
    });

    refs.navItems.forEach((item) => {
        item.addEventListener("click", () => switchTab(item.dataset.tab || "chats"));
    });

    refs.chatFolderChips.addEventListener("click", (event) => {
        const chip = event.target.closest("[data-folder]");
        if (!chip) return;
        state.ui.chatFolder = chip.dataset.folder || "all";
        saveJson(STORAGE_KEYS.ui, state.ui);
        renderChatFolderChips();
        renderRooms();
    });

    refs.roomSearchInput.addEventListener("input", renderRooms);
    refs.publicSearchBtn.addEventListener("click", () => loadPublicRooms(refs.publicSearchInput.value.trim()));
    refs.publicSearchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            loadPublicRooms(refs.publicSearchInput.value.trim());
        }
    });

    refs.composeMenuBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        openMenu(refs.composeMenu, event.currentTarget.getBoundingClientRect());
    });

    refs.globalOverlay.addEventListener("click", closeMenus);
    refs.closeModalBtn.addEventListener("click", closeModal);
    refs.modalOverlay.addEventListener("click", (event) => {
        if (event.target === refs.modalOverlay) closeModal();
    });

    refs.composeMenu.addEventListener("click", handleComposeMenu);
    refs.roomMenu.addEventListener("click", handleRoomMenu);
    refs.messageMenu.addEventListener("click", handleMessageMenu);

    refs.backBtn.addEventListener("click", () => {
        refs.body.classList.remove("mobile-chat-active");
    });

    refs.toggleRoomSearchBtn.addEventListener("click", () => {
        refs.roomSearchPanel.classList.toggle("hidden");
        if (!refs.roomSearchPanel.classList.contains("hidden")) refs.messageSearchInput.focus();
    });

    refs.openRoomInfoBtn.addEventListener("click", () => openRoomInfo(state.activeRoomId));
    refs.chatHeaderInfo.addEventListener("click", () => openRoomInfo(state.activeRoomId));

    refs.messageSearchBtn.addEventListener("click", runMessageSearch);
    refs.messageSearchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            runMessageSearch();
        }
    });

    refs.sendBtn.addEventListener("click", sendCurrentMessage);
    refs.attachBtn.addEventListener("click", () => refs.attachmentInput.click());
    refs.attachmentInput.addEventListener("change", handleAttachmentSelection);

    refs.chatInput.addEventListener("keydown", handleComposerKeydown);
    refs.chatInput.addEventListener("input", handleComposerInput);

    refs.messageContainer.addEventListener("scroll", handleTimelineScroll);
    refs.messageContainer.addEventListener("click", handleMessageAreaClick);
    refs.messageContainer.addEventListener("contextmenu", handleMessageAreaContext);

    refs.chatPinnedSection.addEventListener("click", handleRoomListClick);
    refs.chatDmSection.addEventListener("click", handleRoomListClick);
    refs.chatRoomsSection.addEventListener("click", handleRoomListClick);
    refs.privateRoomsSection.addEventListener("click", handleRoomListClick);
    refs.joinedPublicSection.addEventListener("click", handleRoomListClick);
    refs.publicDirectorySection.addEventListener("click", handlePublicListClick);

    [refs.chatPinnedSection, refs.chatDmSection, refs.chatRoomsSection, refs.privateRoomsSection, refs.joinedPublicSection].forEach((container) => {
        container.addEventListener("contextmenu", handleRoomContextMenu);
    });

    refs.editProfileBtn.addEventListener("click", openEditProfileModal);
    refs.openOwnProfileBtn.addEventListener("click", () => openUserProfile(state.session?.userId));
    refs.restoreKeysBtn.addEventListener("click", openRestoreKeysModal);
    refs.checkBackupBtn.addEventListener("click", recheckCryptoAndBackup);
    refs.logoutBtn.addEventListener("click", logout);
    refs.reconnectBtn.addEventListener("click", reconnectNow);
    refs.copySessionBtn.addEventListener("click", copySessionInfo);
    refs.clearDraftsBtn.addEventListener("click", clearAllDrafts);
    refs.resetUiBtn.addEventListener("click", resetLocalUi);

    refs.settingReadReceipts.addEventListener("change", () => setSettings({ sendReadReceipts: refs.settingReadReceipts.checked }));
    refs.settingTyping.addEventListener("change", () => setSettings({ sendTyping: refs.settingTyping.checked }));
    refs.settingCompactMode.addEventListener("change", () => setSettings({ compactMode: refs.settingCompactMode.checked }));
    refs.settingShowMutedRooms.addEventListener("change", () => setSettings({ showMutedRooms: refs.settingShowMutedRooms.checked }));
    refs.settingShowAvatars.addEventListener("change", () => setSettings({ showAvatars: refs.settingShowAvatars.checked }));
    refs.settingUse24HourTime.addEventListener("change", () => setSettings({ use24HourTime: refs.settingUse24HourTime.checked }));
    refs.settingConfirmLeaveRoom.addEventListener("change", () => setSettings({ confirmLeaveRoom: refs.settingConfirmLeaveRoom.checked }));

    refs.modalBody.addEventListener("click", handleModalActions);
    refs.modalBody.addEventListener("change", handleModalChanges);
    refs.modalBody.addEventListener("submit", handleModalSubmit);

    window.addEventListener("online", () => showStatus("Сеть восстановлена."));
    window.addEventListener("offline", () => showStatus("Нет сети. Клиент останется в offline/reconnecting режиме.", "error", true));
}

function updateAuthMode(mode) {
    state.authMode = mode;
    refs.authTabs.forEach((button) => button.classList.toggle("active", button.dataset.authMode === mode));
    refs.authDisplayNameField.classList.toggle("hidden", mode !== "register");
    refs.authPasswordConfirmField.classList.toggle("hidden", mode !== "register");
    refs.checkUsernameBtn.classList.toggle("hidden", mode !== "register");
    refs.authSubmit.textContent = mode === "register" ? "Создать аккаунт" : "Войти";
    refs.authPassword.autocomplete = mode === "register" ? "new-password" : "current-password";
    refs.authPasswordConfirm.autocomplete = mode === "register" ? "new-password" : "off";
    refs.authError.classList.add("hidden");
    refs.authUsernameHint.classList.add("hidden");
}

function showAuth() {
    refs.authScreen.classList.remove("hidden");
    refs.appShell.classList.add("hidden");
}

function showApp() {
    refs.authScreen.classList.add("hidden");
    refs.appShell.classList.remove("hidden");
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    refs.authError.classList.add("hidden");
    refs.authSubmit.disabled = true;

    const baseUrl = normalizeHomeserver(refs.authHomeserver.value.trim());
    const usernameRaw = refs.authUsername.value.trim();
    const password = refs.authPassword.value;
    const passwordConfirm = refs.authPasswordConfirm.value;
    const displayName = refs.authDisplayName.value.trim();
    const deviceName = refs.authDeviceName.value.trim() || APP_NAME;
    const enableCrypto = refs.authEnableCrypto.checked;

    try {
        if (!baseUrl) throw new Error("Укажи валидный homeserver URL.");
        if (!usernameRaw) throw new Error("Укажи логин или Matrix ID.");
        if (!password) throw new Error("Укажи пароль.");
        if (state.authMode === "register") {
            if (password.length < 8) throw new Error("Для регистрации задай пароль не короче 8 символов.");
            if (password !== passwordConfirm) throw new Error("Пароли не совпадают.");
        }

        await verifyHomeserver(baseUrl);
        const tempClient = sdk.createClient({ baseUrl });
        let response;

        if (state.authMode === "register") {
            const localpart = usernameToLocalpart(usernameRaw);
            const availability = await checkUsernameAvailability(false, tempClient, localpart);
            if (availability === false) throw new Error("Этот логин уже занят на данном homeserver.");
            response = await performRegistration(tempClient, { localpart, password, deviceName });
        } else {
            response = await performLogin(tempClient, { usernameRaw, password, deviceName });
        }

        const session = {
            baseUrl,
            userId: response.user_id,
            accessToken: response.access_token,
            deviceId: response.device_id,
            refreshToken: response.refresh_token || null,
            enableCrypto,
        };

        rememberHomeserver(baseUrl);
        saveJson(STORAGE_KEYS.session, session);
        await startSession(session);

        if (displayName && state.authMode === "register") {
            await state.client?.setDisplayName?.(displayName);
        }

        showStatus(state.authMode === "register" ? "Аккаунт создан и сессия активна." : "Вход выполнен.");
    } catch (error) {
        const message = parseError(error);
        refs.authError.textContent = message;
        refs.authError.classList.remove("hidden");
    } finally {
        refs.authSubmit.disabled = false;
    }
}


async function performLogin(tempClient, { usernameRaw, password, deviceName }) {
    const identifierUser = usernameRaw.startsWith("@") ? usernameRaw : usernameToLocalpart(usernameRaw);
    try {
        return await tempClient.loginRequest({
            type: "m.login.password",
            identifier: { type: "m.id.user", user: identifierUser },
            user: identifierUser,
            password,
            initial_device_display_name: deviceName,
            refresh_token: true,
        });
    } catch (error) {
        if (/refresh/i.test(parseError(error))) {
            return tempClient.loginRequest({
                type: "m.login.password",
                identifier: { type: "m.id.user", user: identifierUser },
                user: identifierUser,
                password,
                initial_device_display_name: deviceName,
            });
        }
        throw error;
    }
}

async function performRegistration(tempClient, { localpart, password, deviceName }) {
    try {
        return await tempClient.registerRequest({
            username: localpart,
            password,
            initial_device_display_name: deviceName,
            inhibit_login: false,
            refresh_token: true,
            auth: { type: "m.login.dummy" },
        });
    } catch (error) {
        const flows = extractRegistrationFlows(error);
        if (flows.length) {
            const stages = [...new Set(flows.flatMap((flow) => flow.stages || []))];
            const unsupported = stages.filter((stage) => stage !== "m.login.dummy");
            if (unsupported.length) {
                throw new Error(`Этот homeserver требует дополнительный registration flow: ${unsupported.join(", ")}. В чистом browser-клиенте это нельзя завершить автоматически.`);
            }
        }
        if (/refresh/i.test(parseError(error))) {
            return tempClient.registerRequest({
                username: localpart,
                password,
                initial_device_display_name: deviceName,
                inhibit_login: false,
                auth: { type: "m.login.dummy" },
            });
        }
        if (error?.errcode === "M_USER_IN_USE") throw new Error("Этот логин уже занят.");
        throw error;
    }
}

function extractRegistrationFlows(error) {
    return error?.data?.flows || error?.flows || error?.body?.flows || [];
}

async function verifyHomeserver(value, { showToast = false } = {}) {
    const baseUrl = normalizeHomeserver(value);
    if (!baseUrl) {
        refs.authServerMeta.classList.add("hidden");
        state.authServerMeta = null;
        return null;
    }

    const tempClient = sdk.createClient({ baseUrl });
    const meta = { baseUrl, ok: false, versions: [], loginFlows: [], registerProbe: "unknown", error: "" };

    try {
        const [versions, loginFlows] = await Promise.all([
            tempClient.getVersions?.().catch(() => null),
            tempClient.loginFlows?.().catch(() => null),
        ]);
        meta.ok = true;
        meta.versions = versions?.versions || [];
        meta.loginFlows = (loginFlows?.flows || []).map((flow) => flow.type);
        try {
            const probe = await fetch(`${baseUrl}/_matrix/client/v3/register/available?username=ficusprobe${Date.now()}`);
            meta.registerProbe = probe.ok || [400, 401, 403].includes(probe.status) ? "reachable" : `http ${probe.status}`;
        } catch {
            meta.registerProbe = "unavailable";
        }
        state.authServerMeta = meta;
        renderAuthServerMeta();
        if (showToast) showStatus(`Homeserver доступен: ${baseUrl}`);
        return meta;
    } catch (error) {
        meta.error = parseError(error);
        state.authServerMeta = meta;
        renderAuthServerMeta();
        if (showToast) showStatus(`Homeserver недоступен: ${meta.error}`, "error", true);
        throw error;
    }
}

function renderAuthServerMeta() {
    const meta = state.authServerMeta;
    if (!meta) {
        refs.authServerMeta.classList.add("hidden");
        refs.authServerMeta.innerHTML = "";
        return;
    }
    refs.authServerMeta.classList.remove("hidden");
    if (!meta.ok) {
        refs.authServerMeta.innerHTML = `<div><strong>Сервер не ответил.</strong> ${escapeHtml(meta.error || "Проверь URL и CORS на homeserver.")}</div>`;
        return;
    }
    refs.authServerMeta.innerHTML = `
        <div><strong>Homeserver:</strong> ${escapeHtml(meta.baseUrl)}</div>
        <div><strong>Login flows:</strong> ${escapeHtml(meta.loginFlows.length ? meta.loginFlows.join(", ") : "не удалось определить")}</div>
        <div><strong>Registration probe:</strong> ${escapeHtml(meta.registerProbe)}</div>
        <div><strong>Versions:</strong> ${escapeHtml(meta.versions.slice(-3).join(", ") || "—")}</div>
    `;
}

async function checkUsernameAvailability(showToast = false, clientOverride = null, localpartOverride = null) {
    if (state.authMode !== "register" && !clientOverride) return null;
    const baseUrl = normalizeHomeserver(refs.authHomeserver.value.trim());
    const localpart = localpartOverride || usernameToLocalpart(refs.authUsername.value.trim());
    if (!baseUrl || !localpart) {
        refs.authUsernameHint.classList.add("hidden");
        return null;
    }

    const tempClient = clientOverride || sdk.createClient({ baseUrl });
    try {
        const available = await tempClient.isUsernameAvailable(localpart);
        state.authUsernameStatus = available;
        refs.authUsernameHint.className = `auth-inline-help ${available ? "ok" : "error"}`;
        refs.authUsernameHint.textContent = available ? `Логин ${localpart} свободен на этом homeserver.` : `Логин ${localpart} уже занят.`;
        refs.authUsernameHint.classList.remove("hidden");
        if (showToast) showStatus(refs.authUsernameHint.textContent, available ? "info" : "error", !available);
        return available;
    } catch (error) {
        refs.authUsernameHint.className = "auth-inline-help";
        refs.authUsernameHint.textContent = `Проверка логина недоступна: ${parseError(error)}`;
        refs.authUsernameHint.classList.remove("hidden");
        if (showToast) showStatus(refs.authUsernameHint.textContent, "error", true);
        return null;
    }
}

function rememberHomeserver(baseUrl) {
    if (!baseUrl) return;
    state.recentHomeservers = [baseUrl, ...state.recentHomeservers.filter((item) => item !== baseUrl)].slice(0, 6);
    saveJson(STORAGE_KEYS.homeservers, state.recentHomeservers);
    renderRecentHomeservers();
}

function renderRecentHomeservers() {
    refs.authServerHistory.innerHTML = "";
    if (!state.recentHomeservers.length) {
        refs.authServerHistory.classList.add("hidden");
        return;
    }
    refs.authServerHistory.classList.remove("hidden");
    state.recentHomeservers.forEach((server) => {
        const button = document.createElement("button");
        button.className = `server-chip${refs.authHomeserver.value.trim() === server ? " active" : ""}`;
        button.type = "button";
        button.textContent = server.replace(/^https?:\/\//, "");
        button.addEventListener("click", () => {
            refs.authHomeserver.value = server;
            renderRecentHomeservers();
            verifyHomeserver(server, { showToast: true }).catch(() => {});
        });
        refs.authServerHistory.appendChild(button);
    });
}

function renderChatFolderChips() {
    refs.chatFolderChips.querySelectorAll("[data-folder]").forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.folder === (state.ui.chatFolder || "all"));
    });
}

async function startSession(session, options = {}) {
    teardownClient();
    refs.body.classList.remove("mobile-chat-active");
    refs.emptyState.classList.remove("hidden");
    refs.chatView.classList.add("hidden");
    refs.messageContainer.innerHTML = "";

    state.session = session;
    rememberHomeserver(session.baseUrl);
    state.activeRoomId = state.ui.lastRoomId || null;
    state.replyToEventId = null;
    state.editEventId = null;
    state.currentPublicRooms = [];
    state.messageSearchResults = [];
    clearStatus();

    showStatus(options.restoring ? "Восстанавливаю сессию…" : "Подключаюсь к Matrix…", "info", true);

    const client = sdk.createClient({
        baseUrl: session.baseUrl,
        accessToken: session.accessToken,
        userId: session.userId,
        deviceId: session.deviceId,
        refreshToken: session.refreshToken || undefined,
        timelineSupport: true,
        cryptoCallbacks: {
            getSecretStorageKey: getSecretStorageKey,
            cacheSecretStorageKey: cacheSecretStorageKey,
        },
    });

    state.client = client;
    attachClientListeners(client);

    if (session.enableCrypto !== false) {
        await initCrypto(client);
    } else {
        state.cryptoReady = false;
        state.cryptoStatus = {
            enabled: false,
            secretStorageReady: false,
            keyBackupReady: false,
            keyBackupVersion: null,
            keyBackupTrusted: false,
            lastError: "Crypto вручную выключен для этой сессии.",
        };
    }

    showApp();
    renderSettings();
    renderRooms();
    renderChat();

    client.startClient({
        initialSyncLimit: 40,
        lazyLoadMembers: true,
        includeArchivedRooms: false,
    });
}

async function initCrypto(client) {
    try {
        await initCryptoWasm();
        await client.initRustCrypto({ useIndexedDB: true });
        state.cryptoReady = true;
        await recheckCryptoAndBackup({ silent: true });

        const crypto = client.getCrypto?.();
        if (crypto) {
            try {
                await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
                state.cryptoStatus.lastError = "";
                showStatus("Ключ backup загружен из secret storage.");
            } catch (error) {
                state.cryptoStatus.lastError = parseError(error);
            }
        }
    } catch (error) {
        state.cryptoReady = false;
        state.cryptoStatus = {
            enabled: false,
            secretStorageReady: false,
            keyBackupReady: false,
            keyBackupVersion: null,
            keyBackupTrusted: false,
            lastError: parseError(error),
        };
        showStatus(`E2EE не инициализировался: ${parseError(error)}`, "error", true);
    }
}

function attachClientListeners(client) {
    client.on(CLIENT_EVENT_SYNC, handleSyncState);
    client.on(CLIENT_EVENT_ROOM, () => {
        renderRooms();
        renderChat();
    });
    client.on(CLIENT_EVENT_EVENT, () => {
        renderRooms();
        renderChat();
        renderSettings();
    });
    client.on(CLIENT_EVENT_ACCOUNT_DATA, () => {
        renderRooms();
        renderSettings();
    });
    client.on(ROOM_EVENT_TIMELINE, (event, room, toStartOfTimeline) => {
        if (!room || toStartOfTimeline) return;
        renderRooms();
        if (room.roomId === state.activeRoomId) {
            renderChat();
            maybeAutoScroll();
            sendReadReceiptForActiveRoom().catch(console.error);
        }
    });
    client.on(ROOM_EVENT_RECEIPT, () => {
        renderChat();
    });
    client.on(ROOM_MEMBER_EVENT_TYPING, (_event, member) => {
        if (member?.roomId === state.activeRoomId) renderTypingBar();
    });
}

function teardownClient() {
    if (!state.client) return;
    try {
        state.client.removeAllListeners();
        state.client.stopClient();
    } catch {
        // noop
    }
    state.client = null;
}

function handleSyncState(syncState, previousState, data) {
    state.syncState = syncState;

    if (["PREPARED", "SYNCING", "CATCHUP"].includes(syncState)) {
        clearStatus();
        renderRooms();
        if (!state.activeRoomId) autoOpenPreferredRoom();
        renderChat();
        renderSettings();
        return;
    }

    if (syncState === "RECONNECTING") {
        showStatus("Потеряно соединение. Пытаюсь переподключиться…", "error", true);
        return;
    }

    if (syncState === "ERROR") {
        const message = data?.error ? parseError(data.error) : "Ошибка синхронизации.";
        showStatus(message, "error", true);
        return;
    }

    if (syncState === "STOPPED") {
        showStatus("Синхронизация остановлена.", "error", true);
    }
}

async function recheckCryptoAndBackup({ silent = false } = {}) {
    const crypto = state.client?.getCrypto?.();
    if (!crypto) {
        state.cryptoStatus = {
            enabled: false,
            secretStorageReady: false,
            keyBackupReady: false,
            keyBackupVersion: null,
            keyBackupTrusted: false,
            lastError: "Crypto API недоступен.",
        };
        renderSettings();
        return;
    }

    try {
        const check = await crypto.checkKeyBackupAndEnable();
        const info = await crypto.getKeyBackupInfo();
        const trust = info ? await crypto.isKeyBackupTrusted(info) : null;
        const secretStorageReady = await crypto.isSecretStorageReady?.().catch(() => false);

        state.cryptoStatus = {
            enabled: true,
            secretStorageReady: Boolean(secretStorageReady),
            keyBackupReady: Boolean(check || info),
            keyBackupVersion: info?.version || null,
            keyBackupTrusted: Boolean(
                trust?.usable || trust?.trusted || trust?.matchesBackup || trust?.backupTrusted,
            ),
            lastError: "",
        };

        if (!silent) showStatus(info ? "Key backup перепроверен." : "На сервере нет key backup.");
    } catch (error) {
        state.cryptoStatus = {
            enabled: true,
            secretStorageReady: false,
            keyBackupReady: false,
            keyBackupVersion: null,
            keyBackupTrusted: false,
            lastError: parseError(error),
        };
        if (!silent) showStatus(`Не удалось перепроверить key backup: ${parseError(error)}`, "error", true);
    }

    renderSettings();
}

function switchTab(tab) {
    state.ui.activeTab = tab;
    saveJson(STORAGE_KEYS.ui, state.ui);
    refs.navItems.forEach((item) => item.classList.toggle("active", item.dataset.tab === tab));
    Object.entries(refs.tabs).forEach(([key, node]) => node.classList.toggle("active", key === tab));
}

function setSettings(next) {
    state.settings = { ...state.settings, ...next };
    saveJson(STORAGE_KEYS.settings, state.settings);
    applyLocalSettings();
    syncSettingsUI();
    renderRooms();
    renderSettings();
}

function applyLocalSettings() {
    refs.body.classList.toggle("compact-mode", Boolean(state.settings.compactMode));
    refs.body.classList.toggle("hide-list-avatars", !Boolean(state.settings.showAvatars));
}

function syncSettingsUI() {
    refs.settingReadReceipts.checked = Boolean(state.settings.sendReadReceipts);
    refs.settingTyping.checked = Boolean(state.settings.sendTyping);
    refs.settingCompactMode.checked = Boolean(state.settings.compactMode);
    refs.settingShowMutedRooms.checked = Boolean(state.settings.showMutedRooms);
    refs.settingShowAvatars.checked = Boolean(state.settings.showAvatars);
    refs.settingUse24HourTime.checked = Boolean(state.settings.use24HourTime);
    refs.settingConfirmLeaveRoom.checked = Boolean(state.settings.confirmLeaveRoom);
    refs.authEnableCrypto.checked = Boolean(state.settings.enableCrypto);
}

function renderSettings() {
    const me = state.session?.userId || "—";
    const currentUser = state.client?.getUser?.(me);
    refs.settingsProfileCard.innerHTML = `
        <div class="profile-avatar">${escapeHtml(initialsFromName(currentUser?.displayName || me))}</div>
        <div class="profile-copy">
            <div class="profile-name">${escapeHtml(currentUser?.displayName || me)}</div>
            <div class="profile-id">${escapeHtml(me)}</div>
            <div class="profile-meta-row">
                <span class="state-pill">${escapeHtml(state.syncState || "STOPPED")}</span>
                ${state.cryptoStatus.enabled ? `<span class="state-pill">Crypto</span>` : ""}
                ${(state.ui.pinnedRooms || []).length ? `<span class="state-pill">Pinned ${state.ui.pinnedRooms.length}</span>` : ""}
            </div>
        </div>
    `;

    refs.homeserverInfoValue.textContent = state.session?.baseUrl || "—";
    refs.mxidInfoValue.textContent = state.session?.userId || "—";
    refs.deviceInfoValue.textContent = state.session?.deviceId || "—";

    if (!state.session) {
        refs.cryptoStatusValue.textContent = "—";
        refs.backupStatusValue.textContent = "—";
        return;
    }

    refs.cryptoStatusValue.textContent = state.cryptoStatus.enabled
        ? `Активно${state.cryptoReady ? " / rust" : ""}${state.cryptoStatus.secretStorageReady ? " / 4S" : ""}`
        : (state.cryptoStatus.lastError || "Выключено");

    const backupParts = [];
    backupParts.push(state.cryptoStatus.keyBackupReady ? "backup найден" : "backup не найден");
    if (state.cryptoStatus.keyBackupVersion) backupParts.push(`v${state.cryptoStatus.keyBackupVersion}`);
    backupParts.push(state.cryptoStatus.keyBackupTrusted ? "trusted" : "not trusted");
    refs.backupStatusValue.textContent = backupParts.join(" · ");
}

function renderRooms() {
    const rooms = getJoinedRoomsSorted();
    const query = refs.roomSearchInput.value.trim().toLowerCase();
    const filteredBase = rooms.filter((room) => matchesRoomQuery(room, query));
    const filtered = applyChatFolderFilter(filteredBase);

    const pinnedIds = new Set(state.ui.pinnedRooms || []);
    const pinned = filtered.filter((room) => pinnedIds.has(room.roomId));
    const unpinned = filtered.filter((room) => !pinnedIds.has(room.roomId));
    const dmRooms = unpinned.filter(isDirectRoom);
    const normalRooms = unpinned.filter((room) => !isDirectRoom(room));
    const privateRooms = filtered.filter((room) => isPrivateRoom(room));
    const joinedPublicRooms = filtered.filter((room) => isPublicRoom(room));

    fillRoomSection(refs.chatPinnedSection, pinned, "Закреплённые");
    fillRoomSection(refs.chatDmSection, dmRooms, "DM");
    fillRoomSection(refs.chatRoomsSection, normalRooms, pinned.length || dmRooms.length ? "Остальные комнаты" : "Комнаты");
    refs.chatEmptyState.classList.toggle("hidden", filtered.length > 0);

    fillRoomSection(refs.privateRoomsSection, privateRooms, privateRooms.length ? "Приватные" : "");
    refs.privateEmptyState.classList.toggle("hidden", privateRooms.length > 0);

    fillRoomSection(refs.joinedPublicSection, joinedPublicRooms, joinedPublicRooms.length ? "Уже в клиенте" : "");
    refs.publicEmptyState.classList.toggle("hidden", state.currentPublicRooms.length > 0 || joinedPublicRooms.length > 0);
    renderPublicDirectory();
}

function applyChatFolderFilter(rooms) {
    const folder = state.ui.chatFolder || "all";
    switch (folder) {
        case "unread": return rooms.filter((room) => getUnreadCount(room) > 0);
        case "dm": return rooms.filter(isDirectRoom);
        case "groups": return rooms.filter((room) => !isDirectRoom(room));
        case "encrypted": return rooms.filter(isEncryptedRoom);
        default: return rooms;
    }
}

function fillRoomSection(node, rooms, title = "") {
    node.innerHTML = "";
    if (!rooms.length) return;

    if (title) {
        const titleNode = document.createElement("div");
        titleNode.className = "section-title";
        titleNode.textContent = title;
        node.appendChild(titleNode);
    }

    rooms.forEach((room) => {
        node.appendChild(renderRoomItem(room));
    });
}

function renderRoomItem(room) {
    const item = document.createElement("button");
    const draft = state.settings.preserveDrafts ? (state.drafts[room.roomId] || "") : "";
    item.className = `room-item${room.roomId === state.activeRoomId ? " active" : ""}${draft ? " has-draft" : ""}`;
    item.dataset.roomId = room.roomId;
    item.type = "button";

    const lastEvent = getLastRenderableMessage(room);
    const unread = getUnreadCount(room);
    const badges = [];
    if (isEncryptedRoom(room)) badges.push(`<span class="state-pill">E2EE</span>`);
    if ((state.ui.mutedRooms || []).includes(room.roomId)) badges.push(`<span class="state-pill is-muted">Muted</span>`);
    if (draft) badges.push(`<span class="state-pill">Draft</span>`);
    if (unread > 0) badges.push(`<span class="unread-badge">${Math.min(unread, 99)}</span>`);

    const preview = draft || getPreviewText(lastEvent, room);
    item.innerHTML = `
        <div class="room-avatar${(state.ui.mutedRooms || []).includes(room.roomId) ? " is-muted" : ""}">${escapeHtml(initialsFromName(getRoomName(room)))}</div>
        <div class="room-main">
            <div class="room-top">
                <div class="room-name">${escapeHtml(getRoomName(room))}</div>
                <div class="room-time">${escapeHtml(formatTime(getRoomSortTimestamp(room) || Date.now()))}</div>
            </div>
            <div class="room-preview${preview.length > 64 ? " multiline" : ""}">${escapeHtml(preview)}</div>
            <div class="room-meta-row">${badges.join("")}</div>
        </div>
    `;

    return item;
}

function renderPublicDirectory() {
    refs.publicDirectorySection.innerHTML = "";
    if (!state.currentPublicRooms.length) return;

    const titleNode = document.createElement("div");
    titleNode.className = "section-title";
    titleNode.textContent = "Директория homeserver";
    refs.publicDirectorySection.appendChild(titleNode);

    state.currentPublicRooms.forEach((room) => {
        const item = document.createElement("div");
        item.className = "public-room-item";
        item.dataset.publicRoomId = room.room_id || "";
        item.dataset.publicAlias = room.canonical_alias || room.alias || "";
        item.innerHTML = `
            <div class="public-avatar">${escapeHtml(initialsFromName(room.name || room.canonical_alias || room.room_id || "P"))}</div>
            <div class="public-main">
                <div class="public-top">
                    <div class="public-name">${escapeHtml(room.name || room.canonical_alias || room.room_id)}</div>
                    <button class="secondary-btn" data-public-action="join" type="button">Join</button>
                </div>
                <div class="public-topic">${escapeHtml(room.topic || room.room_id || "Без topic")}</div>
                <div class="public-meta-row">
                    <span class="room-badge">${room.num_joined_members || 0} участников</span>
                    ${room.world_readable ? '<span class="room-badge">World-readable</span>' : ""}
                </div>
            </div>
        `;
        refs.publicDirectorySection.appendChild(item);
    });
}

function autoOpenPreferredRoom() {
    const available = getJoinedRoomsSorted();
    if (!available.length) return;
    const room = available.find((entry) => entry.roomId === state.ui.lastRoomId) || available[0];
    openRoom(room.roomId);
}

function openRoom(roomId) {
    const room = state.client?.getRoom(roomId);
    if (!room) return;
    state.activeRoomId = roomId;
    state.ui.lastRoomId = roomId;
    saveJson(STORAGE_KEYS.ui, state.ui);
    refs.emptyState.classList.add("hidden");
    refs.chatView.classList.remove("hidden");
    refs.body.classList.add("mobile-chat-active");
    state.messageSearchResults = [];
    refs.messageSearchResults.classList.add("hidden");
    refs.messageSearchResults.innerHTML = "";
    if (state.settings.preserveDrafts && !state.replyToEventId && !state.editEventId) {
        refs.chatInput.value = state.drafts[roomId] || "";
        refs.chatInput.dispatchEvent(new Event("input"));
    }
    renderRooms();
    renderChat();
    maybeAutoScroll(true);
    sendReadReceiptForActiveRoom().catch(console.error);
}

function renderChat() {
    const room = getActiveRoom();
    refs.composerContext.classList.toggle("hidden", !state.replyToEventId && !state.editEventId);
    refs.composerContext.innerHTML = buildComposerContextHtml(room);

    if (!room) {
        refs.emptyState.classList.remove("hidden");
        refs.chatView.classList.add("hidden");
        return;
    }

    refs.emptyState.classList.add("hidden");
    refs.chatView.classList.remove("hidden");
    refs.chatHeaderAvatar.textContent = initialsFromName(getRoomName(room));
    refs.chatHeaderTitle.textContent = getRoomName(room);
    refs.chatHeaderStatus.textContent = buildRoomStatus(room);
    refs.chatHeaderEncrypted.classList.toggle("hidden", !isEncryptedRoom(room));

    const timeline = getRenderableTimeline(room);
    refs.messageContainer.innerHTML = "";

    let previousDateKey = "";
    let previousSender = "";
    let previousTs = 0;

    timeline.forEach((event) => {
        const ts = event.getTs?.() || Date.now();
        const currentDateKey = new Date(ts).toDateString();
        if (currentDateKey !== previousDateKey) {
            const sep = document.createElement("div");
            sep.className = "date-separator";
            sep.textContent = formatDateLabel(ts);
            refs.messageContainer.appendChild(sep);
            previousDateKey = currentDateKey;
        }

        const sender = event.getSender?.() || "";
        const isMine = sender === state.session?.userId;
        const shouldShowAuthor = !isMine && (!previousSender || previousSender !== sender || ts - previousTs > 6 * 60 * 1000);
        const messageNode = renderMessageEvent(event, room, { isMine, shouldShowAuthor });
        refs.messageContainer.appendChild(messageNode);

        previousSender = sender;
        previousTs = ts;
    });

    renderTypingBar();
}

function renderMessageEvent(event, room, { isMine, shouldShowAuthor }) {
    const row = document.createElement("div");
    row.className = `msg-row${isMine ? " mine" : ""}`;
    row.dataset.eventId = event.getId?.() || "";
    row.dataset.roomId = room.roomId;

    const member = room.getMember?.(event.getSender?.()) || null;
    const senderName = member?.name || event.getSender?.() || "Unknown";
    const status = getEventStatusLabel(event);
    const replyEventId = event.getContent?.()?.["m.relates_to"]?.["m.in_reply_to"]?.event_id || null;
    const replyHtml = replyEventId ? buildReplyHtml(room, replyEventId) : "";
    const bodyHtml = buildMessageContentHtml(event);

    row.innerHTML = `
        <div class="member-avatar">${escapeHtml(initialsFromName(senderName))}</div>
        <div class="msg-bubble">
            ${shouldShowAuthor ? `<div class="msg-author">${escapeHtml(senderName)}</div>` : ""}
            ${replyHtml}
            ${bodyHtml}
            <div class="msg-meta-row">
                <span class="msg-meta">${escapeHtml(formatTime(event.getTs?.() || Date.now()))}</span>
                ${status ? `<span class="msg-status ${status.className}">${escapeHtml(status.label)}</span>` : ""}
            </div>
        </div>
    `;

    if (isMine) row.querySelector(".member-avatar")?.remove();

    hydrateMedia(row, event).catch(console.error);
    return row;
}

function buildMessageContentHtml(event) {
    const type = event.getType?.();
    if (type === "m.room.encrypted") {
        return `
            <div class="msg-decrypt">
                <div class="msg-decrypt-title">Сообщение не расшифровано</div>
                <div class="msg-decrypt-help">Похоже, ключей этого устройства недостаточно. Загрузи recovery key или включи рабочий key backup.</div>
                <div>
                    <button class="secondary-btn" data-inline-action="restore-keys" type="button">Восстановить ключи</button>
                </div>
            </div>
        `;
    }

    if (type !== "m.room.message") {
        return `<div class="msg-subtle">${escapeHtml(event.getContent?.()?.body || type || "Событие")}</div>`;
    }

    const content = event.getContent?.() || {};
    const msgtype = content.msgtype || "m.text";

    if (msgtype === "m.image") {
        return `
            <div>${escapeHtml(content.body || "Изображение")}</div>
            <div class="msg-media"><img alt="${escapeHtml(content.body || "image")}" data-mxc="${escapeHtml(content.url || "")}"></div>
        `;
    }

    if (msgtype === "m.file") {
        return `
            <div class="file-card">
                <div>
                    <div>${escapeHtml(content.body || "Файл")}</div>
                    <div class="file-meta">${escapeHtml(content.info?.mimetype || "file")}${content.info?.size ? ` · ${escapeHtml(formatBytes(content.info.size))}` : ""}</div>
                </div>
                <a class="file-link" data-mxc-link="${escapeHtml(content.url || "")}" href="#">Открыть</a>
            </div>
        `;
    }

    return `<div>${escapeHtml(getEventBody(event))}</div>`;
}

function buildReplyHtml(room, replyEventId) {
    const original = room.findEventById?.(replyEventId) || room.timeline?.find((item) => item.getId?.() === replyEventId);
    if (!original) {
        return `<div class="msg-reply">Ответ на сообщение</div>`;
    }
    const name = room.getMember?.(original.getSender?.())?.name || original.getSender?.() || "Unknown";
    return `<div class="msg-reply"><strong>${escapeHtml(name)}</strong><br>${escapeHtml(getEventBody(original).slice(0, 140))}</div>`;
}

async function hydrateMedia(row, event) {
    const content = event.getContent?.() || {};
    const img = row.querySelector("img[data-mxc]");
    if (img && content.url) {
        img.src = await getMediaSrc(content.url);
    }

    const link = row.querySelector("a[data-mxc-link]");
    if (link && content.url) {
        link.href = await getMediaSrc(content.url, { forceDownload: true });
        link.target = "_blank";
        link.rel = "noreferrer noopener";
    }
}

function renderTypingBar() {
    const room = getActiveRoom();
    if (!room) {
        refs.typingBar.classList.add("hidden");
        refs.typingBar.textContent = "";
        return;
    }

    const typing = (room.getTypingMembers?.() || [])
        .filter((member) => member.userId !== state.session?.userId)
        .map((member) => member.name || member.userId);

    if (!typing.length) {
        refs.typingBar.classList.add("hidden");
        refs.typingBar.textContent = "";
        return;
    }

    refs.typingBar.classList.remove("hidden");
    refs.typingBar.textContent = typing.length === 1
        ? `${typing[0]} печатает…`
        : `${typing.slice(0, 2).join(", ")} печатают…`;
}

function buildRoomStatus(room) {
    const members = room.getJoinedMembers?.() || [];
    const parts = [];
    if (isDirectRoom(room)) {
        const other = members.find((member) => member.userId !== state.session?.userId);
        if (other?.presence === "online") parts.push("в сети");
    } else {
        parts.push(`${members.length || 0} участников`);
    }
    const topic = getRoomTopic(room);
    if (topic) parts.push(topic);
    const unread = getUnreadCount(room);
    if (unread) parts.push(`${unread} unread`);
    return parts.join(" · ") || "Без статуса";
}

function buildComposerContextHtml(room) {
    if (!room) return "";
    if (state.editEventId) {
        const event = room.findEventById?.(state.editEventId) || room.timeline?.find((item) => item.getId?.() === state.editEventId);
        return `
            <strong>Редактирование</strong><br>
            ${escapeHtml(getEventBody(event).slice(0, 180))}
            <div class="form-actions">
                <button class="ghost-btn" data-inline-action="cancel-compose-context" type="button">Отмена</button>
            </div>
        `;
    }

    if (state.replyToEventId) {
        const event = room.findEventById?.(state.replyToEventId) || room.timeline?.find((item) => item.getId?.() === state.replyToEventId);
        return `
            <strong>Ответ</strong><br>
            ${escapeHtml(getEventBody(event).slice(0, 180))}
            <div class="form-actions">
                <button class="ghost-btn" data-inline-action="cancel-compose-context" type="button">Отмена</button>
            </div>
        `;
    }

    return "";
}

function handleComposerKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendCurrentMessage();
    }
}

function handleComposerInput(event) {
    event.currentTarget.style.height = "auto";
    event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 140)}px`;
    persistDraftForActiveRoom(event.currentTarget.value);
    if (state.settings.sendTyping) sendTyping();
}

async function sendCurrentMessage() {
    const room = getActiveRoom();
    const client = state.client;
    if (!room || !client) return;

    const text = refs.chatInput.value.trim();
    if (!text) return;

    const content = { msgtype: "m.text", body: text };

    if (state.replyToEventId) {
        content["m.relates_to"] = { "m.in_reply_to": { event_id: state.replyToEventId } };
    }

    if (state.editEventId) {
        content.body = `* ${text}`;
        content["m.new_content"] = { msgtype: "m.text", body: text };
        content["m.relates_to"] = { rel_type: "m.replace", event_id: state.editEventId };
    }

    try {
        await client.sendEvent(room.roomId, "m.room.message", content, "");
        refs.chatInput.value = "";
        refs.chatInput.style.height = "auto";
        clearDraftForRoom(room.roomId);
        clearComposeContext();
        renderChat();
        renderRooms();
        maybeAutoScroll(true);
    } catch (error) {
        showStatus(`Сообщение не отправилось: ${parseError(error)}`, "error", true);
    }
}

async function handleAttachmentSelection(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    for (const file of files) {
        await uploadAndSendFile(file);
    }
}

async function uploadAndSendFile(file) {
    const room = getActiveRoom();
    const client = state.client;
    if (!room || !client) return;

    showStatus(`Загружаю ${file.name}…`, "info", true);

    try {
        const uploadResponse = await client.uploadContent(file, {
            type: file.type || undefined,
            name: file.name,
            includeFilename: true,
        });

        const mxcUrl = typeof uploadResponse === "string"
            ? uploadResponse
            : uploadResponse?.content_uri || uploadResponse?.url || uploadResponse?.contentUri;

        if (!mxcUrl) throw new Error("Homeserver не вернул MXC URL для файла.");

        const isImage = file.type.startsWith("image/");
        const content = {
            msgtype: isImage ? "m.image" : "m.file",
            body: file.name,
            url: mxcUrl,
            info: {
                mimetype: file.type || "application/octet-stream",
                size: file.size,
            },
        };

        await client.sendEvent(room.roomId, "m.room.message", content, "");
        clearStatus();
        renderChat();
        maybeAutoScroll(true);
    } catch (error) {
        showStatus(`Ошибка upload: ${parseError(error)}`, "error", true);
    }
}

async function loadPublicRooms(query = "") {
    if (!state.client) return;
    try {
        showStatus("Загружаю публичные комнаты…", "info", true);
        const response = await state.client.publicRooms({
            limit: 30,
            filter: query ? { generic_search_term: query } : undefined,
        });
        state.currentPublicRooms = response.chunk || [];
        renderRooms();
        clearStatus();
    } catch (error) {
        showStatus(`Не удалось загрузить директорию: ${parseError(error)}`, "error", true);
    }
}

function runMessageSearch() {
    const room = getActiveRoom();
    if (!room) return;

    const query = refs.messageSearchInput.value.trim().toLowerCase();
    if (!query) {
        state.messageSearchResults = [];
        refs.messageSearchResults.innerHTML = "";
        refs.messageSearchResults.classList.add("hidden");
        return;
    }

    const results = getRenderableTimeline(room)
        .filter((event) => getEventBody(event).toLowerCase().includes(query))
        .slice(-30)
        .reverse();

    state.messageSearchResults = results;
    refs.messageSearchResults.classList.remove("hidden");
    refs.messageSearchResults.innerHTML = results.length
        ? results.map((event) => `
            <button class="search-result-item" data-result-event-id="${escapeHtml(event.getId?.() || "")}" type="button">
                <div class="search-result-main">
                    <div class="search-result-title">${escapeHtml(room.getMember?.(event.getSender?.())?.name || event.getSender?.() || "Unknown")}</div>
                    <div class="search-result-snippet">${escapeHtml(getEventBody(event).slice(0, 200))}</div>
                </div>
            </button>
        `).join("")
        : '<div class="empty-list">Совпадений не найдено.</div>';
}

function handleMessageAreaClick(event) {
    const inlineAction = event.target.closest("[data-inline-action]");
    if (inlineAction) {
        const action = inlineAction.dataset.inlineAction;
        if (action === "restore-keys") openRestoreKeysModal();
        if (action === "cancel-compose-context") clearComposeContext();
        return;
    }

    const searchResult = event.target.closest("[data-result-event-id]");
    if (searchResult) {
        jumpToEvent(searchResult.dataset.resultEventId);
        return;
    }
}

function handleMessageAreaContext(event) {
    const row = event.target.closest(".msg-row");
    if (!row) return;
    event.preventDefault();
    state.activeMessageEvent = row.dataset.eventId || null;
    const eventObject = getActiveRoom()?.findEventById?.(state.activeMessageEvent) || getActiveRoom()?.timeline?.find((item) => item.getId?.() === state.activeMessageEvent);
    const status = getEventStatusLabel(eventObject);
    refs.retryMessageMenuItem.classList.toggle("hidden", status?.className !== "failed");
    openMenu(refs.messageMenu, { left: event.clientX, top: event.clientY, width: 0, height: 0 });
}

function handleRoomContextMenu(event) {
    const item = event.target.closest(".room-item");
    if (!item) return;
    event.preventDefault();
    state.activeRoomContextId = item.dataset.roomId || null;
    openMenu(refs.roomMenu, { left: event.clientX, top: event.clientY, width: 0, height: 0 });
}

function handleRoomListClick(event) {
    const item = event.target.closest(".room-item");
    if (!item) return;
    openRoom(item.dataset.roomId || "");
}

async function handlePublicListClick(event) {
    const joinButton = event.target.closest("[data-public-action='join']");
    if (!joinButton) return;
    const item = event.target.closest(".public-room-item");
    if (!item || !state.client) return;

    const roomAddress = item.dataset.publicAlias || item.dataset.publicRoomId;
    try {
        await state.client.joinRoom(roomAddress);
        showStatus("Комната подключена.");
        renderRooms();
    } catch (error) {
        showStatus(`Join не удался: ${parseError(error)}`, "error", true);
    }
}

async function handleComposeMenu(event) {
    const action = event.target.closest("[data-compose-action]")?.dataset.composeAction;
    if (!action) return;
    closeMenus();

    if (action === "new-private") return openCreateRoomModal("private");
    if (action === "new-public") return openCreateRoomModal("public");
    if (action === "join-public") return openJoinRoomModal();
    if (action === "restore-keys") return openRestoreKeysModal();
}

async function handleRoomMenu(event) {
    const action = event.target.closest("[data-room-action]")?.dataset.roomAction;
    const roomId = state.activeRoomContextId;
    const room = roomId ? state.client?.getRoom(roomId) : null;
    closeMenus();
    if (!action || !room) return;

    if (action === "toggle-pin") {
        toggleInList(state.ui.pinnedRooms, roomId);
        saveJson(STORAGE_KEYS.ui, state.ui);
        renderRooms();
        return;
    }

    if (action === "toggle-mute") {
        toggleInList(state.ui.mutedRooms, roomId);
        saveJson(STORAGE_KEYS.ui, state.ui);
        renderRooms();
        return;
    }

    if (action === "info") return openRoomInfo(roomId);
    if (action === "invite") return openInviteModal(roomId);
    if (action === "leave") {
        if (state.settings.confirmLeaveRoom && !window.confirm(`Покинуть ${getRoomName(room)}?`)) return;
        try {
            await state.client.leave(roomId);
            if (state.activeRoomId === roomId) {
                state.activeRoomId = null;
                state.ui.lastRoomId = null;
                saveJson(STORAGE_KEYS.ui, state.ui);
                refs.body.classList.remove("mobile-chat-active");
            }
            renderRooms();
            renderChat();
            showStatus("Комната покинута.");
        } catch (error) {
            showStatus(`Не удалось выйти из комнаты: ${parseError(error)}`, "error", true);
        }
    }
}

async function handleMessageMenu(event) {
    const action = event.target.closest("[data-message-action]")?.dataset.messageAction;
    const room = getActiveRoom();
    const eventId = state.activeMessageEvent;
    closeMenus();
    if (!action || !room || !eventId) return;

    const messageEvent = room.findEventById?.(eventId) || room.timeline?.find((item) => item.getId?.() === eventId);
    if (!messageEvent) return;

    if (action === "reply") {
        state.replyToEventId = eventId;
        state.editEventId = null;
        renderChat();
        refs.chatInput.focus();
        return;
    }

    if (action === "edit") {
        refs.chatInput.value = getEventBody(messageEvent);
        refs.chatInput.dispatchEvent(new Event("input"));
        state.editEventId = eventId;
        state.replyToEventId = null;
        renderChat();
        refs.chatInput.focus();
        return;
    }

    if (action === "copy") {
        await navigator.clipboard.writeText(getEventBody(messageEvent));
        showStatus("Текст сообщения скопирован.");
        return;
    }

    if (action === "retry") {
        try {
            await state.client.resendEvent(messageEvent, room);
            showStatus("Повторная отправка запущена.");
        } catch (error) {
            showStatus(`Retry не удался: ${parseError(error)}`, "error", true);
        }
        return;
    }

    if (action === "delete") {
        try {
            await state.client.redactEvent(room.roomId, eventId, undefined, { reason: "Удалено в web-клиенте" });
            showStatus("Сообщение удалено.");
        } catch (error) {
            showStatus(`Не удалось удалить сообщение: ${parseError(error)}`, "error", true);
        }
    }
}

function persistDraftForActiveRoom(value) {
    if (!state.settings.preserveDrafts || !state.activeRoomId || state.editEventId) return;
    const cleaned = String(value || "");
    if (!cleaned.trim()) {
        clearDraftForRoom(state.activeRoomId, false);
        return;
    }
    state.drafts[state.activeRoomId] = cleaned;
    saveJson(STORAGE_KEYS.drafts, state.drafts);
    renderRooms();
}

function clearDraftForRoom(roomId, rerender = true) {
    if (!roomId || !state.drafts[roomId]) return;
    delete state.drafts[roomId];
    saveJson(STORAGE_KEYS.drafts, state.drafts);
    if (rerender) renderRooms();
}

function clearAllDrafts() {
    state.drafts = {};
    saveJson(STORAGE_KEYS.drafts, state.drafts);
    if (state.activeRoomId) refs.chatInput.value = "";
    refs.chatInput.style.height = "auto";
    renderRooms();
    showStatus("Черновики очищены.");
}

function reconnectNow() {
    if (!state.client) return;
    const retried = state.client.retryImmediately?.();
    if (!retried && state.session) {
        startSession(state.session, { restoring: true }).catch((error) => showStatus(`Переподключение не удалось: ${parseError(error)}`, "error", true));
        return;
    }
    showStatus("Повтор sync запущен.");
}

async function copySessionInfo() {
    const payload = [
        `Homeserver: ${state.session?.baseUrl || "—"}`,
        `MXID: ${state.session?.userId || "—"}`,
        `Device ID: ${state.session?.deviceId || "—"}`,
        `Sync: ${state.syncState || "STOPPED"}`,
    ].join("\n");
    await navigator.clipboard.writeText(payload);
    showStatus("Данные сессии скопированы.");
}

function resetLocalUi() {
    state.ui = structuredClone(DEFAULT_UI);
    saveJson(STORAGE_KEYS.ui, state.ui);
    renderChatFolderChips();
    switchTab(state.ui.activeTab || "chats");
    renderRooms();
    showStatus("Локальные пины, mute и фильтры сброшены.");
}

function clearComposeContext() {
    state.replyToEventId = null;
    state.editEventId = null;
    renderChat();
}

function openMenu(menu, anchorRect) {
    closeMenus();
    refs.globalOverlay.classList.add("active");
    menu.classList.add("active");
    const menuWidth = 248;
    const menuHeight = 240;
    const left = Math.min(window.innerWidth - menuWidth - 12, Math.max(12, anchorRect.left || 12));
    const top = Math.min(window.innerHeight - menuHeight - 12, Math.max(12, anchorRect.top || 12));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
}

function closeMenus() {
    refs.globalOverlay.classList.remove("active");
    refs.composeMenu.classList.remove("active");
    refs.roomMenu.classList.remove("active");
    refs.messageMenu.classList.remove("active");
}

function openModal(title, subtitle = "", html = "") {
    refs.modalTitle.textContent = title;
    refs.modalSubtitle.textContent = subtitle;
    refs.modalBody.innerHTML = html;
    refs.modalOverlay.classList.add("active");
}

function closeModal() {
    refs.modalOverlay.classList.remove("active");
    refs.modalBody.innerHTML = "";
}

function openCreateRoomModal(kind) {
    const isPublic = kind === "public";
    openModal(
        isPublic ? "Новая публичная комната" : "Новая приватная комната",
        isPublic ? "Создание public room на homeserver" : "Создание private / trusted chat room",
        `
            <form class="fieldset" data-modal-form="create-room">
                <input type="hidden" name="visibility" value="${isPublic ? "public" : "private"}">
                <label class="field">
                    <span>Название</span>
                    <input name="name" type="text" placeholder="Название комнаты" required>
                </label>
                <label class="field">
                    <span>Topic</span>
                    <textarea name="topic" placeholder="Краткое описание"></textarea>
                </label>
                <label class="toggle-row compact">
                    <input name="encrypted" type="checkbox" ${isPublic ? "" : "checked"}>
                    <span>Включить E2EE при создании</span>
                </label>
                <label class="toggle-row compact">
                    <input name="dm" type="checkbox" ${isPublic ? "disabled" : ""}>
                    <span>Считать комнату direct chat</span>
                </label>
                <div class="form-actions">
                    <button class="secondary-btn" type="button" data-inline-action="close-modal">Отмена</button>
                    <button class="primary-btn" type="submit">Создать</button>
                </div>
            </form>
        `,
    );
}

function openJoinRoomModal() {
    openModal(
        "Join public room",
        "Можно указать alias вида #room:server или room id",
        `
            <form class="fieldset" data-modal-form="join-room">
                <label class="field">
                    <span>Alias / Room ID</span>
                    <input name="roomAddress" type="text" placeholder="#room:server или !roomid:server" required>
                </label>
                <div class="form-actions">
                    <button class="secondary-btn" type="button" data-inline-action="close-modal">Отмена</button>
                    <button class="primary-btn" type="submit">Подключиться</button>
                </div>
            </form>
        `,
    );
}

function openInviteModal(roomId) {
    openModal(
        "Пригласить пользователя",
        "Matrix invite в выбранную комнату",
        `
            <form class="fieldset" data-modal-form="invite-user">
                <input type="hidden" name="roomId" value="${escapeHtml(roomId)}">
                <label class="field">
                    <span>Matrix ID</span>
                    <input name="userId" type="text" placeholder="@user:server" required>
                </label>
                <div class="form-actions">
                    <button class="secondary-btn" type="button" data-inline-action="close-modal">Отмена</button>
                    <button class="primary-btn" type="submit">Пригласить</button>
                </div>
            </form>
        `,
    );
}

function openEditProfileModal() {
    const me = state.session?.userId;
    if (!me) return;

    const currentUser = state.client?.getUser?.(me);
    openModal(
        "Редактирование профиля",
        "Изменение display name и avatar через Matrix API",
        `
            <form class="fieldset" data-modal-form="edit-profile">
                <label class="field">
                    <span>Display name</span>
                    <input name="displayName" type="text" value="${escapeHtml(currentUser?.displayName || "")}" placeholder="Ваш display name">
                </label>
                <label class="field">
                    <span>Avatar</span>
                    <input name="avatarFile" type="file" accept="image/*">
                </label>
                <div class="form-actions">
                    <button class="secondary-btn" type="button" data-inline-action="close-modal">Отмена</button>
                    <button class="primary-btn" type="submit">Сохранить</button>
                </div>
            </form>
        `,
    );
}

function openRestoreKeysModal() {
    openModal(
        "Восстановление encrypted history",
        "Для старых зашифрованных сообщений этому устройству нужен рабочий key backup: через secret storage, recovery key или passphrase.",
        `
            <div class="room-info-card">
                <div class="info-label">Текущее состояние</div>
                <div class="info-value">${escapeHtml(refs.backupStatusValue.textContent || "—")}</div>
            </div>

            <form class="fieldset" data-modal-form="restore-keys-from-secret-storage">
                <div class="room-info-card">
                    <div class="info-label">1. Secret storage / already cached key</div>
                    <div class="info-value">Если recovery key уже был передан этому браузеру, клиент попробует загрузить backup key из secret storage и после этого сможет автоматически подтягивать missing keys.</div>
                </div>
                <label class="toggle-row compact">
                    <input name="fullRestore" type="checkbox" checked>
                    <span>Сразу запустить полное restore key backup</span>
                </label>
                <div class="form-actions">
                    <button class="primary-btn" type="submit">Загрузить из secret storage</button>
                </div>
            </form>

            <hr class="soft">

            <form class="fieldset" data-modal-form="restore-keys-from-recovery">
                <div class="room-info-card">
                    <div class="info-label">2. Recovery key</div>
                    <div class="info-value">Вставь recovery key из другого Matrix-клиента. Он будет использован как secret storage key для загрузки backup key, после чего можно восстановить старые encrypted messages.</div>
                </div>
                <label class="field">
                    <span>Recovery key</span>
                    <textarea name="recoveryKey" placeholder="EsTc ..."></textarea>
                </label>
                <label class="toggle-row compact">
                    <input name="fullRestore" type="checkbox" checked>
                    <span>Сразу запустить полное restore key backup</span>
                </label>
                <div class="form-actions">
                    <button class="primary-btn" type="submit">Использовать recovery key</button>
                </div>
            </form>

            <hr class="soft">

            <form class="fieldset" data-modal-form="restore-keys-from-passphrase">
                <div class="room-info-card">
                    <div class="info-label">3. Passphrase</div>
                    <div class="info-value">Best-effort путь для старых backup-схем. В современных настройках предпочтительнее recovery key / secret storage.</div>
                </div>
                <label class="field">
                    <span>Passphrase</span>
                    <input name="passphrase" type="password" placeholder="Ваш recovery passphrase">
                </label>
                <div class="form-actions">
                    <button class="primary-btn" type="submit">Использовать passphrase</button>
                </div>
            </form>
        `,
    );
}

async function openRoomInfo(roomId) {
    const room = roomId ? state.client?.getRoom(roomId) : null;
    if (!room) return;

    const topic = getRoomTopic(room) || "Без topic";
    const memberRows = (room.getJoinedMembers?.() || [])
        .slice(0, 60)
        .map((member) => `
            <div class="member-row" data-user-id="${escapeHtml(member.userId)}">
                <div class="member-avatar">${escapeHtml(initialsFromName(member.name || member.userId))}</div>
                <div class="member-main">
                    <div class="member-name">${escapeHtml(member.name || member.userId)}</div>
                    <div class="member-id">${escapeHtml(member.userId)}</div>
                </div>
            </div>
        `)
        .join("");

    openModal(
        getRoomName(room),
        room.roomId,
        `
            <div class="room-info-card">
                <div class="info-grid">
                    <div>
                        <div class="info-label">Тип</div>
                        <div class="info-value">${isPublicRoom(room) ? "Публичная" : isDirectRoom(room) ? "DM" : "Приватная / групповая"}</div>
                    </div>
                    <div>
                        <div class="info-label">Шифрование</div>
                        <div class="info-value">${isEncryptedRoom(room) ? "Включено" : "Отключено"}</div>
                    </div>
                    <div>
                        <div class="info-label">Участников</div>
                        <div class="info-value">${room.getJoinedMembers?.().length || 0}</div>
                    </div>
                    <div>
                        <div class="info-label">Unread</div>
                        <div class="info-value">${getUnreadCount(room)}</div>
                    </div>
                </div>
            </div>
            <div class="room-info-card">
                <div class="info-label">Topic</div>
                <div class="info-value">${escapeHtml(topic)}</div>
            </div>
            <form class="fieldset" data-modal-form="edit-room">
                <input type="hidden" name="roomId" value="${escapeHtml(room.roomId)}">
                <label class="field">
                    <span>Название комнаты</span>
                    <input name="name" type="text" value="${escapeHtml(getRoomName(room))}">
                </label>
                <label class="field">
                    <span>Topic</span>
                    <textarea name="topic">${escapeHtml(topic === "Без topic" ? "" : topic)}</textarea>
                </label>
                <div class="form-actions">
                    <button class="primary-btn" type="submit">Сохранить room info</button>
                </div>
            </form>
            <div class="room-info-card">
                <div class="info-label">Участники</div>
                <div class="member-list">${memberRows || '<div class="empty-list">Участники не загружены.</div>'}</div>
            </div>
            <div class="inline-actions">
                <button class="secondary-btn" data-room-inline="invite" data-room-id="${escapeHtml(room.roomId)}" type="button">Пригласить</button>
                <button class="ghost-btn" data-room-inline="leave" data-room-id="${escapeHtml(room.roomId)}" type="button">Покинуть</button>
            </div>
        `,
    );
}

async function openUserProfile(userId) {
    if (!userId || !state.client) return;

    (async () => {
        try {
            const profile = await state.client.getProfileInfo(userId).catch(() => ({}));
            const sharedCount = getJoinedRoomsSorted().filter((room) => room.getJoinedMembers?.().some((member) => member.userId === userId)).length;
            openModal(
                profile.displayname || userId,
                userId,
                `
                    <div class="settings-profile">
                        <div class="profile-avatar">${escapeHtml(initialsFromName(profile.displayname || userId))}</div>
                        <div class="profile-copy">
                            <div class="profile-name">${escapeHtml(profile.displayname || userId)}</div>
                            <div class="profile-id">${escapeHtml(userId)}</div>
                            <div class="profile-meta-row">
                                <span class="state-pill">Shared rooms ${sharedCount}</span>
                                ${(state.ui.blockedUsers || []).includes(userId) ? '<span class="state-pill is-muted">Blocked</span>' : ''}
                            </div>
                        </div>
                    </div>
                    <div class="inline-actions">
                        <button class="primary-btn" data-user-inline="start-dm" data-user-id="${escapeHtml(userId)}" type="button">Начать диалог</button>
                        <button class="ghost-btn" data-user-inline="toggle-block" data-user-id="${escapeHtml(userId)}" type="button">${(state.ui.blockedUsers || []).includes(userId) ? "Разблокировать" : "Заблокировать"}</button>
                    </div>
                `,
            );
        } catch (error) {
            showStatus(`Профиль не открылся: ${parseError(error)}`, "error", true);
        }
    })();
}

async function handleModalActions(event) {
    const closeButton = event.target.closest("[data-inline-action='close-modal']");
    if (closeButton) {
        closeModal();
        return;
    }

    const memberRow = event.target.closest(".member-row[data-user-id]");
    if (memberRow) {
        openUserProfile(memberRow.dataset.userId || "");
        return;
    }

    const roomInline = event.target.closest("[data-room-inline]");
    if (roomInline) {
        const roomId = roomInline.dataset.roomId || "";
        if (roomInline.dataset.roomInline === "invite") return openInviteModal(roomId);
        if (roomInline.dataset.roomInline === "leave") {
            closeModal();
            try {
                await state.client.leave(roomId);
                if (state.activeRoomId === roomId) {
                    state.activeRoomId = null;
                    state.ui.lastRoomId = null;
                    saveJson(STORAGE_KEYS.ui, state.ui);
                    refs.body.classList.remove("mobile-chat-active");
                }
                renderRooms();
                renderChat();
                showStatus("Комната покинута.");
            } catch (error) {
                showStatus(`Не удалось выйти из комнаты: ${parseError(error)}`, "error", true);
            }
            return;
        }
    }

    const userInline = event.target.closest("[data-user-inline]");
    if (userInline) {
        const userId = userInline.dataset.userId || "";
        if (userInline.dataset.userInline === "start-dm") {
            await startDirectChat(userId);
            closeModal();
            return;
        }
        if (userInline.dataset.userInline === "toggle-block") {
            toggleBlockedUser(userId);
            closeModal();
            return openUserProfile(userId);
        }
    }
}

function handleModalChanges(event) {
    if (event.target.name === "avatarFile") {
        const file = event.target.files?.[0];
        if (!file) return;
        const hint = document.createElement("div");
        hint.className = "room-meta";
        hint.textContent = `Выбран файл: ${file.name}`;
        event.target.closest("form")?.appendChild(hint);
    }
}

async function handleModalSubmit(event) {
    const form = event.target.closest("form[data-modal-form]");
    if (!form) return;
    event.preventDefault();

    const action = form.dataset.modalForm;
    const formData = new FormData(form);

    try {
        if (action === "create-room") {
            const visibility = String(formData.get("visibility") || "private");
            const encrypted = formData.get("encrypted") === "on";
            const dm = formData.get("dm") === "on";
            const response = await state.client.createRoom({
                name: String(formData.get("name") || ""),
                topic: String(formData.get("topic") || ""),
                visibility,
                preset: visibility === "public" ? "public_chat" : (dm ? "trusted_private_chat" : "private_chat"),
                is_direct: dm,
                initial_state: encrypted ? [{ type: "m.room.encryption", state_key: "", content: { algorithm: "m.megolm.v1.aes-sha2" } }] : [],
            });
            closeModal();
            renderRooms();
            openRoom(response.room_id);
            showStatus("Комната создана.");
            return;
        }

        if (action === "join-room") {
            await state.client.joinRoom(String(formData.get("roomAddress") || ""));
            closeModal();
            renderRooms();
            showStatus("Подключение к комнате выполнено.");
            return;
        }

        if (action === "invite-user") {
            await state.client.invite(String(formData.get("roomId") || ""), String(formData.get("userId") || ""));
            closeModal();
            showStatus("Инвайт отправлен.");
            return;
        }

        if (action === "edit-profile") {
            const displayName = String(formData.get("displayName") || "").trim();
            const avatarFile = formData.get("avatarFile");
            if (displayName) await state.client.setDisplayName(displayName);
            if (avatarFile instanceof File && avatarFile.size > 0) {
                const uploadResponse = await state.client.uploadContent(avatarFile, {
                    type: avatarFile.type || undefined,
                    name: avatarFile.name,
                    includeFilename: true,
                });
                const mxcUrl = typeof uploadResponse === "string"
                    ? uploadResponse
                    : uploadResponse?.content_uri || uploadResponse?.url || uploadResponse?.contentUri;
                if (mxcUrl) await state.client.setAvatarUrl(mxcUrl);
            }
            closeModal();
            renderSettings();
            renderRooms();
            showStatus("Профиль обновлён.");
            return;
        }

        if (action === "edit-room") {
            const roomId = String(formData.get("roomId") || "");
            await state.client.setRoomName(roomId, String(formData.get("name") || ""));
            await state.client.setRoomTopic(roomId, String(formData.get("topic") || ""));
            closeModal();
            renderRooms();
            renderChat();
            showStatus("Room info обновлён.");
            return;
        }

        if (action === "restore-keys-from-secret-storage") {
            const fullRestore = formData.get("fullRestore") === "on";
            await restoreKeysFromSecretStorage(fullRestore);
            closeModal();
            return;
        }

        if (action === "restore-keys-from-recovery") {
            const recoveryKey = String(formData.get("recoveryKey") || "").trim();
            const fullRestore = formData.get("fullRestore") === "on";
            await restoreKeysFromRecoveryKey(recoveryKey, fullRestore);
            closeModal();
            return;
        }

        if (action === "restore-keys-from-passphrase") {
            const passphrase = String(formData.get("passphrase") || "").trim();
            await restoreKeysFromPassphrase(passphrase);
            closeModal();
        }
    } catch (error) {
        showStatus(parseError(error), "error", true);
    }
}

async function restoreKeysFromSecretStorage(fullRestore = true) {
    const crypto = state.client?.getCrypto?.();
    if (!crypto) throw new Error("Crypto API недоступен.");

    showStatus("Пробую загрузить backup key из secret storage…", "info", true);
    await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
    await recheckCryptoAndBackup({ silent: true });

    if (fullRestore) {
        showStatus("Запускаю полное восстановление key backup…", "info", true);
        await crypto.restoreKeyBackup();
    }

    renderChat();
    showStatus("Ключи восстановлены. Повтори открытие комнаты с зашифрованной историей.");
}

async function restoreKeysFromRecoveryKey(recoveryKey, fullRestore = true) {
    if (!recoveryKey) throw new Error("Вставь recovery key.");

    const decoded = decodeRecoveryKey(recoveryKey.replace(/\s+/g, " ").trim());
    state.secretStorageKey = { keyId: null, privateKey: decoded };
    persistSecretStorageKey(state.secretStorageKey);

    await restoreKeysFromSecretStorage(fullRestore);
}

async function restoreKeysFromPassphrase(passphrase) {
    if (!passphrase) throw new Error("Введи passphrase.");
    const crypto = state.client?.getCrypto?.();
    if (!crypto) throw new Error("Crypto API недоступен.");

    showStatus("Пробую восстановить key backup через passphrase…", "info", true);
    await crypto.restoreKeyBackupWithPassphrase(passphrase);
    await recheckCryptoAndBackup({ silent: true });
    renderChat();
    showStatus("Passphrase принята. Ключи backup восстановлены.");
}

async function startDirectChat(userId) {
    if (!state.client) return;
    const existing = getJoinedRoomsSorted().find((room) => isDirectRoom(room) && room.getJoinedMembers?.().some((member) => member.userId === userId));
    if (existing) {
        openRoom(existing.roomId);
        return;
    }

    const response = await state.client.createRoom({
        is_direct: true,
        invite: [userId],
        preset: "trusted_private_chat",
        initial_state: [{ type: "m.room.encryption", state_key: "", content: { algorithm: "m.megolm.v1.aes-sha2" } }],
    });
    openRoom(response.room_id);
    showStatus("Direct room создана.");
}

function toggleBlockedUser(userId) {
    toggleInList(state.ui.blockedUsers, userId);
    saveJson(STORAGE_KEYS.ui, state.ui);

    if (state.client?.setIgnoredUsers) {
        state.client.setIgnoredUsers(state.ui.blockedUsers).catch(console.error);
    }
}

async function logout() {
    teardownClient();
    clearSession();
    state.session = null;
    state.activeRoomId = null;
    refs.body.classList.remove("mobile-chat-active");
    showAuth();
    renderRooms();
    renderChat();
    renderSettings();
    showStatus("Сессия завершена.");
}

function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.session);
    sessionStorage.removeItem(SESSION_SECRET_STORAGE_KEY);
    state.secretStorageKey = null;
}

function handleTimelineScroll() {
    if (refs.messageContainer.scrollTop > 80) return;
    const room = getActiveRoom();
    if (!room || !state.client) return;
    state.client.scrollback(room, 30).then((didPaginate) => {
        if (didPaginate) {
            const previousHeight = refs.messageContainer.scrollHeight;
            renderChat();
            const nextHeight = refs.messageContainer.scrollHeight;
            refs.messageContainer.scrollTop = nextHeight - previousHeight;
        }
    }).catch(console.error);
}

function maybeAutoScroll(force = false) {
    if (force) {
        refs.messageContainer.scrollTop = refs.messageContainer.scrollHeight;
        return;
    }
    const nearBottom = refs.messageContainer.scrollHeight - refs.messageContainer.scrollTop - refs.messageContainer.clientHeight < 120;
    if (nearBottom) refs.messageContainer.scrollTop = refs.messageContainer.scrollHeight;
}

async function sendReadReceiptForActiveRoom() {
    if (!state.settings.sendReadReceipts || !state.client) return;
    const room = getActiveRoom();
    if (!room) return;
    const lastEvent = [...getRenderableTimeline(room)].reverse().find((event) => event.getSender?.() !== state.session?.userId);
    if (!lastEvent) return;

    if (typeof state.client.sendReadReceipt === "function") {
        await state.client.sendReadReceipt(lastEvent);
        return;
    }

    if (typeof state.client.setRoomReadMarkers === "function") {
        await state.client.setRoomReadMarkers(room.roomId, lastEvent.getId?.(), lastEvent.getId?.());
    }
}

function sendTyping() {
    if (!state.settings.sendTyping || !state.client || !state.activeRoomId) return;

    state.client.sendTyping(state.activeRoomId, true, 4000).catch(() => {});
    clearTimeout(state.typingTimeout);
    state.typingTimeout = setTimeout(() => {
        state.client?.sendTyping?.(state.activeRoomId, false, 0).catch(() => {});
    }, 3500);
}

function jumpToEvent(eventId) {
    if (!eventId) return;
    const node = refs.messageContainer.querySelector(`[data-event-id="${CSS.escape(eventId)}"]`);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.animate([
        { backgroundColor: "rgba(196,59,54,.24)" },
        { backgroundColor: "transparent" },
    ], { duration: 900, easing: "ease-out" });
}

function getRenderableTimeline(room) {
    return (room?.timeline || []).filter((event) => {
        const type = event.getType?.();
        if (!type) return false;
        if (type === "m.room.message" || type === "m.room.encrypted") {
            const rel = event.getContent?.()?.["m.relates_to"];
            if (rel?.rel_type === "m.replace") return false;
            return true;
        }
        return false;
    });
}

function getEventBody(event) {
    if (!event) return "";
    const content = event.getContent?.() || {};
    if (event.getType?.() === "m.room.encrypted") return content.body || "Зашифрованное сообщение";
    if (content["m.new_content"]?.body) return content["m.new_content"].body;
    return content.body || content.filename || "";
}

function getPreviewText(event, room) {
    if (!event) return isEncryptedRoom(room) ? "Encrypted room" : "Сообщений пока нет";
    if (event.getType?.() === "m.room.encrypted") return "Не расшифровано";
    const content = event.getContent?.() || {};
    let body = getEventBody(event).replace(/\s+/g, " ").trim();
    if (content.msgtype === "m.image") body = `🖼 ${content.body || "Изображение"}`;
    if (content.msgtype === "m.file") body = `📎 ${content.body || "Файл"}`;
    const sender = event.getSender?.() === state.session?.userId ? "Вы" : (room.getMember?.(event.getSender?.())?.name || event.getSender?.() || "");
    return `${sender ? `${sender}: ` : ""}${body || "Сообщение"}`;
}

function getLastRenderableMessage(room) {
    return [...getRenderableTimeline(room)].reverse().find(Boolean) || null;
}

function getRoomName(room) {
    return room?.name || room?.getCanonicalAlias?.() || room?.roomId || "Room";
}

function getRoomTopic(room) {
    return room?.currentState?.getStateEvents?.("m.room.topic", "")?.getContent?.()?.topic || "";
}

function getRoomSortTimestamp(room) {
    return getLastRenderableMessage(room)?.getTs?.() || room?.getLastActiveTimestamp?.() || 0;
}

function getJoinedRoomsSorted() {
    if (!state.client) return [];
    return state.client.getRooms()
        .filter((room) => room.getMyMembership?.() === "join")
        .filter((room) => !(state.ui.blockedUsers || []).some((userId) => room.getJoinedMembers?.().some((member) => member.userId === userId)))
        .filter((room) => state.settings.showMutedRooms || !(state.ui.mutedRooms || []).includes(room.roomId))
        .sort((a, b) => getRoomSortTimestamp(b) - getRoomSortTimestamp(a));
}

function matchesRoomQuery(room, query) {
    if (!query) return true;
    const haystack = [
        getRoomName(room),
        getRoomTopic(room),
        room.roomId,
        getPreviewText(getLastRenderableMessage(room), room),
    ].join(" ").toLowerCase();
    return haystack.includes(query);
}

function isEncryptedRoom(room) {
    return Boolean(room?.currentState?.getStateEvents?.("m.room.encryption", ""));
}

function isPublicRoom(room) {
    const joinRule = room?.currentState?.getStateEvents?.("m.room.join_rules", "")?.getContent?.()?.join_rule;
    return joinRule === "public" || Boolean(room?.getCanonicalAlias?.());
}

function isPrivateRoom(room) {
    return !isPublicRoom(room) && !isDirectRoom(room);
}

function isDirectRoom(room) {
    const directMap = state.client?.getAccountData?.("m.direct")?.getContent?.() || {};
    const isMapped = Object.values(directMap).some((roomIds) => Array.isArray(roomIds) && roomIds.includes(room.roomId));
    if (isMapped) return true;

    const joined = room.getJoinedMembers?.() || [];
    const others = joined.filter((member) => member.userId !== state.session?.userId);
    return others.length === 1 && joined.length <= 2;
}

function getUnreadCount(room) {
    try {
        return room.getUnreadNotificationCount?.("total") ?? room.getUnreadNotificationCount?.() ?? 0;
    } catch {
        return 0;
    }
}

function getEventStatusLabel(event) {
    if (!event) return null;
    const status = event.status;
    if (!status) return null;
    const sending = sdk.EventStatus?.SENDING ?? "sending";
    const queued = sdk.EventStatus?.QUEUED ?? "queued";
    const notSent = sdk.EventStatus?.NOT_SENT ?? "not_sent";
    const cancelled = sdk.EventStatus?.CANCELLED ?? "cancelled";

    if (status === sending || status === queued) return { label: "sending", className: "sending" };
    if (status === notSent || status === cancelled) return { label: "failed", className: "failed" };
    return { label: "sent", className: "sent" };
}

async function getMediaSrc(mxcUrl, { forceDownload = false } = {}) {
    if (!state.client || !mxcUrl) return "#";
    const cacheKey = `${mxcUrl}:${forceDownload ? "download" : "view"}`;
    if (state.mediaCache.has(cacheKey)) return state.mediaCache.get(cacheKey);

    const httpUrl = state.client.mxcUrlToHttp(mxcUrl, undefined, undefined, undefined, false, true, true)
        || state.client.mxcUrlToHttp(mxcUrl)
        || "#";

    try {
        const response = await fetch(httpUrl, {
            headers: state.client.getAccessToken?.()
                ? { Authorization: `Bearer ${state.client.getAccessToken()}` }
                : undefined,
        });
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        state.mediaCache.set(cacheKey, objectUrl);
        return objectUrl;
    } catch {
        state.mediaCache.set(cacheKey, httpUrl);
        return httpUrl;
    }
}

async function getSecretStorageKey(opts) {
    if (!state.secretStorageKey?.privateKey) return null;
    const keys = Object.keys(opts?.keys || {});
    if (!keys.length) return null;

    const selectedKeyId = state.secretStorageKey.keyId && keys.includes(state.secretStorageKey.keyId)
        ? state.secretStorageKey.keyId
        : keys[0];

    return [selectedKeyId, state.secretStorageKey.privateKey];
}

function cacheSecretStorageKey(keyId, _keyInfo, key) {
    state.secretStorageKey = { keyId, privateKey: key };
    persistSecretStorageKey(state.secretStorageKey);
}

function persistSecretStorageKey(payload) {
    if (!payload?.privateKey) return;
    sessionStorage.setItem(SESSION_SECRET_STORAGE_KEY, JSON.stringify({
        keyId: payload.keyId || null,
        privateKey: bytesToBase64(payload.privateKey),
    }));
}

function loadSecretStorageKey() {
    try {
        const raw = sessionStorage.getItem(SESSION_SECRET_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return {
            keyId: parsed.keyId || null,
            privateKey: base64ToBytes(parsed.privateKey),
        };
    } catch {
        return null;
    }
}

function toggleInList(list, value) {
    const index = list.indexOf(value);
    if (index >= 0) list.splice(index, 1);
    else list.unshift(value);
}

function getActiveRoom() {
    return state.activeRoomId ? state.client?.getRoom(state.activeRoomId) || null : null;
}

function normalizeHomeserver(value) {
    if (!value) return "";
    try {
        const url = new URL(value);
        return url.origin;
    } catch {
        return "";
    }
}

function usernameToLocalpart(input) {
    return String(input).replace(/^@/, "").split(":")[0];
}

function formatTime(timestamp) {
    const date = new Date(Number(timestamp) || Date.now());
    return date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: !state.settings.use24HourTime,
    });
}

function formatDateLabel(timestamp) {
    return new Date(Number(timestamp) || Date.now()).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function initialsFromName(name = "?") {
    const clean = String(name).replace(/^[@#!]/, "").trim();
    if (!clean) return "?";
    const parts = clean.split(/[\s._:-]+/).filter(Boolean);
    return (parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || clean[0]?.toUpperCase() || "?");
}

function parseError(error) {
    if (!error) return "Неизвестная ошибка.";
    if (typeof error === "string") return error;
    if (error.errcode) return `${error.errcode}: ${error.message || "Ошибка Matrix API"}`;
    return error.message || String(error);
}

function showStatus(text, mode = "info", sticky = false) {
    refs.statusBanner.textContent = text;
    refs.statusBanner.classList.remove("hidden");
    refs.statusBanner.style.background = mode === "error" ? "rgba(58, 18, 18, 0.98)" : "var(--bg-elevated)";
    refs.statusBanner.style.borderColor = mode === "error" ? "rgba(255, 125, 119, 0.35)" : "var(--border)";
    refs.statusBanner.style.color = mode === "error" ? "#ffb0ab" : "var(--text-main)";
    clearTimeout(showStatus.timer);
    if (!sticky) showStatus.timer = setTimeout(() => refs.statusBanner.classList.add("hidden"), 3200);
}

function clearStatus() {
    clearTimeout(showStatus.timer);
    refs.statusBanner.classList.add("hidden");
}

function loadJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback ? structuredClone(fallback) : null;
        return fallback ? { ...structuredClone(fallback), ...JSON.parse(raw) } : JSON.parse(raw);
    } catch {
        return fallback ? structuredClone(fallback) : null;
    }
}

function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function bytesToBase64(uint8) {
    let binary = "";
    uint8.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
