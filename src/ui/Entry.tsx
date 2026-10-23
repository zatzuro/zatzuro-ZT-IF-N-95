import { useEffect, useState, type FormEvent } from 'react';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import App from './App';
import FinanceApp from './FinanceApp';
import './finance.css';

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string|undefined;
const configured=Boolean(url?.startsWith('https://') && key?.startsWith('sb_publishable_'));
export const financeClient:SupabaseClient|null=configured?createClient(url!,key!,{
 auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}
}):null;

export default function Entry(){
 const [user,setUser]=useState<User|null>(null);
 const [checking,setChecking]=useState(true);
 const [allowed,setAllowed]=useState(false);
 const [demo,setDemo]=useState(false);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  const client=financeClient;if(!client){setChecking(false);return;}
  let alive=true;
  const check=async()=>{
   try{
    const {data:{user:verified},error:e}=await client.auth.getUser();
    if(e && e.name!=='AuthSessionMissingError')throw e;
    if(!alive)return;
    setUser(verified);
    if(verified){
      const {data, error:rpcError}=await client.rpc('is_authorized_owner');
      if(rpcError)throw rpcError;
      if(alive)setAllowed(data===true);
    } else setAllowed(false);
   }catch {if(alive){setAllowed(false);setError('No fue posible verificar la sesión y autorización. Acceso bloqueado.');}}
   finally{if(alive)setChecking(false);}
  };
  void check();
  const {data:{subscription}}=client.auth.onAuthStateChange(()=>{setChecking(true);window.setTimeout(()=>void check(),0);});
  return()=>{alive=false;subscription.unsubscribe();};
 },[]);
 const submit=async(e:FormEvent)=>{
  e.preventDefault();if(!financeClient)return;
  setBusy(true);setError('');
  try{
   const response=await financeClient.auth.signInWithPassword({email,password});
   if(response.error)throw response.error;
   setError('Sesión iniciada; verificando acceso...');
  }catch(e){setError(e instanceof Error?e.message:'Error de autenticación');}
  finally{setBusy(false);}
 };
 if(demo)return <div className="fs-demo"><div className="fs-demo-strip">VISTA PÚBLICA DE EJEMPLO · NO MUESTRA DATOS PRIVADOS <button onClick={()=>setDemo(false)}>Regresar al acceso privado</button></div><App/></div>;
 if(checking)return <div className="fs-auth"><div className="fs-login">Validando acceso privado…</div></div>;
 if(user&&allowed&&financeClient)return <FinanceApp client={financeClient} user={user} onExit={async()=>{await financeClient!.auth.signOut();setUser(null);setAllowed(false);}}/>;
 return <div className="fs-auth"><div className="fs-login">
   <div className="fs-logo">▥ <span>FINANZAS SANTI</span></div>
   <h1>Tu patrimonio, bajo control</h1><p>Acceso privado. Ningún dato financiero está disponible sin una cuenta autorizada.</p>
   {!configured?<div role="alert" className="fs-warning">Configuración pública de Supabase pendiente. El sistema permanece cerrado: definir VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en el build de Pages.</div>:
   user&&!allowed?<div role="alert" className="fs-warning">Tu cuenta inició sesión, pero todavía no está autorizada como propietaria. Solicita la activación administrativa tras verificar tu identidad. <button onClick={()=>financeClient?.auth.signOut()}>Cerrar sesión</button></div>:
   <form onSubmit={e=>void submit(e)}>
    <label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>Contraseña<input type="password" autoComplete="current-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <button className="fs-primary" type="submit" disabled={busy}>{busy?'Verificando…':'Ingresar al dashboard'}</button>
   </form>}
   {error&&<p role="alert" className="fs-warning">{error}</p>}
   <button className="fs-secondary" onClick={()=>setDemo(true)}>Ver demostración con datos ficticios →</button>
   <small>Sin cuentas compartidas · Sin claves privadas en el navegador · RLS obligatorio</small>
 </div></div>;
}
