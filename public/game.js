// how many entries to keep
const MAX_FEED = 30;

socket.on("live_event", (e) => {
  const ul = document.getElementById("live-feed-list");
  if (!ul) return;

  let text;
  switch (e.type) {
    case "shot":
      text = `💥 ${e.shooter} shot ${e.target} with ${e.weapon}`;
      break;
    case "powerUp":
      text = `✨ ${e.player} picked up ${e.powerUp}`;
      break;
    case "treasure":
      text = `🎉 ${e.player} found treasure`;
      break;
    case "death":
      text = `☠️ ${e.killer} eliminated ${e.victim}`;
      break;
    default:
      text = `${e.type} event`;
  }

  const li = document.createElement("li");
  li.textContent = text;
  ul.prepend(li);

  // prune old entries
  while (ul.children.length > MAX_FEED) {
    ul.removeChild(ul.lastChild);
  }
});


   socket.on("start_game", (players) => {
     const current = getCurrentPlayer(players);
     if (!current.isSpectator) {
       setTimeout(() => {
         if (typeof initializeDetection === "function") {
           initializeDetection();
         }
       }, 200);
     }
   });
socket.on("notify_of_invisibility", (targetName) => {
  const toast = document.querySelector(".toast-notification");
  toast.innerText = `${targetName} is invisible`;
  toast.style.display = "flex";
  setTimeout(() => {
    toast.style.display = "none";
  }, 5000);
});

socket.on("reset_game", () => {
  window.location.reload();
});

socket.on("notify_of_shot", () => {
  console.log("You've been shot");

  // vibrate if supported
  if ("vibrate" in navigator) {
    navigator.vibrate(200);
  } else {
    console.warn("Vibration API not supported");
  }
});

socket.on("notify_of_death", ({ shooterName }) => {
  document.querySelector(".player-view").style.display = "none";

  const deathDiv = document.querySelector(".death-screen");
  deathDiv.style.display = "flex";
  const deathText = document.querySelector(".death-screen-text");
  deathText.innerText = `Killed by ${shooterName}`;
});

socket.on("notify_of_failed_purchase", ({ powerUpName, powerUpCost }) => {
  const toast = document.querySelector(".toast-notification");
  toast.innerText = `You're broke. ${powerUpName.toUpperCase()} costs 💰 ${powerUpCost}`;
  toast.style.display = "flex";

  setTimeout(() => {
    toast.style.display = "none";
  }, 5000);
});

socket.on("notify_of_power_up_re_scan", (powerUpName) => {
  const toast = document.querySelector(".toast-notification");
  toast.innerText = `You can't get ${powerUpName.toUpperCase()} twice`;
  toast.style.display = "flex";

  setTimeout(() => {
    toast.style.display = "none";
  }, 5000);
});

socket.on("receive_emoji", (emoji) => {
  const toast = document.querySelector(".toast-notification");
  toast.innerText = emoji;
  toast.style.display = "flex";
  toast.classList.add("toast-notification-emoji");

  setTimeout(() => {
    toast.style.display = "none";
    toast.classList.remove("toast-notification-emoji");
    toast.innerText = ""; // clear it after
  }, 5000);
});

socket.on("player_update", (players) => {
  console.log("From Player Update: ", players);
  updateRankings(players);
  updateHealth(players);
  updateItems(players);
  updateScore(players);
  updateSpectatorLeaderboard(players);
});

function updateSpectatorLeaderboard(players) {
  if (!players || players.length === 0) return;

  const sorted = [...players].sort((a, b) => b.tags - a.tags); // Sort by tags
  //   const leader = sorted[0];
  //   const others = sorted.slice(1);

  //   updateLeaderCard(leader);
  updateLeaderboardList(sorted);
  updateSpectatorStats(players);
}

// function updateLeaderCard(player) {
//   const container = document.getElementById("leader-card");
//   if (!container) return;

//   console.log("player.points: ", player.points);
//   console.log("player.powerUp.name: ", player.powerUp);

//   container.innerHTML = `
//     <ul class="leader-list">
//       <li>
//         <span>#</span><span>Name</span><span>Tags</span>
//         <span>Points</span><span>Weapon</span><span>PowerUp</span>
//       </li>
//       <li>
//         <span>1</span>
//         <span>${player.name}</span>
//         <span>${player.tags}</span>
//         <span>${player.points}</span>
//         <span>${player.gun.name}</span>
//         <span>${player.powerUp || "-"}</span>
//         <span><button onclick="sendEmoji('${
//           player.name
//         }', '❤️')">❤️</button></span>
//       </li>
//     </ul>`;
// }

function updateLeaderboardList(players) {
  const container = document.querySelector(".leaderboard-list");
  if (!container) return;

  container.innerHTML = `
    <li>
      <span>#</span><span>Name</span><span>Tags</span>
      <span>Points</span><span>Weapon</span><span>PowerUp</span><span>Health</span>
    </li>`;

  const active_players = players.filter((p) => !p.isSpectator);

  active_players.forEach((player, idx) => {
    const li = document.createElement("li");
    if (player.health <= 0) li.classList.add("eliminated");

    if (idx === 0) {
      li.classList.add("leader-spotlight");
    }

    li.innerHTML = `
      <span>${
        idx + 1 == 1
          ? "🥇"
          : idx + 1 == 2
          ? "🥈"
          : idx + 1 == 3
          ? "🥉"
          : idx + 1
      }</span>
      <span>${player.name}</span>
      <span>${player.tags}</span>
      <span>${player.points}</span>
      <span>${player.gun.name}</span>
      <span>${player.powerUp || "-"}</span>
      <span>${player.health}/100</span>
      <span><button onclick="sendEmoji('${
        player.name
      }', '❤️')">❤️</button></span>
    `;
    container.appendChild(li);
  });
}

function updateSpectatorStats(players) {
  document.getElementById("total-tags").textContent = players.reduce(
    (sum, p) => sum + p.tags,
    0
  );

  const active_players = players.filter((p) => !p.isSpectator);
  document.getElementById("active-players").textContent = active_players.filter(
    (p) => p.health > 0
  ).length;
  document.getElementById("eliminated-players").textContent =
    active_players.filter((p) => p.health <= 0).length;
  const titleElement = document.getElementById("spectator-title");
  if (titleElement) {
    const spectatorCount = players.filter((p) => p.isSpectator).length;
    titleElement.innerHTML =
      spectatorCount == 1
        ? `👁️ Spectator View <span id="spectator-count">(${spectatorCount} person watching)</span>`
        : `👁️ Spectator View <span id="spectator-count">(${spectatorCount} people watching)</span>`;
  }
}

socket.on("game_end", ({ winner, players }) => {
  document.querySelector(".player-view").style.display = "none";
  document.querySelector(".spectator-view").style.display = "none";
  document.querySelector(".lobby-view").style.display = "none";

  const deathDiv = document.querySelector(".death-screen");
  if (deathDiv) {
    deathDiv.style.display = "none";
  }

  const endDiv = document.querySelector(".end-screen");
  const endText = document.querySelector(".end-screen-text");
  const countdownText = document.querySelector(".countdown-text");

  endText.innerText =
    winner.id === socket.id ? "🏆 You win!" : `🏆 ${winner.name} wins!`;

  let secondsRemaining = 5;
  countdownText.innerText = `Returning to lobby in ${secondsRemaining}…`;
  endDiv.style.display = "flex";

  const intervalId = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining > 0) {
      countdownText.innerText = `Returning to lobby in ${secondsRemaining}…`;
    } else {
      clearInterval(intervalId);
    }
  }, 1000);
});
function updateRankings(players) {
  const list = document.querySelector(".rank-list");
  if (list) {
    list.innerHTML = "";

    const current = getCurrentPlayer(players);
    players.sort((p1, p2) => p2.tags - p1.tags);
    const top5 = players.filter((p) => !p.isSpectator).slice(0, 5);

    const headerLi = document.createElement("li");

    headerLi.innerHTML = `
        <span>#</span>
        <span>Name</span>
        <span>Tags</span>`;
    list.appendChild(headerLi);

    top5.forEach((item, idx) => {
      const li = document.createElement("li");

      li.innerHTML = `
        <span class="">${idx + 1}</span>
        <span>${item.name}</span>
        <span>${item.tags}</span>
    `;

      const isCurrent = current.name === item.name;

      if (isCurrent) {
        li.classList.add("rank-you-indicator");
      }

      list.appendChild(li);
    });
  }
}

function updateHealth(players) {
  const healthFillSpan = document.querySelector(".health-fill");
  const healthAmountSpan = document.querySelector(".health-amount");
  if (!healthFillSpan || !healthAmountSpan) return;

  const current = getCurrentPlayer(players);
  if (socket.id !== current.id) return;

  // 1) update the bar
  healthFillSpan.style.width = `${current.health}%`;
  healthAmountSpan.innerText = `${current.health}/100`;

  // 2) toggle the low-health pulse
  if (current.health <= 20) {
    healthFillSpan.classList.add("low-health");
  } else {
    healthFillSpan.classList.remove("low-health");
  }
}

function updateItems(players) {
  const weaponSpan = document.querySelector(".weapon");
  const weaponIcon = document.querySelector(".weapon-icon");
  const powerUpSpan = document.querySelector(".powerUp");
  const powerUpIcon = document.querySelector(".powerUp-icon");

  const powerUpIcons = [
    {
      name: "invisibility",
      icon: "🫥",
    },
    {
      name: "health pack",
      icon: "❤️‍🩹",
    },
    {
      name: "score multiplier",
      icon: "📈",
    },
  ];

  if (weaponSpan && powerUpSpan) {
    const current = getCurrentPlayer(players);
    if (socket.id === current.id) {
      weaponSpan.innerText = `${current.gun.name.toUpperCase()}`;
      weaponIcon.src = `./assets/images/${current.gun.name.toLowerCase()}.png`;

      updateReticleForGun(current.gun.name);

      if (current.powerUp) {
        powerUpSpan.innerText =
          current.powerUp.toLowerCase() === "score multiplier"
            ? `score x2`
            : `${current.powerUp.toUpperCase()}`;
        powerUpIcon.innerText = powerUpIcons.filter(
          (pI) => pI.name.toLowerCase() === current.powerUp.toLowerCase()
        )[0].icon;
      } else {
        powerUpSpan.innerText = "";
        powerUpIcon.innerText = "";
      }
    }
  }
}

function updateScore(players) {
  const scoreAmountSpan = document.querySelector(".score-amount");

  if (scoreAmountSpan) {
    const current = getCurrentPlayer(players);
    if (socket.id === current.id) {
      scoreAmountSpan.innerText = `💰 ${current.points}`;
    }
  }
}

function updateReticleForGun(gunName) {
  const ret = document.querySelector(".reticle");
  if (!ret) return;
  // clear previous weapon class, then add the new one
  ret.className = "reticle " + gunName.toLowerCase();
}

function getCurrentPlayer(players) {
  const current = players.find((p) => p.id === socket.id);
  return current;
}

function shootPlayer(targetSymbol) {
  socket.emit("shoot", targetSymbol);
}

function powerUp(targetSymbol) {
  socket.emit("powerUp", targetSymbol);
}

function findTreasure() {
  socket.emit("treasure_found");
}

function changeGun(targetSymbol) {
  socket.emit("change_gun", targetSymbol);
}

function sendEmoji(targetName, emoji) {
  socket.emit("send_emoji", { targetName, emoji });
}

window.shootPlayer = shootPlayer;
window.powerUp = powerUp;
window.findTreasure = findTreasure;
window.changeGun = changeGun;
const toggle = document.querySelector(".rules-toggle");
const list = document.querySelector(".rules-list");
const arrow = toggle.querySelector(".arrow");

toggle.addEventListener("click", () => {
  const isCollapsed = list.classList.toggle("collapsed");
  // adjust arrow
  arrow.textContent = isCollapsed ? "▸" : "▾";
});