import { describe, expect, test } from 'bun:test';
import { thresholdHistory, thresholdNext, validateThresholdNetwork, type ThresholdTeam } from '@/components/react/NetworkThresholdTrace';
const teams: ThresholdTeam[] = ['A','B','C','D','E'].map(id=>({id,label:id,threshold:id==='D'?2:1}));
const arcs: [string,string][] = [['A','B'],['B','C'],['C','A'],['A','D'],['C','D'],['D','E']];
describe('declared local-threshold traces',()=>{
  test('a snapshot prevents in-place propagation and preserves committed seeds',()=>{
    expect(thresholdNext(teams,arcs,['A'])).toEqual(['B']);
    expect(thresholdHistory(teams,arcs,['A']).map(r=>r.newly)).toEqual([['A'],['B'],['C'],['D'],['E']]);
    expect(thresholdHistory(teams,arcs,['D']).map(r=>r.active)).toEqual([['D'],['D','E']]);
  });
  test('empty positive-threshold cycle and terminal-only seed are fixed points',()=>{
    expect(thresholdHistory(teams,arcs,[])).toEqual([{active:[],newly:[]}]);
    expect(thresholdHistory(teams,arcs,['E'])).toEqual([{active:['E'],newly:['E']}]);
  });
  test('equal seed budgets and eventual reach can have different deadlines',()=>{
    expect(thresholdHistory(teams,arcs,['A','D']).map(r=>r.newly)).toEqual([['A','D'],['B','E'],['C']]);
    expect(thresholdHistory(teams,arcs,['A','E']).map(r=>r.newly)).toEqual([['A','E'],['B'],['C'],['D']]);
    expect(thresholdHistory(teams,arcs,['A','C']).map(r=>r.newly)).toEqual([['A','C'],['B','D'],['E']]);
  });
  test('one changed local threshold alters timing without changing reach',()=>{
    const changed=teams.map(t=>t.id==='D'?{...t,threshold:1}:t);
    expect(thresholdHistory(changed,arcs,['A']).map(r=>r.newly)).toEqual([['A'],['B','D'],['C','E']]);
  });
  test('all seed sets terminate and satisfy independent bit-mask recurrence',()=>{
    for(const d of [1,2])for(let m=0;m<32;m++){
      const configured=teams.map(t=>t.id==='D'?{...t,threshold:d}:t),seeds=teams.filter((_,j)=>m>>j&1).map(t=>t.id);
      const history=thresholdHistory(configured,arcs,seeds);let mask=m;
      for(let round=0;round<history.length;round++){
        expect(history[round]!.active).toEqual(teams.filter((_,j)=>mask>>j&1).map(t=>t.id));
        let next=mask;for(let j=0;j<5;j++){const contacts=arcs.reduce((n,[s,t])=>n+(t===teams[j]!.id&&(mask>>teams.findIndex(x=>x.id===s)&1)?1:0),0);if(contacts>=configured[j]!.threshold)next|=1<<j}mask=next;
      }
      expect(history.length).toBeLessThanOrEqual(5);
      expect(thresholdNext(configured,arcs,history.at(-1)!.active)).toEqual([]);
    }
  });
  test('extra seeds cannot reduce any same-round active set under fixed rules',()=>{
    for(let a=0;a<32;a++)for(let b=0;b<32;b++)if((a&b)===a){const x=thresholdHistory(teams,arcs,teams.filter((_,i)=>a>>i&1).map(t=>t.id)),y=thresholdHistory(teams,arcs,teams.filter((_,i)=>b>>i&1).map(t=>t.id));for(let t=0;t<6;t++)expect(x[Math.min(t,x.length-1)]!.active.every(id=>y[Math.min(t,y.length-1)]!.active.includes(id))).toBe(true)}
  });
  test('rejects a missing team entry with the named input error',()=>{
    const sparse=[teams[0],teams[1],,teams[3],teams[4]] as ThresholdTeam[];
    expect(()=>validateThresholdNetwork(sparse,arcs,[],'D')).toThrow('NetworkThresholdTrace');
  });
  test('rejects a missing contact entry instead of silently omitting it',()=>{
    expect(()=>validateThresholdNetwork(teams,new Array<[string,string]>(1),[],'D')).toThrow('NetworkThresholdTrace');
  });
  test('rejects a missing committed-seed entry',()=>{
    expect(()=>validateThresholdNetwork(teams,arcs,new Array<string>(1),'D')).toThrow('NetworkThresholdTrace');
  });
  test('rejects invalid graph inputs while allowing unreachable thresholds',()=>{
    expect(()=>validateThresholdNetwork(teams,arcs,['A'],'D')).not.toThrow();
    expect(()=>validateThresholdNetwork(teams,arcs,['A','A'],'D')).toThrow();
    expect(()=>validateThresholdNetwork(teams,[...arcs,['A','B']],[],'D')).toThrow();
    expect(()=>validateThresholdNetwork(teams,[['A','X']],[],'D')).toThrow();
    expect(()=>validateThresholdNetwork(teams,[['A','A']],[],'D')).toThrow();
    expect(()=>validateThresholdNetwork(teams,arcs,['X'],'D')).toThrow();
    expect(()=>validateThresholdNetwork(teams,arcs,[],'X')).toThrow();
    expect(()=>validateThresholdNetwork(teams.slice(0,4),arcs,[],'D')).toThrow();
    expect(()=>validateThresholdNetwork(teams.map(t=>t.id==='A'?{...t,id:'B'}:t),arcs,[],'D')).toThrow();
    expect(()=>validateThresholdNetwork(teams.map(t=>t.id==='A'?{...t,label:''}:t),arcs,[],'D')).toThrow();
    for(const bad of [0,-1,1.5,NaN,Infinity])expect(()=>validateThresholdNetwork(teams.map(t=>t.id==='A'?{...t,threshold:bad}:t),arcs,[],'D')).toThrow();
    expect(()=>validateThresholdNetwork(teams.map(t=>t.id==='A'?{...t,threshold:10}:t),arcs,[],'D')).not.toThrow();
  });
});
