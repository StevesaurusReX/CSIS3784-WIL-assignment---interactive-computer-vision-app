// 1) Map of all your sound URLs
const soundFiles = {
  pistol: "/assets/sounds/laser-pistol.mp3",
  shotgun: "/assets/sounds/laser-shotgun.mp3",
  sniper: "/assets/sounds/laser-sniper.mp3",
  holster: "/assets/sounds/holster.mp3",
  hit: "/assets/sounds/hit.mp3",
  death: "/assets/sounds/death-sound.mp3",
  fail: "/assets/sounds/fail.mp3",
  powerUp: "/assets/sounds/powerUp.mp3",
  victory: "/assets/sounds/victory.mp3",
  lostGame: "/assets/sounds/game-over.mp3",
  treasure: "/assets/sounds/treasure.mp3",
  lobby: "/assets/sounds/lobby.mp3",
};

// 2) Preload one Audio element per sound
const sounds = {};
for (let [name, url] of Object.entries(soundFiles)) {
  const a = new Audio(url);
  a.preload = "auto";
  sounds[name] = a;
}

if (sounds.lobby) {
  sounds.lobby.loop = true; // keep it looping
  sounds.lobby.volume = 0.05; // 30% volume, feel free to tweak
}

// 3) Universal play function
function play(name) {
  const a = sounds[name];
  if (!a) return console.warn(`No sound for "${name}"`);
  a.currentTime = 0; // rewind to start
  a.play().catch(console.warn);
}

// 4) Hook up your shoot button
document.getElementById("shutterBtn").addEventListener("click", () => {
  const cls = Array.from(document.querySelector(".reticle")?.classList || []);
  const gun =
    cls.find((c) => ["pistol", "shotgun", "sniper"].includes(c)) || "pistol";
  play(gun);
});

// 5) Hook up all your socket events the same way
socket.on("notify_of_shot", () => play("hit"));
socket.on("notify_of_death", () => play("death"));
socket.on("notify_of_weapon_change", () => play("holster"));
socket.on("notify_of_power_up", () => play("powerUp"));
socket.on("notify_of_failed_purchase", () => play("fail"));
socket.on("notify_of_invisibility", () => play("fail"));
socket.on("notify_of_power_up_re_scan", () => play("fail"));
socket.on("lost_game", () => play("lostGame"));
socket.on("won_game", () => play("victory"));
socket.on("notify_of_treasure", () => play("treasure"));