const MODES={
 campaign:{title:'Campaña',tag:'01 / CONSTRUYE TU LEYENDA',description:'Construye tu leyenda a través del mundo del automovilismo en Japón'},
 time:{title:'Time Attack',tag:'02 / CADA MILÉSIMA CUENTA',description:'Practica y mejora tus tiempos'},
 online:{title:'Juego Online',tag:'03 / LA MONTAÑA ES DE TODOS',description:'Enfrenta a rivales de todo el mundo.'}
};
export class PlayMenu {
 constructor({openModal,closeModal,enter,active}){
  this.openModal=openModal;this.closeModal=closeModal;this.enter=enter;this.active=active;
  const cards=[...document.querySelectorAll('[data-play-mode]')];
  for(const card of cards){
   card.addEventListener('click',()=>this.open(card.dataset.playMode));
   // Layout changes can place a card under a stationary mouse while a controller is in use.
   card.addEventListener('pointermove',event=>{if(event.pointerType!=='mouse'||this.hovered===card||this.blockedMode===card.dataset.playMode)return;this.hovered=card;this.timer=setTimeout(()=>{if(this.active())this.open(card.dataset.playMode);},240);});
   card.addEventListener('pointerleave',()=>{clearTimeout(this.timer);if(this.hovered===card)this.hovered=null;if(this.active()&&this.blockedMode===card.dataset.playMode)this.blockedMode=null;});
   card.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();cards[(cards.indexOf(card)+(event.key==='ArrowRight'?1:cards.length-1))%cards.length].focus();}});
  }
  document.getElementById('mode-enter').onclick=()=>{const mode=this.mode;this.closeModal();this.enter(mode);};
 }
 open(mode){if(!this.active()||!MODES[mode])return;clearTimeout(this.timer);this.mode=mode;this.blockedMode=mode;const info=MODES[mode];document.getElementById('mode-title').textContent=info.title;document.getElementById('mode-tag').textContent=info.tag;document.getElementById('mode-description-dialog').textContent=info.description;document.getElementById('mode-icon').replaceChildren(document.querySelector(`[data-play-mode="${mode}"] svg`).cloneNode(true));this.openModal('mode');}
 cancelHover(){clearTimeout(this.timer);this.hovered=null;this.blockedMode=null;}
}
