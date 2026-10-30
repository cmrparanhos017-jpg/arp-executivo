import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
const TOKEN_HASH = Deno.env.get('ARP_TOKEN_SHA256') ?? '93cb77a196149f15a994d3c375fd306d34ef6505e5b70ac928b2922e18d5b80f';
const json = (v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
Deno.serve(async (req:Request)=>{
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(req.headers.get('x-arp-token')??'')))).map(n=>n.toString(16).padStart(2,'0')).join('');
 if(hash!==TOKEN_HASH)return json({error:'Acesso não autorizado.'},401);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const authClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
 const body=await req.json(); const action=body.action;
 const member=async(email:string)=>{const {data,error}=await db.from('arp_members').select('email,role,active').eq('email',email.toLowerCase()).maybeSingle();if(error)throw error;return data?.active?data:null;};
 const identity=async(token:string)=>{const {data,error}=await db.auth.getUser(token);if(error||!data.user?.email||!data.user.email_confirmed_at)return null;const m=await member(data.user.email);return m?{...m,id:data.user.id}:null;};
 if(action==='login'){
  const {data,error}=await authClient.auth.signInWithPassword({email:String(body.email).toLowerCase(),password:String(body.password)});
  if(error||!data.session)return json({error:'E-mail ou senha inválidos.'},401);
  const user=await identity(data.session.access_token);if(!user)return json({error:'Seu acesso não está autorizado.'},403);
  return json({session:data.session,user});
 }
 if(action==='accept'){
  if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)return json({error:'Use uma senha de 12 a 128 caracteres.'},400);
  const {data,error}=await authClient.auth.verifyOtp({token_hash:String(body.tokenHash),type:body.tokenType==='recovery'?'recovery':'invite'});
  if(error||!data.session)return json({error:'Convite inválido ou expirado. Solicite outro ao administrador.'},401);
  const user=await identity(data.session.access_token);if(!user)return json({error:'Convite revogado.'},403);
  const result=await db.auth.admin.updateUserById(user.id,{password:body.password});if(result.error)throw result.error;
  const signed=await authClient.auth.signInWithPassword({email:user.email,password:body.password});
  if(signed.error||!signed.data.session)throw new Error('Falha ao iniciar sessão após ativação.');
  return json({session:signed.data.session,user});
 }
 if(action==='refresh'){
  const {data,error}=await authClient.auth.refreshSession({refresh_token:String(body.refreshToken)});
  if(error||!data.session)return json({error:'Entre novamente.'},401);
  const user=await identity(data.session.access_token);if(!user)return json({error:'Acesso revogado.'},403);
  return json({session:data.session,user});
 }
 const user=await identity(req.headers.get('x-user-token')??'');
 if(!user)return json({error:'Entre para continuar.'},401);
 if(action==='session')return json({user});
 if(action==='logout'){await db.auth.admin.signOut(req.headers.get('x-user-token')!,'local');return json({ok:true});}
 if(user.role!=='admin')return json({error:'Somente o administrador pode gerenciar acessos.'},403);
 if(action==='selfRecovery'){const {data,error}=await db.auth.admin.generateLink({type:'recovery',email:user.email});if(error)throw error;return json({tokenHash:data.properties.hashed_token});}

 if(action==='list'){const {data,error}=await db.from('arp_members').select('email,role,active,created_at').order('created_at');if(error)throw error;return json({members:data});}
 if(action==='revoke'){
  const email=String(body.email).trim().toLowerCase();const {error}=await db.from('arp_members').update({active:false}).eq('email',email).eq('role','viewer');if(error)throw error;return json({ok:true});
 }
 if(action==='invite'){
  const email=String(body.email).trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json({error:'Informe um e-mail válido.'},400);
  const {data:existing}=await db.from('arp_members').select('role').eq('email',email).maybeSingle();
  if(existing?.role==='admin')return json({error:'A conta administrativa já existe.'},400);
  const {data,error}=await db.auth.admin.generateLink({type:'invite',email});
  if(error)return json({error:'Este e-mail já tem uma conta. Reative o acesso existente ou escolha outro e-mail.'},400);
  const save=await db.from('arp_members').upsert({email,role:'viewer',active:true});if(save.error)throw save.error;
  return json({tokenHash:data.properties.hashed_token});
 }
 if(action==='reactivate'){
  const {error}=await db.from('arp_members').update({active:true}).eq('email',String(body.email).toLowerCase()).eq('role','viewer');if(error)throw error;return json({ok:true});
 }
 return json({error:'Operação inválida.'},400);
 }catch{return json({error:'Não foi possível concluir. Tente novamente.'},500);}
});
