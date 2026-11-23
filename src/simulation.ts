export type Team = 0 | 1;
export type ClassId = 'scout' | 'goliath';
export interface Specs { maxHealth:number; speed:number; radarRange:number; attackRange:number; damage:number; shotsPerSecond:number; radius:number; cost:number; }
export const CLASSES: Record<ClassId, Specs> = {
  scout:   { maxHealth:90, speed:105, radarRange:200, attackRange:130, damage:9, shotsPerSecond:1.8, radius:10, cost:100 },
  goliath: { maxHealth:360, speed:46, radarRange:145, attackRange:170, damage:27, shotsPerSecond:0.8, radius:18, cost:300 }
};
export interface Behaviour { aggression:number; teamwork:number; caution:number; distance:number; target:number; mobility:number; }
export const DEFAULT_BEHAVIOUR:Behaviour = { aggression:70, teamwork:50, caution:45, distance:50, target:40, mobility:60 };
export interface Bot { id:number; team:Team; kind:ClassId; x:number; y:number; health:number; cooldown:number; angle:number; behaviour:Behaviour; targetId:number|null; }
export interface Shot { from:number; to:number; x:number; y:number; damage:number; }
export interface Match { bots:Bot[]; shots:Shot[]; winner:Team|null; finished:boolean; elapsed:number; }
export const ARENA={ width:960,height:600,padding:32 };
export function createMatch(team0:ClassId[],team1:ClassId[],behaviour:Behaviour):Match {
  const bots:Bot[]=[];
  for (const [team, roster] of [[0,team0],[1,team1]] as const) {
    roster.forEach((kind,i)=>{
      const specs=CLASSES[kind];
      bots.push({id:bots.length,team,kind,x:team===0?85:875,y:110+i*100,health:specs.maxHealth,cooldown:0,angle:team===0?0:Math.PI,behaviour:{...behaviour},targetId:null});
    });
  }
  return {bots,shots:[],winner:null,finished:false,elapsed:0};
}
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
const dist=(a:Bot,b:Bot)=>Math.hypot(a.x-b.x,a.y-b.y);
export function step(match:Match,dt:number):void {
  if(match.finished)return;
  match.elapsed+=dt;
  match.shots=[];
  // Every target must be locally detected. Normal bots never share radar contacts.
  for(const bot of match.bots) {
    if(bot.health<=0)continue;
    const spec=CLASSES[bot.kind];
    bot.cooldown=Math.max(0,bot.cooldown-dt);
    const visible=match.bots.filter(other=>other.team!==bot.team&&other.health>0&&dist(bot,other)<=spec.radarRange);
    const score=(enemy:Bot)=>{
      const d=dist(bot,enemy);
      const healthFrac=enemy.health/CLASSES[enemy.kind].maxHealth;
      const targetBias=bot.behaviour.target/100;
      return (1-d/spec.radarRange)*2 + (1-targetBias)*(1-healthFrac) + targetBias*healthFrac;
    };
    visible.sort((a,b)=>score(b)-score(a));
    const target=visible[0];
    bot.targetId=target?.id??null;
    if(!target) {
      // Basic searching: move toward centre, but never follow invisible opponents.
      const dx=ARENA.width/2-bot.x, dy=ARENA.height/2-bot.y;
      const len=Math.hypot(dx,dy)||1;
      bot.x+=dx/len*spec.speed*dt*.35;
      bot.y+=dy/len*spec.speed*dt*.35;
      continue;
    }
    const dx=target.x-bot.x,dy=target.y-bot.y,d=Math.hypot(dx,dy)||1;
    bot.angle=Math.atan2(dy,dx);
    const ideal=spec.attackRange*(.45+bot.behaviour.distance/100*.48);
    const healthFraction=bot.health/spec.maxHealth;
    const retreat=healthFraction<.3&&bot.behaviour.caution>60;
    const movement=retreat?-1:(d>ideal?1:d<ideal*.65?-1:0);
    const urge=.4+bot.behaviour.aggression/100*.6;
    bot.x+=dx/d*spec.speed*dt*movement*urge;
    bot.y+=dy/d*spec.speed*dt*movement*urge;
    if(d<=spec.attackRange&&bot.cooldown===0) {
      target.health=Math.max(0,target.health-spec.damage);
      bot.cooldown=1/spec.shotsPerSecond;
      match.shots.push({from:bot.id,to:target.id,x:target.x,y:target.y,damage:spec.damage});
    }
  }
  for(const b of match.bots){
    const r=CLASSES[b.kind].radius;
    b.x=clamp(b.x,ARENA.padding+r,ARENA.width-ARENA.padding-r);
    b.y=clamp(b.y,ARENA.padding+r,ARENA.height-ARENA.padding-r);
  }
  const alive0=match.bots.some(b=>b.team===0&&b.health>0);
  const alive1=match.bots.some(b=>b.team===1&&b.health>0);
  if(!alive0||!alive1||match.elapsed>=180){
    match.finished=true;
    match.winner=alive0&&!alive1?0:alive1&&!alive0?1:null;
  }
}
