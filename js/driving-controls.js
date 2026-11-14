const byId = id => document.getElementById(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const TRANSMISSIONS = ['auto', 'sequential', 'direct', 'shifter'];
const defaultKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
const reserved = new Set(['KeyA', 'KeyC', 'KeyD', 'KeyH', 'KeyM', 'KeyR', 'KeyS', 'KeyW', 'KeyX', 'KeyZ']);
const keyboardDefaults={throttle:'KeyW',brake:'KeyS',left:'KeyA',right:'KeyD',handbrake:'Space',down:'KeyQ',up:'KeyE',camera:'KeyC',headlights:'KeyH',focus:'KeyX',reposition:'KeyZ',pause:'Escape'};
const gamepadDefaults={throttle:7,brake:6,handbrake:0,down:4,up:5,camera:3,headlights:2,focus:1,reposition:11,pause:9};
const keyboardAlternates={throttle:'ArrowUp',brake:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'};
const bindingNames={camera:'Cambiar cámara',headlights:'Faros',focus:'Superconcentración',reposition:'Centrar coche',pause:'Pausa'};
const keyLabel=code=>code.replace(/^(Digit|Key)/,'').replace(/^Arrow/,'Flecha ');
const names = {
  left: 'Izquierda', right: 'Derecha', wheel: 'Volante', throttle: 'Acelerador',
  brake: 'Freno', handbrake: 'Freno de mano', down: 'Bajar marcha', up: 'Subir marcha',
  shifter: 'Palanca en H',...bindingNames
};
const optionalControls={camera:[.11,.36,.11],headlights:[.24,.36,.11],reposition:[.37,.36,.11],pause:[.50,.36,.11],focus:[.63,.36,.11]};
const captions = {left:'◀', right:'▶', throttle:'GAS', brake:'FRENO', handbrake:'DRIFT', down:'−', up:'+',camera:'CÁM',headlights:'LUZ',reposition:'↺',pause:'Ⅱ',focus:'✦'};
const defaults = {
  portrait: {left:[.11,.85,.16],right:[.30,.85,.16],wheel:[.19,.82,.30],handbrake:[.51,.85,.14],brake:[.70,.86,.17],throttle:[.89,.86,.17],down:[.70,.75,.13],up:[.89,.75,.13],...optionalControls},
  landscape: {left:[.08,.83,.18],right:[.20,.83,.18],wheel:[.14,.81,.32],handbrake:[.68,.85,.16],brake:[.81,.85,.19],throttle:[.93,.85,.19],down:[.81,.68,.14],up:[.93,.68,.14],...optionalControls},
  shifter: {shifter:[.89,.64,.21]}
};
const positions = [[.18,.19],[.18,.81],[.5,.19],[.5,.81],[.82,.19]];
const guide = {
  auto:'El coche elige la marcha según tu velocidad. Solo aceleras, frenas y giras.',
  sequential:'Q baja una marcha y E sube una. Con mando, usa LB y RB. En táctil, toca − o +.',
  direct:'Cada tecla salta directamente a su marcha. Selecciona una casilla y pulsa la tecla que quieras asignar.',
  shifter:'Haz clic en una marcha o mantén pulsada la palanca, deslízala por la H y suelta en la marcha elegida.'
};

export function transmissionMode(saved, mobile) {
  const mode = saved === 'manual' ? 'sequential' : saved;
  if (!TRANSMISSIONS.includes(mode)) return 'auto';
  return mobile && mode !== 'auto' ? 'sequential' : mode;
}

function hPattern() {
  return '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M18 19V81 M50 19V81 M82 19V50 M18 50H82"/></svg>' +
    positions.map(([x,y], i) => '<span data-gear="'+(i+1)+'" style="left:'+x*100+'%;top:'+y*100+'%">'+(i+1)+'</span>').join('') +
    '<i class="shift-knob"></i>';
}

function control(id, preview = false) {
  const element = document.createElement('button');
  element.type = 'button';
  element.dataset.control = id;
  element.className = 'drive-control drive-' + id;
  element.setAttribute('aria-label', names[id]);
  if (id === 'wheel') {
    element.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42"/><path d="M13 40L50 52 87 40M50 52V91"/><path class="wheel-stripe" d="M50 4V15"/></svg>';
  } else if (id === 'shifter') {
    element.innerHTML = hPattern();
  } else {
    element.textContent = captions[id];
  }
  if (!preview) element.tabIndex = -1;
  return element;
}

export class DrivingControls {
  constructor(settings, {save, shift, race, changeMode, action}) {
    this.settings = settings;
    this.save = save;
    this.shift = shift;
    this.race = race;
    this.changeMode = changeMode;
    this.action=action;
    settings.optionalTouch=Array.isArray(settings.optionalTouch)?settings.optionalTouch.filter(id=>Object.hasOwn(optionalControls,id)):[];
    this.coarsePointer = matchMedia('(pointer: coarse)');
    this.held = new Map();
    this.layer = byId('touch-controls');
    this.editor = byId('control-preview');
    this.steering = 0;
    settings.transmission = transmissionMode(settings.transmission, false);
    settings.gearKeys = Array.isArray(settings.gearKeys) && settings.gearKeys.length === 5 &&
      new Set(settings.gearKeys).size === 5 && settings.gearKeys.every(DrivingControls.validKey) ? settings.gearKeys : [...defaultKeys];
    settings.touchSteering = settings.touchSteering === 'wheel' ? 'wheel' : 'buttons';
    if (!settings.controlLayouts || typeof settings.controlLayouts !== 'object' || Array.isArray(settings.controlLayouts)) settings.controlLayouts = {};

    this.buttons = Object.fromEntries(Object.keys(names).map(id => [id, control(id)]));
    this.layer.replaceChildren(...Object.values(this.buttons));
    for (const [id, button] of Object.entries(this.buttons)) this.bindControl(button, id);
    byId('transmission').onchange = event => {
      settings.transmission = event.target.value;
      this.save();
      this.changeMode();
      this.showGuide();
      this.sync();
    };
    byId('control-layout').onchange = () => this.showEditor();
    byId('touch-steering').value = settings.touchSteering;
    byId('touch-steering').onchange = event => {
      settings.touchSteering = event.target.value;
      this.save();
      this.showEditor();
      this.sync();
    };
    byId('control-size').oninput = event => this.editPosition(2, Number(event.target.value) / 100);
    byId('control-reset').onclick = () => {
      delete settings.controlLayouts[this.layoutName];
      this.save();
      this.showEditor();
      this.sync();
    };
    this.coarsePointer.addEventListener('change', () => { this.clear(); this.updateDevices(); });
    for(const [device,defaults] of [['key',keyboardDefaults],['gamepad',gamepadDefaults]]){
      const saved=settings[device+'Bindings'];
      const valid=device==='key'?code=>typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Up|Down|Left|Right)|Space|Escape)$/.test(code)&&!['KeyM','KeyR'].includes(code):button=>Number.isInteger(button)&&button>=0&&button<=31;
      const values=Object.keys(defaults).map(action=>saved?.[action]);
      settings[device+'Bindings']=values.every(valid)&&new Set(values).size===values.length?Object.fromEntries(Object.keys(defaults).map((action,index)=>[action,values[index]])):{...defaults};
      byId(device==='key'?'reset-keys':'reset-gamepad').onclick=()=>{
        settings[device+'Bindings']={...defaults};this.cancelBinding();this.renderBindings(device);this.save();
      };
      this.renderBindings(device);
    }
    settings.enableGamepad=settings.enableGamepad!==false;
    byId('enable-gamepad').checked=settings.enableGamepad;
    byId('enable-gamepad').onchange=event=>{
      settings.enableGamepad=event.target.checked;this.clear();this.sync();this.save();
    };
    for(const event of ['gamepadconnected','gamepaddisconnected'])window.addEventListener(event,()=>this.updateDevices());
    new ResizeObserver(() => this.positionControls()).observe(this.layer);
    new ResizeObserver(() => this.positionPreview()).observe(this.editor);
    this.updateDevices();
  }

  static validKey(code) {
    return typeof code === 'string' && /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|BracketLeft|BracketRight|Comma|Period|Slash|Semicolon|Quote|Minus|Equal|Backslash)$/.test(code) && !reserved.has(code);
  }

  get mobile() {
    return this.coarsePointer.matches || (navigator.maxTouchPoints>0 && (matchMedia('(hover: none)').matches || /Android|iPad|iPhone/.test(navigator.userAgent)));
  }
  get choice() { return transmissionMode(this.settings.transmission, this.mobile); }
  get gamepad(){return Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);}
  get usingGamepad(){return !!this.gamepad&&this.settings.enableGamepad;}
  get mode() {
    const race = this.race();
    if (!race?.manual) return 'auto';
    return transmissionMode(race.transmissionMode || 'sequential', this.mobile);
  }
  get orientation() { return innerWidth > innerHeight ? 'landscape' : 'portrait'; }
  get layoutName() { return byId('control-layout').value; }

  updateDevices(){
    byId('keyboard-options').hidden=this.mobile;
    byId('gamepad-options').hidden=!this.gamepad;
    this.showGuide();
    this.sync();
  }

  renderBindings(device){
    const list=byId(device+'-bindings');
    list.replaceChildren(...Object.entries(this.settings[device+'Bindings']).map(([action,value])=>{
      const row=document.createElement('label'),button=document.createElement('button');
      row.className='setting-row';row.textContent=names[action]||bindingNames[action];
      button.type='button';button.className='secondary-button';button.textContent=device==='key'?keyLabel(value):'Botón '+value;
      button.setAttribute('aria-label',row.textContent+' · '+button.textContent);
      button.onclick=()=>{this.pendingBinding={device,action};byId(device+'-bindings-status').textContent=device==='key'?'Pulsa una tecla o Esc para cancelar.':'Pulsa un botón del mando.';};
      row.append(button);return row;
    }));
  }

  cancelBinding(){
    if(!this.pendingBinding)return;
    byId(this.pendingBinding.device+'-bindings-status').textContent='';this.pendingBinding=null;
  }

  assignBinding(value){
    const {device,action}=this.pendingBinding,bindings=this.settings[device+'Bindings'];
    const other=Object.keys(bindings).find(key=>bindings[key]===value);
    if(other)bindings[other]=bindings[action];
    bindings[action]=value;this.cancelBinding();this.renderBindings(device);this.showGuide();this.save();
  }

  captureKey(event){
    if(this.pendingBinding?.device!=='key'||event.code==='Tab')return false;
    event.preventDefault();
    const code=event.code;
    if(code==='Escape'){this.cancelBinding();return true;}
    if(!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Up|Down|Left|Right)|Space)$/.test(code)&&!['KeyM','KeyR',...this.settings.gearKeys].includes(code))this.assignBinding(code);
    else byId('key-bindings-status').textContent='Esa tecla está reservada o no es compatible.';
    return true;
  }

  keyMatches(action,code){
    const bindings=this.settings.keyBindings;
    return bindings[action]===code||(keyboardAlternates[action]===code&&bindings[action]===keyboardDefaults[action]&&!Object.values(bindings).includes(code));
  }

  showGuide() {
    const select = byId('transmission');
    for (const option of select.options){
      const unavailable=this.mobile&&['direct','shifter'].includes(option.value);
      option.hidden=unavailable;
      option.disabled=unavailable;
    }
    const mode = select.value = this.choice;
    byId('transmission-help').textContent = this.mobile && mode === 'sequential'
      ? 'Toca − para bajar una marcha y + para subir. Puedes mover y redimensionar ambos botones.'
      : mode==='sequential'?`${keyLabel(this.settings.keyBindings.down)} baja una marcha y ${keyLabel(this.settings.keyBindings.up)} sube una.`:guide[mode];
    const diagram = byId('transmission-diagram');
    diagram.replaceChildren();
    diagram.className = 'transmission-diagram diagram-' + mode;
    const keyboard = byId('gear-bindings');
    keyboard.classList.toggle('hidden', mode !== 'direct');
    if (mode === 'shifter') diagram.innerHTML = hPattern();
    if (mode === 'auto' || mode === 'sequential') {
      for (const label of (mode === 'auto' ? ['1', '2', '3', '4', '5'] : [this.mobile?'−':keyLabel(this.settings.keyBindings.down)+'  −','1 → 5',this.mobile?'+':'+  '+keyLabel(this.settings.keyBindings.up)])) {
        const item = document.createElement('span');
        item.textContent = label;
        diagram.append(item);
      }
    }
    diagram.hidden = mode === 'direct';
    keyboard.replaceChildren();
    if (mode !== 'direct') return;
    for (const [i, code] of this.settings.gearKeys.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = (i + 1) + ' · ' + code.replace(/^(Digit|Key)/, '');
      button.setAttribute('aria-label', 'Asignar marcha ' + (i + 1));
      button.onclick = () => { this.binding = i; button.textContent = (i + 1) + ' · …'; button.focus(); };
      button.onblur = () => { if (this.binding === i) { this.binding = null; this.showGuide(); } };
      keyboard.append(button);
    }
  }

  handleKey(event) {
    if (this.binding !== null && this.binding !== undefined) {
      const index = this.binding;
      if (event.code === 'Tab') return false;
      event.preventDefault();
      if (event.code !== 'Escape') {
        if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || !DrivingControls.validKey(event.code)||Object.values(this.settings.keyBindings).includes(event.code)) {
          byId('transmission-help').textContent = 'Esa tecla está reservada. Prueba con otra o pulsa Esc.';
          return true;
        }
        const keys = this.settings.gearKeys;
        const other = keys.indexOf(event.code);
        if (other !== -1) keys[other] = keys[index];
        keys[index] = event.code;
        this.save();
      }
      this.binding = null;
      this.showGuide();
      byId('gear-bindings').children[index]?.focus();
      return true;
    }
    if (!this.race()?.manual || event.ctrlKey || event.altKey || event.metaKey) return false;
    let gear;
    if (this.mode === 'direct') gear = this.settings.gearKeys.indexOf(event.code) + 1;
    if (this.mode === 'sequential') {
      if (this.keyMatches('down',event.code)) gear = -1;
      if (this.keyMatches('up',event.code)) gear = 1;
    }
    if (!gear) return false;
    event.preventDefault();
    if (!event.repeat) this.shift(gear, this.mode === 'sequential');
    return true;
  }

  has(action) {
    for (const held of this.held.values()) if (held === action) return true;
    return false;
  }

  clear() {
    this.held.clear();
    this.steering = 0;
    this.wheelPointer = this.shifterPointer = null;
    for (const element of Object.values(this.buttons)) element.classList.remove('pressed');
    this.buttons.wheel.style.setProperty('--wheel-turn', '0deg');
  }

  bindControl(button, id) {
    button.onpointerdown = event => {
      if (!this.race() || event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      button.classList.add('pressed');
      if (id === 'up' || id === 'down') return this.shift(id === 'up' ? 1 : -1, true);
      if(Object.hasOwn(optionalControls,id))return this.action?.(id);
      if (id === 'shifter') {
        this.shifterPointer = event.pointerId;
        this.shifterLane = this.shifterY = null;
        this.shifterMove(event);
        return;
      }
      if (id === 'wheel') {
        if (this.wheelPointer == null) {
          this.wheelPointer = event.pointerId;
          const rect = button.getBoundingClientRect();
          const angle = Math.atan2(event.clientX - (rect.x + rect.width / 2), rect.y + rect.height / 2 - event.clientY);
          this.wheelDrag = {rect, angle, turn:0};
        }
        return;
      }
      this.held.set(event.pointerId, id);
    };
    button.onpointermove = event => {
      if (id === 'shifter' && this.shifterPointer === event.pointerId) this.shifterMove(event);
      if (id !== 'wheel' || this.wheelPointer !== event.pointerId) return;
      const {rect, angle, turn} = this.wheelDrag;
      const x = event.clientX - (rect.x + rect.width / 2), y = rect.y + rect.height / 2 - event.clientY;
      if (Math.hypot(x,y) < rect.width * .12) return;
      const next = Math.atan2(x,y);
      const delta = Math.atan2(Math.sin(next - angle), Math.cos(next - angle));
      this.wheelDrag.angle = next;
      this.wheelDrag.turn = clamp(turn + delta, -1.22, 1.22);
      this.steering = this.wheelDrag.turn / 1.22;
      button.style.setProperty('--wheel-turn', this.steering * 70 + 'deg');
    };
    const release = event => {
      this.held.delete(event.pointerId);
      if (this.shifterPointer === event.pointerId) {
        this.shifterPointer = null;
        if (event.type === 'pointerup') {
          this.shifterMove(event);
          if (this.hoverGear) this.shift(this.hoverGear, false);
        }
        this.renderGear();
      }
      if (this.wheelPointer === event.pointerId) {
        this.wheelPointer = null;
        this.steering = 0;
        button.style.setProperty('--wheel-turn', '0deg');
      }
      button.classList.toggle('pressed', this.has(id));
    };
    button.onpointerup = button.onpointercancel = button.onlostpointercapture = release;
  }

  shifterMove(event) {
    const rect = this.buttons.shifter.getBoundingClientRect();
    const x = (event.clientX - rect.x) / rect.width, y = (event.clientY - rect.y) / rect.height;
    const targetLane = clamp(Math.round((x - .18) / .32), 0, 2);
    const inNeutral = Math.abs(y-.5) <= .13;
    const crossedNeutral = this.shifterY != null && (y-.5)*(this.shifterY-.5)<0;
    if (this.shifterLane == null || inNeutral || crossedNeutral) this.shifterLane = targetLane;
    this.shifterY = y;
    const lane = this.shifterLane;
    const withinGate = Math.abs(x-(.18+.32*lane)) < .135;
    const gear = lane * 2 + (y < .5 ? 1 : 2);
    this.hoverGear = lane === targetLane && withinGate && x >= 0 && x <= 1 && y >= 0 && y <= 1 && !inNeutral && gear <= 5 ? gear : null;
    this.renderGear(this.hoverGear, [.18 + .32 * lane, inNeutral ? .5 : clamp(y,.19,lane === 2 ? .5 : .81)]);
  }

  renderGear(highlight = null, pointer = null) {
    const button = this.buttons.shifter;
    if (button.hidden || (this.shifterPointer != null && !pointer)) return;
    const selected = this.race()?.requestedGear ?? this.race()?.gear ?? 1;
    const [x,y] = pointer || positions[selected - 1] || positions[0];
    button.style.setProperty('--knob-x', x * 100 + '%');
    button.style.setProperty('--knob-y', y * 100 + '%');
    for (const mark of button.querySelectorAll('[data-gear]')) {
      mark.classList.toggle('active', +mark.dataset.gear === (highlight || selected));
    }
  }

  getPosition(layout, id) {
    const position = this.settings.controlLayouts[layout]?.[id];
    const fallback = defaults[layout][id];
    if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) return [...fallback];
    return [clamp(position[0],0,1),clamp(position[1],0,1),clamp(position[2],.09,.36)];
  }

  place(button, layout, area, id) {
    const [x,y,size] = this.getPosition(layout,id);
    const w = area.clientWidth, h = area.clientHeight;
    if (!w || !h) return;
    const width = Math.max(28,Math.min(w-8,Math.min(w,h)*size));
    button.style.setProperty('--control-size', width + 'px');
    button.style.left = clamp(x*w,width/2+4,w-width/2-4) + 'px';
    button.style.top = clamp(y*h,width/2+4,h-width/2-4) + 'px';
  }

  positionControls() {
    for (const [id,button] of Object.entries(this.buttons)) {
      if (!button.hidden) this.place(button,id === 'shifter' ? 'shifter' : this.orientation,this.layer,id);
    }
  }

  sync() {
    const active = !!this.race(), mobile = active && this.mobile, touch=mobile&&!this.usingGamepad;
    const wheel = this.settings.touchSteering === 'wheel';
    for (const [id,button] of Object.entries(this.buttons)) {
      if (id === 'shifter') button.hidden = !active || mobile || this.mode !== 'shifter';
      else if (id === 'up' || id === 'down') button.hidden = !touch || this.mode !== 'sequential';
      else if (id === 'wheel') button.hidden = !touch || !wheel;
      else if (id === 'left' || id === 'right') button.hidden = !touch || wheel;
      else if(Object.hasOwn(optionalControls,id))button.hidden=!touch||!this.settings.optionalTouch.includes(id);
      else button.hidden = !touch;
    }
    this.positionControls();
    this.renderGear();
  }

  openEditor() {
    const desktop = byId('control-layout').querySelector('[value=shifter]');
    desktop.hidden = desktop.disabled = this.mobile;
    byId('control-layout').value = !this.mobile && this.choice === 'shifter' ? 'shifter' : this.orientation;
    this.showEditor();
  }

  showEditor() {
    const layout = this.layoutName;
    this.editor.dataset.layout = layout;
    byId('touch-steering-row').classList.toggle('hidden',layout === 'shifter');
    this.editor.replaceChildren();
    const optional=byId('touch-optional');optional.replaceChildren();optional.hidden=layout==='shifter';
    if(!optional.hidden)for(const id of Object.keys(optionalControls)){
      const label=document.createElement('label'),check=document.createElement('input');
      check.type='checkbox';check.checked=this.settings.optionalTouch.includes(id);
      check.onchange=()=>{this.settings.optionalTouch=this.settings.optionalTouch.filter(value=>value!==id);if(check.checked)this.settings.optionalTouch.push(id);this.save();this.showEditor();this.sync();};
      label.append(check,names[id]);optional.append(label);
    }
    const ids = Object.keys(defaults[layout]).filter(id =>
      (!Object.hasOwn(optionalControls,id)||this.settings.optionalTouch.includes(id))&&
      (this.settings.touchSteering === 'wheel' ? id !== 'left' && id !== 'right' : id !== 'wheel'));
    for (const id of ids) {
      const button = control(id,true);
      button.onfocus = () => this.selectControl(id);
      button.onpointerdown = event => {
        if (event.button !== 0) return;
        event.preventDefault();
        button.focus();
        button.setPointerCapture(event.pointerId);
        const rect = button.getBoundingClientRect();
        this.drag = {id, pointer:event.pointerId, x:event.clientX - rect.x - rect.width/2, y:event.clientY - rect.y - rect.height/2};
      };
      button.onpointermove = event => {
        if (this.drag?.pointer !== event.pointerId || this.drag.id !== id) return;
        const rect = this.editor.getBoundingClientRect();
        const position = this.getPosition(layout,id);
        position[0] = clamp((event.clientX - this.drag.x - rect.x) / rect.width,0,1);
        position[1] = clamp((event.clientY - this.drag.y - rect.y) / rect.height,0,1);
        this.setPosition(id,position,false);
      };
      button.onpointerup = button.onpointercancel = button.onlostpointercapture = event => {
        if (this.drag?.pointer === event.pointerId) { this.drag = null; this.save(); }
      };
      button.onkeydown = event => {
        const step = {ArrowLeft:[0,-.02],ArrowRight:[0,.02],ArrowUp:[1,-.02],ArrowDown:[1,.02]}[event.key];
        if (!step) return;
        event.preventDefault();
        this.editPosition(step[0],this.getPosition(layout,id)[step[0]] + step[1]);
      };
      this.editor.append(button);
    }
    this.selectControl(ids.includes(this.selected) ? this.selected : ids[0]);
    this.positionPreview();
  }

  selectControl(id) {
    this.selected = id;
    byId('control-size').value = Math.round(this.getPosition(this.layoutName,id)[2] * 100);
    byId('control-size-name').textContent = 'Tamaño · ' + names[id];
    for (const button of this.editor.children) button.classList.toggle('selected',button.dataset.control === id);
  }

  editPosition(axis,value) {
    if (!this.selected) return;
    const position = this.getPosition(this.layoutName,this.selected);
    position[axis] = clamp(value,axis === 2 ? .09 : 0,axis === 2 ? .36 : 1);
    this.setPosition(this.selected,position,true);
  }

  setPosition(id,position,persist) {
    const layout = this.layoutName;
    this.settings.controlLayouts[layout] = {...this.settings.controlLayouts[layout],[id]:position};
    if (persist) this.save();
    this.positionPreview();
    this.positionControls();
  }

  positionPreview() {
    for (const button of this.editor.children) this.place(button,this.layoutName,this.editor,button.dataset.control);
  }
}
