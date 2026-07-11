window.__SUPABASE__ = (function () {
  const SUPABASE_URL = "https://xxxuzcjqeuttryupbbzg.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_LE4iAG_AZaHOukrUJLTjhA_QpB2PZRK";

  const api = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    client: null,
  };

  try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      api.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      // 仅在用户已开启云同步时提示，避免本地模式下的无意义噪音日志
      var cloudEnabled = false;
      try {
        cloudEnabled = window.localStorage && window.localStorage.getItem('mg_cloud_enabled') === '1';
      } catch (_) {}
      if (cloudEnabled) {
        console.warn('[supabase] SDK 未加载，已跳过 createClient');
      }
    }
  } catch (e) {
    console.warn('[supabase] createClient 失败，已降级为本地模式', e);
    api.client = null;
  }

  return api;
})();
