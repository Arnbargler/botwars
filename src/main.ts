import Phaser from 'phaser';
import { ARENA, CLASSES, DEFAULT_BEHAVIOUR, createMatch, step, type Behaviour, type Bot, type ClassId, type Match } from './simulation';
import './style.css';

const app=document.querySelector<HTMLDivElement>('#app')!;
const budget=700;
interface ConfiguredBot { id:number; kind:ClassId; behaviour:Behaviour; }
let nextRosterId=4;
let roster:ConfiguredBot[]=[
  {id:1,kind:'scout',behaviour:{...DEFAULT_BEHAVIOUR}},
  {id:2,kind:'scout',behaviour:{...DEFAULT_BEHAVIOUR}},
  {id:3,kind:'goliath',behaviour:{...DEFAULT_BEHAVIOUR}}
];
let selectedId:number|null=1;
let game:Phaser.Game|null=null;
let currentMatch:Match|null=null;

function rosterCost():number {return roster.reduce((sum,bot)=>sum+CLASSES[bot.kind].cost,0);}
const sliderLabels: {key:keyof Behaviour;title:string;low:string;high:string}[]=[
  {key:'aggression',title:'Aggression',low:'Timid',high:'Aggressive'},
  {key:'teamwork',title:'Teamwork',low:'Lone wolf',high:'Helps teammates'},
  {key:'caution',title:'Self-preservation',low:'Reckless',high:'Cautious'},
  {key:'distance',title:'Engagement',low:'Close combat',high:'Keep distance'},
  {key:'target',title:'Target preference',low:'Weakest',high:'Strongest'},
  {key:'mobility',title:'Mobility',low:'Hold position',high:'Keep moving'}
];
const CLASS_DETAILS:Record<ClassId,{description:string;glyph:string}> = {
  scout:{description:'Fast reconnaissance and harassment',glyph:'◆'},
  goliath:{description:'Heavy frontline combat unit',glyph:'⬡'}
};
function botLabel(bot:ConfiguredBot):string {
  const ordinal=roster.filter(b=>b.kind===bot.kind&&b.id<=bot.id).length;
  return `${bot.kind==='scout'?'Scout':'Goliath'} #${ordinal}`;
}
function setup():void {
  game?.destroy(true);game=null;currentMatch=null;
  app.innerHTML=`
    <header class="setup-header">
      <div class="brand"><span class="brand-icon">⚙</span><div><h1>BOTWARS</h1><p>TACTICAL ROBOT ARENA</p></div></div>
      <div class="steps" aria-label="Match setup steps"><span class="step done"><b>1</b> Build Roster ✓</span><span class="step active"><b>2</b> Configure Bots</span><span class="step"><b>3</b> Ready</span></div>
      <div class="version">PRE-ALPHA · v0.5</div>
    </header>
    <main class="setup-grid">
      <aside class="ui-panel catalogue">
        <div class="panel-head"><h2>Available Bots</h2><span>CLASSES</span></div>
        <div class="panel-body"><p class="credits" id="credits"></p><div class="catalogue-list" id="catalogue"></div>
          <p class="sidebar-note">Each class has fixed physical capabilities. Individual behaviour is configured in your roster.</p>
        </div>
      </aside>
      <section class="ui-panel roster-panel">
        <div class="panel-head"><h2>Your Roster <small id="rosterCount"></small></h2><strong id="budgetHeading"></strong></div>
        <div class="roster-cards" id="roster"></div>
        <div class="roster-footer"><span>Choose a bot to edit its six behaviour sliders.</span><button id="clearRoster" class="subtle">Clear Roster</button></div>
      </section>
      <aside class="right-stack">
        <section class="ui-panel preview-panel">
          <div class="panel-head"><h2>Arena Preview</h2><span>01 / BASIC</span></div>
          <div class="arena-wrap" aria-label="Basic empty arena preview with boundary walls">
            <div class="arena-preview">
              <div class="arena-wall top"></div><div class="arena-wall bottom"></div><div class="arena-wall left"></div><div class="arena-wall right"></div>
              <span class="arena-bot blue a"></span><span class="arena-bot blue b"></span><span class="arena-bot blue c"></span>
              <span class="arena-bot red a"></span><span class="arena-bot red b"></span><span class="arena-bot red c"></span>
            </div>
          </div>
          <div class="preview-caption">Arena: <strong>Basic Arena</strong><small>Boundary walls only</small></div>
        </section>
        <section class="ui-panel match-settings">
          <div class="panel-head"><h2>Match Settings</h2></div>
          <div class="setting-row"><span>Mode</span><strong>Team Battle · 2 teams</strong></div>
          <div class="setting-row"><span>Opponent</span><strong>2 Scouts + 1 Goliath</strong></div>
          <div class="setting-row"><span>Rounds</span><strong>Best of 1</strong></div>
          <p>Additional modes and arenas are planned. Settings shown here are fixed for this prototype.</p>
        </section>
        <button id="ready" class="ready-button"><span class="play-icon">▶</span><span>READY<small>Lock roster and start the battle</small></span></button>
      </aside>
    </main>`;

  function renderCatalogue():void {
    document.querySelector<HTMLElement>('#credits')!.textContent=`Remaining credits: ${budget-rosterCost()} / ${budget}`;
    document.querySelector<HTMLElement>('#catalogue')!.innerHTML=(Object.keys(CLASSES) as ClassId[]).map(kind=>{
      const spec=CLASSES[kind],detail=CLASS_DETAILS[kind];
      const disabled=rosterCost()+spec.cost>budget;
      return `<div class="catalogue-card ${kind}"><div class="bot-emblem ${kind}">${detail.glyph}</div>
        <div class="catalogue-info"><strong>${kind==='scout'?'Scout':'Goliath'}</strong><p>${detail.description}</p><span>${spec.cost} credits</span></div>
        <button data-add="${kind}" ${disabled?'disabled':''} aria-label="Add ${kind} to roster">+</button></div>`;
    }).join('');
    document.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(button=>button.onclick=()=>addBot(button.dataset.add as ClassId));
  }
  function sliderMarkup(bot:ConfiguredBot):string {
    return sliderLabels.map(label=>`<label class="slider"><span class="slider-title">${label.title}</span>
      <div class="slider-controls"><small>${label.low}</small><input aria-label="${botLabel(bot)} ${label.title}" type="range" min="0" max="100" value="${bot.behaviour[label.key]}" data-setting="${label.key}" data-id="${bot.id}"/><small>${label.high}</small><output>${bot.behaviour[label.key]}</output></div></label>`).join('');
  }
  function renderRoster():void {
    document.querySelector<HTMLElement>('#rosterCount')!.textContent=`(${roster.length} bots)`;
    document.querySelector<HTMLElement>('#budgetHeading')!.textContent=`Total Cost: ${rosterCost()} / ${budget}`;
    const list=document.querySelector<HTMLElement>('#roster')!;
    list.innerHTML=roster.length?roster.map(bot=>{
      const spec=CLASSES[bot.kind],detail=CLASS_DETAILS[bot.kind],active=bot.id===selectedId;
      return `<article class="roster-card ${active?'selected':''}">
        <div class="roster-card-head">
          <button class="roster-select" data-select="${bot.id}" aria-expanded="${active}">
            <span class="bot-emblem ${bot.kind}">${detail.glyph}</span>
            <span class="roster-card-title"><strong>${botLabel(bot)}</strong><small>${spec.cost} credits · ${active?'Editing behaviour':'Select to configure'}</small></span>
            <span class="expand-symbol">${active?'▾':'▸'}</span>
          </button>
          <button class="remove-bot subtle" data-remove="${bot.id}" aria-label="Remove ${botLabel(bot)}">✕</button>
        </div>
        <div class="roster-stats"><span>♥ HP <b>${spec.maxHealth}</b></span><span>➤ Speed <b>${spec.speed}</b></span><span>◎ Radar <b>${spec.radarRange}</b></span><span>⌖ Weapon <b>${spec.attackRange}</b></span><span>✦ Damage <b>${spec.damage}</b></span><span>◷ Shots/s <b>${spec.shotsPerSecond}</b></span></div>
        ${active?`<div class="behaviour-grid">${sliderMarkup(bot)}</div>`:'<div class="collapsed-hint">Behaviour saved · click to edit</div>'}
      </article>`;
    }).join(''):'<div class="empty-roster">Your roster is empty.<br>Add a bot from the left panel to begin.</div>';
    list.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(button=>button.onclick=()=>{
      selectedId=Number(button.dataset.select);
      renderRoster();
    });
    list.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(button=>button.onclick=()=>{
      const id=Number(button.dataset.remove);
      roster=roster.filter(bot=>bot.id!==id);
      if(selectedId===id) selectedId=roster[0]?.id??null;
      renderAll();
    });
    list.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input=>{
      input.oninput=()=>{
        const bot=roster.find(b=>b.id===Number(input.dataset.id));
        if(!bot)return;
        bot.behaviour[input.dataset.setting as keyof Behaviour]=Number(input.value);
        input.parentElement!.querySelector('output')!.textContent=input.value;
      };
    });
    document.querySelector<HTMLButtonElement>('#ready')!.disabled=roster.length===0;
    document.querySelector<HTMLButtonElement>('#clearRoster')!.disabled=roster.length===0;
  }
  function renderAll():void {renderCatalogue();renderRoster();}
  function addBot(kind:ClassId):void {
    if(rosterCost()+CLASSES[kind].cost>budget)return;
    const bot={id:nextRosterId++,kind,behaviour:{...DEFAULT_BEHAVIOUR}};
    roster.push(bot);selectedId=bot.id;renderAll();
  }
  document.querySelector<HTMLButtonElement>('#clearRoster')!.onclick=()=>{
    roster=[];selectedId=null;renderAll();
  };
  document.querySelector<HTMLButtonElement>('#ready')!.onclick=start;
  renderAll();
}
let battleSelectedId:number|null=null;
const displayName=(bot:{kind:ClassId;id:number;team:number})=>
  `${bot.kind==='scout'?'Scout':'Goliath'} #${bot.id+1}`;
function updateInspector(match:Match):void {
  const container=document.querySelector<HTMLElement>('#inspector');
  if(!container)return;
  const bot=match.bots.find(b=>b.id===battleSelectedId);
  if(!bot){
    container.innerHTML='<h2>Bot Inspector</h2><p class="hint">Click any robot in the arena to inspect its decisions, health, radar contacts and individual settings.</p>';
    return;
  }
  const spec=CLASSES[bot.kind];
  const target=match.bots.find(b=>b.id===bot.targetId);
  const entries=[
    ['Team',bot.team===0?'Blue':'Red'],
    ['Status',bot.health>0?bot.action:'Destroyed'],
    ['Target',target?`${displayName(target)} (ID ${target.id+1})`:'None'],
    ['Radar contacts',String(bot.visibleEnemies)],
    ['Radar range',String(spec.radarRange)],
    ['Attack range',String(spec.attackRange)],
    ['Weapon cooldown',bot.cooldown.toFixed(2)+' s'],
    ['Shots / hits',`${bot.shotsFired} / ${bot.hits}`],
    ['Damage dealt',String(bot.damageDealt)],
    ['Kills',String(bot.kills)]
  ];
  container.innerHTML=`<h2>${displayName(bot)} <small>· ${bot.team===0?'BLUE':'RED'} TEAM</small></h2>
    <div class="inspect-health"><div style="width:${bot.health/spec.maxHealth*100}%"></div></div>
    <p class="inspect-hp">Health: ${bot.health} / ${spec.maxHealth}</p>
    <div class="inspect-rows">${entries.map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
    <h3>Configured behaviour</h3>
    <div class="inspect-rows">${sliderLabels.map(x=>`<div><span>${x.title}</span><strong>${bot.behaviour[x.key]}%</strong></div>`).join('')}</div>`;
}
function displayResults(match:Match):void {
  const holder=document.querySelector<HTMLElement>('#results');
  if(!holder || !match.finished || holder.dataset.shown==='yes')return;
  holder.dataset.shown='yes';
  const rows=([0,1] as const).map(team=>{
    const bots=match.bots.filter(bot=>bot.team===team);
    return {team:team===0?'Blue':'Red',deployed:bots.length,survived:bots.filter(b=>b.health>0).length,
      shots:bots.reduce((n,b)=>n+b.shotsFired,0),
      hits:bots.reduce((n,b)=>n+b.hits,0),
      damage:bots.reduce((n,b)=>n+b.damageDealt,0),
      kills:bots.reduce((n,b)=>n+b.kills,0)};
  });
  holder.innerHTML=`<h2>Battle Results — ${match.winner===null?'Draw':match.winner===0?'Blue victory':'Red victory'}</h2>
    <p>Match duration: ${match.elapsed.toFixed(1)} seconds</p>
    <table><thead><tr><th>Statistic</th><th>Blue</th><th>Red</th></tr></thead><tbody>
    ${([['Robots deployed','deployed'],['Surviving','survived'],['Shots fired','shots'],['Hits','hits'],['Damage inflicted','damage'],['Kills','kills']] as const)
      .map(([label,key])=>`<tr><th>${label}</th><td>${rows[0][key]}</td><td>${rows[1][key]}</td></tr>`).join('')}
    </tbody></table><p class="hint">Weapons are currently instant-hit; every fired shot counts as a hit. Accuracy will become meaningful when we add projectile misses.</p>`;
}
class BattleScene extends Phaser.Scene {
  private match!:Match;
  private board!:Phaser.GameObjects.Graphics;
  private accumulator=0;
  private result!:Phaser.GameObjects.Text;
  private inspectorElapsed=0;
  constructor(){super('battle');}
  create(){
    this.match=currentMatch!;
    this.cameras.main.setBackgroundColor('#101b2b');
    this.board=this.add.graphics();
    this.add.text(24,12,'BOTWARS · BLUE vs RED', {fontFamily:'monospace',fontSize:'19px',color:'#d9edff'});
    this.result=this.add.text(480,300,'',{fontFamily:'monospace',fontSize:'32px',color:'#ffffff',align:'center'}).setOrigin(.5).setDepth(5);
    this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{
      let nearest:Bot|undefined;
      let best=Number.POSITIVE_INFINITY;
      for(const bot of this.match.bots){
        const distance=Math.hypot(pointer.worldX-bot.x,pointer.worldY-bot.y);
        if(distance<=Math.max(20,CLASSES[bot.kind].radius+7)&&distance<best){
          nearest=bot;best=distance;
        }
      }
      if(nearest){battleSelectedId=nearest.id;updateInspector(this.match);}
    });
    updateInspector(this.match);
  }
  update(_time:number,deltaMs:number){
    if(!this.match.finished){
      this.accumulator+=Math.min(deltaMs,100)/1000;
      while(this.accumulator>=1/60){step(this.match,1/60);this.accumulator-=1/60;}
    }
    this.inspectorElapsed+=deltaMs;
    if(this.inspectorElapsed>=200){updateInspector(this.match);this.inspectorElapsed=0;}
    const g=this.board;g.clear();
    g.lineStyle(4,0x637c9a);g.strokeRect(32,32,896,536);
    for(const bot of this.match.bots){
      if(bot.health<=0)continue;
      const spec=CLASSES[bot.kind],color=bot.team===0?0x42c6ee:0xff657e;
      const selected=bot.id===battleSelectedId;
      g.lineStyle(selected?2:1,selected?0x9ff4ff:bot.team===0?0x347493:0x8c4052,selected ? 0.9 : 0.15);
      g.strokeCircle(bot.x,bot.y,spec.radarRange);
      if(selected){
        g.lineStyle(2,0xffe69a,.85);g.strokeCircle(bot.x,bot.y,spec.attackRange);
        g.lineStyle(2,0xffffff);g.strokeCircle(bot.x,bot.y,spec.radius+5);
      }
      g.fillStyle(color);g.fillCircle(bot.x,bot.y,spec.radius);
      g.lineStyle(3,0xffffff,.85);
      g.lineBetween(bot.x,bot.y,bot.x+Math.cos(bot.angle)*spec.radius*1.5,bot.y+Math.sin(bot.angle)*spec.radius*1.5);
      g.fillStyle(0x344055);g.fillRect(bot.x-17,bot.y-spec.radius-11,34,4);
      g.fillStyle(bot.team===0?0x57eac5:0xffbb76);g.fillRect(bot.x-17,bot.y-spec.radius-11,34*bot.health/spec.maxHealth,4);
    }
    for(const shot of this.match.shots){
      const from=this.match.bots.find(bot=>bot.id===shot.from);
      if(from){g.lineStyle(2,0xffe6a0,.8);g.lineBetween(from.x,from.y,shot.x,shot.y);}
    }
    if(this.match.finished){
      this.result.setText(this.match.winner===null?'DRAW':this.match.winner===0?'BLUE WINS':'RED WINS');
      displayResults(this.match);
    }
  }
}
function start():void{
  currentMatch=createMatch(
    roster.map(bot=>({kind:bot.kind,behaviour:{...bot.behaviour}})),
    (['scout','scout','goliath'] as ClassId[]).map(kind=>({kind,behaviour:{...DEFAULT_BEHAVIOUR}}))
  );
  battleSelectedId=null;
  app.innerHTML=`<header class="battle-header"><h1>BOTWARS <span>LIVE MATCH</span></h1></header>
    <div class="battle-layout"><div id="game"></div><aside id="inspector" class="ui-panel inspector"></aside></div>
    <div class="actions"><button id="again">BACK TO SETUP</button></div>
    <p class="hint">Click a robot to inspect it. Cyan circle = selected robot's radar; gold circle = its weapon range. Only the Spy will eventually share radar contacts.</p>
    <section id="results" class="ui-panel results-panel"></section>`;
  document.querySelector<HTMLButtonElement>('#again')!.onclick=setup;
  game=new Phaser.Game({type:Phaser.AUTO,width:ARENA.width,height:ARENA.height,parent:'game',backgroundColor:'#101b2b',scene:[BattleScene],scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_HORIZONTALLY}});
}
setup();
