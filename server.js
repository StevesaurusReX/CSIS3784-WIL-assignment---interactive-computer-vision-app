const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const { MAX_PLAYERS, MIN_PLAYERS } = require("./public/constants.json");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*",
  },
});

const symbols = [1, 2, 3, 4, 5, 6, 7, 8];
const guns = [
  { id: 9, name: "Pistol", damage: 10 },
  { id: 10, name: "Shotgun", damage: 20 },
  { id: 11, name: "Sniper", damage: 99 },
];
const powerUps = [
  { id: 12, name: "Health Pack", cost: 10 },
  { id: 13, name: "Invisibility", cost: 10 },
  { id: 14, name: "Score Multiplier", cost: 10 },
];

const SCORE_MULT_FACTOR = 2;
const TREASURE_VALUE = 50;
const TAG_TARGET = 12; // how many tags win the game

/*
PLAYER STRUCTURE:   
{
 *    id: string,
 *    name: string,
 *    leader: boolean,
 *    isReady: boolean,
 *    isSpectator: boolean,
 *    health: number,
 *    points: number,
 *    tags: number,
 *    gun: string,
 *    powerUp: string,
 *    symbol: number,
 *    isInvisible: boolean,
 * }
 */
let players = [];

/**
 * @type {"lobby" | "countdown" | "active" | "ended"}
 */
let gameState = "lobby";

function broadcastLive(event) {
  io.emit("live_event", event);
}

function endGame(winnerId) {
  if (gameState !== "active") return;
  gameState = "ended";

  const winner = players.find((p) => p.id === winnerId);

  // 1) Let everyone display the end screen & show who won
  io.emit("game_end", { winner, players });

  // 2) Tell just the winner to play victory music
  io.to(winnerId).emit("won_game");

  // 3) Tell everyone else to play loser music
  for (const [id, sock] of io.of("/").sockets) {
    if (id !== winnerId) {
      sock.emit("lost_game");
    }
  }

  // 4) Reset back to lobby after 5s

  setTimeout(() => {
    players = [];
    gameState = "lobby";
    io.emit("reset_game");
  }, 5000);
}

function checkEndConditions() {
  // 1) last one standing
  const alive = players.filter((p) => p.health > 0 && !p.isSpectator);
  if (alive.length === 1) {
    endGame(alive[0].id);
    return;
  }

  // 2) reached tag threshold
  const tagWinner = players.find((p) => p.tags >= TAG_TARGET && !p.isSpectator);
  if (tagWinner) {
    endGame(tagWinner.id);
  }
}

function rebalanceSymbols() {
  let idx = 0;
  for (const p of players) {
    if (!p.isSpectator) {
      p.symbol = symbols[idx++];
    } else {
      p.symbol = ""; // explicitly clear any leftover
    }
  }
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  socket.on("request_symbol", () => {
    const player = players.find((p) => p.id === socket.id);
    if (player) {
      socket.emit("your_symbol", { symbol: player.symbol });
    }
  });

  socket.on("send_emoji", ({ targetName, emoji }) => {
    const targetPlayer = players.find((p) => p.name === targetName);
    if (targetPlayer) {
      io.to(targetPlayer.id).emit("receive_emoji", emoji);
    }
  });

  socket.on("join_lobby", ({ name, type }) => {
    
    const isLeader = players.length === 0;
    // if a game is already running, force them into spectator mode
    const lateSpectator =
      gameState === "active" ||
      players.filter((p) => !p.isSpectator).length >= MAX_PLAYERS;

    const newPlayer = {
      id: socket.id,
      name,
      leader: isLeader,
      isReady: false,
      isSpectator: type === "spectator" ? true : lateSpectator,
      health: 100,
      hasScannedHealthPack: false,
      hasScannedInvisibility: false,
      hasScannedScoreMultiplier: false,
      hasScannedTreasure: false,
      points: 0,
      tags: 0,
      gun: guns[0],
      powerUp: "",
      // only non-spectators need a symbol
      symbol: "",
      isInvisible: false,
      isScoreMultActive: false,
    };
    players.push(newPlayer);
    rebalanceSymbols();
    if (gameState === "active") {
      // don’t re-open the lobby — just send them the “start_game” flow
      socket.emit("start_game", players);
      io.emit("player_update", players);
    } else {
      io.emit("lobby_update", players);
    }
  });

  socket.on("request_toggle_ready", () => {
    const player = players.find((p) => p.id === socket.id);
    if (!player) return;

    player.isReady = !player.isReady;
    io.emit("lobby_update", players);

    if (player.leader == true) {
      io.emit("display_start", players);
    }

    // Check if all players are ready
    const activePlayers = players.filter((p) => !p.isSpectator);
    const allReady =
      activePlayers.length >= MIN_PLAYERS &&
      activePlayers.every((p) => p.isReady);

    if (allReady) {
      io.emit("enable_start_btn");
    }
  });

  socket.on("trigger_start", () => {
    console.log("Game state: ", gameState);
    console.log("Players on start: ", players);
    if (gameState == "lobby") {
      gameState = "countdown";
      //TODO: Drop countdown
      let countdown = 3;

      const countdownInterval = setInterval(() => {
        io.emit("countdown", countdown);
        countdown--;

        if (countdown < 0) {
          clearInterval(countdownInterval);
          gameState = "active";
          io.emit("start_game", players);
          io.emit("player_update", players);
          if (typeof initializeDetection === "function") {
            initializeDetection();
          }
        }
      }, 1000);
    }
  });

  socket.on("disconnect", () => {
    // pull out the player who just left
    const disconnected = players.find((p) => p.id === socket.id);
    const wasLeader = disconnected?.leader;

    // remove them from the game
    players = players.filter((p) => p.id !== socket.id);

    if (gameState === "active") {
      // 1) notify everyone of the new player list
      io.emit("player_update", players);

      // 2) check if that disconnect leaves only one (or zero) players
      checkEndConditions();
    } else {
      // still in lobby or ended: behave as before
      if (wasLeader && players.length > 0) {
        players[0].leader = true;
      }
      io.emit("lobby_update", players);
    }
  });

  socket.on("shoot", (targetSymbol) => {
    if (gameState !== "active") return;

    const shooterId = socket.id;
    const shooter = players.find((p) => p.id == shooterId);
    const target = players.find((p) => p.symbol == targetSymbol);

    if (!shooter) {
      console.log("Shooter not defined: ", shooter, shooterId);
      return;
    }

    if (!target) {
      console.log("Target not defined: ", target);
      return;
    }

    if (!target.isInvisible) {
      target.health -= shooter.gun.damage;
      shooter.tags++;
      shooter.points += shooter.isScoreMultActive ? 10 * SCORE_MULT_FACTOR : 10;

      broadcastLive({
        type: "shot",
        shooter: shooter.name,
        target: target.name,
        weapon: shooter.gun.name,
        timestamp: Date.now(),
      });
    } else {
      io.to(socket.id).emit("notify_of_invisibility", target.name);
    }

    if (target.health <= 0) {
      io.to(target.id).emit("notify_of_death", {
        shooterName: shooter.name,
      });
      broadcastLive({
        type: "death",
        killer: shooter.name,
        victim: target.name,
        timestamp: Date.now(),
      });
    }

    io.emit("player_update", players);
    io.to(target.id).emit("notify_of_shot");
    checkEndConditions();
  });

  socket.on("powerUp", (targetSymbol) => {
    if (gameState !== "active") return;
    const shooterId = socket.id;
    const shooter = players.find((p) => p.id == shooterId);
    const powerUp = powerUps.find((pU) => pU.id === targetSymbol);

    if (!shooter) {
      console.log("Shooter not defined: ", shooter, shooterId);
      return;
    }

    if (!powerUp) {
      console.log("Power up not defined: ", powerUp);
      return;
    }

    if (shooter.powerUp) {
      console.log("Currently active power up");
      return;
    }

    if (shooter.points - powerUp.cost < 0) {
      io.to(shooterId).emit("notify_of_failed_purchase", {
        powerUpName: powerUp.name,
        powerUpCost: powerUp.cost,
      });
      return;
    }

    if (targetSymbol === 12) {
      // Health Pack
      if (shooter.hasScannedHealthPack) {
        io.to(socket.id).emit("notify_of_power_up_re_scan", powerUp.name);
        return;
      }
      shooter.health += 50;
      shooter.hasScannedHealthPack = true;
      shooter.powerUp = powerUp.name;
      shooter.points -= powerUp.cost;
      setTimeout(() => {
        shooter.powerUp = "";
        io.emit("player_update", players);
        // console.log("After invis: ", players);
      }, 3000);
    } else if (targetSymbol === 13) {
      // Invisibility
      if (shooter.hasScannedInvisibility) {
        io.to(socket.id).emit("notify_of_power_up_re_scan", powerUp.name);
        return;
      }
      shooter.isInvisible = true;
      shooter.hasScannedInvisibility = true;
      shooter.powerUp = powerUp.name;
      shooter.points -= powerUp.cost;
      setTimeout(() => {
        shooter.isInvisible = false;
        shooter.powerUp = "";
        io.emit("player_update", players);
        // console.log("After invis: ", players);
      }, 10000);
    } else if (targetSymbol === 14) {
      // Score multiplier
      if (shooter.hasScannedScoreMultiplier) {
        io.to(socket.id).emit("notify_of_power_up_re_scan", powerUp.name);
        return;
      }
      shooter.isScoreMultActive = true;
      shooter.hasScannedScoreMultiplier = true;
      shooter.powerUp = powerUp.name;
      shooter.points -= powerUp.cost;
      setTimeout(() => {
        shooter.isScoreMultActive = false;
        shooter.powerUp = "";
        io.emit("player_update", players);
      }, 10000);
    }

    io.to(shooterId).emit("notify_of_power_up");
    // console.log("After power up: ", players);
    io.emit("player_update", players);

    broadcastLive({
      type: "powerUp",
      player: shooter.name,
      powerUp: powerUp.name,
      timestamp: Date.now(),
    });
  });

  socket.on("treasure_found", () => {
    if (gameState !== "active") return;
    const shooterId = socket.id;
    const shooter = players.find((p) => p.id == shooterId);

    if (!shooter) {
      console.log("Shooter not defined: ", shooter);
      return;
    }

    if (!shooter.hasScannedTreasure) {
      shooter.points += TREASURE_VALUE;
      shooter.hasScannedTreasure = true;

      broadcastLive({
        type: "treasure",
        player: shooter.name,
        timestamp: Date.now(),
      });
    }

    io.to(shooterId).emit("notify_of_treasure");
    // console.log("After  treasure: ", players);
    io.emit("player_update", players);
  });

  socket.on("change_gun", (targetSymbol) => {
    if (gameState !== "active") return;
    const shooterId = socket.id;
    const shooter = players.find((p) => p.id == shooterId);

    if (!shooter) {
      console.log("Shooter not defined: ", shooter);
      return;
    }

    const gun = guns.find((g) => g.id == targetSymbol);
    shooter.gun = gun;

    io.to(shooterId).emit("notify_of_weapon_change");

    // console.log("After gun change: ", players);
    io.emit("player_update", players);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running on port 3000");
});