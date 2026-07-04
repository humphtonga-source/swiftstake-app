// ── SWIFTSTAKE PUSH NOTIFICATIONS ──
// A real push notification reaches a locked/closed device, exactly
// like WhatsApp - a local pushNotif() toast only works while the tab
// is already open. Both matter; this file handles the real kind.

const VAPID_PUBLIC_KEY = 'BIoBM3evac45-034MiiMKv8oLt45WvaRl2W-ugprGTWQYDHEGPouyuR6g5Ah7gmhNMgqkJ1xT9hxhntmYoaiC40';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

let _pushPermissionState = 'default';

// Browsers reliably show the permission prompt only in response to a
// real user tap - calling this automatically on login/page-load is
// exactly why it's never worked before. Call this from an onclick.
async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Push notifications are not supported in this browser.');
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    _pushPermissionState = permission;
    if (permission !== 'granted') {
      if (permission === 'denied') alert('Notifications are blocked for this site. Enable them in your browser/site settings to receive alerts when the app is closed.');
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    await saveSubscription(subscription, sess.name, sess.isAdmin ? 'admin' : sess.shop);
    return true;
  } catch (err) {
    logError('enablePushNotifications', err);
    return false;
  }
}

// Called silently after login - only actually subscribes if permission
// was already granted in a past session, so it never triggers a
// surprise prompt. Otherwise the person sees the "Enable" prompt in Chat.
async function initPushNotifications(userName, userShop) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    if (Notification.permission !== 'granted') {
      _pushPermissionState = Notification.permission;
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    await saveSubscription(subscription, userName, userShop);
    _pushPermissionState = 'granted';
  } catch (err) {
    logError('initPushNotifications', err);
  }
}

async function saveSubscription(subscription, userName, userShop) {
  const subData = subscription.toJSON();
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + (sessToken || SUPABASE_KEY),
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
    if (!response.ok) logError('saveSubscription', new Error('HTTP ' + response.status));
  } catch(e) { logError('saveSubscription', e); }
}

// Real push to a specific person by name - used for DMs and for
// notifying someone about a channel message when they're not looking.
async function sendPushToPerson(userName, title, body, tag, url) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'apikey': SUPABASE_KEY},
      body: JSON.stringify({userName, title, body, tag, url})
    });
  } catch (e) { logError('sendPushToPerson', e); }
}

async function sendPushToAll(title, body, tag, url, excludeName) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'apikey': SUPABASE_KEY},
      body: JSON.stringify({title, body, tag, url, excludeName})
    });
  } catch (e) { logError('sendPushToAll', e); }
}

async function sendPushToShop(shop, title, body, tag, excludeName) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'apikey': SUPABASE_KEY},
      body: JSON.stringify({shop, title, body, tag, excludeName, url: '/'})
    });
  } catch (e) { logError('sendPushToShop', e); }
}
