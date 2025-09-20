const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;
let socket = io();
let hasJoined = false;
let currentPlayerName = null;
let playerNames = [];

// Debug socket connection
socket.on('connect', () => {
  console.log('🔌 Socket connected with ID:', socket.id);
  if (typeof updateDebugInfo === 'function') {
    updateDebugInfo('playerid', socket.id);
  }
});

socket.on('disconnect', () => {
  console.log('🔌 Socket disconnected');
  if (typeof updateDebugInfo === 'function') {
    updateDebugInfo('playerid', 'disconnected');
  }
});

// Stub functions to prevent errors
function playMusic(type) {
  console.log("Would play music:", type);
}

function stopMusic(type) {
  console.log("Would stop music:", type);
}

window.addEventListener("beforeunload", () => {
  socket.disconnect();
});

socket.on("lobby_update", (players) => {
  if (players.length) {
    displayReadySection(players);
    updatePlayerList(players);
    updateSpectatorList(players);
    updateStats(players);
    updateLobbyStatus(players);
    updateReadyButton(players);
    playerNames = players.map((p) => p.name);
    if (players.filter((p) => !p.isSpectator).length >= MAX_PLAYERS) {
      const joinAsPlayerBtn = document.querySelector(".join-btn");
      joinAsPlayerBtn.disabled = true;
    }
  }
});

socket.on("display_start", (players) => {
  const currentPlayer = getCurrentPlayer(players);

  if (currentPlayer && currentPlayer.leader == true) {
    document.querySelector(".start-btn").style.display = "flex";
  }
});

socket.on("enable_start_btn", () => {
  const btn = document.querySelector(".start-btn");
  if (btn) {
    btn.disabled = false;
    btn.style.background = "linear-gradient(45deg, #00ff88, #00cc6a)";
  }
});

socket.on("countdown", (seconds) => {
  console.log("Countdown:", seconds);
  document.getElementById(
    "lobby-status"
  ).textContent = `Game starting in ${seconds}...`;
});

socket.on("start_game", (players) => {
  console.log("🚨 CRITICAL: start_game event received");
  console.log("My socket.id:", socket.id);
  console.log("Players received:", players);
  console.log("Players IDs:", players.map(p => p.id));
  
  const current = getCurrentPlayer(players);
  console.log("Current player found:", current);
  
  if (!current) {
    console.error("❌ CRITICAL: Current player not found! Socket ID doesn't match any player.");
    console.error("My socket.id:", socket.id);
    console.error("Available player IDs:", players.map(p => p.id));
    return;
  }

  // Update debug info
  if (typeof updateDebugInfo === 'function') {
    updateDebugInfo('gamestate', 'starting');
  }

  try {
    stopMusic("lobby");
  } catch (e) {
    console.warn("Music function failed:", e);
  }
  
  // Hide lobby UI
  const lobbyView = document.querySelector(".lobby-view");
  console.log("Lobby view element found:", !!lobbyView);
  if (lobbyView) {
    lobbyView.style.display = "none";
    console.log("✅ Lobby view hidden");
  } else {
    console.error("❌ Lobby view element not found!");
  }

  // Show correct view
  if (current.isSpectator) {
    console.log("👁️ Showing spectator view");
    const spectatorView = document.querySelector(".spectator-view");
    console.log("Spectator view element found:", !!spectatorView);
    
    if (spectatorView) {
      spectatorView.style.display = "block";
      console.log("✅ Spectator view display set to block");
      
      // Force repaint
      spectatorView.offsetHeight;
      
      const computedStyle = window.getComputedStyle(spectatorView);
      console.log("Spectator view computed display:", computedStyle.display);
      console.log("Spectator view computed visibility:", computedStyle.visibility);
      console.log("Spectator view computed opacity:", computedStyle.opacity);
    } else {
      console.error("❌ Spectator view element not found!");
    }
  } else {
    console.log("🎯 Showing player view");
    const playerView = document.querySelector(".player-view");
    console.log("Player view element found:", !!playerView);
    
    if (playerView) {
      playerView.style.display = "flex";
      console.log("✅ Player view display set to flex");
      
      // Force repaint
      playerView.offsetHeight;
      
      const computedStyle = window.getComputedStyle(playerView);
      console.log("Player view computed display:", computedStyle.display);
      console.log("Player view computed visibility:", computedStyle.visibility);
      console.log("Player view computed opacity:", computedStyle.opacity);
      
      // Check for CSS overrides
      console.log("Player view inline style:", playerView.style.cssText);
      console.log("Player view class list:", playerView.classList.toString());
      
      // Try forcing with !important
      playerView.style.setProperty('display', 'flex', 'important');
      console.log("Forced display with !important");
      
      const finalComputedStyle = window.getComputedStyle(playerView);
      console.log("Player view FINAL computed display:", finalComputedStyle.display);
      
    } else {
      console.error("❌ Player view element not found!");
    }
    
    // Skip detection initialization for debugging
    console.log("⏸️ Skipping detection initialization for debugging");
  }
  
  console.log("🏁 start_game event processing complete");
});

function getCurrentPlayer(players) {
  const found = players.find((p) => p.id === socket.id);
  console.log("getCurrentPlayer - socket.id:", socket.id, "found:", !!found);
  return found;
}

function displayReadySection(players) {
  const current = getCurrentPlayer(players);
  const readySection = document.querySelector(".ready-section");
  if (current && !current.isSpectator && readySection) {
    readySection.style.display = "flex";
  } else if (readySection) {
    readySection.style.display = "none";
  }
}

function joinLobby(type) {
  if (hasJoined) return;

  const nameInput = document.getElementById("name");
  const name = nameInput.value.trim();
  if (!name) return alert("Enter a name!");
  if (playerNames.find((n) => n.toLowerCase() === name.toLowerCase()))
    return alert("Name taken");

  console.log("Joining lobby with socket.id:", socket.id);
  currentPlayerName = name;
  socket.emit("join_lobby", { name, type });
  hasJoined = true;

  document.querySelector(".join-section").style.display = "none";

  try {
    playMusic("lobby");
  } catch (e) {
    console.warn("Music function failed:", e);
  }
}

function updatePlayerList(players) {
  const list = document.getElementById("players-list");
  if (!list) return;
  
  list.innerHTML = "";

  players
    .filter((p) => p.isSpectator == false)
    .forEach((player) => {
      const li = document.createElement("li");
      const isCurrent = player.name === currentPlayerName;
      li.innerHTML = `
      <div class="player-info">
        <span class="player-name">${player.name}</span>
        <div>
          ${player.leader ? "👑" : ""}
          ${isCurrent ? '<span class="you-indicator">(You)</span>' : ""}
        </div>
      </div>
    `;

      if (isCurrent) {
        li.classList.add("current-player");
      }

      list.appendChild(li);
    });
}

function updateSpectatorList(players) {
  const list = document.getElementById("spectators-list");
  if (!list) return;
  
  list.innerHTML = "";

  players
    .filter((p) => p.isSpectator == true)
    .forEach((player) => {
      const li = document.createElement("li");
      const isCurrent = player.name === currentPlayerName;

      li.innerHTML = `
      <div class="player-info">
        <span class="player-name">${player.name}</span>
        <div>
           ${isCurrent ? '<span class="you-indicator">(You)</span>' : ""}
        </div>
      </div>
    `;

      if (isCurrent) {
        li.classList.add("current-player");
      }

      list.appendChild(li);
    });
}

function updateStats(players) {
  const playerCountEl = document.getElementById("player-count");
  const spectatorCountEl = document.getElementById("spectator-count");
  const readyCountEl = document.getElementById("ready-count");
  
  if (playerCountEl) {
    playerCountEl.textContent = `${
      players.filter((item) => item.isSpectator == false).length
    } / ${MAX_PLAYERS}`;
  }
  
  if (spectatorCountEl) {
    spectatorCountEl.textContent = `${
      players.filter((item) => item.isSpectator == true).length
    }`;
  }
  
  if (readyCountEl) {
    const readyCount = players.filter((p) => p.isReady == true).length;
    readyCountEl.textContent = readyCount;
  }
}

function updateLobbyStatus(players) {
  const statusEl = document.getElementById("lobby-status");
  if (!statusEl) return;
  
  const readyPlayers = players.filter((p) => p.isReady == true).length;
  const participants = players.filter((p) => !p.isSpectator).length;

  if (participants === 0) {
    statusEl.textContent = "Waiting...";
  } else if (readyPlayers === participants && participants >= 2) {
    statusEl.textContent = "Ready to Start!";
    const readyBtn = document.querySelector(".ready-btn");
    if (readyBtn) {
      readyBtn.disabled = true;
      readyBtn.style.setProperty("background", "grey", "important");
    }
  } else {
    statusEl.textContent = `${readyPlayers}/${participants} Players Ready`;
  }
}

function updateReadyButton(players) {
  const current = getCurrentPlayer(players);
  const button = document.querySelector(".ready-btn");
  if (current && !current.isSpectator && button) {
    button.innerText = current.isReady ? "Unready" : "Ready up";
  }
}

function toggleReady() {
  socket.emit("request_toggle_ready");
}

function triggerStart() {
  socket.emit("trigger_start");
  const btn = document.querySelector(".start-btn");
  if (btn) {
    btn.disabled = true;
    btn.style.background = "blue";
  }
}