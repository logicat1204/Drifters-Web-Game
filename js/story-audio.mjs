// A single short sound per page, mixed separately from the narrative soundtrack.
export class StoryPageAudio {
  constructor(audio=new Audio()){this.audio=audio;this.audio.preload='auto';}
  setVolume(volume){this.audio.volume=Math.max(0,Math.min(1,Number(volume)||0));}
  play(sound){
    this.stop();
    if(!sound?.url)return;
    this.audio.src=sound.url;
    // Missing files and unsupported formats must not prevent reading the story.
    this.audio.play().catch(()=>{});
  }
  stop(){
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}
