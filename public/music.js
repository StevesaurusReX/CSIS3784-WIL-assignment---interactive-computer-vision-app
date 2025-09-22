// preload & configure your music
const music = {
  lobby: new Audio("/assets/sounds/lobby.mp3"),
  // you could add menu, victoryTheme, etc.
};

music.lobby.loop = true;
music.lobby.volume = 0.01; // low lobby volume

function playMusic(name) {
  const track = music[name];
  if (!track) return;
  track.currentTime = 0;
  track.play().catch(console.warn);
}

function stopMusic(name) {
  const track = music[name];
  if (track) {
    track.pause();
    track.currentTime = 0;
  }
}