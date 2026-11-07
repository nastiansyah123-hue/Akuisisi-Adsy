import {loadMotivation} from './motivationService';
import React,{useState,useEffect}from'react';import{RefreshCw,Pause,Play}from'lucide-react';
const fallbackMessages=[
 'Semangat, Adsy Team. Kita tumbuh bersama.',
 'Satu follow-up bisa membuka peluang baru.',
 'Data rapi, langkah tim lebih pasti.',
 'Langkah kecil hari ini tetap berarti.',
 'Fokus pada proses, rayakan kemajuan.',
 'Dengarkan pelanggan, temukan peluang.',
 'Terus belajar, terus tumbuh bersama.',
 'Kerja tim membuat langkah terasa ringan.',
 'Jaga semangat, beri pelayanan terbaik.',
 'Usaha yang konsisten membangun hasil.',
 'Hari baru, kesempatan baru untuk tumbuh.',
 'Terima kasih sudah bergerak bersama tim.'
];
export default function TeamMotivation(){const[messages,setMessages]=useState(fallbackMessages),[index,setIndex]=useState(()=>Math.floor(Date.now()/180000)%fallbackMessages.length),[paused,setPaused]=useState(false);useEffect(()=>{let alive=true,expiresAt=0,loading=false;async function update(){if(loading||Date.now()<expiresAt||document.visibilityState!=='visible')return;loading=true;try{const data=await loadMotivation();if(alive&&data){setMessages(data.messages);setIndex(0);expiresAt=data.expiresAt||Date.now()+3600000;}else expiresAt=Date.now()+300000;}catch{expiresAt=Date.now()+300000;}finally{loading=false;}}update();const timer=setInterval(update,180000);return()=>{alive=false;clearInterval(timer)}},[]);useEffect(()=>{if(paused)return;const id=setInterval(()=>{if(document.visibilityState==='visible')setIndex(i=>(i+1)%messages.length)},180000);return()=>clearInterval(id)},[paused,messages.length]);return <div className="motivation-block"><div className="motivation-heading"><h1>{messages[index%messages.length]}</h1><div className="motivation-actions"><button title="Pesan semangat berikutnya" aria-label="Pesan semangat berikutnya" onClick={()=>setIndex(i=>(i+1)%messages.length)}><RefreshCw size={14}/></button><button title={paused?'Lanjutkan pergantian pesan':'Jeda pergantian pesan'} aria-label={paused?'Lanjutkan pergantian pesan':'Jeda pergantian pesan'} aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?<Play size={14}/>:<Pause size={14}/>}</button></div></div></div>}
