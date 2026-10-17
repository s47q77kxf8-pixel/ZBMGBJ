/**
 * Metton 存储层（Phase 1）
 * ------------------------------------------------------------
 * 背景：Supabase 会话令牌默认写在 localStorage 里，而本项目各页共用同一个
 * 源（GitHub Pages），该源的 localStorage 配额仅约 5MB，被业务数据占满后
 * 连几 KB 的令牌都写不进去，导致登录报
 *   "setItem ... 'sb-xxx...-auth-token' exceeded the quota"
 *
 * 本文件把「认证会话」单独放到 IndexedDB，并做多级兜底，保证：
 *   1. localStorage 再满，也不影响登录；
 *   2. IndexedDB 不可用（无痕/被策略禁用）时，退化为 sessionStorage → 内存，链路不断；
 *   3. 适配器自身永不抛错（SDK 会把非 AuthError 异常直接抛出，导致登录失败）。
 *
 * 必须在 supabase-config.js 之前加载。
 */
(function () {
    'use strict';

    var DB_NAME = 'mettonKVDB';
    var DB_VERSION = 1;
    var KV_STORE = 'kv';      // 通用业务数据（Phase 2 起使用）
    var AUTH_STORE = 'auth';  // 认证会话专用
    var OPEN_TIMEOUT = 3000;  // IDB 打不开时的硬超时，避免阻塞启动

    var _dbPromise = null;

    /** 防御式打开数据库：任何异常/超时/被阻塞都 resolve(null)，绝不 reject */
    function openDb() {
        if (_dbPromise) return _dbPromise;
        _dbPromise = new Promise(function (resolve) {
            var settled = false;
            var done = function (v) { if (!settled) { settled = true; resolve(v); } };
            try {
                if (!window.indexedDB) return done(null);
                var req = window.indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = function (e) {
                    var db = e.target.result;
                    if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
                    if (!db.objectStoreNames.contains(AUTH_STORE)) db.createObjectStore(AUTH_STORE);
                };
                req.onsuccess = function (e) { done(e.target.result); };
                req.onerror = function () { done(null); };
                req.onblocked = function () { done(null); };
                setTimeout(function () { done(null); }, OPEN_TIMEOUT);
            } catch (_) { done(null); }
        });
        return _dbPromise;
    }

    /** 统一的 IDB 单条操作包装：失败一律返回 null，不抛错 */
    function idbOp(store, mode, fn) {
        return openDb().then(function (db) {
            if (!db) return null;
            return new Promise(function (resolve) {
                try {
                    var tx = db.transaction(store, mode);
                    var req = fn(tx.objectStore(store));
                    req.onsuccess = function () { resolve(req.result == null ? null : req.result); };
                    req.onerror = function () { resolve(null); };
                    tx.onabort = function () { resolve(null); };
                } catch (_) { resolve(null); }
            });
        }).catch(function () { return null; });
    }
    function idbGet(store, key) { return idbOp(store, 'readonly', function (os) { return os.get(key); }); }
    function idbPut(store, key, val) { return idbOp(store, 'readwrite', function (os) { return os.put(val, key); }); }
    function idbDel(store, key) { return idbOp(store, 'readwrite', function (os) { return os.delete(key); }); }

    // ---------- 认证存储适配器 ----------
    var _authMem = Object.create(null);
    function _tmpKey(key) { return 'mg_auth_tmp__' + key; }

    /**
     * 通道优先级（读）：IndexedDB → localStorage(旧令牌迁移) → sessionStorage → 内存
     * 任何一步失败都降级到下一步，永不抛错。
     */
    var authStorage = {
        getItem: function (key) {
            return Promise.resolve()
                // 1) IndexedDB
                .then(function () { return idbGet(AUTH_STORE, key); })
                .then(function (v) {
                    if (v != null) return v;
                    // 2) localStorage：旧版令牌，迁移进 IDB 成功后才删除旧键
                    var legacy = null;
                    try { legacy = window.localStorage.getItem(key); } catch (_) { legacy = null; }
                    if (legacy != null) {
                        return idbPut(AUTH_STORE, key, legacy).then(function (res) {
                            // 写 IDB 失败（如无 IDB）时保留 localStorage 副本，避免丢掉唯一会话
                            if (res != null) { try { window.localStorage.removeItem(key); } catch (_) {} }
                            return legacy;
                        });
                    }
                    // 3) sessionStorage（无痕或 IDB 不可用时的跨页兜底）
                    try {
                        var s = window.sessionStorage.getItem(_tmpKey(key));
                        if (s != null) return s;
                    } catch (_) {}
                    // 4) 内存
                    return _authMem[key] != null ? _authMem[key] : null;
                })
                .catch(function () {
                    try { return window.localStorage.getItem(key); } catch (_) {}
                    return null;
                });
        },

        setItem: function (key, value) {
            _authMem[key] = value;
            var tasks = [
                idbPut(AUTH_STORE, key, value),
                // 尽力双写：localStorage 是「旧版本代码回滚后仍能读到会话」的安全网，
                // 配额已满时失败也无所谓（不影响登录）
                Promise.resolve().then(function () {
                    try { window.localStorage.setItem(key, value); } catch (_) {}
                }),
                Promise.resolve().then(function () {
                    try { window.sessionStorage.setItem(_tmpKey(key), value); } catch (_) {}
                })
            ];
            return Promise.all(tasks).then(function () {}).catch(function () {});
        },

        removeItem: function (key) {
            delete _authMem[key];
            return Promise.all([
                idbDel(AUTH_STORE, key),
                Promise.resolve().then(function () { try { window.localStorage.removeItem(key); } catch (_) {} }),
                Promise.resolve().then(function () { try { window.sessionStorage.removeItem(_tmpKey(key)); } catch (_) {} })
            ]).then(function () {}).catch(function () {});
        }
    };

    // ---------- 通用业务数据 KV 层（Phase 2 铺设，Phase 3 逐批启用搬迁） ----------
    // 目标：读保持同步（内存镜像，不改 call site），写异步落盘到 IndexedDB，
    //       避免业务大件数据挤占 localStorage 的 5MB 配额。

    // 计划搬入 IndexedDB 的键（见 MOVE_ENABLED / MOVE_BATCH）
    var MOVE_KEYS = [
        // 3a：派生 / 易重建，先释放空间
        'mg_data_snapshots', 'mg_order_trash_v1', 'caseLibrary', 'caseLayoutPresets', 'marketingCards',
        // 3b：主业务数据
        'templates', 'receiptTemplates', 'productSettings', 'processSettings', 'customers', 'roleProfiles', 'quoteHistory',
        // 3c：计算设置（含图片与导入字体引用，最大件）
        'calculatorSettings'
    ];

    // 动态键前缀（案例图片降级路径）。前缀命中同样视为「已搬迁」。
    var MOVE_PREFIXES = ['caseImg_'];

    // ---------- 账号命名空间 ----------
    // 背景：本地业务数据此前全部存全局键，同一浏览器切换账号会互串（A 的数据被 B 看到，
    // 甚至被自动同步写进 B 的云端）。命名空间层把业务键映射为 `<ns>_<key>`，
    // 每个账号（u_<userId>）与未登录（guest）各自独立。
    // 约定：
    //   - 认证令牌走独立 authStorage 通道（AUTH_STORE），不经过命名空间；
    //   - UI 偏好类小键（主题、折叠状态等）不经 MGStore，保持全局；
    //   - setNamespace 返回 Promise：完成该命名空间数据的内存预热（hydrate）后才可读。
    var _ns = null; // null = 未设置（裸键，兼容期）；字符串 = 命名空间

    function mgNsKey(bizKey) {
        return _ns ? (_ns + '_' + bizKey) : String(bizKey);
    }

    function idbGetAllKeys(store) {
        return openDb().then(function (db) {
            if (!db || !db.objectStoreNames || !db.objectStoreNames.contains(store)) return [];
            return new Promise(function (resolve) {
                try {
                    var tx = db.transaction(store, 'readonly');
                    var rq = tx.objectStore(store).getAllKeys();
                    rq.onsuccess = function () { resolve(rq.result || []); };
                    rq.onerror = function () { resolve([]); };
                    tx.onabort = function () { resolve([]); };
                } catch (_) { resolve([]); }
            });
        }).catch(function () { return []; });
    }

    /** 把当前命名空间下「计划搬迁键 + 动态前缀键」的数据预热进内存镜像（同步读的前提） */
    function hydrateNamespace() {
        if (!_ns) return Promise.resolve(false);
        var prefix = _ns + '_';
        // 清掉内存镜像中不属于当前命名空间的残留（切换账号前的裸键/其他账号数据）
        // setNamespace 已先 flush 落盘，这里清理不会丢已写数据
        Object.keys(_mem).forEach(function (k) { if (k.indexOf(prefix) !== 0) delete _mem[k]; });
        Object.keys(_touched).forEach(function (k) { if (k.indexOf(prefix) !== 0) delete _touched[k]; });
        Object.keys(_dirty).forEach(function (k) { if (k.indexOf(prefix) !== 0) delete _dirty[k]; });
        var chain = Promise.resolve();
        MOVE_KEYS.forEach(function (bizKey) {
            var fullKey = prefix + bizKey;
            chain = chain.then(function () {
                if (_touched[fullKey]) return null; // 本页已写过，保留新值
                return idbGet(KV_STORE, fullKey).then(function (v) {
                    if (v != null) {
                        if (!(fullKey in _mem)) _mem[fullKey] = v;
                        return null;
                    }
                    var lsVal = _ls(function () { return window.localStorage.getItem(fullKey); }, null);
                    if (lsVal != null && !(fullKey in _mem)) _mem[fullKey] = lsVal;
                    return null;
                });
            });
        });
        // 动态前缀键：IndexedDB 与 localStorage 两路都扫
        chain = chain.then(function () {
            return idbGetAllKeys(KV_STORE).then(function (keys) {
                // 各键的 idbGet 串入局部 inner 链并作为返回值，确保 hydrate 完成时全部就绪
                var inner = Promise.resolve();
                keys.forEach(function (fullKey) {
                    fullKey = String(fullKey);
                    if (fullKey.indexOf(prefix) !== 0) return;
                    var bizKey = fullKey.slice(prefix.length);
                    if (MOVE_KEYS.indexOf(bizKey) !== -1) return;
                    var hit = false;
                    for (var i = 0; i < MOVE_PREFIXES.length; i++) {
                        if (bizKey.indexOf(MOVE_PREFIXES[i]) === 0) { hit = true; break; }
                    }
                    if (!hit || (fullKey in _mem)) return;
                    inner = inner.then(function () {
                        return idbGet(KV_STORE, fullKey).then(function (v) {
                            if (v != null && !(fullKey in _mem)) _mem[fullKey] = v;
                            return null;
                        });
                    });
                });
                return inner;
            });
        });
        chain = chain.then(function () {
            _ls(function () {
                Object.keys(window.localStorage).forEach(function (fullKey) {
                    if (fullKey.indexOf(prefix) !== 0 || (fullKey in _mem)) return;
                    var bizKey = fullKey.slice(prefix.length);
                    if (MOVE_KEYS.indexOf(bizKey) !== -1) return;
                    var hit = false;
                    for (var i = 0; i < MOVE_PREFIXES.length; i++) {
                        if (bizKey.indexOf(MOVE_PREFIXES[i]) === 0) { hit = true; break; }
                    }
                    if (hit) {
                        var v = window.localStorage.getItem(fullKey);
                        if (v != null) _mem[fullKey] = v;
                    }
                });
            }, undefined);
            return true;
        });
        return chain;
    }

    /** 切换命名空间：先落盘当前未写数据，再预热新命名空间；重复设置同一命名空间时直接跳过 */
    function setNamespace(ns) {
        ns = ns ? String(ns) : null;
        if (ns === _ns) return Promise.resolve(true);
        return Promise.resolve().then(function () { return flush(); }).then(function () {
            _ns = ns;
            return hydrateNamespace();
        }).then(function () { return true; }).catch(function () { return false; });
    }

    /** 清空当前命名空间的全部数据（IndexedDB + 内存 + localStorage），不影响其他账号与认证令牌 */
    function clearNamespace() {
        if (!_ns) return Promise.resolve(false);
        var prefix = _ns + '_';
        return idbGetAllKeys(KV_STORE).then(function (keys) {
            var chain = Promise.resolve();
            keys.forEach(function (fullKey) {
                if (String(fullKey).indexOf(prefix) === 0) {
                    chain = chain.then(function () { return idbDel(KV_STORE, fullKey); });
                }
            });
            return chain;
        }).then(function () {
            Object.keys(_mem).forEach(function (k) { if (k.indexOf(prefix) === 0) delete _mem[k]; });
            Object.keys(_dirty).forEach(function (k) { if (k.indexOf(prefix) === 0) delete _dirty[k]; });
            Object.keys(_touched).forEach(function (k) { if (k.indexOf(prefix) === 0) delete _touched[k]; });
            _ls(function () {
                Object.keys(window.localStorage).forEach(function (k) {
                    if (k.indexOf(prefix) === 0) window.localStorage.removeItem(k);
                });
            }, undefined);
            return true;
        }).catch(function () { return false; });
    }

    // Phase 3：启用搬迁。写路径改为「IndexedDB 为准」，启动时把 localStorage 旧数据迁入 IDB。
    var MOVE_ENABLED = true;
    // 迁移成功后删除 localStorage 副本，真正把 5MB 配额让出来。
    // 仅在 idbPut 确认成功后才删，因此写失败时旧副本仍在，不会丢数据。
    var PURGE_LS = true;
    var MIGRATED_FLAG = 'mg_store_migrated_v1';

    var _mem = Object.create(null);      // key -> 原始字符串（与 localStorage 语义一致）
    var _touched = Object.create(null);  // 本页已写过的 key（hydrate 不覆盖）
    var _dirty = Object.create(null);    // 待落盘 key -> 值
    var _flushTimer = null;

    function _ls(fn, fallback) {
        try { return fn(); } catch (_) { return fallback; }
    }
    function _isMoved(key) {
        if (!MOVE_ENABLED) return false;
        if (MOVE_KEYS.indexOf(key) !== -1) return true;
        for (var i = 0; i < MOVE_PREFIXES.length; i++) {
            if (key.indexOf(MOVE_PREFIXES[i]) === 0) return true;
        }
        return false;
    }

    function kvGetItem(key) {
        var fullKey = mgNsKey(key);
        if (fullKey in _mem) return _mem[fullKey];
        return _ls(function () { return window.localStorage.getItem(fullKey); }, null);
    }

    function kvSetItem(key, value) {
        var fullKey = mgNsKey(key);
        _mem[fullKey] = value;
        _touched[fullKey] = 1;
        // _isMoved 用业务键判断（MOVE_KEYS 清单不变），实际读写用命名空间后的完整键
        if (_isMoved(key)) {
            _dirty[fullKey] = value;
            scheduleFlush();
            // PURGE_LS=false 时同时保留 localStorage 副本：旧版代码回滚后仍能读到数据
            if (!PURGE_LS) _ls(function () { window.localStorage.setItem(fullKey, value); }, undefined);
        } else {
            var ok = _ls(function () { window.localStorage.setItem(fullKey, value); return true; }, false);
            if (!ok) raiseFailure(key, 'localStorage 写入失败（可能已超出配额）');
        }
    }

    function kvRemoveItem(key) {
        var fullKey = mgNsKey(key);
        delete _mem[fullKey];
        delete _dirty[fullKey];
        _touched[fullKey] = 1;
        idbDel(KV_STORE, fullKey);
        _ls(function () { window.localStorage.removeItem(fullKey); }, undefined);
    }

    function scheduleFlush() {
        if (_flushTimer) return;
        _flushTimer = setTimeout(function () { _flushTimer = null; flush(); }, 80);
    }

    /** 把 dirty 队列落盘到 IndexedDB；失败时指数退避重试，仍失败则通知上层（不静默） */
    function flush() {
        var keys = Object.keys(_dirty);
        if (!keys.length) return Promise.resolve();
        var snapshot = _dirty;
        _dirty = Object.create(null);
        var attempt = 0;
        var send = function () {
            return Promise.all(keys.map(function (k) { return idbPut(KV_STORE, k, snapshot[k]); })).then(function (res) {
                var failed = keys.filter(function (k, i) { return res[i] == null; });
                if (!failed.length) return;
                if (attempt < 3) {
                    attempt++;
                    return new Promise(function (r) { setTimeout(r, 200 * attempt); }).then(send);
                }
                failed.forEach(function (k) { raiseFailure(k, 'IndexedDB 写入失败'); });
            });
        };
        return send().catch(function () {});
    }

    /** 失败上报：由 script.js 注册 onFailure 决定「可丢 / 不可丢」的可见性策略 */
    function raiseFailure(key, err) {
        var detail = { key: key, error: err };
        MGStore.lastError = detail;
        if (typeof MGStore.onFailure === 'function') {
            try { MGStore.onFailure(key, err); } catch (_) {}
        } else {
            console.error('[MGStore] 写入失败:', key, err);
        }
    }

    function saveMarkers(markers) {
        _ls(function () { window.localStorage.setItem(MIGRATED_FLAG, JSON.stringify(markers)); }, undefined);
    }

    /** 启动预热：把已在 IDB 的数据读进内存镜像，并把 localStorage 里的旧数据迁移进 IDB */
    function hydrate() {
        if (!MOVE_ENABLED) return Promise.resolve(false); // 透传模式，无需预热
        return openDb().then(function (db) {
            if (!db) return false; // 无 IDB：全局退化为 localStorage 行为，绝不阻塞启动
            var markers = _ls(function () {
                return JSON.parse(window.localStorage.getItem(MIGRATED_FLAG) || '{}') || {};
            }, {}) || {};
            var migrateKey = function (key) {
                return function () {
                    if (_touched[key]) return null; // 本页已写过，保留新值，不被磁盘旧值覆盖
                    return idbGet(KV_STORE, key).then(function (idbVal) {
                        var lsVal = _ls(function () { return window.localStorage.getItem(key); }, null);
                        if (idbVal == null && lsVal != null) {
                            return idbPut(KV_STORE, key, lsVal).then(function (res) {
                                if (res == null) return; // 写 IDB 失败：保留 LS，下次启动重试
                                _mem[key] = lsVal;
                                markers[key] = { t: Date.now(), bytes: lsVal.length };
                                saveMarkers(markers);
                                if (PURGE_LS) _ls(function () { window.localStorage.removeItem(key); }, undefined);
                            });
                        }
                        if (idbVal != null) {
                            _mem[key] = idbVal;
                            if (PURGE_LS && markers[key]) _ls(function () { window.localStorage.removeItem(key); }, undefined);
                        }
                    });
                };
            };
            var chain = Promise.resolve();
            MOVE_KEYS.forEach(function (key) { chain = chain.then(migrateKey(key)); });
            // 动态前缀键（如 caseImg_*）同样搬迁，避免历史副本长期占用 localStorage
            _ls(function () { return Object.keys(window.localStorage); }, []).forEach(function (key) {
                if (MOVE_KEYS.indexOf(key) !== -1) return;
                var hit = false;
                for (var i = 0; i < MOVE_PREFIXES.length; i++) {
                    if (key.indexOf(MOVE_PREFIXES[i]) === 0) { hit = true; break; }
                }
                if (hit) chain = chain.then(migrateKey(key));
            });
            return chain.then(function () { return true; });
        }).catch(function () { return false; });
    }

    /** 存储占用统计（供「设置 → 存储占用」面板使用）。命名空间模式下只统计当前账号的键，并以业务键名展示 */
    function usage() {
        var out = [];
        var seen = Object.create(null);
        var prefix = _ns ? (_ns + '_') : null;
        var match = function (fullKey) {
            // 返回要展示的键名；不匹配（其他命名空间/全局键）返回 null
            if (!prefix) return fullKey;
            if (String(fullKey).indexOf(prefix) !== 0) return null;
            return String(fullKey).slice(prefix.length);
        };
        Object.keys(_mem).forEach(function (k) {
            var bizKey = match(k);
            if (bizKey == null || seen[k]) return;
            seen[k] = 1;
            var inLs = _ls(function () { return window.localStorage.getItem(k) != null; }, false);
            out.push({ key: bizKey, bytes: (_mem[k] || '').length * 2, channel: _isMoved(bizKey) ? 'idb' : (inLs ? 'localStorage' : 'mem') });
        });
        _ls(function () { return Object.keys(window.localStorage); }, []).forEach(function (k) {
            var bizKey = match(k);
            if (bizKey == null || seen[k]) return;
            seen[k] = 1;
            var v = _ls(function () { return window.localStorage.getItem(k); }, '') || '';
            out.push({ key: bizKey, bytes: (k.length + v.length) * 2, channel: 'localStorage' });
        });
        out.sort(function (a, b) { return b.bytes - a.bytes; });
        return out;
    }

    // ---------- 对外接口 ----------
    var MGStore = {
        available: true,          // IndexedDB 是否可用（探测后更新）
        READY: false,             // 同步可读的就绪标志（hydrate 完成）
        ready: null,              // Promise<boolean>，hydrate 完成，永不 reject
        authStorage: authStorage,
        lastError: null,
        onFailure: null,          // 由 script.js 注册
        getItem: kvGetItem,
        setItem: kvSetItem,
        removeItem: kvRemoveItem,
        flush: flush,
        usage: usage,
        raiseFailure: raiseFailure,
        setNamespace: setNamespace,
        clearNamespace: clearNamespace,
        nsKey: mgNsKey,           // 供案例图片等独立 IDB store 用同一命名空间规则包装键名
        _idbKeys: idbGetAllKeys,  // 供迁移/清空逻辑枚举 IDB 全部键
        _openDb: openDb,
        _idbGet: idbGet,
        _idbPut: idbPut,
        _idbDel: idbDel,
        _MOVE_KEYS: MOVE_KEYS
    };
    Object.defineProperty(MGStore, 'namespace', { get: function () { return _ns; } });

    MGStore.ready = openDb().then(function (db) {
        MGStore.available = !!db;
        if (!db) {
            // IDB 不可用：认证会话仍有 sessionStorage/内存兜底，登录链路不受影响
            console.warn('[MGStore] IndexedDB 不可用，认证会话将退化为 sessionStorage/内存');
        }
        return hydrate();
    }).then(function () {
        MGStore.READY = true;
        return MGStore.available;
    }).catch(function () {
        MGStore.READY = true;
        return MGStore.available;
    });

    // 页面隐藏 / 卸载前立即落盘，缩短丢写窗口
    _ls(function () {
        window.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') flush();
        });
        window.addEventListener('pagehide', function () { flush(); });
        return true;
    }, undefined);

    window.MGStore = MGStore;
})();
