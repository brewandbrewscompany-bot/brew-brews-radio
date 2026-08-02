(() => {
  const tracks = window.BB_PLAYLIST || [];
  const $ = id => document.getElementById(id);
  const audio = $("audio");

  let current = Number(localStorage.getItem("bbCurrentTrack") || 0);
  if (!tracks[current]) current = 0;

  let genre = "All";
  let shuffle = localStorage.getItem("bbShuffle") === "true";
  let repeat = localStorage.getItem("bbRepeat") === "true";
  let restore = Number(localStorage.getItem("bbPosition") || 0);

  const favorites = new Set(
    JSON.parse(localStorage.getItem("bbFavorites") || "[]")
  );

  const ids = [
    "miniCover","miniTitle","miniArtist","miniFavorite",
    "miniProgress","miniCurrent","miniDuration",
    "playBtn","prevBtn","nextBtn",
    "fullPlayer","fullBackdrop","closeFullPlayer",
    "fullCover","fullTitle","fullArtist","fullProgress",
    "fullCurrent","fullDuration","fullPlay","fullPrev",
    "fullNext","fullShuffle","fullRepeat","fullFavorite",
    "heroPlayBtn","searchInput","genreFilters","trackGrid",
    "openFullPlayer","songCount"
  ];

  const e = {};
  ids.forEach(id => e[id] = $(id));

  function formatTime(seconds){
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60).toString().padStart(2,"0");
    return `${minutes}:${remaining}`;
  }

  function saveFavorites(){
    localStorage.setItem("bbFavorites",JSON.stringify([...favorites]));
  }

  function updateControls(){
    e.fullShuffle.classList.toggle("active-control",shuffle);
    e.fullRepeat.classList.toggle("active-control",repeat);

    const isFavorite = favorites.has(tracks[current].id);

    e.miniFavorite.textContent = isFavorite ? "♥" : "♡";
    e.fullFavorite.textContent = isFavorite
      ? "♥ Favorited"
      : "♡ Favorite";
  }

  function renderGenres(){
    const genres = [
      "All",
      "Favorites",
      ...new Set(
        tracks.map(track =>
          track.genre.split(",")[0].trim()
        )
      )
    ];

    e.genreFilters.innerHTML = "";

    genres.forEach(item => {
      const button = document.createElement("button");

      button.className =
        "chip" + (item === genre ? " active" : "");

      button.textContent = item;

      button.onclick = () => {
        genre = item;
        renderGenres();
        renderTracks();
      };

      e.genreFilters.appendChild(button);
    });
  }

  function renderTracks(){
    const query = e.searchInput.value.toLowerCase();
    e.trackGrid.innerHTML = "";

    let visibleCount = 0;

    tracks.forEach((track,index) => {
      const matchesGenre =
        genre === "All" ||
        (genre === "Favorites" && favorites.has(track.id)) ||
        track.genre.toLowerCase().includes(genre.toLowerCase());

      const matchesSearch =
        !query ||
        `${track.title} ${track.artist} ${track.genre}`
          .toLowerCase()
          .includes(query);

      if (!matchesGenre || !matchesSearch) return;

      visibleCount += 1;

      const button = document.createElement("button");

      button.className =
        "card" + (index === current ? " active" : "");

      button.type = "button";

      button.innerHTML = `
        <img src="${track.cover}" alt="${track.title} cover">
        <h3>${track.title}</h3>
        <p>${track.genre}</p>
        <span class="row-action">
          ${index === current && !audio.paused ? "❚❚" : "▶"}
        </span>
      `;

      button.onclick = () => {
        if (index === current) {
          togglePlayback();
        } else {
          loadTrack(index,0,true);
        }
      };

      e.trackGrid.appendChild(button);
    });

    e.songCount.textContent = visibleCount;
  }

  function syncPlayer(){
    const track = tracks[current];

    e.miniCover.src = track.cover;
    e.fullCover.src = track.cover;

    e.miniTitle.textContent = track.title;
    e.fullTitle.textContent = track.title;

    e.miniArtist.textContent = track.artist;
    e.fullArtist.textContent = track.artist;

    e.fullBackdrop.style.backgroundImage =
      `url("${track.cover}")`;

    updateControls();
    renderTracks();

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata =
        new MediaMetadata({
          title:track.title,
          artist:track.artist,
          album:"Brew & Brews Radio",
          artwork:[
            {
              src:track.cover,
              sizes:"512x512",
              type:"image/png"
            }
          ]
        });
    }
  }

  function loadTrack(index,startAt=0,autoplay=false){
    current = index;

    localStorage.setItem(
      "bbCurrentTrack",
      String(current)
    );

    restore = startAt;
    audio.src = tracks[current].audio;
    audio.loop = repeat;

    syncPlayer();

    if (autoplay) playAudio();
  }

  async function playAudio(){
    try{
      await audio.play();
    }catch(error){
      console.error(error);
    }
  }

  function pauseAudio(){
    audio.pause();
  }

  function togglePlayback(){
    audio.paused ? playAudio() : pauseAudio();
  }

  function nextTrack(){
    let nextIndex;

    if (shuffle && tracks.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * tracks.length);
      } while (nextIndex === current);
    } else {
      nextIndex = (current + 1) % tracks.length;
    }

    loadTrack(nextIndex,0,true);
  }

  function previousTrack(){
    if (audio.currentTime > 4) {
      audio.currentTime = 0;
      return;
    }

    const previousIndex =
      (current - 1 + tracks.length) % tracks.length;

    loadTrack(previousIndex,0,true);
  }

  function toggleFavorite(){
    const id = tracks[current].id;

    if (favorites.has(id)) {
      favorites.delete(id);
    } else {
      favorites.add(id);
    }

    saveFavorites();
    updateControls();

    if (genre === "Favorites") renderTracks();
  }

  function toggleShuffle(){
    shuffle = !shuffle;
    localStorage.setItem("bbShuffle",String(shuffle));
    updateControls();
  }

  function toggleRepeat(){
    repeat = !repeat;
    audio.loop = repeat;
    localStorage.setItem("bbRepeat",String(repeat));
    updateControls();
  }

  function seek(input){
    if (!audio.duration) return;

    audio.currentTime =
      (Number(input.value) / 100) *
      audio.duration;
  }

  function openFullPlayer(){
    if (!e.fullPlayer.hidden) return;

    e.fullPlayer.hidden = false;
    document.body.style.overflow = "hidden";

    history.pushState(
      {fullPlayerOpen:true},
      "",
      location.href
    );
  }

  function closeFullPlayer(){
    if (e.fullPlayer.hidden) return;

    e.fullPlayer.hidden = true;
    document.body.style.overflow = "";
  }

  e.playBtn.onclick =
    e.fullPlay.onclick =
    e.heroPlayBtn.onclick =
    togglePlayback;

  e.prevBtn.onclick =
    e.fullPrev.onclick =
    previousTrack;

  e.nextBtn.onclick =
    e.fullNext.onclick =
    nextTrack;

  e.fullShuffle.onclick = toggleShuffle;
  e.fullRepeat.onclick = toggleRepeat;

  e.miniFavorite.onclick =
    e.fullFavorite.onclick =
    toggleFavorite;

  e.openFullPlayer.onclick = openFullPlayer;

  e.closeFullPlayer.onclick = () => {
    if (
      history.state &&
      history.state.fullPlayerOpen
    ) {
      history.back();
    } else {
      closeFullPlayer();
    }
  };

  window.addEventListener("popstate",() => {
    if (!e.fullPlayer.hidden) {
      closeFullPlayer();
    }
  });

  e.miniProgress.oninput = () => {
    seek(e.miniProgress);
  };

  e.fullProgress.oninput = () => {
    seek(e.fullProgress);
  };

  e.searchInput.oninput = renderTracks;

  audio.onloadedmetadata = () => {
    e.miniDuration.textContent =
      e.fullDuration.textContent =
      formatTime(audio.duration);

    if (
      restore > 0 &&
      restore < audio.duration - 2
    ) {
      audio.currentTime = restore;
    }

    restore = 0;
  };

  audio.ontimeupdate = () => {
    const progress = audio.duration
      ? (audio.currentTime / audio.duration) * 100
      : 0;

    e.miniProgress.value = progress;
    e.fullProgress.value = progress;

    e.miniCurrent.textContent =
      e.fullCurrent.textContent =
      formatTime(audio.currentTime);

    e.miniDuration.textContent =
      e.fullDuration.textContent =
      formatTime(audio.duration);

    localStorage.setItem(
      "bbPosition",
      String(audio.currentTime)
    );
  };

  audio.onplay = () => {
    e.playBtn.textContent = "❚❚";
    e.fullPlay.textContent = "❚❚";
    e.heroPlayBtn.textContent = "❚❚ PAUSE RADIO";
    renderTracks();
  };

  audio.onpause = () => {
    e.playBtn.textContent = "▶";
    e.fullPlay.textContent = "▶";
    e.heroPlayBtn.textContent = "▶ PLAY RADIO";
    renderTracks();
  };

  audio.onended = () => {
    localStorage.setItem("bbPosition","0");

    if (!repeat) nextTrack();
  };

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play",playAudio);
    navigator.mediaSession.setActionHandler("pause",pauseAudio);
    navigator.mediaSession.setActionHandler("previoustrack",previousTrack);
    navigator.mediaSession.setActionHandler("nexttrack",nextTrack);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load",() => {
      navigator.serviceWorker.register("service-worker.js");
    });
  }

  renderGenres();
  loadTrack(current,restore,false);
})();
