# Driving audio

`engines/idle.wav`, `mid.wav`, `high.wav`: **domasx2**, “racing car engine sound loops”, CC0 1.0. Downloaded 2026-11-04 from [OpenGameArt](https://opengameart.org/content/racing-car-engine-sound-loops). Original filenames: `loop_0.wav`, `loop_2_0.wav`, `loop_5_0.wav`. Source recording: pdsounds.org “start up car with seat belt warning beep”, public domain. The author confirms in the comments that the files were remade from this public-domain recording. [CC0 dedication](https://creativecommons.org/publicdomain/zero/1.0/).

`engines/body.wav`: **qubodup**, “Car Engine Loop 96kHz, 4s”, [OpenGameArt](https://opengameart.org/content/car-engine-loop-96khz-4s), licensed here under [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/). Original normalized WAV from `engine-loop.7z`, downloaded 2026-11-04. Copyright qubodup; credit must remain with redistributed builds.

The shipped WAVs are unmodified. Playback normalizes with headroom, crossfades the loop boundary, filters, blends RPM bands and changes pitch. These are family-specific **arcade interpretations**, not recordings of the real Toyota/Mazda/Nissan models. Tire/brake/wind/rain layers are original procedural audio in `js/driving-audio.js`.

The game loads only the four local files listed in `engines/bank.json`; no external audio request is made during play. Replace them with reusable steady-RPM loops, keep valid URLs in that manifest, and include the new source and license here. A synthesis fallback preserves sound if a file cannot be decoded.
