import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ataValidity} from '../lib/validity';
test('vigência inclui as datas de início e fim e não inventa datas ausentes',()=>{
 const entries=[{starts:'2026-01-01',ends:'2026-11-09'}];
 assert.deepEqual(ataValidity(entries,'2026-11-09'),{label:'01/01/2026 até 09/11/2026',status:'Vigente'});
 assert.equal(ataValidity(entries,'2026-11-10').status,'Vencida');
 assert.equal(ataValidity(entries,'2025-12-31').status,'Vigência futura');
 assert.equal(ataValidity([{starts:null,ends:null}],'2026-11-09').status,'Datas incompletas');
});
test('datas divergentes não são consolidadas como uma vigência única',()=>{
 assert.equal(ataValidity([{starts:'2026-01-01',ends:'2026-12-31'},{starts:'2026-02-01',ends:'2027-01-31'}],'2026-11-09').status,'Por item');
});
