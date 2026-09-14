import Link from "next/link";
import { ArrowRight, Feather, ShieldCheck, TimerReset } from "lucide-react";

const notes = [
  {name:"Mira", handle:"@mira", time:"8m", text:"I miss when the internet felt like a place you visited, not somewhere that followed you everywhere."},
  {name:"Ari", handle:"@ari", time:"31m", text:"Made coffee, turned the phone face down, finished the thing I kept postponing. Small win."},
  {name:"Nara", handle:"@nara", time:"1h", text:"What are you listening to tonight? I need something slow."}
];

export default function Home() {
  return <main>
    <nav className="topbar"><Link className="wordmark" href="/">NOVA<span>.</span></Link><div className="navlinks"><Link href="#principles">Why NOVA</Link><Link href="/protocol">Protocol</Link><Link className="pill" href="/app">Enter NOVA <ArrowRight size={15}/></Link></div></nav>
    <section className="hero"><div className="eyebrow">A quieter social network</div><h1>Be here.<br/><em>Then leave.</em></h1><p>NOVA is a simple place for people to share thoughts and stay close — without infinite noise, popularity contests, or a feed designed to keep you trapped.</p><div className="heroActions"><Link className="primary" href="/app">Open the social space <ArrowRight size={16}/></Link><span>No streaks. No autoplay. No casino UI.</span></div></section>
    <section className="preview"><div className="phone"><header><b>Home</b><span>Following · newest first</span></header><div className="composer"><div className="avatar">S</div><span>Share something worth saying…</span><button>Post</button></div>{notes.map(n=><article className="post" key={n.handle}><div className="avatar">{n.name[0]}</div><div><div className="meta"><b>{n.name}</b> <span>{n.handle} · {n.time}</span></div><p>{n.text}</p><div className="postActions"><span>Reply</span><span>Appreciate</span><span>Save</span></div></div></article>)}<footer>You’re caught up. Go live a little.</footer></div></section>
    <section id="principles" className="principles"><div><span>01</span><Feather/><h2>Human-scale</h2><p>The default feed ends. Following is chronological. Discovery lives somewhere else.</p></div><div><span>02</span><TimerReset/><h2>Attention is yours</h2><p>Quiet notifications, no streak mechanics and no artificial urgency engineered into the product.</p></div><div><span>03</span><ShieldCheck/><h2>Portable by design</h2><p>Your identity and economic ownership are designed to outlive any single NOVA client.</p></div></section>
    <section className="millennium"><div><div className="eyebrow">NOVA Millennium Protocol</div><h2>A social network can be temporary.<br/>Your ownership should not be.</h2></div><div className="numbers"><div><strong>250M</strong><span>absolute NOVA cap</span></div><div><strong>1,000y</strong><span>issuance horizon</span></div><div><strong>96%</strong><span>post-genesis issuance</span></div></div><p>The protocol is being engineered around a small constitutional core: continuity, ownership and monetary integrity. Consensus, cryptography, execution and storage are replaceable generations of machinery.</p><Link href="/protocol">Read protocol status <ArrowRight size={15}/></Link></section>
    <footer className="siteFooter"><b>NOVA.</b><span>Built for people, not cycles.</span><span>Protocol research preview · 2026</span></footer>
  </main>
}
