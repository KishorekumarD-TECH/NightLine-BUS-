import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

/* ---------- helpers ---------- */
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
const durationOf = (a, b) => {
  const mins = Math.round((new Date(b) - new Date(a)) / 60000)
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}
const makePNR = () =>
  'NL' + Math.random().toString(36).slice(2, 8).toUpperCase()

/* ---------- root ---------- */
export default function App() {
  const [session, setSession] = useState(null)
  const [stage, setStage] = useState('search') // search | list | seats | passengers | done | bookings
  const [schedules, setSchedules] = useState([])
  const [selectedSchedule, setSelectedSchedule] = useState(null)
  const [selectedSeats, setSelectedSeats] = useState([])
  const [pickup, setPickup] = useState(null)
  const [drop, setDrop] = useState(null)
  const [lastBooking, setLastBooking] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const goSearch = () => {
    setStage('search')
    setSelectedSchedule(null)
    setSelectedSeats([])
    setPickup(null)
    setDrop(null)
  }

  return (
    <div className="min-h-screen">
      <Header
        session={session}
        onHome={goSearch}
        onBookings={() => (session ? setStage('bookings') : setAuthOpen(true))}
        onAuth={() => setAuthOpen(true)}
        onSignOut={() => supabase.auth.signOut()}
      />

      <main className="max-w-5xl mx-auto px-4 pb-24">
        {stage === 'search' && (
          <Search
            onResults={(rows) => {
              setSchedules(rows)
              setStage('list')
            }}
          />
        )}
        {stage === 'list' && (
          <BusList
            schedules={schedules}
            onBack={goSearch}
            onPick={(s) => {
              setSelectedSchedule(s)
              setSelectedSeats([])
              setStage('seats')
            }}
          />
        )}
        {stage === 'seats' && selectedSchedule && (
          <SeatMap
            schedule={selectedSchedule}
            selected={selectedSeats}
            setSelected={setSelectedSeats}
            pickup={pickup}
            drop={drop}
            setPickup={setPickup}
            setDrop={setDrop}
            onBack={() => setStage('list')}
            onContinue={() => {
              if (!session) return setAuthOpen(true)
              setStage('passengers')
            }}
          />
        )}
        {stage === 'passengers' && selectedSchedule && (
          <Passengers
            schedule={selectedSchedule}
            seats={selectedSeats}
            pickup={pickup}
            drop={drop}
            session={session}
            onBack={() => setStage('seats')}
            onBooked={(b) => {
              setLastBooking(b)
              setStage('done')
            }}
          />
        )}
        {stage === 'done' && lastBooking && (
          <Confirmation booking={lastBooking} onHome={goSearch} onBookings={() => setStage('bookings')} />
        )}
        {stage === 'bookings' && <MyBookings session={session} onHome={goSearch} />}
      </main>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}

/* ---------- header ---------- */
function Header({ session, onHome, onBookings, onAuth, onSignOut }) {
  return (
    <header className="bg-brand text-white sticky top-0 z-30 shadow-lg">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <button onClick={onHome} className="flex items-center gap-2 group">
          <span className="text-accent text-2xl">◈</span>
          <span className="font-display font-extrabold text-xl tracking-tight">NightLine</span>
        </button>
        <nav className="flex items-center gap-2 text-sm">
          <button
            onClick={onBookings}
            className="px-3 py-2 rounded-lg hover:bg-branddark transition"
          >
            My Bookings
          </button>
          {session ? (
            <button
              onClick={onSignOut}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accentdark text-white font-medium transition"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={onAuth}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accentdark text-white font-medium transition"
            >
              Sign in
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}

/* ---------- search ---------- */
function Search({ onResults }) {
  const [routes, setRoutes] = useState([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase
      .from('routes')
      .select('source,destination')
      .then(({ data }) => {
        if (!data) return
        setRoutes(data)
        if (data[0]) {
          setFrom(data[0].source)
          setTo(data[0].destination)
        }
      })
  }, [])

  const cities = [...new Set(routes.flatMap((r) => [r.source, r.destination]))]

  const runSearch = async () => {
    setErr('')
    if (from === to) return setErr('Pick two different cities.')
    setLoading(true)
    const { data, error } = await supabase
      .from('schedules')
      .select(
        `id, departure_time, arrival_time, fare, bus_id, route_id,
         routes!inner ( source, destination, distance_km ),
         buses ( bus_number, bus_type, total_seats, amenities,
                 operators ( name, rating ) )`
      )
      .eq('routes.source', from)
      .eq('routes.destination', to)
      .order('departure_time')
    setLoading(false)
    if (error) return setErr(error.message)
    onResults(data || [])
  }

  return (
    <section className="pt-10">
      <div className="text-center mb-8">
        <h1 className="font-display font-extrabold text-4xl md:text-5xl text-ink leading-tight">
          Overnight buses,<br />
          <span className="text-accent">booked in a blink.</span>
        </h1>
        <p className="mt-3 text-slate-500">Real seats, real confirmations. South India routes.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-5 md:p-6 border border-slate-200">
        <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <Field label="From">
            <select value={from} onChange={(e) => setFrom(e.target.value)} className="input">
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="To">
            <select value={to} onChange={(e) => setTo(e.target.value)} className="input">
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <button
            onClick={runSearch}
            disabled={loading}
            className="h-[46px] px-8 rounded-xl bg-accent hover:bg-accentdark disabled:opacity-60 text-white font-semibold transition whitespace-nowrap"
          >
            {loading ? 'Searching…' : 'Search buses'}
          </button>
        </div>
        {err && <p className="text-red-600 text-sm mt-3">{err}</p>}
      </div>

      <OffersStrip />

      <style>{`
        .input { width:100%; height:46px; padding:0 14px; border:1px solid #cbd5e1; border-radius:12px; background:#f8fafc; font-size:15px; }
        .input:focus { outline:none; border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.15); }
      `}</style>
    </section>
  )
}

function OffersStrip() {
  const offers = [
    { tag: 'FESTIVE300', text: 'Save up to ₹300 on bus tickets', valid: 'Valid till 23 Sep' },
    { tag: 'FIRST', text: 'Save up to ₹250 on bus tickets', valid: 'Valid till 31 Aug' },
    { tag: 'BUS300', text: 'Save up to ₹300 on bus tickets', valid: 'Valid till 31 Aug' },
    { tag: 'IDFC500', text: 'Save up to ₹500 with IDFC FIRST cards', valid: 'Valid till 31 Aug' },
  ]
  return (
    <div className="mt-10">
      <h2 className="font-display font-bold text-xl mb-4">Offers for you</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {offers.map((o) => (
          <div key={o.tag} className="rounded-xl p-4 bg-accent/10 border border-accent/20">
            <span className="text-[10px] font-semibold bg-brand text-white px-2 py-0.5 rounded">BUS</span>
            <p className="font-semibold text-sm mt-3 leading-snug">{o.text}</p>
            <p className="text-xs text-slate-400 mt-1">{o.valid}</p>
            <span className="inline-block mt-3 text-xs font-semibold bg-white border border-slate-200 px-2.5 py-1 rounded-full">
              🏷 {o.tag}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
        {label}
      </span>
      {children}
    </label>
  )
}

/* ---------- bus list ---------- */
function BusList({ schedules, onBack, onPick }) {
  const [sort, setSort] = useState('departure')

  const sorted = [...schedules].sort((a, b) => {
    if (sort === 'price') return a.fare - b.fare
    if (sort === 'rating') return (b.buses?.operators?.rating || 0) - (a.buses?.operators?.rating || 0)
    return new Date(a.departure_time) - new Date(b.departure_time)
  })

  return (
    <section className="pt-6">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-ink mb-4">← Modify search</button>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-2xl">
          {schedules.length} bus{schedules.length !== 1 && 'es'} found
        </h2>
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
          <option value="departure">Departure</option>
          <option value="price">Price: low to high</option>
          <option value="rating">Rating</option>
        </select>
      </div>

      {sorted.length === 0 && (
        <div className="bg-white rounded-xl p-10 text-center text-slate-500 border border-slate-200">
          No buses on this route yet. Try another pair of cities.
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((s) => {
          const op = s.buses?.operators
          return (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition p-4 md:p-5">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{op?.name}</h3>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
                      ★ {op?.rating}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{s.buses?.bus_type}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(s.buses?.amenities || []).slice(0, 4).map((a) => (
                      <span key={a} className="text-[11px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-slate-500">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="font-display font-bold text-lg">{fmtTime(s.departure_time)}</div>
                    <div className="text-xs text-slate-400">{s.routes.source}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400">{durationOf(s.departure_time, s.arrival_time)}</div>
                    <div className="w-16 border-t border-dashed border-slate-300 my-1"></div>
                    <div className="text-[10px] text-slate-400">{fmtDate(s.departure_time)}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display font-bold text-lg">{fmtTime(s.arrival_time)}</div>
                    <div className="text-xs text-slate-400">{s.routes.destination}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:flex-col md:items-end gap-2 md:pl-4 md:border-l border-slate-200">
                  <div className="font-display font-extrabold text-2xl text-ink">₹{s.fare}</div>
                  <button
                    onClick={() => onPick(s)}
                    className="px-5 py-2 rounded-lg bg-brand hover:bg-branddark text-white text-sm font-semibold transition"
                  >
                    Select seats
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ---------- seat map ---------- */
function SeatMap({ schedule, selected, setSelected, pickup, drop, setPickup, setDrop, onBack, onContinue }) {
  const [seats, setSeats] = useState([])
  const [booked, setBooked] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [boarding, setBoarding] = useState([])
  const [dropping, setDropping] = useState([])
  const [warn, setWarn] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data: seatRows } = await supabase
        .from('seats')
        .select('id, seat_number, seat_type, deck, bus_id, gender_lock')
        .eq('bus_id', schedule.bus_id)
      const { data: takenRows } = await supabase.rpc('get_taken_seats', {
        p_schedule: schedule.id,
      })
      const routeId = schedule.route_id
      const [{ data: bp }, { data: dp }] = await Promise.all([
        supabase.from('boarding_points').select('*').eq('route_id', routeId).order('seq'),
        supabase.from('dropping_points').select('*').eq('route_id', routeId).order('seq'),
      ])
      setSeats(seatRows || [])
      setBooked(new Set(takenRows || []))
      setBoarding(bp || [])
      setDropping(dp || [])
      if (!pickup && bp?.[0]) setPickup(bp[0])
      if (!drop && dp?.[0]) setDrop(dp[0])
      setLoading(false)
    })()
  }, [schedule.id])

  const toggle = (seat) => {
    if (booked.has(seat.id)) return
    setSelected((prev) =>
      prev.find((s) => s.id === seat.id)
        ? prev.filter((s) => s.id !== seat.id)
        : prev.length >= 6
        ? prev
        : [...prev, seat]
    )
  }

  const total = selected.length * schedule.fare
  const lower = seats.filter((s) => s.deck === 'lower')
  const upper = seats.filter((s) => s.deck === 'upper')
  const isSleeper = (schedule.buses?.bus_type || '').includes('Sleeper')

  const handleContinue = () => {
    if (selected.length === 0) return setWarn('Select at least one seat.')
    if (!pickup || !drop) return setWarn('Select a boarding and dropping point.')
    setWarn('')
    onContinue()
  }

  return (
    <section className="pt-6">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-ink mb-4">← Back to buses</button>
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-display font-bold text-xl mb-1">
              {schedule.buses?.operators?.name}
            </h2>
            <p className="text-sm text-slate-500 mb-5">{schedule.buses?.bus_type} · ₹{schedule.fare}/seat · tap a seat to select</p>

            <Legend />

            {loading ? (
              <div className="py-16 text-center text-slate-400">Loading seat map…</div>
            ) : (
              <div className="mt-6 grid md:grid-cols-2 gap-4">
                <BusDeck title="Lower deck" seats={lower} booked={booked} selected={selected}
                  onToggle={toggle} fare={schedule.fare} isSleeper={isSleeper} showWheel />
                {upper.length > 0 && (
                  <BusDeck title="Upper deck" seats={upper} booked={booked} selected={selected}
                    onToggle={toggle} fare={schedule.fare} isSleeper={isSleeper} />
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-semibold text-lg mb-1">Boarding &amp; dropping points</h3>
            <p className="text-sm text-slate-500 mb-4">Times shown are the estimated pickup / drop at each stop.</p>
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Boarding · {schedule.routes.source}</p>
                <div className="space-y-2 max-h-56 overflow-auto pr-1">
                  {boarding.map((b) => (
                    <PointRow key={b.id} p={b} active={pickup?.id === b.id} onClick={() => setPickup(b)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Dropping · {schedule.routes.destination}</p>
                <div className="space-y-2 max-h-56 overflow-auto pr-1">
                  {dropping.map((d) => (
                    <PointRow key={d.id} p={d} active={drop?.id === d.id} onClick={() => setDrop(d)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 h-fit bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-lg mb-3">Your selection</h3>
          {selected.length === 0 ? (
            <p className="text-sm text-slate-400">No seats selected yet.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {selected.map((s) => (
                <div key={s.id} className="flex justify-between text-sm">
                  <span className="font-medium">Seat {s.seat_number}</span>
                  <span>₹{schedule.fare}</span>
                </div>
              ))}
            </div>
          )}

          {(pickup || drop) && (
            <div className="text-xs text-slate-500 border-t border-slate-100 pt-3 space-y-1">
              {pickup && <div><span className="text-slate-400">Board:</span> {pickup.name} · {pickup.time}</div>}
              {drop && <div><span className="text-slate-400">Drop:</span> {drop.name} · {drop.time}</div>}
            </div>
          )}

          <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between font-display font-bold text-lg">
            <span>Total</span>
            <span>₹{total}</span>
          </div>
          <button
            onClick={handleContinue}
            disabled={selected.length === 0}
            className="w-full mt-4 py-3 rounded-xl bg-accent hover:bg-accentdark disabled:opacity-50 text-white font-semibold transition"
          >
            Continue
          </button>
          {warn && <p className="text-red-600 text-sm mt-2">{warn}</p>}
        </aside>
      </div>
    </section>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
      <span className="flex items-center gap-1.5"><i className="w-3.5 h-4 rounded bg-white border-2 border-brand inline-block" /> Available</span>
      <span className="flex items-center gap-1.5"><i className="w-3.5 h-4 rounded bg-white border-2 border-pink-400 inline-block" /> Female only</span>
      <span className="flex items-center gap-1.5"><i className="w-3.5 h-4 rounded bg-accent inline-block" /> Selected</span>
      <span className="flex items-center gap-1.5"><i className="w-3.5 h-4 rounded bg-slate-200 inline-block" /> Sold</span>
    </div>
  )
}

function Wheel() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-slate-400">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 9.6V3M9.9 13.6 4.3 17M14.1 13.6 19.7 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function BusDeck({ title, seats, booked, selected, onToggle, fare, isSleeper, showWheel }) {
  const perRow = isSleeper ? 3 : 4 // sleeper: 2+1 style, seater: 2+2
  const rows = chunk(seats, perRow)
  // aisle after column index (perRow===3 -> after col1; perRow===4 -> after col1)
  const aisleAfter = perRow === 3 ? 1 : 1

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
        {showWheel && <Wheel />}
      </div>
      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
        <div className="space-y-2">
          {rows.map((row, ri) => (
            <div key={ri} className="flex items-stretch gap-2 justify-center">
              {row.map((seat, ci) => (
                <div key={seat.id} className="flex items-stretch">
                  <Seat seat={seat} fare={fare} isSleeper={isSleeper}
                    booked={booked.has(seat.id)}
                    selected={!!selected.find((s) => s.id === seat.id)}
                    onToggle={() => onToggle(seat)} />
                  {ci === aisleAfter && <span className="w-4" />}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t border-dashed border-slate-200 text-center">
          <span className="text-[10px] text-slate-400 tracking-wide">▪ Emergency exit</span>
        </div>
      </div>
    </div>
  )
}

function Seat({ seat, fare, isSleeper, booked, selected, onToggle }) {
  const isFemale = seat.gender_lock === 'female'

  const base = 'relative flex flex-col items-center justify-end transition-all border-2 select-none'
  const shape = isSleeper ? 'w-12 h-20 rounded-xl pt-4 pb-1.5' : 'w-12 h-12 rounded-lg pb-1'

  let state
  if (booked) state = 'bg-slate-100 border-transparent text-slate-400 cursor-not-allowed'
  else if (selected) state = 'bg-accent border-accentdark text-white shadow scale-[1.03]'
  else if (isFemale) state = 'bg-white border-pink-400 text-pink-500 hover:scale-[1.03]'
  else state = 'bg-white border-brand text-ink hover:border-branddark hover:scale-[1.03]'

  return (
    <button
      onClick={onToggle}
      disabled={booked}
      title={isFemale ? `Seat ${seat.seat_number} · female only` : `Seat ${seat.seat_number}`}
      className={`${base} ${shape} ${state}`}
    >
      {isSleeper && (
        <span className={`absolute top-1.5 left-1/2 -translate-x-1/2 w-6 h-1.5 rounded-full ${
          booked ? 'bg-slate-300' : selected ? 'bg-white/70' : isFemale ? 'bg-pink-300' : 'bg-brand'
        }`} />
      )}
      <span className="text-[10px] font-semibold leading-none">{seat.seat_number}</span>
      <span className="text-[8px] leading-tight mt-0.5 opacity-80">
        {booked ? 'Sold' : `₹${fare}`}
      </span>
    </button>
  )
}

/* ---------- passengers + booking ---------- */
const COUPONS = {
  FESTIVE300: 300,
  FIRST: 250,
  BUS300: 300,
  IDFC500: 500,
}
const STATES = ['Tamil Nadu', 'Karnataka', 'Kerala', 'Andhra Pradesh', 'Telangana', 'Puducherry', 'Maharashtra', 'Other']

function Passengers({ schedule, seats, pickup, drop, session, onBack, onBooked }) {
  const [pax, setPax] = useState(
    seats.map((s) => ({
      name: '',
      age: '',
      gender: s.gender_lock === 'female' ? 'female' : 'male',
    }))
  )
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(session?.user?.email || '')
  const [gstState, setGstState] = useState('Tamil Nadu')
  const [coupon, setCoupon] = useState('')
  const [applied, setApplied] = useState(null)
  const [couponMsg, setCouponMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const setField = (i, k, v) =>
    setPax((p) => p.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)))

  const base = seats.length * schedule.fare
  const discount = applied ? Math.min(applied.off, base) : 0
  const taxable = base - discount
  const cgst = +(taxable * 0.025).toFixed(2)
  const sgst = +(taxable * 0.025).toFixed(2)
  const total = +(taxable + cgst + sgst).toFixed(2)

  const applyCoupon = () => {
    const code = coupon.trim().toUpperCase()
    if (!code) return
    if (COUPONS[code]) {
      setApplied({ code, off: COUPONS[code] })
      setCouponMsg(`${code} applied — ₹${COUPONS[code]} off`)
    } else {
      setApplied(null)
      setCouponMsg('Invalid coupon code.')
    }
  }

  const confirm = async () => {
    setErr('')
    for (const p of pax) {
      if (!p.name.trim() || !p.age) return setErr('Fill in every passenger’s name and age.')
    }
    if (!/^\+?\d{10,15}$/.test(phone.replace(/\s/g, '')))
      return setErr('Enter a valid mobile number (with country code, e.g. +91…).')
    if (!pickup || !drop) return setErr('Go back and select a boarding and dropping point.')

    setBusy(true)
    const pnr = makePNR()

    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .insert({
        user_id: session.user.id,
        schedule_id: schedule.id,
        pnr,
        total_fare: total,
        status: 'confirmed',
        boarding_point: `${pickup.name} (${pickup.time})`,
        dropping_point: `${drop.name} (${drop.time})`,
        email: email || null,
        gst_state: gstState,
        coupon_code: applied?.code || null,
        base_fare: base,
        discount,
        cgst,
        sgst,
      })
      .select()
      .single()

    if (bErr) {
      setBusy(false)
      return setErr(bErr.message)
    }

    const rows = seats.map((s, i) => ({
      booking_id: booking.id,
      schedule_id: schedule.id,
      seat_id: s.id,
      passenger_name: pax[i].name.trim(),
      passenger_age: Number(pax[i].age),
      passenger_gender: pax[i].gender,
    }))
    const { error: sErr } = await supabase.from('booking_seats').insert(rows)

    if (sErr) {
      await supabase.from('bookings').delete().eq('id', booking.id)
      setBusy(false)
      return setErr('One of your seats was just booked by someone else. Please pick again.')
    }

    let smsNote = ''
    try {
      const { error: fnErr } = await supabase.functions.invoke('send-sms', {
        body: {
          phone,
          pnr,
          from: schedule.routes.source,
          to: schedule.routes.destination,
          depart: schedule.departure_time,
          seats: seats.map((s) => s.seat_number).join(', '),
          fare: total,
          boarding: `${pickup.name} ${pickup.time}`,
        },
      })
      if (fnErr) smsNote = 'Booking confirmed — SMS could not be sent (check Twilio setup).'
      else await supabase.from('bookings').update({ sms_sent: true }).eq('id', booking.id)
    } catch {
      smsNote = 'Booking confirmed — SMS could not be sent (check Twilio setup).'
    }

    setBusy(false)
    onBooked({
      ...booking,
      phone,
      smsNote,
      route: `${schedule.routes.source} → ${schedule.routes.destination}`,
      depart: schedule.departure_time,
      operator: schedule.buses?.operators?.name,
      seatNumbers: seats.map((s) => s.seat_number),
      boarding: `${pickup.name} · ${pickup.time}`,
      dropping: `${drop.name} · ${drop.time}`,
      fareBreakdown: { base, discount, cgst, sgst, total },
    })
  }

  return (
    <section className="pt-6 grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div>
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-ink mb-4">← Back to seats</button>

        {/* Trip summary (points chosen on the seat page) */}
        <div className="bg-brand/5 rounded-xl border border-brand/20 p-5 mb-4">
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Trip</p>
              <p className="font-semibold mt-0.5">{schedule.routes.source} → {schedule.routes.destination}</p>
              <p className="text-slate-500">{fmtDate(schedule.departure_time)}, {fmtTime(schedule.departure_time)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Boarding</p>
              <p className="font-semibold mt-0.5">{pickup?.name}</p>
              <p className="text-slate-500">Est. {pickup?.time}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Dropping</p>
              <p className="font-semibold mt-0.5">{drop?.name}</p>
              <p className="text-slate-500">Est. {drop?.time}</p>
            </div>
          </div>
        </div>

        {/* Contact details */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-4">
          <h2 className="font-display font-bold text-xl mb-1">Contact details</h2>
          <p className="text-sm text-slate-500 mb-4">Ticket details will be sent here.</p>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Mobile number (for SMS)">
              <input className="pinput" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
            </Field>
            <Field label="Email ID">
              <input className="pinput" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
            </Field>
            <Field label="State of residence (for GST invoice)">
              <select className="pinput" value={gstState} onChange={(e) => setGstState(e.target.value)}>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Passengers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-display font-bold text-xl mb-4">Passenger details</h2>
          <div className="space-y-4">
            {seats.map((s, i) => {
              const femaleLock = s.gender_lock === 'female'
              return (
                <div key={s.id} className="grid grid-cols-[auto_1fr_70px_110px] gap-3 items-end">
                  <div className="pb-2">
                    <span className={`inline-flex h-9 min-w-9 px-1.5 items-center justify-center rounded-lg font-semibold text-sm ${
                      femaleLock ? 'bg-pink-100 text-pink-600' : 'bg-brand/10 text-brand'
                    }`}>
                      {s.seat_number}
                    </span>
                  </div>
                  <Field label={`Full name${femaleLock ? ' (female seat)' : ''}`}>
                    <input className="pinput" value={pax[i].name} onChange={(e) => setField(i, 'name', e.target.value)} placeholder="e.g. Kishore R" />
                  </Field>
                  <Field label="Age">
                    <input className="pinput" type="number" min="1" value={pax[i].age} onChange={(e) => setField(i, 'age', e.target.value)} />
                  </Field>
                  <Field label="Gender">
                    <select className="pinput" value={pax[i].gender} disabled={femaleLock}
                      onChange={(e) => setField(i, 'gender', e.target.value)}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                </div>
              )
            })}
          </div>
        </div>
        {err && <p className="text-red-600 text-sm mt-3">{err}</p>}
      </div>

      {/* Fare summary with GST */}
      <aside className="lg:sticky lg:top-24 h-fit bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-semibold text-lg mb-3">Fare summary</h3>

        <div className="flex gap-2 mb-4">
          <input className="pinput flex-1" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Coupon code" />
          <button onClick={applyCoupon} className="px-3 rounded-lg bg-brand text-white text-sm font-medium">Apply</button>
        </div>
        {couponMsg && (
          <p className={`text-xs mb-3 ${applied ? 'text-green-700' : 'text-red-600'}`}>{couponMsg}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {Object.keys(COUPONS).map((c) => (
            <button key={c} onClick={() => { setCoupon(c); }}
              className="text-[11px] border border-dashed border-accent/50 text-accentdark px-2 py-0.5 rounded-md hover:bg-accent/5">
              {c}
            </button>
          ))}
        </div>

        <div className="space-y-1.5 text-sm border-t border-slate-100 pt-3">
          <FareRow k={`Base fare (${seats.length} seat)`} v={base} />
          {discount > 0 && <FareRow k={`Discount (${applied.code})`} v={-discount} green />}
          <FareRow k="CGST @2.5%" v={cgst} />
          <FareRow k="SGST @2.5%" v={sgst} />
        </div>
        <div className="border-t border-slate-100 mt-2 pt-2 flex justify-between font-display font-extrabold text-lg">
          <span>Total payable</span>
          <span>₹{total}</span>
        </div>

        <button onClick={confirm} disabled={busy}
          className="w-full mt-4 py-3 rounded-xl bg-accent hover:bg-accentdark disabled:opacity-60 text-white font-semibold transition">
          {busy ? 'Confirming…' : `Pay ₹${total}`}
        </button>
        <p className="text-[11px] text-slate-400 text-center mt-2">Payment is simulated for this prototype.</p>
      </aside>

      <style>{`
        .pinput { width:100%; height:42px; padding:0 12px; border:1px solid #cbd5e1; border-radius:10px; background:#f8fafc; font-size:14px; }
        .pinput:focus { outline:none; border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.15); }
        .pinput:disabled { opacity:.6; }
      `}</style>
    </section>
  )
}

function PointRow({ p, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`relative w-full text-left rounded-lg border px-3 py-2.5 transition ${
        active ? 'border-brand bg-brand/5' : 'border-slate-200 hover:border-slate-300 bg-white'
      }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm tabular-nums">{p.time}</span>
            <span className="font-medium text-sm truncate">{p.name}</span>
          </div>
          {p.landmark && <p className="text-xs text-slate-400 mt-0.5 truncate">{p.landmark}</p>}
          {active && (
            <span className="inline-block mt-1.5 text-[10px] font-medium bg-brand text-white px-2 py-0.5 rounded">
              Your selected point
            </span>
          )}
        </div>
        <span className={`mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 grid place-items-center ${
          active ? 'border-brand' : 'border-slate-300'
        }`}>
          {active && <span className="w-2 h-2 rounded-full bg-brand" />}
        </span>
      </div>
    </button>
  )
}

function FareRow({ k, v, green }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{k}</span>
      <span className={green ? 'text-green-700 font-medium' : ''}>
        {v < 0 ? `- ₹${Math.abs(v)}` : `₹${v}`}
      </span>
    </div>
  )
}

/* ---------- confirmation ---------- */
function Confirmation({ booking, onHome, onBookings }) {
  return (
    <section className="pt-10 max-w-lg mx-auto text-center">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
        <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center text-3xl text-green-600 mb-4">
          ✓
        </div>
        <h2 className="font-display font-extrabold text-2xl">Booking confirmed!</h2>
        <p className="text-slate-500 mt-1">Your seats are locked in.</p>

        <div className="mt-6 bg-slate-100 rounded-xl p-5 text-left border border-slate-200">
          <Row k="PNR" v={booking.pnr} big />
          <Row k="Route" v={booking.route} />
          <Row k="Operator" v={booking.operator} />
          <Row k="Departs" v={`${fmtDate(booking.depart)}, ${fmtTime(booking.depart)}`} />
          {booking.boarding && <Row k="Boarding" v={booking.boarding} />}
          {booking.dropping && <Row k="Dropping" v={booking.dropping} />}
          <Row k="Seats" v={booking.seatNumbers.join(', ')} />
        </div>

        {booking.fareBreakdown && (
          <div className="mt-3 bg-white rounded-xl p-5 text-left border border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Payment breakdown</p>
            <Row k="Base fare" v={`₹${booking.fareBreakdown.base}`} />
            {booking.fareBreakdown.discount > 0 && (
              <Row k="Discount" v={`- ₹${booking.fareBreakdown.discount}`} />
            )}
            <Row k="CGST @2.5%" v={`₹${booking.fareBreakdown.cgst}`} />
            <Row k="SGST @2.5%" v={`₹${booking.fareBreakdown.sgst}`} />
            <div className="border-t border-slate-200 mt-1 pt-1">
              <Row k="Total paid" v={`₹${booking.fareBreakdown.total}`} big />
            </div>
          </div>
        )}

        {booking.smsNote ? (
          <p className="text-amber-700 text-sm mt-4 bg-amber-50 rounded-lg p-3">{booking.smsNote}</p>
        ) : (
          <p className="text-green-700 text-sm mt-4 bg-green-50 rounded-lg p-3">
            Confirmation SMS sent to {booking.phone} ✓
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={onBookings} className="flex-1 py-3 rounded-xl bg-brand text-white font-semibold">
            View my bookings
          </button>
          <button onClick={onHome} className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold">
            Book another
          </button>
        </div>
      </div>
    </section>
  )
}
function Row({ k, v, big }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-slate-500 text-sm">{k}</span>
      <span className={big ? 'font-display font-extrabold text-accent tracking-wide' : 'font-medium'}>{v}</span>
    </div>
  )
}

/* ---------- my bookings ---------- */
function MyBookings({ session, onHome }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    if (!session) return
    ;(async () => {
      const { data } = await supabase
        .from('bookings')
        .select(
          `id, pnr, total_fare, status, created_at,
           schedules ( departure_time, routes ( source, destination ),
                       buses ( operators ( name ) ) ),
           booking_seats ( passenger_name, seats ( seat_number ) )`
        )
        .order('created_at', { ascending: false })
      setRows(data || [])
    })()
  }, [session])

  const cancel = async (id) => {
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    setRows((r) => r.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)))
  }

  if (!session)
    return <div className="pt-10 text-center text-slate-500">Sign in to see your bookings.</div>

  return (
    <section className="pt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-2xl">My bookings</h2>
        <button onClick={onHome} className="text-sm text-accent font-medium">+ New booking</button>
      </div>

      {rows === null ? (
        <p className="text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center text-slate-500 border border-slate-200">
          No bookings yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => {
            const sc = b.schedules
            return (
              <div key={b.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-accent">{b.pnr}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        b.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                    <p className="font-semibold mt-1">
                      {sc?.routes?.source} → {sc?.routes?.destination}
                    </p>
                    <p className="text-sm text-slate-500">
                      {sc?.buses?.operators?.name} · {sc && fmtDate(sc.departure_time)}, {sc && fmtTime(sc.departure_time)}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Seats: {b.booking_seats?.map((x) => x.seats?.seat_number).join(', ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold text-lg">₹{b.total_fare}</div>
                    {b.status === 'confirmed' && (
                      <button onClick={() => cancel(b.id)} className="text-xs text-red-600 hover:underline mt-2">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ---------- auth ---------- */
function AuthModal({ onClose }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const submit = async () => {
    setMsg('')
    setBusy(true)
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: { data: { full_name: name } },
      })
      setBusy(false)
      if (error) return setMsg(error.message)
      setMsg('Account created — you can sign in now.')
      setMode('signin')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
      setBusy(false)
      if (error) return setMsg(error.message)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display font-bold text-2xl mb-1">
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </h2>
        <p className="text-sm text-slate-500 mb-5">Book and manage your tickets.</p>

        <div className="space-y-3">
          {mode === 'signup' && (
            <input className="pinput" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input className="pinput" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="pinput" placeholder="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>

        <button onClick={submit} disabled={busy}
          className="w-full mt-4 py-3 rounded-xl bg-accent hover:bg-accentdark disabled:opacity-60 text-white font-semibold transition">
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>

        {msg && <p className="text-sm mt-3 text-center text-slate-500">{msg}</p>}

        <p className="text-sm text-center mt-4 text-slate-500">
          {mode === 'signin' ? "No account? " : 'Already have one? '}
          <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="text-accent font-medium">
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        <style>{`
          .pinput { width:100%; height:44px; padding:0 14px; border:1px solid #cbd5e1; border-radius:10px; background:#f8fafc; font-size:15px; }
          .pinput:focus { outline:none; border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.15); }
        `}</style>
      </div>
    </div>
  )
}
