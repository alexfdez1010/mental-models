import { describe, expect, test } from 'bun:test';
import { reachableKnowledgeWorlds, validateKnowledgeWorlds, type KnowledgeWorld } from '@/components/react/KnowledgeWorlds';

const worlds: KnowledgeWorld[] = [
  {id:'closed',label:'Closed',fact:false,observations:['none','none']},
  {id:'silent',label:'Silent',fact:true,observations:['none','none']},
  {id:'ana',label:'Ana only',fact:true,observations:['received','none']},
  {id:'ben',label:'Ben only',fact:true,observations:['none','received']},
  {id:'both',label:'Both',fact:true,observations:['received','received']},
];
const ids = (set: KnowledgeWorld[]) => set.map(w=>w.id);

describe('finite observation reachability', () => {
  test('separates actual truth, mutual knowledge and common-knowledge counterexample', () => {
    expect(ids(reachableKnowledgeWorlds(worlds,'both',0))).toEqual(['both']);
    const one = reachableKnowledgeWorlds(worlds,'both',1);
    expect(ids(one)).toEqual(['ana','ben','both']);
    expect(one.every(w=>w.fact)).toBe(true);
    const full = reachableKnowledgeWorlds(worlds,'both',2);
    expect(ids(full)).toEqual(['closed','silent','ana','ben','both']);
    expect(full.every(w=>w.fact)).toBe(false);
    expect(ids(reachableKnowledgeWorlds(worlds,'both',3))).toEqual(ids(full));
  });
  test('ideal true announcement restricts relations as well as worlds', () => {
    const prepared = worlds.filter(w=>w.fact);
    const full = reachableKnowledgeWorlds(prepared,'both',prepared.length);
    expect(ids(full)).toEqual(['silent','ana','ben','both']);
    expect(full.every(w=>w.fact)).toBe(true);
    expect(()=>reachableKnowledgeWorlds(prepared,'closed',0)).toThrow('actual world');
  });
  test('does not confuse distributed intersection with group union closure', () => {
    const ana = worlds.filter(w=>w.observations[0]==='received');
    const ben = worlds.filter(w=>w.observations[1]==='received');
    expect(ids(ana)).toEqual(['ana','both']);
    expect(ids(ben)).toEqual(['ben','both']);
    expect(ids(ana.filter(w=>ben.includes(w)))).toEqual(['both']);
    expect(reachableKnowledgeWorlds(worlds,'both',2)).toHaveLength(5);
  });
  test('private acknowledgment needs three links to expose the false world', () => {
    const ack: KnowledgeWorld[] = [
      {id:'closed',label:'Closed',fact:false,observations:['closed/noack','none']},
      {id:'undelivered',label:'Undelivered',fact:true,observations:['ready/noack','none']},
      {id:'delivered',label:'Delivered',fact:true,observations:['ready/noack','received']},
      {id:'acknowledged',label:'Acknowledged',fact:true,observations:['ready/ack','received']},
    ];
    expect(ids(reachableKnowledgeWorlds(ack,'acknowledged',1))).toEqual(['delivered','acknowledged']);
    expect(ids(reachableKnowledgeWorlds(ack,'acknowledged',2))).toEqual(['undelivered','delivered','acknowledged']);
    expect(ids(reachableKnowledgeWorlds(ack,'acknowledged',3))).toEqual(['closed','undelivered','delivered','acknowledged']);
  });
  test('leaves disconnected false worlds outside a true component', () => {
    const disconnected: KnowledgeWorld[] = [
      {id:'false',label:'False',fact:false,observations:['off','off']},
      {id:'true',label:'True',fact:true,observations:['on','on']},
    ];
    expect(ids(reachableKnowledgeWorlds(disconnected,'true',10))).toEqual(['true']);
  });
  test('factivity includes the actual world even before expansion', () => {
    expect(reachableKnowledgeWorlds(worlds,'closed',0).every(w=>w.fact)).toBe(false);
    expect(ids(reachableKnowledgeWorlds(worlds,'closed',100))).toEqual(ids(worlds));
  });
  test('rejects malformed models at authoring time', () => {
    expect(()=>validateKnowledgeWorlds([],['Ana','Ben'])).toThrow('worlds');
    expect(()=>validateKnowledgeWorlds([worlds[0],worlds[0]],['Ana','Ben'])).toThrow('unique');
    expect(()=>validateKnowledgeWorlds([{...worlds[0],observations:['','none']},worlds[1]],['Ana','Ben'])).toThrow('observations');
    expect(()=>validateKnowledgeWorlds([{...worlds[0],fact:undefined as unknown as boolean},worlds[1]],['Ana','Ben'])).toThrow('label/fact');
    expect(()=>validateKnowledgeWorlds(worlds,['','Ben'])).toThrow('agents');
    expect(()=>reachableKnowledgeWorlds(worlds,'missing',0)).toThrow('actual world');
    expect(()=>reachableKnowledgeWorlds(worlds,'both',-1)).toThrow('steps');
    expect(()=>reachableKnowledgeWorlds(worlds,'both',0.5)).toThrow('steps');
  });
});
