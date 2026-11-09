import nodemailer from 'npm:nodemailer@10.4.0';
import {mailConfig} from './mail-config.ts';
function config(){return mailConfig({SMTP_HOST:Deno.env.get('SMTP_HOST'),SMTP_PORT:Deno.env.get('SMTP_PORT'),SMTP_USER:Deno.env.get('SMTP_USER'),SMTP_PASS:Deno.env.get('SMTP_PASS'),SMTP_FROM:Deno.env.get('SMTP_FROM')});}
export function mailConfigured(){return config()!==null;}
export async function sendAccessCode(email:string,code:string){
 const settings=config();if(!settings)throw new Error('Envio não configurado.');
 if(!/^\d{6,10}$/.test(code))throw new Error('Código inválido.');
 const {from,...options}=settings;
 const transport=nodemailer.createTransport({...options,connectionTimeout:10000,socketTimeout:15000,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
 try{const result=await transport.sendMail({from:{name:'Dashboard ARP Executivo',address:from},to:email,subject:'Seu código de acesso ao Dashboard ARP',text:`Seu código de acesso é: ${code}\n\nDigite-o no Dashboard ARP Executivo. O código é pessoal e de uso único. Se você não solicitou este acesso, ignore a mensagem.`});
 if(!result.accepted?.length)throw new Error('E-mail não aceito.');
 }finally{transport.close();}
}
