import { useEffect, useState } from 'react'
import { useAppContext } from '@/context/AppContext'

const SUPA_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3Nzg2OSwiZXhwIjoyMDkzNTUzODY5fQ.LmCOC7T9iC2SuKzRH9aVeUz0eml8RM95chPGMQgvuFo'

interface AbandonedCart {
  id: string
  customer_name: string
  phone: string
  city: string
  address: string
  notes: string
  items: { name_ar: string; price: number; qty: number; image_url?: string }[]
  total: number
  status: 'abandoned' | 'recovered' | 'ignored'
  created_at: string
  reminder_sent_at?: string | null
}

const REMINDER_DELAY_MS = 60 * 60 * 1000 // 1 hour

function isReadyForReminder(cart: AbandonedCart) {
  if (cart.status !== 'abandoned' || cart.reminder_sent_at) return false
  return Date.now() - new Date(cart.created_at).getTime() >= REMINDER_DELAY_MS
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  abandoned: { label: 'متروكة',   color: 'bg-red-100 text-red-700' },
  recovered: { label: 'استُرجعت', color: 'bg-green-100 text-green-700' },
  ignored:   { label: 'متجاهلة',  color: 'bg-gray-100 text-gray-500' },
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)   return `منذ ${Math.floor(diff)} ثانية`
  if (diff < 3600) return `منذ ${Math.floor(diff/60)} دقيقة`
  if (diff < 86400) return `منذ ${Math.floor(diff/3600)} ساعة`
  return `منذ ${Math.floor(diff/86400)} يوم`
}

export default function AbandonedCarts() {
  const { currentStore } = useAppContext()
  const [carts, setCarts] = useState<AbandonedCart[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'abandoned' | 'recovered' | 'ignored'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function fetchCarts() {
    if (!currentStore?.id) return
    setLoading(true)
    const res = await fetch(
      `${SUPA_URL}/rest/v1/abandoned_carts?store_id=eq.${currentStore.id}&order=created_at.desc`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    )
    const data = await res.json()
    setCarts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: AbandonedCart['status']) {
    await fetch(`${SUPA_URL}/rest/v1/abandoned_carts?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    })
    setCarts(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  useEffect(() => { fetchCarts() }, [currentStore?.id])

  const filtered = filter === 'all' ? carts : carts.filter(c => c.status === filter)
  const counts = {
    all:       carts.length,
    abandoned: carts.filter(c => c.status === 'abandoned').length,
    recovered: carts.filter(c => c.status === 'recovered').length,
    ignored:   carts.filter(c => c.status === 'ignored').length,
  }
  const readyForReminder = carts.filter(isReadyForReminder)

  async function markReminderSent(id: string) {
    await fetch(`${SUPA_URL}/rest/v1/abandoned_carts?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ reminder_sent_at: new Date().toISOString() }),
    })
    setCarts(prev => prev.map(c => c.id === id ? { ...c, reminder_sent_at: new Date().toISOString() } : c))
  }

  const storeUrl = (currentStore as any)?.domain
    ? `https://${(currentStore as any).domain}`
    : (currentStore as any)?.slug ? `https://${(currentStore as any).slug}.mawq3i.co` : ''

  function whatsappLink(phone: string, name: string, items: AbandonedCart['items'], total: number) {
    const itemsList = items.map(i => `• ${i.name_ar} × ${i.qty}`).join('\n')
    const linkLine = storeUrl ? `\n\n🛍️ أكمل طلبك من هون: ${storeUrl}` : ''
    const msg = encodeURIComponent(
      `السلام عليكم ${name} 👋\nلاحظنا إنك تركت سلتك قبل ما تكمل الطلب 😊\n\nالمنتجات:\n${itemsList}\n\nالمجموع: ${total} ₪${linkLine}\n\nهل تريد إكمال طلبك؟ 🛒`
    )
    const clean = phone.replace(/[^0-9]/g, '')
    return `https://wa.me/${clean}?text=${msg}`
  }

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🛒 السلات المتروكة</h1>
          <p className="text-gray-500 text-sm mt-1">زبائن بدأوا الطلب ولم يكملوه</p>
        </div>
        <button
          onClick={fetchCarts}
          className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition"
        >
          🔄 تحديث
        </button>
      </div>

      {/* بانر السلات الجاهزة للتذكير (مرّ عليها ساعة ولسا ما انبعث لها تذكير) */}
      {readyForReminder.length > 0 && (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-green-800">
              🔔 {readyForReminder.length} سلة جاهزة للتذكير الآن (مرّ عليها ساعة أو أكثر)
            </p>
          </div>
          <div className="space-y-2">
            {readyForReminder.map(cart => (
              <div key={cart.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-100">
                <div className="text-sm">
                  <span className="font-semibold text-gray-900">{cart.customer_name || 'زبون مجهول'}</span>
                  <span className="text-gray-400 mx-1.5">·</span>
                  <span className="text-gray-500">{cart.total} ₪</span>
                  <span className="text-gray-400 mx-1.5">·</span>
                  <span className="text-gray-500">{timeAgo(cart.created_at)}</span>
                </div>
                <a
                  href={whatsappLink(cart.phone, cart.customer_name, cart.items, cart.total)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => markReminderSent(cart.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition"
                >
                  إرسال تذكير واتساب
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-5 flex-wrap">
        {(['all', 'abandoned', 'recovered', 'ignored'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
              filter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {f === 'all' ? `الكل (${counts.all})` : `${STATUS_LABELS[f].label} (${counts[f]})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🛒</div>
          <p>لا توجد سلات متروكة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(cart => (
            <div key={cart.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* رأس البطاقة */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setExpandedId(expandedId === cart.id ? null : cart.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-600">
                    {cart.customer_name?.[0] || '؟'}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{cart.customer_name || 'زبون مجهول'}</div>
                    <div className="text-sm text-gray-500">{cart.phone} — {timeAgo(cart.created_at)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900">{cart.total} ₪</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_LABELS[cart.status].color}`}>
                    {STATUS_LABELS[cart.status].label}
                  </span>
                  {isReadyForReminder(cart) && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700">🔔 جاهزة للتذكير</span>
                  )}
                  {cart.reminder_sent_at && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-700">✅ أُرسل تذكير</span>
                  )}
                  <span className="text-gray-400">{expandedId === cart.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* تفاصيل قابلة للطي */}
              {expandedId === cart.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
                  {/* المنتجات */}
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">المنتجات</div>
                    <div className="space-y-1">
                      {cart.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span>{item.name_ar} × {item.qty}</span>
                          <span className="text-gray-600">{(item.price * item.qty).toFixed(2)} ₪</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* بيانات التوصيل */}
                  {(cart.city || cart.address) && (
                    <div className="text-sm text-gray-600">
                      📍 {[cart.city, cart.address].filter(Boolean).join(' — ')}
                    </div>
                  )}
                  {cart.notes && (
                    <div className="text-sm text-gray-600">💬 {cart.notes}</div>
                  )}

                  {/* أزرار الإجراءات */}
                  <div className="flex gap-2 flex-wrap pt-1">
                    <a
                      href={whatsappLink(cart.phone, cart.customer_name, cart.items, cart.total)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markReminderSent(cart.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.107 1.51 5.843L.057 23.5l5.79-1.52A11.93 11.93 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.005-1.366l-.359-.213-3.438.901.921-3.352-.233-.373A9.818 9.818 0 1 1 12 21.818z"/></svg>
                      تواصل واتساب
                    </a>

                    {cart.status !== 'recovered' && (
                      <button
                        onClick={() => updateStatus(cart.id, 'recovered')}
                        className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition"
                      >
                        ✅ تم الاسترجاع
                      </button>
                    )}
                    {cart.status !== 'ignored' && (
                      <button
                        onClick={() => updateStatus(cart.id, 'ignored')}
                        className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                      >
                        🚫 تجاهل
                      </button>
                    )}
                    {cart.status !== 'abandoned' && (
                      <button
                        onClick={() => updateStatus(cart.id, 'abandoned')}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition"
                      >
                        ↩️ إعادة للمتروكة
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
