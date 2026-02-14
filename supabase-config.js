window.__SUPABASE__ = (function () {
  const SUPABASE_URL = "https://xxxuzcjqeuttryupbbzg.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_LE4iAG_AZaHOukrUJLTjhA_QpB2PZRK";

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  return {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    client,
  };
})();
