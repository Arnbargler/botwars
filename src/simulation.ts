export type Team = 0 | 1;
export type ClassId = 'scout' | 'goliath';
export interface Specs { maxHealth:number; speed:number; radarRange:number; attackRange:number; damage:number; shotsPerSecond:number; radius:number; cost:number; }
export const CLASSES: Record<ClassId, Specs> = {
  scout:   { maxHealth:90, speed:105, radarRange:200, attackRange:130, damage:9, shotsPerSecond:1.8, radius:10, cost:100 },
  goliath: { maxHealth:360, speed:46, radarRange:145, attackRange:170, damage:27, shotsPerSecond:0.8, radius:18, cost:300 }
};
export interface Behaviour { aggression:number; teamwork:number; caution:number; distance:number; target:number; mobility:number; }
export const DEFAULT_BEHAVIOUR:Behaviour = { aggression:70, teamwork:50, caution:45, distance:50, target:40, mobility:60 };
export interface RosterEntry { kind:ClassId; behaviour:Behaviour; }
export interface Bot { id:number; team:Team; kind:ClassId; x:number; y:number; health:number; cooldown:number; angle:number; behaviour:Behaviour; targetId:number|null; wanderX:number; wanderY:number; wanderStep:number; action:string; visibleEnemies:number; shotsFired:number; hits:number; damageDealt:number; damageTaken:number; kills:number; }
export interface Shot { from:number; to:number; x:number; y:number; damage:number; }
export interface Match { bots:Bot[]; shots:Shot[]; winner:Team|null; finished:boolean; elapsed:number; }
export const ARENA={ width:960,height:600,padding:32 };
export function createMatch(team0:RosterEntry[],team1:RosterEntry[]):Match {
  const bots:Bot[]=[];
  for (const [team, roster] of [[0,team0],[1,team1]] as const) {
    roster.forEach((entry,i)=>{
      const specs=CLASSES[entry.kind];
      bots.push({id:bots.length,team,kind:entry.kind,x:team===0?85:875,y:110+i*100,health:specs.maxHealth,cooldown:0,angle:team===0?0:Math.PI,behaviour:{...entry.behaviour},targetId:null,wanderX:ARENA.width/2,wanderY:ARENA.height/2,wanderStep:0,action:'Searching',visibleEnemies:0,shotsFired:0,hits:0,damageDealt:0,damageTaken:0,kills:0});
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
    // Only the bot's OWN radar contacts are eligible targets.
    const visible=match.bots.filter(other=>other.team!==bot.team&&other.health>0&&dist(bot,other)<=spec.radarRange);
    bot.visibleEnemies=visible.length;
    const teamwork=bot.behaviour.teamwork/100;
    const score=(enemy:Bot)=>{
      const d=dist(bot,enemy);
      const healthFrac=enemy.health/CLASSES[enemy.kind].maxHealth;
      const targetBias=bot.behaviour.target/100;
      // An ally's danger is observable locally, but never grants its radar contacts.
      // A threatened ally is one with a visible enemy in close proximity.
      let help=0;
      if(teamwork>0){
        for(const ally of match.bots){
          if(ally===bot||ally.team!==bot.team||ally.health<=0||dist(bot,ally)>spec.radarRange)continue;
          const dangerRange=CLASSES[enemy.kind].attackRange*1.1;
          const separation=dist(ally,enemy);
          if(separation<dangerRange){
            const allyHealth=ally.health/CLASSES[ally.kind].maxHealth;
            const urgency=(1-separation/dangerRange)*.45 + (1-allyHealth)*.55;
            help=Math.max(help,urgency);
          }
        }
      }
      // Retain a modest current-target bonus to reduce rapid target oscillation.
      const persistence=bot.targetId===enemy.id?.20:0;
      return (1-d/spec.radarRange)*2+(1-targetBias)*(1-healthFrac)+targetBias*healthFrac
        +teamwork*help*2.0+persistence;
    };
    visible.sort((a,b)=>score(b)-score(a));
    const target=visible[0];
    bot.targetId=target?.id??null;
    if(!target) {
      bot.action='Patrolling — no radar contact';
      // Patrol a sequence of waypoints instead of freezing at the centre.
      // Waypoints depend only on this bot's ID and patrol step, never on unseen enemies.
      const dx=bot.wanderX-bot.x,dy=bot.wanderY-bot.y;
      if(Math.hypot(dx,dy)<18) {
        bot.wanderStep++;
        const seed=bot.id*23.17+bot.wanderStep*31.71;
        const margin=ARENA.padding+spec.radius+24;
        bot.wanderX=margin+(ARENA.width-2*margin)*(.5+.5*Math.sin(seed*1.37));
        bot.wanderY=margin+(ARENA.height-2*margin)*(.5+.5*Math.sin(seed*2.11));
      }
      const vx=bot.wanderX-bot.x,vy=bot.wanderY-bot.y;
      const len=Math.hypot(vx,vy)||1;
      const patrolSpeed=spec.speed*(.25+.45*bot.behaviour.mobility/100);
      bot.x+=vx/len*patrolSpeed*dt;
      bot.y+=vy/len*patrolSpeed*dt;
      bot.angle=Math.atan2(vy,vx);
      continue;
    }
    const dx=target.x-bot.x,dy=target.y-bot.y,d=Math.hypot(dx,dy)||1;
    bot.angle=Math.atan2(dy,dx);
    const ideal=spec.attackRange*(.45+bot.behaviour.distance/100*.48);
    const healthFraction=bot.health/spec.maxHealth;
    const retreat=healthFraction<.3&&bot.behaviour.caution>60;
    bot.action=retreat?'Retreating from enemy #'+(target.id+1):d<=spec.attackRange?'Attacking enemy #'+(target.id+1):'Approaching enemy #'+(target.id+1);
    const movement=retreat?-1:(d>ideal?1:d<ideal*.65?-1:0);
    const urge=.4+bot.behaviour.aggression/100*.6;
    // Even cautious bots circle or reposition, rather than becoming stationary turrets.
    // Strafe direction changes occasionally, with per-bot offsets to avoid lockstep.
    const strafeDirection=Math.floor(match.elapsed/5+bot.id*0.7)%2===0?1:-1;
    const strafeSpeed=spec.speed*(.12+.43*bot.behaviour.mobility/100);
    const vx=dx/d*spec.speed*movement*urge + -dy/d*strafeDirection*strafeSpeed;
    const vy=dy/d*spec.speed*movement*urge + dx/d*strafeDirection*strafeSpeed;
    const moveLength=Math.hypot(vx,vy);
    const scale=moveLength>spec.speed?spec.speed/moveLength:1;
    bot.x+=vx*scale*dt;
    bot.y+=vy*scale*dt;
    if(d<=spec.attackRange&&bot.cooldown===0) {
      const dealt=Math.min(target.health,spec.damage);
      target.health-=dealt;
      bot.shotsFired++;
      bot.hits++;
      bot.damageDealt+=dealt;
      target.damageTaken+=dealt;
      if(target.health===0){bot.kills++;target.action='Destroyed';target.targetId=null;target.visibleEnemies=0;}
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
