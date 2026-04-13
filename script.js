import * as sdk from "matrix-js-sdk";

const STORAGE_KEYS = { session: "ficus_matrix_session" };

const state = {
    client: null,
    session: null,
    authMode: "login",
    activeRoomId: null
};

const refs = {
    body: document.body,
    authScreen: document.getElementById("authScreen"),
    appShell: document.getElementById("appShell"),
    authForm: document.getElementById("authForm"),
    authTabs: Array.from(document.querySelectorAll(".auth-tab")),
    authHomeserver: document.getElementById("authHomeserver"),
    authUsername: document.getElementById("authUsername"),
    authPassword: document.getElementById("authPassword"),
    authSubmit: document.getElementById("authSubmit"),
    authError: document.getElementById("authError"),

    chatRoomsSection: document.getElementById("chatRoomsSection"),
    messageContainer: document.getElementById("messageContainer"),
    roomSearchInput: document.getElementById("roomSearchInput"),

    chatHeader: document.getElementById("chatHeader"),
    inputArea: document.getElementById("inputArea"),
    chatHeaderAvatar: document.getElementById("chatHeaderAvatar"),
    chatHeaderTitle: document.getElementById("chatHeaderTitle"),
    chatHeaderStatus: document.getElementById("chatHeaderStatus"),

    chatInput: document.getElementById("chatInput"),
    sendBtn: document.getElementById("sendBtn"),
    backBtn: document.getElementById("backBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    statusBanner: document.getElementById("statusBanner")
};

init();

async function init() {
    bindEvents();

    const session = loadJson(STORAGE_KEYS.session, null);
    if (session?.accessToken && session?.userId && session?.baseUrl) {
        // Мгновенный показ интерфейса со скелетонами (плавная подгрузка)
        switchScreen('app');
        renderSkeletons();

        try {
            await startSession(session);
        } catch (error) {
            clearSession();
            switchScreen('auth');
            showStatus(`Сессия устарела: ${error.message}`);
        }
    } else {
        switchScreen('auth');
    }
}

function bindEvents() {
    refs.authTabs.forEach(btn => btn.addEventListener("click", () => {
        state.authMode = btn.dataset.authMode;
        refs.authTabs.forEach(b => b.classList.toggle("active", b === btn));
        refs.authSubmit.textContent = state.authMode === "register" ? "Создать аккаунт" : "Войти";
    }));

    refs.authForm.addEventListener("submit", handleAuthSubmit);
    refs.roomSearchInput.addEventListener("input", renderRooms);
    refs.chatRoomsSection.addEventListener("click", handleRoomClick);
    refs.backBtn.addEventListener("click", () => refs.body.classList.remove("mobile-chat-active"));
    refs.logoutBtn.addEventListener("click", logout);

    refs.sendBtn.addEventListener("click", sendCurrentMessage);
    refs.chatInput.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCurrentMessage(); }
    });
    refs.chatInput.addEventListener("input", e => {
        e.currentTarget.style.height = "auto";
        e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 120)}px`;
    });
}

function switchScreen(screen) {
    if (screen === 'auth') {
        refs.appShell.classList.remove("active");
        setTimeout(() => refs.authScreen.classList.add("active"), 150);
    } else {
        refs.authScreen.classList.remove("active");
        setTimeout(() => refs.appShell.classList.add("active"), 150);
    }
}

function renderSkeletons() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 8; i++) {
        const div = document.createElement("div");
        div.className = "room-item";
        div.innerHTML = `
            <div class="room-avatar" style="background:transparent"><div class="skeleton-avatar-core"></div></div>
            <div class="room-main">
                <div class="skeleton-line w-52"></div>
                <div class="skeleton-line w-78"></div>
            </div>
        `;
        frag.appendChild(div);
    }
    refs.chatRoomsSection.innerHTML = "";
    refs.chatRoomsSection.appendChild(frag);
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    refs.authSubmit.disabled = true;
    refs.authSubmit.textContent = "Подключение...";
    refs.authError.classList.add("hidden");

    try {
        const baseUrl = new URL(refs.authHomeserver.value.trim()).origin;
        const user = refs.authUsername.value.trim().replace(/^@/, "").split(":")[0];
        const password = refs.authPassword.value;
        const tempClient = sdk.createClient({ baseUrl });

        let response;
        if (state.authMode === "register") {
            response = await tempClient.registerRequest({ username: user, password, initial_device_display_name: "Ficus Matrix" });
        } else {
            response = await tempClient.loginRequest({ type: "m.login.password", identifier: { type: "m.id.user", user }, password, initial_device_display_name: "Ficus Matrix" });
        }

        const session = { baseUrl, userId: response.user_id, accessToken: response.access_token, deviceId: response.device_id };
        saveJson(STORAGE_KEYS.session, session);

        switchScreen('app');
        renderSkeletons();
        await startSession(session);

    } catch (error) {
        refs.authError.textContent = error.message || "Ошибка подключения";
        refs.authError.classList.remove("hidden");
    } finally {
        refs.authSubmit.disabled = false;
        refs.authSubmit.textContent = state.authMode === "register" ? "Создать аккаунт" : "Войти";
    }
}

async function startSession(session) {
    if (state.client) state.client.stopClient();
    state.session = session;
    state.client = sdk.createClient({ ...session, timelineSupport: true });

    state.client.on("sync", (syncState) => {
        if (syncState === "PREPARED" || syncState === "SYNCING") {
            renderRooms();
            if (state.activeRoomId) renderChat();
        }
    });

    state.client.on("Room", () => { renderRooms(); renderChat(); });
    state.client.on("event", () => { renderRooms(); renderChat(); });

    await state.client.startClient({ initialSyncLimit: 30 });
}

function renderRooms() {
    if (!state.client) return;
    const query = refs.roomSearchInput.value.trim().toLowerCase();
    const rooms = state.client.getRooms()
        .filter(r => r.getMyMembership() === "join")
        .sort((a, b) => getRoomSortTimestamp(b) - getRoomSortTimestamp(a))
        .filter(r => getRoomName(r).toLowerCase().includes(query));

    // Используем Fragment для рендера без подвисаний
    const fragment = document.createDocumentFragment();

    rooms.forEach(room => {
        const lastMsg = getLastMessage(room);
        const item = document.createElement("div");
        item.className = `room-item ${room.roomId === state.activeRoomId ? "active" : ""}`;
        item.dataset.roomId = room.roomId;
        item.innerHTML = `
            <div class="room-avatar">${initials(getRoomName(room))}</div>
            <div class="room-main">
                <div class="room-top">
                    <div class="room-name">${escapeHtml(getRoomName(room))}</div>
                </div>
                <div class="room-preview">${escapeHtml(lastMsg)}</div>
            </div>
        `;
        fragment.appendChild(item);
    });

    refs.chatRoomsSection.innerHTML = "";
    refs.chatRoomsSection.appendChild(fragment);
}

function handleRoomClick(e) {
    const item = e.target.closest(".room-item");
    if (!item) return;

    state.activeRoomId = item.dataset.roomId;
    refs.body.classList.add("mobile-chat-active");

    refs.chatHeader.classList.remove("hidden");
    refs.inputArea.classList.remove("hidden");
    if (window.innerWidth <= 768) refs.backBtn.classList.remove("hidden");

    renderRooms();
    renderChat();
}

function renderChat() {
    const room = state.activeRoomId ? state.client?.getRoom(state.activeRoomId) : null;
    if (!room) return;

    refs.chatHeaderAvatar.textContent = initials(getRoomName(room));
    refs.chatHeaderTitle.textContent = getRoomName(room);
    refs.chatHeaderStatus.textContent = `${room.getJoinedMembers().length} участников`;

    const timeline = (room.timeline || []).filter(e => e.getType() === "m.room.message");

    // Рендер через Fragment
    const fragment = document.createDocumentFragment();
    let prevSender = null;

    timeline.forEach(event => {
        const sender = event.getSender();
        const isMine = sender === state.session.userId;
        const isCont = prevSender === sender;
        const content = event.getContent().body || "";

        const row = document.createElement("div");
        row.className = `msg-row ${isMine ? "mine" : ""} ${isCont ? "continuation" : ""}`;

        row.innerHTML = `
            ${!isMine ? `<div class="member-avatar ${isCont ? "spacer" : ""}">${initials(sender)}</div>` : ""}
            <div class="msg-bubble">
                ${!isMine && !isCont ? `<div class="msg-author">${escapeHtml(sender)}</div>` : ""}
                <div>${escapeHtml(content)}</div>
            </div>
        `;
        fragment.appendChild(row);
        prevSender = sender;
    });

    refs.messageContainer.innerHTML = "";
    refs.messageContainer.appendChild(fragment);
    refs.messageContainer.scrollTop = refs.messageContainer.scrollHeight;
}

async function sendCurrentMessage() {
    const text = refs.chatInput.value.trim();
    if (!text || !state.activeRoomId) return;

    refs.chatInput.value = "";
    refs.chatInput.style.height = "auto";

    await state.client.sendEvent(state.activeRoomId, "m.room.message", { msgtype: "m.text", body: text }, "");
}

function logout() {
    if (state.client) state.client.stopClient();
    clearSession();
    switchScreen('auth');
}

/* Utils */
function getRoomName(r) { return r?.name || r?.roomId || "Чат"; }
function getLastMessage(r) {
    const ev = [...(r?.timeline||[])].reverse().find(e => e.getType() === "m.room.message");
    return ev ? ev.getContent().body : "Нет сообщений";
}
function getRoomSortTimestamp(r) {
    const ev = [...(r?.timeline||[])].reverse().find(e => e.getType() === "m.room.message");
    return ev ? ev.getTs() : 0;
}
function initials(n) { return (n||"?").replace(/^[@#!]/,"").trim()[0]?.toUpperCase() || "?"; }
function escapeHtml(v) { return String(v||"").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function loadJson(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch { return f; } }
function saveJson(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function clearSession() { localStorage.removeItem(STORAGE_KEYS.session); state.session = null; }
function showStatus(t) {
    refs.statusBanner.textContent = t;
    refs.statusBanner.classList.remove("hidden");
    setTimeout(() => refs.statusBanner.classList.add("hidden"), 3000);
}