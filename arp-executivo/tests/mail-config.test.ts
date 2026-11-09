import{test}from'node:test';
import assert from'node:assert/strict';
import{mailConfig}from'../supabase/functions/arp-access/mail-config';
test('envio de códigos fica desativado sem configuração completa',()=>{
 assert.equal(mailConfig({}),null);
 assert.equal(mailConfig({SMTP_HOST:'smtp.example.invalid',SMTP_USER:'user',SMTP_PASS:'test'}),null);
});
test('transporte exige TLS e rejeita remetente ou porta inválidos',()=>{
 const env={SMTP_HOST:'smtp.example.invalid',SMTP_USER:'user',SMTP_PASS:'test',SMTP_FROM:'arp@example.invalid'};
 assert.equal(mailConfig({...env,SMTP_PORT:'587'})?.requireTLS,true);
 assert.equal(mailConfig({...env,SMTP_PORT:'465'})?.secure,true);
 assert.equal(mailConfig({...env,SMTP_PORT:'25'}),null);
 assert.equal(mailConfig({...env,SMTP_FROM:'x@example.invalid\r\nBcc: other@example.invalid'}),null);
});
