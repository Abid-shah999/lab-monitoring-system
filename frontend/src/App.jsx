import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Activity, AlertTriangle, Cpu, Database, FlaskConical, LayoutDashboard, LogOut, ShieldCheck, Thermometer, Users, Droplets, Wifi, Download, CheckCircle2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { API_URL } from "./api";

const demoAccounts = [
  ["Admin", "admin@lab.local"],
  ["Lab assistant", "assistant@lab.local"],
  ["User", "user@lab.local"]
];

function Login({ onLogin }) {
  const [email, setEmail] = useState("admin@lab.local");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault(); setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("lab_token", data.token);
      onLogin(data.user);
    } catch { setError("Login failed. Check your email and password."); }
  }
  return <main className="login-wrap"><section className="login-card">
    <div className="brand-mark"><FlaskConical size={25}/></div><p className="eyebrow">LABSENSE / IOT PLATFORM</p>
    <h1>Welcome back</h1><p className="muted">Sign in to monitor your laboratory environment.</p>
    <form onSubmit={submit}><label>Email address</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
      <label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/>
      {error && <p className="error">{error}</p>}<button className="primary full">Sign in <span>→</span></button>
    </form>
    <div className="demo-box"><b>Demo accounts</b>{demoAccounts.map(([role,mail])=><button key={mail} className="demo-account" onClick={()=>setEmail(mail)}><span>{role}</span><code>{mail}</code></button>)}<small>Password: Password123!</small></div>
  </section></main>;
}

function Stat({ icon: Icon, label, value, note, tone }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19}/></div><p>{label}</p><strong>{value}</strong><small>{note}</small></div>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ stats: {}, devices: [], readings: [], alerts: [] });
  const [tab, setTab] = useState("overview");
  const [toast, setToast] = useState("");
  const [mlResult, setMlResult] = useState(null);

  async function load() {
    try { const { data: result } = await api.get("/dashboard"); setData(result); }
    catch { if (localStorage.getItem("lab_token")) logout(); }
  }
  function logout() { localStorage.removeItem("lab_token"); setUser(null); setData({ stats: {}, devices: [], readings: [], alerts: [] }); }
  useEffect(() => {
    if (!localStorage.getItem("lab_token")) return;
    api.get("/me").then(({data})=>setUser(data.user)).catch(logout);
  }, []);
  useEffect(() => { if (user) load(); }, [user]);
  useEffect(() => {
    if (!user) return;
    const socket = io(API_URL);
    socket.on("sensor:reading", reading => setData(old => ({
      ...old,
      readings: [reading, ...old.readings].slice(0, 80),
      devices: old.devices.map(d => d.id === reading.deviceId ? {...d, status:"online", lastSeen:reading.timestamp} : d),
      stats: {...old.stats, readings:(old.stats.readings || 0) + 1}
    })));
    return () => socket.disconnect();
  }, [user]);

  const chartData = useMemo(() => [...data.readings].slice(0, 30).reverse().map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"}),
    temperature: Number(r.temperature), humidity: Number(r.humidity)
  })), [data.readings]);

  async function acknowledge(id) {
    try { await api.post(`/alerts/${id}/acknowledge`); setData(old=>({...old, alerts:old.alerts.map(a=>String(a.id)===String(id)?{...a,acknowledged:true}:a)})); }
    catch { setToast("Could not acknowledge alert"); }
  }
  async function runMl() {
    try {
      const latest = data.readings[0];
      if (!latest) return;
      const { data: result } = await api.post("/ml/analyze", { temperature: latest.temperature, humidity: latest.humidity });
      setMlResult(result);
    } catch { setMlResult({ message: "ML service is not running. Start the Python service to use anomaly analysis." }); }
  }
  function exportCsv() {
    const rows = [["timestamp","deviceId","labId","temperature","humidity"], ...data.readings.map(r=>[r.timestamp,r.deviceId,r.labId,r.temperature,r.humidity])];
    const csv = rows.map(row=>row.map(v=>`"${String(v ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    const a = document.createElement("a"); a.href=url; a.download="lab-readings.csv"; a.click(); URL.revokeObjectURL(url);
  }

  if (!user) return <Login onLogin={setUser}/>;
  const roleLabel = user.role === "admin" ? "Administrator" : user.role === "assistant" ? "Lab Assistant" : "Research User";
  const isAdmin = user.role === "admin";
  const isAssistant = user.role === "assistant";
  const nav = [{id:"overview",label:"Overview",icon:LayoutDashboard},{id:"devices",label:"Devices",icon:Cpu},{id:"readings",label:"Sensor readings",icon:Activity},{id:"alerts",label:"Alerts",icon:AlertTriangle}, ...(isAdmin ? [{id:"security",label:"Security & audit",icon:ShieldCheck},{id:"users",label:"User management",icon:Users}] : [])];

  return <div className="app-shell">
    <aside className="sidebar"><div className="side-brand"><div className="brand-mark small"><FlaskConical size={20}/></div><div><b>LabSense</b><small>MONITORING PLATFORM</small></div></div>
      <div className="workspace-label">WORKSPACE</div><div className="nav-list">{nav.map(item=><button key={item.id} className={`nav-item ${tab===item.id?"active":""}`} onClick={()=>setTab(item.id)}><item.icon size={18}/>{item.label}</button>)}</div>
      <div className="side-bottom"><div className="secure-label"><ShieldCheck size={16}/> Secure session</div><div className="profile"><div className="avatar">{user.name?.[0]}</div><div className="profile-text"><b>{user.name}</b><small>{roleLabel}</small></div><button title="Sign out" onClick={logout} className="icon-button"><LogOut size={17}/></button></div></div>
    </aside>
    <main className="main-content"><header className="topbar"><div><span className="crumb">Laboratory</span><span className="crumb-sep">/</span><b>{nav.find(n=>n.id===tab)?.label || "Overview"}</b></div><div className="top-actions"><span className="live-pill"><i/> SIMULATION LIVE</span><span className="date-label">{new Date().toLocaleDateString()}</span></div></header>
      <div className="page">
        <div className="page-heading"><div><p className="eyebrow">LABORATORY ENVIRONMENT</p><h1>{tab==="overview"?"Overview":nav.find(n=>n.id===tab)?.label}</h1><p className="muted">Monitor sensor activity and laboratory conditions in real time.</p></div><button className="secondary" onClick={exportCsv}><Download size={16}/> Export CSV</button></div>
        {tab==="overview" && <>
          <div className="stat-grid">
            <Stat icon={Cpu} label="Registered devices" value={data.stats.devices ?? 3} note="Across monitored labs" tone="blue"/>
            <Stat icon={Wifi} label="Devices online" value={data.stats.online ?? 3} note="Currently connected" tone="green"/>
            <Stat icon={Database} label="Collected readings" value={data.stats.readings ?? 0} note="Latest session" tone="purple"/>
            <Stat icon={AlertTriangle} label="Active alerts" value={data.stats.activeAlerts ?? 0} note="Needs attention" tone="orange"/>
          </div>
          <section className="panel chart-panel"><div className="panel-heading"><div><h2>Environmental trends</h2><p>Live temperature and humidity readings</p></div><span className="live-text"><i/> Updating every 5 seconds</span></div>
            <div className="chart-legend"><span><i className="dot temp"/> Temperature (°C)</span><span><i className="dot hum"/> Humidity (%)</span></div>
            <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.2}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9edf3"/><XAxis dataKey="time" tick={{fontSize:11,fill:"#8792a2"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:"#8792a2"}} axisLine={false} tickLine={false}/><Tooltip/><Area type="monotone" dataKey="temperature" stroke="#2563eb" fill="url(#tempFill)" strokeWidth={2} isAnimationActive={false}/><Area type="monotone" dataKey="humidity" stroke="#10a37f" fill="transparent" strokeWidth={2} isAnimationActive={false}/></AreaChart></ResponsiveContainer></div>
          </section>
          <div className="two-col"><section className="panel"><div className="panel-heading"><div><h2>Connected devices</h2><p>Device connectivity status</p></div><button className="text-button" onClick={()=>setTab("devices")}>View all →</button></div><DeviceList devices={data.devices}/></section>
          <section className="panel"><div className="panel-heading"><div><h2>Recent alerts</h2><p>Environmental threshold events</p></div><button className="text-button" onClick={()=>setTab("alerts")}>View all →</button></div><AlertList alerts={data.alerts.slice(0,5)} acknowledge={acknowledge}/></section></div>
        </>}
        {tab==="devices" && <section className="panel"><div className="panel-heading"><div><h2>Device registry</h2><p>Simulated ESP32 sensor endpoints</p></div><span className="count-tag">{data.devices.length} devices</span></div><DeviceList devices={data.devices} detailed/></section>}
        {tab==="readings" && <section className="panel"><div className="panel-heading"><div><h2>Sensor readings</h2><p>Most recent telemetry received by the platform</p></div><span className="count-tag">{data.readings.length} records</span></div><div className="table-wrap"><table><thead><tr><th>Timestamp</th><th>Device</th><th>Laboratory</th><th>Temperature</th><th>Humidity</th></tr></thead><tbody>{data.readings.slice(0,60).map((r,i)=><tr key={r.id || i}><td>{new Date(r.timestamp).toLocaleString()}</td><td><b>{r.deviceId}</b></td><td>{r.labId}</td><td>{Number(r.temperature).toFixed(1)} °C</td><td>{Number(r.humidity).toFixed(1)}%</td></tr>)}</tbody></table></div></section>}
        {tab==="alerts" && <section className="panel"><div className="panel-heading"><div><h2>Alert center</h2><p>Review and acknowledge unusual readings</p></div></div><AlertList alerts={data.alerts} acknowledge={acknowledge}/></section>}
        {tab==="security" && isAdmin && <section className="panel"><div className="panel-heading"><div><h2>Security overview</h2><p>Application security status and audit activity</p></div></div><div className="security-grid"><div className="security-item"><ShieldCheck/><b>JWT authentication</b><small>Enabled for protected API routes</small></div><div className="security-item"><ShieldCheck/><b>Role-based access</b><small>Admin, assistant and user roles</small></div><div className="security-item"><ShieldCheck/><b>HTTP security headers</b><small>Helmet middleware enabled</small></div><div className="security-item"><ShieldCheck/><b>Input checks</b><small>Telemetry values validated</small></div></div><p className="notice">Demo note: audit events are held in memory in this starter. Configure persistent audit logging and production device authentication before deployment.</p></section>}
        {tab==="users" && isAdmin && <section className="panel"><div className="panel-heading"><div><h2>Demo user accounts</h2><p>Role assignments included in the starter build</p></div></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody><tr><td>System Administrator</td><td>admin@lab.local</td><td><span className="role admin">Admin</span></td></tr><tr><td>Lab Assistant</td><td>assistant@lab.local</td><td><span className="role assistant">Assistant</span></td></tr><tr><td>Research User</td><td>user@lab.local</td><td><span className="role user">User</span></td></tr></tbody></table></div><p className="notice">User creation and password management are not implemented in this demo starter.</p></section>}
        <section className="ml-strip"><div><div className="ml-icon"><Activity/></div><div><b>Machine learning analysis</b><p>Run anomaly scoring on the latest sensor reading.</p>{mlResult && <small className="ml-result">{mlResult.message || `Anomaly: ${mlResult.is_anomaly ? "Detected" : "Not detected"} · Score: ${mlResult.score}`}</small>}</div></div><button className="secondary" onClick={runMl}>Analyze latest reading</button></section>
        <footer>LabSense · IoT Laboratory Monitoring <span>Demo data · Not real measurements</span></footer>
      </div>
    </main>
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function DeviceList({ devices, detailed=false }) {
  if (!devices.length) return <p className="empty">Waiting for device data…</p>;
  return <div className="device-list">{devices.map(d=><div className="device-row" key={d.id}><div className="device-avatar"><Cpu size={19}/></div><div className="device-info"><b>{d.name}</b><small>{d.id} · {d.labId}</small>{detailed && <small>Last seen: {d.lastSeen ? new Date(d.lastSeen).toLocaleString() : "Not yet seen"}</small>}</div><span className={`status ${d.status}`}><i/>{d.status}</span></div>)}</div>;
}
function AlertList({ alerts, acknowledge }) {
  if (!alerts.length) return <div className="empty-state"><CheckCircle2 size={25}/><b>All clear</b><span>No alerts have been generated.</span></div>;
  return <div className="alert-list">{alerts.map(a=><div className="alert-row" key={a.id}><div className={`alert-icon ${a.severity}`}><AlertTriangle size={17}/></div><div className="alert-info"><b>{a.message}</b><small>{a.deviceId} · {new Date(a.createdAt).toLocaleString()}</small></div>{a.acknowledged ? <span className="ack">Acknowledged</span> : <button className="text-button" onClick={()=>acknowledge(a.id)}>Acknowledge</button>}</div>)}</div>;
}
