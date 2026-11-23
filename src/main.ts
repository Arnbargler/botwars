import Phaser from 'phaser';
import { ARENA, CLASSES, DEFAULT_BEHAVIOUR, createMatch, step, type Behaviour, type ClassId, type Match } from './simulation';
import './style.css';

const app=document.querySelector<HTMLDivElement>('#app')!;
const budget=700;
let roster:ClassId[]=['scout','scout','goliath'];
let behaviour:Behaviour={...DEFAULT_BEHAVIOUR};
let game:Phaser.Game|null=null;
let currentMatch:Match|null=null;

function rosterCost():number {return roster.reduce((sum,id)=>sum+CLASSES[id].cost,0);}
const sliderLabels: {key:keyof Behaviour;title:string;low:string;high:string}[]=[
  {key:'aggression',title:'Aggression',low:'Timid',high:'Aggressive'},
  {key:'teamwork',title:'Teamwork',low:'Lone wolf',high:'Helps teammates'},
  {key:'caution',title:'Self-preservation',low:'Reckless',high:'Cautious'},
  {key:'distance',title:'Engagement',low:'Close combat',high:'Keep distance'},
  {key:'target',title:'Target preference',low:'Weakest',high:'Strongest'},
  {key:'mobility',title:'Mobility',low:'Hold position',high:'Keep moving'}
];
function setup():void {
  game?.destroy(true);game=null;currentMatch=null;
  app.innerHTML=`<header><h1>BOTWARS <span>v0.1</span></h1><p>BUILD YOUR TEAM · CONFIGURE BEHAVIOUR · WATCH THEM FIGHT</p></header>
  <section class="panel"><h2>Team Blue · ${rosterCost()} / ${budget} credits</h2>
  <div id="roster"></div><div class="actions"><button id="addScout">+ Scout (100)</button><button id="addGoliath">+ Goliath (300)</button></div></section>
  <section class="panel"><h2>Team behaviour (individual settings come next)</h2><div id="sliders"></div></section>
  <section class="panel"><h2>Opponent: 2 Scouts + 1 Goliath</h2><p>Test match: simple arena, fixed-step simulation, independent radar. First team eliminated loses.</p><button id="ready" class="primary">READY — START BATTLE</button></section>`;
  const update=()=>{
    document.querySelector('#roster')!.innerHTML=roster.map((kind,i)=>`<div class="bot"><strong>${kind.toUpperCase()} #${i+1}</strong><span>HP ${CLASSES[kind].maxHealth} · speed ${CLASSES[kind].speed} · radar ${CLASSES[kind].radarRange} · weapon range ${CLASSES[kind].attackRange}</span><button data-remove="${i}">Remove</button></div>`).join('');
    document.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(b=>b.onclick=()=>{roster.splice(Number(b.dataset.remove),1);setup();});
    document.querySelector<HTMLHeadingElement>('.panel h2')!.textContent=`Team Blue · ${rosterCost()} / ${budget} credits`;
    (document.querySelector<HTMLButtonElement>('#addScout')!).disabled=rosterCost()+100>budget;
    (document.querySelector<HTMLButtonElement>('#addGoliath')!).disabled=rosterCost()+300>budget;
    (document.querySelector<HTMLButtonElement>('#ready')!).disabled=roster.length===0;
  };
  document.querySelector('#sliders')!.innerHTML=sliderLabels.map(s=>`<label class="slider"><span>${s.title}</span><div><small>${s.low}</small><input type="range" min="0" max="100" value="${behaviour[s.key]}" data-setting="${s.key}"/><small>${s.high}</small><output>${behaviour[s.key]}</output></div></label>`).join('');
  document.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input=>input.oninput=()=>{const key=input.dataset.setting as keyof Behaviour;behaviour[key]=Number(input.value);input.nextElementSibling!.textContent=input.value;});
  document.querySelector<HTMLButtonElement>('#addScout')!.onclick=()=>{roster.push('scout');update();};
  document.querySelector<HTMLButtonElement>('#addGoliath')!.onclick=()=>{roster.push('goliath');update();};
  document.querySelector<HTMLButtonElement>('#ready')!.onclick=start;
  update();
}
class BattleScene extends Phaser.Scene {
  private match!:Match;
  private board!:Phaser.GameObjects.Graphics;
  private accumulator=0;
  private result!:Phaser.GameObjects.Text;
  constructor(){super('battle');}
  create(){
    this.match=currentMatch!;
    this.cameras.main.setBackgroundColor('#101b2b');
    this.board=this.add.graphics();
    this.add.text(24,12,'BOTWARS · BLUE vs RED', {fontFamily:'monospace',fontSize:'19px',color:'#d9edff'});
    this.result=this.add.text(480,300,'',{fontFamily:'monospace',fontSize:'32px',color:'#ffffff',align:'center'}).setOrigin(.5).setDepth(5);
  }
  update(_time:number,deltaMs:number){
    if(!this.match.finished){
      this.accumulator+=Math.min(deltaMs,100)/1000;
      while(this.accumulator>=1/60){step(this.match,1/60);this.accumulator-=1/60;}
    }
    const g=this.board;g.clear();
    g.lineStyle(4,0x637c9a);g.strokeRect(32,32,896,536);
    for(const b of this.match.bots){
      if(b.health<=0)continue;
      const s=CLASSES[b.kind],color=b.team===0?0x42c6ee:0xff657e;
      g.lineStyle(1,b.team===0?0x347493:0x8c4052,.20);
      g.strokeCircle(b.x,b.y,s.radarRange);
      g.fillStyle(color);g.fillCircle(b.x,b.y,s.radius);
      g.lineStyle(3,0xffffff,.85);
      g.lineBetween(b.x,b.y,b.x+Math.cos(b.angle)*s.radius*1.5,b.y+Math.sin(b.angle)*s.radius*1.5);
      g.fillStyle(0x344055);g.fillRect(b.x-17,b.y-s.radius-11,34,4);
      g.fillStyle(b.team===0?0x57eac5:0xffbb76);g.fillRect(b.x-17,b.y-s.radius-11,34*b.health/s.maxHealth,4);
    }
    for(const shot of this.match.shots){
      const from=this.match.bots.find(b=>b.id===shot.from);
      if(from){g.lineStyle(2,0xffe6a0,.8);g.lineBetween(from.x,from.y,shot.x,shot.y);}
    }
    if(this.match.finished) this.result.setText(this.match.winner===null?'DRAW':this.match.winner===0?'BLUE WINS':'RED WINS');
  }
}
function start():void{
  currentMatch=createMatch(roster,['scout','scout','goliath'],behaviour);
  app.innerHTML='<header><h1>BOTWARS <span>LIVE MATCH</span></h1></header><div id="game"></div><div class="actions"><button id="again">BACK TO SETUP</button></div><p class="hint">Thin circles indicate each bot\'s radar range. Radar is local; no ordinary bot can share contacts. Gold lines indicate shots.</p>';
  document.querySelector<HTMLButtonElement>('#again')!.onclick=setup;
  game=new Phaser.Game({type:Phaser.AUTO,width:ARENA.width,height:ARENA.height,parent:'game',backgroundColor:'#101b2b',scene:[BattleScene],scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_HORIZONTALLY}});
}
setup();
