// Background Music Player with Fade Effects
class MusicPlayer {
  constructor() {
    this.playlist = [
      '/public/music/papinadochka1.mp3',
      '/public/music/loveispain.mp3',
      '/public/music/totoro.mp3',
      '/public/music/vipusknoy.mp3'
    ];
    this.currentIndex = 0;
    this.audio = null;
    this.saveInterval = null;
    this.isInitialized = false;
    this.fadeOutDuration = 2000; // 2 seconds fade out
    this.fadeInDuration = 2000; // 2 seconds fade in
    
    // Check localStorage for saved position
    const savedIndex = localStorage.getItem('musicPlayerIndex');
    if (savedIndex !== null) {
      this.currentIndex = parseInt(savedIndex);
    }
  }

  init() {
    if (this.isInitialized) return;

    // Create audio element
    this.audio = new Audio();
    this.audio.volume = 0;
    this.audio.loop = false;
    
    // Add event listener for when song ends
    this.audio.addEventListener('ended', () => this.nextSong());
    

    this.timeRestored = false;
this.audio.addEventListener('loadedmetadata', () => {
  const savedTime = localStorage.getItem('musicPlayerTime');
  if (savedTime && !this.timeRestored) {
    this.audio.currentTime = parseFloat(savedTime);
    this.timeRestored = true;
  }
  this.fadeIn();
});

    this.isInitialized = true;
    this.play();
  }

  play() {
    if (!this.isInitialized) {
      this.init();
      return;
    }

    this.audio.src = this.playlist[this.currentIndex];
    this.audio.volume = 0;
    this.audio.play().catch(err => {
      console.log('Autoplay prevented:', err);
      // Autoplay is blocked, will require user interaction
    });

    clearInterval(this.saveInterval); // сначала чистим старый
this.saveInterval = setInterval(() => {
  if (this.audio && !this.audio.paused) {
    localStorage.setItem('musicPlayerTime', this.audio.currentTime);
  }
}, 1000);
  }

  fadeIn() {
    this.audio.volume = 0;
    const steps = 50;
    const increment = 0.3 / steps; // Max volume 0.3
    let step = 0;

    const fadeInterval = setInterval(() => {
      step++;
      this.audio.volume = Math.min(increment * step, 0.3);
      if (step >= steps) {
        clearInterval(fadeInterval);
        this.audio.volume = 0.3;
      }
    }, this.fadeInDuration / steps);
  }

  fadeOut() {
    return new Promise(resolve => {
      const currentVolume = this.audio.volume;
      const steps = 50;
      const decrement = currentVolume / steps;
      let step = 0;

      const fadeInterval = setInterval(() => {
        step++;
        this.audio.volume = Math.max(currentVolume - decrement * step, 0);
        if (step >= steps) {
          clearInterval(fadeInterval);
          this.audio.volume = 0;
          resolve();
        }
      }, this.fadeOutDuration / steps);
    });
  }

  async nextSong() {
    await this.fadeOut();
    this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    localStorage.removeItem('musicPlayerTime'); // сбрасываем время при смене трека
    localStorage.setItem('musicPlayerIndex', this.currentIndex);
    this.play();
  }
}

// Initialize music player when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.musicPlayer = new MusicPlayer();
    window.musicPlayer.init();
    
    // Resume on user interaction if autoplay was blocked
    document.addEventListener('click', () => {
      if (window.musicPlayer && window.musicPlayer.audio && window.musicPlayer.audio.paused) {
        window.musicPlayer.audio.play().catch(err => console.log('Play failed:', err));
      }
    }, { once: true });
  });
} else {
  window.musicPlayer = new MusicPlayer();
  window.musicPlayer.init();
}
