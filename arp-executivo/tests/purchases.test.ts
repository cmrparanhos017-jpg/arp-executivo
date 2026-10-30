import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {toEntries,totalize,type Dataset} from '../lib/arp';
import {groupPurchases,itemDestination,pncpReference} from '../lib/purchases';
const original=JSON.parse(fs.readFileSync('data/initial-dataset.json','utf8')) as Dataset;
test('hierarquia por compra preserva todos os itens e totais sem duplicar atas',()=>{
 const entries=toEntries(original),groups=groupPurchases(entries);
 assert.equal(groups.length,38);assert.equal(groups.reduce((n,g)=>n+g.atas.length,0),399);
 assert.equal(new Set(groups.flatMap(g=>g.entries.map(e=>e.id))).size,2121);
 assert.equal(totalize(groups.flatMap(g=>g.entries)).availableValue.toFixed(2),'3833555.77');
 for(const g of groups)assert.ok(g.atas.every(a=>a.entries.every(e=>e.raw.UGG===g.raw.UGG&&e.raw['Nº COMPRA']===g.raw['Nº COMPRA'])));
});
test('links legados usam PNCP sem modificar a célula original',()=>{
 const raw=toEntries(original)[0].raw,source=raw['LINK ITEM'];
 const result=itemDestination(raw);assert.equal(result.legacy,true);assert.equal(result.url,raw['LINK COMPRA PNCP']);assert.equal(raw['LINK ITEM'],source);
 assert.deepEqual(pncpReference('https://pncp.gov.br/app/editais/00394452000103/2025/010771'),{cnpj:'00394452000103',year:'2025',sequence:'10771'});
 assert.equal(pncpReference('https://attacker.example/app/editais/00394452000103/2025/10771'),null);
});
