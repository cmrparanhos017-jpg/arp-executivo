'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {Layers3} from 'lucide-react';
import Dashboard from './dashboard';
import type {Identity} from '@/lib/access';
export default function AccessGate(){
 const [user,setUser]=useState<Identity|null>(null),[adminMode,setAdminMode]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[invite,setInvite]=useState(''),[tokenType,setTokenType]=useState('invite');
 useEffect(()=>{const hash=new URLSearchParams(location.hash.slice(1)),token=hash.get('convite');if(token){setInvite(token);setTokenType(hash.get('tipo')==='recovery'?'recovery':'invite');setAdminMode(true);history.replaceState(null,'',location.pathname);return;}if(location.hash==='#admin')setAdminMode(true);
 fetch('/api/auth',{cache:'no-store'}).then(r=>r.json()).then(b=>setUser(b.user??null)).catch(()=>{});},[]);
 function showPublic(){setAdminMode(false);setInvite('');setError('');history.replaceState(null,'',location.pathname);}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');const form=new FormData(e.currentTarget);try{
 const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(invite?{action:'accept',tokenHash:invite,tokenType,password:form.get('password')}:{action:'login',email:form.get('email'),password:form.get('password')})});const b=await r.json();if(!r.ok)throw new Error(b.error);setUser(b.user);showPublic();
 }catch(e){setError(e instanceof Error?e.message:'Não foi possível entrar.');}finally{setBusy(false);}}
 if(!adminMode)return <Dashboard identity={user} onLogout={async()=>{if(user){await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});setUser(null);showPublic();}else{setError('');setAdminMode(true);history.replaceState(null,'',location.pathname+'#admin');}}}/>;
 return <main className="auth-page"><form className="auth-card" onSubmit={submit}><span className="brand-mark"><Layers3 size={28}/></span><div className="eyebrow">ARP · ADMINISTRAÇÃO</div><h1>{invite?'Ative seu acesso':'Acesso administrativo'}</h1><p>{invite?'Crie uma senha para concluir seu convite.':'Entre para atualizar a planilha na Central de dados.'}</p>{!invite&&<label>E-mail<input name="email" type="email" autoComplete="username" required maxLength={254}/></label>}<label>{invite?'Crie sua senha (mínimo de 6 caracteres)':'Senha'}<input name="password" type="password" autoComplete={invite?'new-password':'current-password'} required minLength={invite?6:1} maxLength={128}/></label>{error&&<div className="notice warning" role="alert">{error}</div>}<button className="button primary" disabled={busy}>{busy?'Validando…':invite?'Ativar acesso':'Entrar como administrador'}</button><button type="button" className="text-button" onClick={showPublic}>Voltar à consulta pública</button></form></main>;
}
