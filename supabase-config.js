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
      console.warn('[supabase] SDK 未加载，已跳过 createClient');
    }
  } catch (e) {
    console.warn('[supabase] createClient 失败，已降级为本地模式', e);
    api.client = null;
  }

  return api;
})();
