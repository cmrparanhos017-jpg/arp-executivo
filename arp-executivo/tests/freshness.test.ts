import{test}from'node:test';
import assert from'node:assert/strict';
import{baseFreshness,updateNoticeId}from'../lib/freshness';
const stamp='2026-10-30T15:00:00Z',time=Date.parse(stamp),day=86400000;
test('aviso amarelo somente após mais de dez dias, incluindo a fronteira exata',()=>{
 assert.equal(baseFreshness(stamp,time+10*day).stale,false);
 assert.equal(baseFreshness(stamp,time+10*day+1).stale,true);
 assert.equal(baseFreshness(stamp,time+11*day).days,11);
 assert.match(baseFreshness(stamp,time).dateLabel,/30\/10\/2026/);
 assert.match(baseFreshness(stamp,time).dateLabel,/12:00/);
});
test('metadados ausentes, inválidos ou futuros não viram datas ou idades inventadas',()=>{
 for(const value of [null,undefined,'','invalid','2026-12-01T00:00:00Z']){
  const f=baseFreshness(value,time);assert.equal(f.known,false);assert.equal(f.days,null);assert.equal(f.stale,false);
 }
});
test('nova importação ou transição para desatualizada abre um novo aviso na mesma sessão',()=>{
 const old=updateNoticeId('supabase',1,stamp,false);
 assert.notEqual(old,updateNoticeId('supabase',2,stamp,false));
 assert.notEqual(old,updateNoticeId('supabase',1,'2026-10-31T15:00:00Z',false));
 assert.notEqual(old,updateNoticeId('supabase',1,stamp,true));
 assert.equal(old,updateNoticeId('supabase',1,stamp,false));
});
