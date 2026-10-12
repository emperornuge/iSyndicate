import { useState, useEffect } from 'react';
import { api } from './api.js';

const STORAGE_KEY = 'mobempire_user';

export default function App() {
  const [user, setUser] = useState(null);
  const [loginName, setLoginName] = useState('');
  const [tab, setTab] = useState('missions');
  const [catalogs, setCatalogs] = useState({ missions: [], items: [], properties: [] });
  const [targets, setTargets] = useState([]);
  const [bankAmount, setBankAmount] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  };

  // Login Function
  const handleLogin = async () => {
    if (!loginName.trim()) return;
    const data = await api.login(loginName.trim());
    if (data.user) {
      setUser(data.user);
      localStorage.setItem(STORAGE_KEY, data.user.username);
    } else if (data.error) {
      showToast(data.error, true);
    }
  };

  // Restore session + load catalogs
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && !user) {
      setLoginName(saved);
      api.login(saved).then((d) => {
        if (d.user) setUser(d.user);
      });
    }

    api.catalogs().then(setCatalogs).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll user stats every 3 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      const data = await api.getUser(user.id);
      if (data.user) {
        setUser(data.user);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [user]);

  // Load Fight Targets when Tab active
  useEffect(() => {
    if (tab === 'fight' && user) {
      api.targets(user.id).then((d) => setTargets(d.targets || []));
    }
  }, [tab, user]);

  const doMission = async (missionId) => {
    const data = await api.doMission(user.id, missionId);
    if (data.error) showToast(data.error, true);
    else {
      showToast(`Mission Complete! +$${data.cashWon.toLocaleString()} | +${data.xpWon} XP`);
      setUser(data.user);
    }
  };

  const buyShopItem = async (type, id) => {
    const data = await api.buy(user.id, type, id);
    if (data.error) showToast(data.error, true);
    else {
      showToast('Purchase successful!');
      setUser(data.user);
    }
  };

  const handleBank = async (action) => {
    const data = await api.bank(user.id, action, bankAmount);
    if (data.error) showToast(data.error, true);
    else {
      showToast('Bank transaction successful!');
      setBankAmount('');
      setUser(data.user);
    }
  };

  const attackPlayer = async (targetId) => {
    const data = await api.attack(user.id, targetId);
    if (data.error) showToast(data.error, true);
    else {
      if (data.won) showToast(`VICTORY! Stole $${data.cashStolen.toLocaleString()} & +${data.expGained} XP!`);
      else showToast('DEFEAT! Attack failed.', true);
      setUser(data.user);
    }
  };

  const joinMob = async () => {
    const data = await api.invite(user.id, inviteCodeInput);
    if (data.error) showToast(data.error, true);
    else {
      showToast('Mobster added successfully!');
      setInviteCodeInput('');
      setUser(data.user);
    }
  };

  const healHospital = async () => {
    const data = await api.heal(user.id);
    if (data.error) showToast(data.error, true);
    else {
      showToast('Fully restored to max health!');
      setUser(data.user);
    }
  };

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <h1 className="text-4xl font-extrabold tracking-wider text-red-600 mb-1 uppercase drop-shadow">Mob Empire</h1>
        <p className="text-slate-400 text-xs mb-8 tracking-widest uppercase">Underworld Syndicate Empire</p>

        <div className="w-full dark-card p-6 rounded-xl space-y-4">
          <input
            type="text"
            placeholder="Enter Mobster Alias..."
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-center text-white font-bold focus:outline-none focus:border-red-500"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-red-700 hover:bg-red-600 font-bold py-3 rounded-lg text-white transition shadow-lg uppercase tracking-wider"
          >
            Enter Underworld
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen text-slate-200 bg-slate-950">
      {/* HEADER BAR STATS */}
      <header className="bg-slate-900 border-b border-slate-800 p-3 sticky top-0 z-20 shadow-md">
        <div className="flex justify-between items-center mb-2">
          <div>
            <span className="font-extrabold text-red-500 text-base tracking-wide">{user.username}</span>
            <span className="ml-2 text-xs bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-amber-400 font-semibold">Lvl {user.level}</span>
          </div>
          <div className="text-xs text-right">
            <div className="text-emerald-400 font-bold">${user.cash.toLocaleString()}</div>
            <div className="text-slate-400">Bank: <span className="text-slate-200">${user.bank.toLocaleString()}</span></div>
          </div>
        </div>

        {/* RESOURCE METERS */}
        <div className="grid grid-cols-3 gap-2 text-[10px] text-center font-bold">
          {/* Energy */}
          <div className="bg-slate-950 p-1 rounded border border-slate-800">
            <div className="flex justify-between text-amber-500 mb-0.5">
              <span>ENERGY</span>
              <span>{user.energy}/{user.maxEnergy}</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full" style={{ width: `${(user.energy / user.maxEnergy) * 100}%` }}></div>
            </div>
          </div>

          {/* Stamina */}
          <div className="bg-slate-950 p-1 rounded border border-slate-800">
            <div className="flex justify-between text-red-400 mb-0.5">
              <span>STAMINA</span>
              <span>{user.stamina}/{user.maxStamina}</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-red-500 h-full" style={{ width: `${(user.stamina / user.maxStamina) * 100}%` }}></div>
            </div>
          </div>

          {/* Health */}
          <div className="bg-slate-950 p-1 rounded border border-slate-800">
            <div className="flex justify-between text-emerald-400 mb-0.5">
              <span>HEALTH</span>
              <span>{user.health}/{user.maxHealth}</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${(user.health / user.maxHealth) * 100}%` }}></div>
            </div>
          </div>
        </div>
      </header>

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`p-2 text-center text-xs font-bold transition-all ${toast.isError ? 'bg-red-900 text-red-200' : 'bg-emerald-900 text-emerald-200'}`}>
          {toast.msg}
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">

        {/* MISSIONS TAB */}
        {tab === 'missions' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-400 tracking-wider uppercase">Syndicate Missions</h2>
            {catalogs.missions.map((m) => (
              <div key={m.id} className="dark-card p-3 rounded-lg flex justify-between items-center border border-slate-800">
                <div className="space-y-1">
                  <div className="font-bold text-sm text-slate-100">{m.name}</div>
                  <div className="text-xs text-slate-400 flex gap-3">
                    <span>⚡ Energy: <b className="text-amber-400">{m.energy}</b></span>
                    <span>💵 Reward: <b className="text-emerald-400">${m.cashMin}-${m.cashMax}</b></span>
                  </div>
                  {m.reqItem && (
                    <div className="text-[11px] text-amber-500">
                      Req: {catalogs.items.find((i) => i.id === m.reqItem)?.name || m.reqItem}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => doMission(m.id)}
                  disabled={user.level < m.reqLevel}
                  className={`px-3 py-2 text-xs font-bold rounded shadow uppercase tracking-wide ${
                    user.level >= m.reqLevel ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {user.level >= m.reqLevel ? 'Do Job' : `Lvl ${m.reqLevel}`}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* FIGHT ARENA TAB */}
        {tab === 'fight' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-400 tracking-wider uppercase">Rival Mobsters</h2>
            {targets.length === 0 && (
              <p className="text-xs text-slate-500">No rivals in your level range yet. Check back soon.</p>
            )}
            {targets.map((t) => (
              <div key={t.id} className="dark-card p-3 rounded-lg flex justify-between items-center border border-slate-800">
                <div>
                  <div className="font-bold text-sm text-red-400">{t.username}</div>
                  <div className="text-xs text-slate-400">
                    Level {t.level} | Mob Size: <b className="text-slate-200">{t.mobSize}</b>
                  </div>
                </div>
                <button
                  onClick={() => attackPlayer(t.id)}
                  className="bg-red-700 hover:bg-red-600 px-3 py-2 text-xs font-bold rounded text-white shadow uppercase tracking-wide"
                >
                  Attack (-1 Stamina)
                </button>
              </div>
            ))}
          </div>
        )}

        {/* SHOP / REAL ESTATE TAB */}
        {tab === 'equipment' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-400 tracking-wider uppercase mb-2">Weapons & Armor</h2>
              <div className="space-y-2">
                {catalogs.items.map((item) => (
                  <div key={item.id} className="dark-card p-3 rounded-lg flex justify-between items-center border border-slate-800">
                    <div>
                      <div className="font-bold text-sm text-slate-100">{item.name} <span className="text-xs text-slate-400 font-normal">({user.inventory[item.id] || 0} Owned)</span></div>
                      <div className="text-xs text-slate-400 flex gap-2">
                        <span>⚔️ Atk: {item.atk}</span>
                        <span>🛡️ Def: {item.def}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => buyShopItem('item', item.id)}
                      className="bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 text-xs font-bold rounded text-white shadow"
                    >
                      Buy ${item.cost.toLocaleString()}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold text-slate-400 tracking-wider uppercase mb-2">Real Estate (Income)</h2>
              <div className="space-y-2">
                {catalogs.properties.map((p) => (
                  <div key={p.id} className="dark-card p-3 rounded-lg flex justify-between items-center border border-slate-800">
                    <div>
                      <div className="font-bold text-sm text-slate-100">{p.name} <span className="text-xs text-slate-400 font-normal">({user.properties[p.id] || 0} Owned)</span></div>
                      <div className="text-xs text-emerald-400">+${p.payout.toLocaleString()} / min</div>
                    </div>
                    <button
                      onClick={() => buyShopItem('property', p.id)}
                      className="bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 text-xs font-bold rounded text-white shadow"
                    >
                      Buy ${p.cost.toLocaleString()}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MOB & PROFILE TAB */}
        {tab === 'mob' && (
          <div className="space-y-4">
            <div className="dark-card p-4 rounded-lg space-y-2 border border-slate-800 text-center">
              <div className="text-xs text-slate-400">YOUR MOBSTER CODE</div>
              <div className="text-2xl font-black text-amber-400 tracking-widest">{user.code}</div>
              <p className="text-[11px] text-slate-500">Share this code with other players to grow your mob size and boost combat effectiveness.</p>
            </div>

            <div className="dark-card p-4 rounded-lg space-y-3 border border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase">Recruit Mobster</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Mob Code..."
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs uppercase font-bold"
                />
                <button onClick={joinMob} className="bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-bold rounded text-white uppercase">Add</button>
              </div>
            </div>

            <div className="dark-card p-4 rounded-lg space-y-2 border border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase">Battle Calculations Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <div className="text-slate-400">Total Mob Size</div>
                  <div className="text-base font-bold text-amber-400">{user.mobSize}</div>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <div className="text-slate-400">Active Loadout</div>
                  <div className="text-base font-bold text-slate-200">{Math.min(user.mobSize, Object.values(user.inventory).reduce((a, b) => a + b, 0))} items</div>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <div className="text-slate-400">Calculated Attack</div>
                  <div className="text-base font-bold text-red-400">{user.attackPower}</div>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <div className="text-slate-400">Calculated Defense</div>
                  <div className="text-base font-bold text-blue-400">{user.defensePower}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BANK & HOSPITAL UTILITY TAB */}
        {tab === 'vault' && (
          <div className="space-y-4">
            {/* Bank */}
            <div className="dark-card p-4 rounded-lg space-y-3 border border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase">First National Vault</h3>
              <p className="text-[11px] text-slate-500">Safeguard cash from rival attacks. Bank charges a 10% fee on deposits.</p>

              <input
                type="number"
                placeholder="Amount..."
                value={bankAmount}
                onChange={(e) => setBankAmount(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
              />

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleBank('deposit')} className="bg-emerald-700 hover:bg-emerald-600 py-2 text-xs font-bold rounded text-white uppercase">Deposit</button>
                <button onClick={() => handleBank('withdraw')} className="bg-slate-700 hover:bg-slate-600 py-2 text-xs font-bold rounded text-white uppercase">Withdraw</button>
              </div>
            </div>

            {/* Hospital */}
            <div className="dark-card p-4 rounded-lg space-y-3 border border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase">Underground Hospital</h3>
              <p className="text-[11px] text-slate-500">Instantly heal health back to 100%. Costs $10 per missing health point.</p>
              <button onClick={healHospital} className="w-full bg-red-800 hover:bg-red-700 py-2 text-xs font-bold rounded text-white uppercase">Heal Entirely</button>
            </div>

            {/* Log History */}
            <div className="dark-card p-4 rounded-lg space-y-2 border border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase">Activity Log</h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {user.logs.map((log) => (
                  <div key={log.id} className="text-[11px] border-b border-slate-800/80 pb-1 text-slate-300">
                    {log.msg}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* BOTTOM NAVIGATION BAR */}
      <nav className="bg-slate-900 border-t border-slate-800 fixed bottom-0 left-0 right-0 max-w-md mx-auto flex justify-around p-2 text-[10px] font-bold" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <button onClick={() => setTab('missions')} className={`flex flex-col items-center py-1 px-2 rounded ${tab === 'missions' ? 'text-amber-400' : 'text-slate-400'}`}>
          <span>⚡</span><span>Jobs</span>
        </button>
        <button onClick={() => setTab('fight')} className={`flex flex-col items-center py-1 px-2 rounded ${tab === 'fight' ? 'text-red-500' : 'text-slate-400'}`}>
          <span>🥊</span><span>Fight</span>
        </button>
        <button onClick={() => setTab('equipment')} className={`flex flex-col items-center py-1 px-2 rounded ${tab === 'equipment' ? 'text-emerald-400' : 'text-slate-400'}`}>
          <span>🏬</span><span>Shop</span>
        </button>
        <button onClick={() => setTab('mob')} className={`flex flex-col items-center py-1 px-2 rounded ${tab === 'mob' ? 'text-blue-400' : 'text-slate-400'}`}>
          <span>👥</span><span>Mob</span>
        </button>
        <button onClick={() => setTab('vault')} className={`flex flex-col items-center py-1 px-2 rounded ${tab === 'vault' ? 'text-purple-400' : 'text-slate-400'}`}>
          <span>🏦</span><span>Vault</span>
        </button>
      </nav>
    </div>
  );
}
