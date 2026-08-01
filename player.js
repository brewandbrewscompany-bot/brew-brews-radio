(() => {
  "use strict";
  const tracks = Array.isArray(window.BB_PLAYLIST) ? window.BB_PLAYLIST : [];
  const $ = (id) => document.getElementById(id);
  const audio = $("audio");
  const state = {
    index: 0,
    filter: "All",
    query: "",
    shuffle: false,
    repeat: "off",
    favorites: readStore("bb-favorites", []),
    recent: readStore("bb-recent", [])
  };
  let deferredInstall;

  function readStore(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be unavailable */ }
  }
  function asset(path) { return new URL(path, document.baseURI).href; }
  function formatTime(value) {
    if (!Number.isFinite(value)) return "0:00";
    const minutes = Math.floor(value / 60);
    return `${minutes}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
  }
  function icon(isPlaying) { return isPlaying ? "❚❚" : "▶"; }

  function renderFilters() {
    const genres = ["All", "Favorites", ...new Set(tracks.map((track) => track.genre))];
    $("genreFilters").replaceChildren(...genres.map((genre) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `filter${state.filter === genre ? " active" : ""}`;
      button.textContent = genre;
      button.setAttribute("aria-pressed", String(state.filter === genre));
      button.addEventListener("click", () => { state.filter = genre; renderFilters(); renderTracks(); });
      return button;
    }));
  }

  function visibleTracks() {
    const query = state.query.toLowerCase();
    return tracks.filter((track) => {
      const inGenre = state.filter === "All" || (state.filter === "Favorites" ? state.favorites.includes(track.id) : track.genre === state.filter);
      return inGenre && `${track.title} ${track.artist} ${track.genre}`.toLowerCase().includes(query);
    });
  }

  function trackButton(track, recent = false) {
    const button = document.createElement("button");
    button.type = "button";
    const current = tracks[state.index]?.id === track.id;
    button.className = recent ? "recent-item" : `track-card${current ? " is-current" : ""}`;
    button.setAttribute("aria-label", `${current && !audio.paused ? "Pause" : "Play"} ${track.title}`);
    button.innerHTML = recent
      ? `<img src="${asset(track.cover)}" alt=""><span><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.genre)}</span></span>`
      : `<img src="${asset(track.cover)}" alt="${escapeHtml(track.title)} cover" loading="lazy"><span class="track-card__play" aria-hidden="true">${current ? icon(!audio.paused) : "▶"}</span><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.genre)}</span>`;
    button.addEventListener("click", () => playTrack(tracks.findIndex((item) => item.id === track.id), current));
    return button;
  }
  function escapeHtml(text) {
    const div = document.createElement("div"); div.textContent = text; return div.innerHTML;
  }
  function renderTracks() {
    const filtered = visibleTracks();
    $("trackList").replaceChildren(...filtered.map((track) => trackButton(track)));
    $("emptyState").hidden = filtered.length > 0;
  }
  function renderRecent() {
    const recentTracks = state.recent.map((id) => tracks.find((track) => track.id === id)).filter(Boolean).slice(0, 5);
    $("recentSection").hidden = recentTracks.length === 0;
    $("recentList").replaceChildren(...recentTracks.map((track) => trackButton(track, true)));
  }

  function loadTrack(index, autoplay = false) {
    if (!tracks.length) return;
    state.index = (index + tracks.length) % tracks.length;
    const track = tracks[state.index];
    audio.src = asset(track.audio);
    $("playerCover").src = asset(track.cover);
    $("playerTitle").textContent = track.title;
    $("playerArtist").textContent = track.artist;
    $("progress").value = 0;
    $("currentTime").textContent = "0:00";
    $("duration").textContent = "0:00";
    updateFavorite();
    updateMediaSession(track);
    renderTracks();
    if (autoplay) audio.play().catch(() => updatePlayUI());
  }
  function playTrack(index, toggleIfCurrent = false) {
    if (toggleIfCurrent && index === state.index) return togglePlay();
    loadTrack(index, true);
  }
  function togglePlay() {
    if (!audio.src) loadTrack(state.index);
    if (audio.paused) audio.play().catch(() => updatePlayUI()); else audio.pause();
  }
  function next(manual = false) {
    if (!manual && state.repeat === "one") { audio.currentTime = 0; return audio.play(); }
    const nextIndex = state.shuffle && tracks.length > 1
      ? pickDifferentIndex()
      : state.index + 1;
    if (!manual && state.repeat === "off" && nextIndex >= tracks.length) { audio.currentTime = 0; return updatePlayUI(); }
    loadTrack(nextIndex, true);
  }
  function previous() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    loadTrack(state.index - 1, true);
  }
  function pickDifferentIndex() {
    let index = state.index;
    while (index === state.index) index = Math.floor(Math.random() * tracks.length);
    return index;
  }
  function updatePlayUI() {
    const playing = !audio.paused;
    $("playButton").textContent = icon(playing);
    $("playButton").setAttribute("aria-label", playing ? "Pause" : "Play");
    $("heroPlay").innerHTML = `<span aria-hidden="true">${icon(playing)}</span> ${playing ? "Pause radio" : "Start listening"}`;
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    renderTracks();
  }
  function addRecent() {
    const id = tracks[state.index]?.id;
    state.recent = [id, ...state.recent.filter((item) => item !== id)].slice(0, 5);
    writeStore("bb-recent", state.recent); renderRecent();
  }
  function toggleFavorite() {
    const id = tracks[state.index].id;
    state.favorites = state.favorites.includes(id) ? state.favorites.filter((item) => item !== id) : [id, ...state.favorites];
    writeStore("bb-favorites", state.favorites); updateFavorite(); renderTracks();
  }
  function updateFavorite() {
    const favorite = state.favorites.includes(tracks[state.index]?.id);
    $("favoriteButton").textContent = favorite ? "♥" : "♡";
    $("favoriteButton").classList.toggle("active", favorite);
    $("favoriteButton").setAttribute("aria-pressed", String(favorite));
    $("favoriteButton").setAttribute("aria-label", favorite ? "Remove from favorites" : "Add to favorites");
  }
  function cycleRepeat() {
    state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
    const button = $("repeatButton");
    button.classList.toggle("active", state.repeat !== "off");
    button.textContent = state.repeat === "one" ? "↻¹" : "↻";
    button.setAttribute("aria-label", `Repeat ${state.repeat}`);
    button.setAttribute("aria-pressed", String(state.repeat !== "off"));
  }
  function updateMediaSession(track) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title, artist: track.artist, album: "Brew & Brews Radio",
      artwork: [{ src: asset(track.cover), sizes: "512x512" }]
    });
  }
  function setupMediaActions() {
    if (!("mediaSession" in navigator)) return;
    const actions = { play: () => audio.play(), pause: () => audio.pause(), previoustrack: previous, nexttrack: () => next(true), seekbackward: (e) => audio.currentTime = Math.max(0, audio.currentTime - (e.seekOffset || 10)), seekforward: (e) => audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + (e.seekOffset || 10)), seekto: (e) => { if (e.seekTime != null) audio.currentTime = e.seekTime; } };
    Object.entries(actions).forEach(([action, handler]) => { try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported action */ } });
  }

  $("searchInput").addEventListener("input", (event) => { state.query = event.target.value.trim(); renderTracks(); });
  $("heroPlay").addEventListener("click", togglePlay);
  $("playButton").addEventListener("click", togglePlay);
  $("previousButton").addEventListener("click", previous);
  $("nextButton").addEventListener("click", () => next(true));
  $("favoriteButton").addEventListener("click", toggleFavorite);
  $("shuffleButton").addEventListener("click", () => { state.shuffle = !state.shuffle; $("shuffleButton").classList.toggle("active", state.shuffle); $("shuffleButton").setAttribute("aria-pressed", String(state.shuffle)); });
  $("repeatButton").addEventListener("click", cycleRepeat);
  $("progress").addEventListener("input", (event) => { if (audio.duration) audio.currentTime = (event.target.value / 100) * audio.duration; });
  $("volume").addEventListener("input", (event) => { audio.volume = Number(event.target.value); audio.muted = false; });
  $("muteButton").addEventListener("click", () => { audio.muted = !audio.muted; $("muteButton").classList.toggle("active", audio.muted); $("muteButton").setAttribute("aria-label", audio.muted ? "Unmute" : "Mute"); });
  audio.addEventListener("play", () => { addRecent(); updatePlayUI(); });
  audio.addEventListener("pause", updatePlayUI);
  audio.addEventListener("ended", () => next(false));
  audio.addEventListener("loadedmetadata", () => $("duration").textContent = formatTime(audio.duration));
  audio.addEventListener("timeupdate", () => {
    $("currentTime").textContent = formatTime(audio.currentTime);
    $("progress").value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    if ("mediaSession" in navigator && audio.duration && Number.isFinite(audio.duration)) {
      try { navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: Math.min(audio.currentTime, audio.duration) }); } catch { /* browser limitation */ }
    }
  });
  audio.volume = Number($("volume").value);

  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredInstall = event; $("installButton").hidden = false; });
  $("installButton").addEventListener("click", async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $("installButton").hidden = true; });
  window.addEventListener("appinstalled", () => { deferredInstall = null; $("installButton").hidden = true; });
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));

  renderFilters(); renderRecent(); setupMediaActions(); loadTrack(0);
})();
