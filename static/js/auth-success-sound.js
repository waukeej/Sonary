document.addEventListener("DOMContentLoaded", () => {
  const pendingKey = "sonary-auth-sound-pending";
  const playedKey = "sonary-auth-sound-played";

  if (sessionStorage.getItem(pendingKey) !== "1") return;
  sessionStorage.removeItem(pendingKey);
  if (sessionStorage.getItem(playedKey) === "1") return;

  const sound = new Audio("/static/audio/welcome-login.wav");
  sound.volume = 0.42;
  sound
    .play()
    .then(() => sessionStorage.setItem(playedKey, "1"))
    .catch(() => sessionStorage.removeItem(playedKey));
});
