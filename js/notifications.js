// ── SWIFTSTAKE PUSH NOTIFICATIONS ──

const VAPID_PUBLIC_KEY = 'BIoBM3evac45-034MiiMKv8oLt45WvaRl2W-ugprGTWQYDHEGPouyuR6g5Ah7gmhNMgqkJ1xT9hxhntmYoaiC40';
const SUPABASE_URL = 'https://inlafchehdzjiesetvvr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tA4igGd_AjqTR2NW5GJhsQ_mzC1aaAu';

// Convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// Request permission and subscribe
async function initPushNotifications(userName, userShop) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push not supported');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    let subscription = await reg.pushManager.getSubscription();
    
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    // Save subscription to Supabase
    await saveSubscription(subscription, userName, userShop);
    console.log('Push notifications enabled for', userName);

  } catch (err) {
    console.error('Push subscription failed:', err);
  }
}

// Save push subscription to Supabase
async function saveSubscription(subscription, userName, userShop) {
  const subData = subscription.toJSON();
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      user_name: userName,
      shop: userShop || 'admin',
      endpoint: subData.endpoint,
      p256dh: subData.keys?.p256dh,
      auth: subData.keys?.auth,
      updated_at: new Date().toISOString()
    })
  });

  if (!response.ok) console.error('Failed to save subscription');
}

// Send push via Supabase Edge Function
async function sendPushToAll(title, body, tag, url) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ title, body, tag, url })
    });
  } catch (e) {
    console.error('Failed to send push:', e);
  }
}

// Send push to specific shop only
async function sendPushToShop(shop, title, body, tag) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ shop, title, body, tag, url: '/swiftstake-app/' })
    });
  } catch (e) {
    console.error('Failed to send push to shop:', e);
  }
}
