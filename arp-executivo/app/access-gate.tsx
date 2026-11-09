'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ShieldCheck,Layers3,LoaderCircle} from 'lucide-react';
import Dashboard from './dashboard';
import type {Identity} from '@/lib/access';
type Mode='password'|'email'|'code'|'request';
export default function AccessGate(){
 const [user,setUser]=useState<Identity|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[invite,setInvite]=useState(''),[tokenType,setTokenType]=useState('invite'),[mode,setMode]=useState<Mode>('password'),[email,setEmail]=useState(''),[otpEnabled,setOtpEnabled]=useState(false);
 useEffect(()=>{const params=new URLSearchParams(location.hash.slice(1)),hash=params.get('convite');if(hash){setInvite(hash);setTokenType(params.get('tipo')==='recovery'?'recovery':'invite');history.replaceState(null,'',location.pathname);setLoading(false);return;}
 fetch('/api/auth',{cache:'no-store'}).then(r=>r.json()).then(b=>{setUser(b.user??null);setOtpEnabled(b.otpEnabled===true);if(b.otpEnabled)setMode('email');}).catch(()=>setError('Não foi possível consultar o acesso.')).finally(()=>setLoading(false));},[]);
 function change(next:Mode){setMode(next);setError('');setMessage('');}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');setMessage('');const form=new FormData(e.currentTarget);
 const body=invite?{action:'accept',tokenHash:invite,tokenType,password:form.get('password')}:mode==='password'?{action:'login',email,password:form.get('password')}:mode==='email'?{action:'issueCode',email}:mode==='code'?{action:'verifyCode',email,code:form.get('code')}:{action:'requestAccess',email};
 try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const b=await r.json();if(!r.ok)throw new Error(b.error);
 if(body.action==='issueCode'){setMode('code');setMessage(b.message);}else if(body.action==='requestAccess'){setMessage(b.message);}else{setInvite('');setUser(b.user);}
 }catch(e){setError(e instanceof Error?e.message:'Falha ao entrar.');}finally{setBusy(false);}}
 if(loading)return <main className="auth-page"><LoaderCircle className="animate-spin" aria-label="Verificando acesso"/></main>;
 if(user)return <Dashboard identity={user} onLogout={async()=>{await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});setUser(null);}}/>;
 const title=invite?'Ative seu convite':mode==='request'?'Solicite seu acesso':mode==='code'?'Confira seu e-mail':'Bem-vindo ao seu painel';
 const description=invite?'Crie uma senha para concluir este convite.':mode==='request'?'Informe seu e-mail. O administrador analisará sua solicitação antes de liberar a consulta.':mode==='code'?`Digite o código recebido em ${email}. Você precisa ter acesso aprovado.`:mode==='email'?'Entre com seu e-mail aprovado. Você receberá um código pessoal para acessar, sem criar uma senha.':'Entre com seu e-mail e senha atuais.';
 return <main className="auth-page"><form className="auth-card" onSubmit={submit}><span className="brand-mark"><Layers3 size={28}/></span><div className="eyebrow">ARP · GESTÃO EXECUTIVA</div><h1>{title}</h1><p>{description}</p>
 {!invite&&mode!=='code'&&<label>E-mail<input name="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/></label>}
 {(invite||mode==='password')&&<label>{invite?'Crie sua senha (mínimo de 6 caracteres)':'Senha'}<input name="password" type="password" autoComplete={invite?'new-password':'current-password'} required minLength={invite?6:1} maxLength={128}/></label>}
 {!invite&&mode==='code'&&<label>Código de acesso<input className="otp-input" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required placeholder="Digite o código"/></label>}
 {error&&<div className="notice warning" role="alert">{error}</div>}{message&&<div className="notice" role="status">{message}</div>}
 <button className="button primary" disabled={busy||(mode==='request'&&!!message)}>{busy?'Aguarde…':invite?'Ativar convite':mode==='request'?'Solicitar acesso':mode==='email'?'Receber código por e-mail':mode==='code'?'Confirmar código e entrar':'Entrar no dashboard'}</button>
 {!invite&&mode!=='request'&&<button type="button" className="text-button" onClick={()=>change('request')}>Ainda não tenho acesso · Solicitar</button>}
 {!invite&&mode!=='password'&&<button type="button" className="text-button" onClick={()=>change('password')}>Entrar com minha senha atual</button>}
 {!invite&&otpEnabled&&mode!=='email'&&<button type="button" className="text-button" onClick={()=>change('email')}>{mode==='code'?'Trocar e-mail ou pedir novo código':'Entrar sem senha · Receber código'}</button>}
 {invite&&<button type="button" className="text-button" onClick={()=>{setInvite('');change('password');}}>Voltar ao login</button>}
 <small><ShieldCheck size={16}/>Acesso aprovado pelo administrador · Consulta restrita</small></form></main>;
}
