const audioEngine = Scratch.vm.runtime.audioEngine;

const fetchAsArrayBufferWithTimeout = (url) =>
  new Promise((resolve, reject) => {
    // Permission is checked in playSound()
    // eslint-disable-next-line extension/no-xmlhttprequest
    const xhr = new XMLHttpRequest();
    let timeout = setTimeout(() => {
      xhr.abort();
      reject(new Error("Timed out"));
    }, 5000);
    xhr.onload = () => {
      clearTimeout(timeout);
      if (xhr.status === 200) {
        resolve(xhr.response);
      } else {
        reject(new Error(`HTTP error ${xhr.status} while fetching ${url}`));
      }
    };
    xhr.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Failed to request ${url}`));
    };
    xhr.responseType = "arraybuffer";
    xhr.open("GET", url);
    xhr.send();
});

const soundPlayerCache = new Map();

const decodeSoundPlayer = async (url) => {
  const cached = soundPlayerCache.get(url);
  if (cached) {
    if (cached.sound) {
      return cached.sound;
    }
    throw cached.error;
  }

  try {
    const arrayBuffer = await fetchAsArrayBufferWithTimeout(url);
    const soundPlayer = await audioEngine.decodeSoundPlayer({
      data: {
        buffer: arrayBuffer,
      },
    });
    soundPlayerCache.set(url, {
      sound: soundPlayer,
      error: null,
    });
    return soundPlayer;
  } catch (e) {
    soundPlayerCache.set(url, {
      sound: null,
      error: e,
    });
    throw e;
  }
};

const playWithAudioEngine = async (url, target) => {
  const soundBank = target.sprite.soundBank;

  /** @type {AudioEngine.SoundPlayer} */
  let soundPlayer;
  try {
    const originalSoundPlayer = await decodeSoundPlayer(url);
    soundPlayer = originalSoundPlayer.take();
  } catch (e) {
    console.warn(
      "Could not fetch audio; falling back to primitive approach",
      e
    );
    return false;
  }

  soundBank.addSoundPlayer(soundPlayer);
  await soundBank.playSound(target, soundPlayer.id);

  delete soundBank.soundPlayers[soundPlayer.id];
  soundBank.playerTargets.delete(soundPlayer.id);
  soundBank.soundEffects.delete(soundPlayer.id);

  return true;
};

const playWithAudioElement = (url, target) =>
  new Promise((resolve, reject) => {
    // Unfortunately, we can't play all sounds with the audio engine.
    // For these sounds, fall back to a primitive <audio>-based solution that will work for all
    // sounds, even those without CORS.
    // Permission is checked in playSound()
    // eslint-disable-next-line extension/check-can-fetch
    const mediaElement = new Audio(url);

    // Make a minimal effort to simulate Scratch's sound effects.
    // We can get pretty close for volumes <100%.
    // playbackRate does not have enough range for simulating pitch.
    // There is no way for us to pan left or right.
    mediaElement.volume = target.volume / 100;

    mediaElement.onended = () => {
      resolve();
    };
    mediaElement
      .play()
      .then(() => {
        // Wait for onended
      })
      .catch((err) => {
        reject(err);
      });
});

const playSound = async (url, target) => {
  try {
    /*if (!(await Scratch.canFetch(url))) {
      throw new Error(`Permission to fetch ${url} denied`);
    }*/

    const success = await playWithAudioEngine(url, target);
    if (!success) {
      return await playWithAudioElement(url, target);
    }
  } catch (e) {
    console.warn(`All attempts to play ${url} failed`, e);
  }
};
class PatrickUtils {
  getInfo() {
    return {
      id: "patrickutils",
      name: "Patrick's utils",
      blocks: [
        {
          opcode: 'evaluate',
          blockType: Scratch.BlockType.REPORTER,
          text: 'evaluate [ONE].',
          arguments: {
            ONE: {
              type: Scratch.ArgumentType.STRING
            },
          }
        },
        {
          opcode: 'play',
            blockType: Scratch.BlockType.COMMAND,
            text: "start sound from url: [path]",
            arguments: {
              path: {
                  type: Scratch.ArgumentType.STRING,
                  defaultValue: "https://extensions.turbowarp.org/meow.mp3",
              }
            }
        }
      ]
    };
  }

  evaluate(args) {
    try {
      return eval(args.ONE);
    } catch (error) {
      return 'Error: ' + error.message;
    }
  }

  play({ path }, util){
    playSound(path, util.target);
  }
}

Scratch.extensions.register(new PatrickUtils());
