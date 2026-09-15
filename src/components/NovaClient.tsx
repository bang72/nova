"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Bookmark, Compass, Home, MessageCircle, Search, Settings, UserRound, Moon, Plus, Send, ShieldCheck, WalletCards } from "lucide-react";

type Post = { id:string; name:string; handle:string; body:string; time:string; liked:boolean; saved:boolean; replies:number };
type Message = { id:string; from:"me"|"them"; body:string; time:string };

const seedPosts: Post[] = [
  {id:"p1",name:"Mira",handle:"@mira",time:"8m",body:"I miss when the internet felt like a place you visited, not somewhere that followed you everywhere.",liked:false,saved:false,replies:12},
  {id:"p2",name:"Ari",handle:"@ari",time:"31m",body:"Made coffee, turned the phone face down, finished the thing I kept postponing. Small win.",liked:false,saved:false,replies:4},
  {id:"p3",name:"Nara",handle:"@nara",time:"1h",body:"What are you listening to tonight? I need something slow.",liked:false,saved:false,replies:18},
];

export default function NovaClient(){
  const [tab,setTab]=useState("Home");
  const [quiet,setQuiet]=useState(true);
  const [composer,setComposer]=useState("");
  const [posts,setPosts]=useState<Post[]>(seedPosts);
  const [query,setQuery]=useState("");
  const [messages,setMessages]=useState<Message[]>([{id:"m1",from:"them",body:"You around tonight?",time:"22:04"},{id:"m2",from:"me",body:"Yeah. Keeping it quiet though.",time:"22:08"}]);
  const [draft,setDraft]=useState("");
  const [hydrated,setHydrated]=useState(false);

  useEffect(()=>{
    const saved=localStorage.getItem("nova-beta-state");
    if(saved){ try{ const parsed=JSON.parse(saved); if(parsed.posts) setPosts(parsed.posts); if(typeof parsed.quiet==="boolean") setQuiet(parsed.quiet); }catch{} }
    setHydrated(true);
  },[]);
  useEffect(()=>{ if(hydrated) localStorage.setItem("nova-beta-state",JSON.stringify({posts,quiet})); },[posts,quiet,hydrated]);

  const visible=useMemo(()=> posts.filter(p=>`${p.name} ${p.handle} ${p.body}`.toLowerCase().includes(query.toLowerCase())),[posts,query]);
  function publish(){ const body=composer.trim(); if(!body) return; setPosts([{id:crypto.randomUUID(),name:"You",handle:"@you",time:"now",body,liked:false,saved:false,replies:0},...posts]); setComposer(""); }
  function toggle(id:string,key:"liked"|"saved"){ setPosts(posts.map(p=>p.id===id?{...p,[key]:!p[key]}:p)); }
  function send(){ const body=draft.trim(); if(!body)return; setMessages([...messages,{id:crypto.randomUUID(),from:"me",body,time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}]); setDraft(""); }

  const nav=[[Home,"Home"],[Compass,"Discover"],[Bell,"Notifications"],[MessageCircle,"Messages"],[Bookmark,"Saved"],[UserRound,"Profile"]] as const;
  const shown=tab==="Saved"?visible.filter(p=>p.saved):visible;

  return <div className="shell">
    <aside className="rail"><a className="wordmark" href="/">NOVA<span>.</span></a><nav>{nav.map(([Icon,label])=><button key={label} className={tab===label?"active":""} onClick={()=>setTab(label)}><Icon size={18}/><span>{label}</span></button>)}</nav><button className="settings" onClick={()=>setTab("Settings")}><Settings size={18}/><span>Settings</span></button></aside>

    <main className="feed">
      <header><div><b>{tab}</b><small>{tab==="Home"?"Following · newest first":"NOVA beta"}</small></div><label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search"/></label></header>

      {tab==="Home" && <><div className="write"><div className="avatar">Y</div><textarea maxLength={1000} value={composer} onChange={e=>setComposer(e.target.value)} placeholder="Share something worth saying…"/><button onClick={publish} disabled={!composer.trim()}><Plus size={14}/> Post</button></div><PostList posts={shown} toggle={toggle}/><Caught/></>}
      {tab==="Discover" && <Discover posts={shown} toggle={toggle}/>} 
      {tab==="Saved" && <><PostList posts={shown} toggle={toggle}/>{shown.length===0&&<Empty title="Nothing saved yet." text="Save something you genuinely want to return to."/>}</>}
      {tab==="Messages" && <Messages messages={messages} draft={draft} setDraft={setDraft} send={send}/>} 
      {tab==="Notifications" && <Notifications quiet={quiet}/>} 
      {tab==="Profile" && <Profile posts={posts.filter(p=>p.handle==="@you")} toggle={toggle}/>} 
      {tab==="Settings" && <SettingsPanel quiet={quiet} setQuiet={setQuiet}/>} 
    </main>

    <aside className="right"><section className="quiet"><div><b>Quiet mode</b><span>Non-essential notifications are bundled.</span></div><button onClick={()=>setQuiet(!quiet)}>{quiet?"On":"Off"}</button></section><section className="now"><small>AROUND NOVA</small><p>Slow internet club</p><p>What are you making?</p><p>Night listening</p></section><section className="protocol-card"><ShieldCheck size={17}/><div><b>Protocol status</b><span>Research network · no live token sale</span></div><a href="/protocol">View</a></section></aside>
  </div>
}

function PostList({posts,toggle}:{posts:Post[];toggle:(id:string,key:"liked"|"saved")=>void}){return <>{posts.map(p=><article className="post" key={p.id}><div className="avatar">{p.name[0]}</div><div><div className="meta"><b>{p.name}</b><span>{p.handle} · {p.time}</span></div><p>{p.body}</p><div className="actions"><button>Reply <span>{p.replies}</span></button><button className={p.liked?"selected":""} onClick={()=>toggle(p.id,"liked")}>{p.liked?"Appreciated":"Appreciate"}</button><button className={p.saved?"selected":""} onClick={()=>toggle(p.id,"saved")}>{p.saved?"Saved":"Save"}</button></div></div></article>)}</>}
function Caught(){return <div className="caught"><b>You’re caught up.</b><span>There is nothing else you need to see right now.</span></div>}
function Empty({title,text}:{title:string;text:string}){return <div className="empty"><b>{title}</b><span>{text}</span></div>}
function Discover({posts,toggle}:{posts:Post[];toggle:(id:string,key:"liked"|"saved")=>void}){return <><div className="section-intro"><Compass size={18}/><div><b>Discover deliberately.</b><span>No endless recommendations. Three small rooms, refreshed slowly.</span></div></div><div className="rooms"><button>Slow internet club <span>184 people</span></button><button>What are you making? <span>93 people</span></button><button>Night listening <span>251 people</span></button></div><PostList posts={posts.slice(0,2)} toggle={toggle}/></>}
function Notifications({quiet}:{quiet:boolean}){return <div className="panel-list"><div><Bell/><span><b>Notification bundle</b>{quiet?"Quiet Mode is active. Non-urgent activity waits until your bundle window.":"Quiet Mode is off. Notifications arrive normally."}</span></div><div><MessageCircle/><span><b>Nara replied</b>“Slow records for slow nights.”</span></div><div><Bookmark/><span><b>Your saved posts are private</b>NOVA never publishes your reading list.</span></div></div>}
function Messages({messages,draft,setDraft,send}:{messages:Message[];draft:string;setDraft:(v:string)=>void;send:()=>void}){return <div className="messages"><div className="thread-head"><div className="avatar">M</div><div><b>Mira</b><span>Private conversation</span></div></div><div className="thread">{messages.map(m=><div key={m.id} className={`bubble ${m.from}`}><p>{m.body}</p><small>{m.time}</small></div>)}</div><div className="message-box"><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send()}} placeholder="Write quietly…"/><button onClick={send}><Send size={16}/></button></div></div>}
function Profile({posts,toggle}:{posts:Post[];toggle:(id:string,key:"liked"|"saved")=>void}){return <><section className="profile"><div className="big-avatar">Y</div><div><h1>You</h1><span>@you</span><p>A small place on the internet.</p><small>0 followers · 0 following</small></div></section><PostList posts={posts} toggle={toggle}/>{posts.length===0&&<Empty title="Your profile is quiet." text="Your first post will appear here."/>}</>}
function SettingsPanel({quiet,setQuiet}:{quiet:boolean;setQuiet:(v:boolean)=>void}){return <div className="settings-panel"><section><Moon/><div><b>Attention settings</b><span>Make NOVA adapt to your life, not the other way around.</span></div></section><label><span><b>Quiet Mode</b><small>Bundle non-essential notifications.</small></span><input type="checkbox" checked={quiet} onChange={e=>setQuiet(e.target.checked)}/></label><label><span><b>Hide public counts</b><small>Planned for account-backed beta.</small></span><input type="checkbox" defaultChecked/></label><label><span><b>Autoplay media</b><small>Off by default.</small></span><input type="checkbox"/></label><section><WalletCards/><div><b>NOVA account</b><span>The future protocol wallet stays behind the social experience. Mainnet is not live.</span></div></section></div>}
