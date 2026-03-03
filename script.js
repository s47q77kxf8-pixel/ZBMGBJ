// ========== 文件版本标识 ==========
console.log('🔧🔧🔧 script.js 文件版本: 2026-02-15-cloud-debug 🔧🔧🔧');
console.log('🔧 如果看不到这条日志，说明浏览器加载的是旧版本！');
// ========== 文件版本标识结束 ==========

// ====== 云端调试面板（必须尽早初始化，避免按钮找不到函数） ======
(function mgInitCloudDebug() {
    if (window.__mgCloudDebugInited) return;
    window.__mgCloudDebugInited = true;

    const MAX_LINES = 400;
    const SYNC_LOG_KEYWORDS = [
        'sync', 'cloud', 'supabase', 'artist_settings', 'artist_settings_singleton', 'artist_settings_items',
        '上传', '下载', '拉取', '推送', '同步', '云端', '设置', '回退', 'merge', 'v2'
    ];
    const state = {
        lines: [],
        lastFlush: 0,
        dayKey: ''
    };

    function safeToString(v) {
        try {
            if (v == null) return String(v);
            if (typeof v === 'string') return v;
            if (v instanceof Error) return (v.stack || v.message || String(v));
            return JSON.stringify(v);
        } catch (_) {
            try { return String(v); } catch (__) { return '[unprintable]'; }
        }
    }

    function getDayKey(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function ensureTodayLogsOnly() {
        const today = getDayKey(new Date());
        if (!state.dayKey) {
            state.dayKey = today;
            return;
        }
        if (state.dayKey !== today) {
            state.lines = [];
            state.dayKey = today;
        }
    }

    function isSyncRelated(args) {
        const msg = Array.prototype.slice.call(args || []).map(safeToString).join(' ').toLowerCase();
        return SYNC_LOG_KEYWORDS.some(function (kw) { return msg.includes(String(kw).toLowerCase()); });
    }

    function appendLine(level, args) {
        ensureTodayLogsOnly();
        if (!isSyncRelated(args)) return;
        const ts = new Date().toISOString();
        const msg = Array.prototype.slice.call(args || []).map(safeToString).join(' ');
        state.lines.push(`[${ts}] [${level}] ${msg}`);
        if (state.lines.length > MAX_LINES) state.lines.splice(0, state.lines.length - MAX_LINES);
        scheduleFlush();
    }

    function scheduleFlush() {
        const now = Date.now();
        if (now - state.lastFlush < 250) return;
        state.lastFlush = now;
        setTimeout(() => {
            const ta = document.getElementById('cloudDebugLogText');
            if (ta) {
                ta.value = state.lines.join('\n');
                ta.scrollTop = ta.scrollHeight;
            }
        }, 0);
    }

    // hook console（保留原行为）
    const origLog = console.log;
    const origError = console.error;
    const origWarn = console.warn;
    console.log = function () {
        appendLine('log', arguments);
        try { return origLog.apply(console, arguments); } catch (_) {}
    };
    console.error = function () {
        appendLine('error', arguments);
        try { return origError.apply(console, arguments); } catch (_) {}
    };
    console.warn = function () {
        appendLine('warn', arguments);
        try { return origWarn.apply(console, arguments); } catch (_) {}
    };

    // 写入一条可见日志，确保面板不是空的
    appendLine('log', ['cloud debug ready']);

    window.addEventListener('error', (ev) => {
        try {
            appendLine('window.error', [ev.message, ev.filename + ':' + ev.lineno + ':' + ev.colno]);
        } catch (_) {}
    });
    window.addEventListener('unhandledrejection', (ev) => {
        try {
            appendLine('unhandledrejection', [ev.reason]);
        } catch (_) {}
    });

    window.mgToggleCloudDebugPanel = function () {
        const panel = document.getElementById('cloudDebugPanel');
        if (!panel) return;
        panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
        scheduleFlush();
    };
    window.mgClearCloudDebugLog = function () {
        state.lines = [];
        scheduleFlush();
    };
    window.mgCopyCloudDebugLog = async function () {
        const text = state.lines.join('\n');
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.getElementById('cloudDebugLogText');
                if (ta) {
                    ta.focus();
                    ta.select();
                    document.execCommand('copy');
                }
            }
            if (typeof showGlobalToast === 'function') showGlobalToast('✅ 已复制调试日志');
            else alert('已复制调试日志');
        } catch (e) {
            console.error('复制失败:', e);
            alert('复制失败，请长按文本框手动复制');
        }
    };
})();

// 全局变量
let products = [];
let gifts = [];
let productSettings = [];
let processSettings = [];
let quoteData = null;
let history = [];
let productIdCounter = 0;
let giftIdCounter = 0;
let selectedHistoryIds = new Set(); // 存储选中的历史记录ID
let templates = []; // 存储模板列表
let expandedCategories = new Set(); // 存储展开的分类状态

// ========== 自定义搜索下拉组件 ==========
/**
 * 创建可搜索下拉组件
 * @param {string} inputId - 原input的id
 * @param {Array} options - 选项数组 [{value, label}] 或 字符串数组
 * @param {string} placeholder - 占位文字
 * @param {Function} onChange - 选择后的回调函数(value, label)
 * @param {string} initialValue - 初始值
 */
function createSearchableSelect(inputId, options, placeholder, onChange, initialValue) {
    const container = document.getElementById(inputId);
    if (!container) return null;
    
    // 规范化选项格式
    const normalizedOptions = options.map(opt => {
        if (typeof opt === 'string') {
            return { value: opt, label: opt };
        }
        return { value: opt.value || opt.label, label: opt.label || opt.value };
    });
    
    // 查找初始选项
    let selectedOption = null;
    if (initialValue) {
        selectedOption = normalizedOptions.find(opt => opt.value === initialValue || opt.label === initialValue);
    }
    
    // 创建组件 HTML
    container.innerHTML = `
        <div class="searchable-select${selectedOption ? ' has-value' : ''}" data-input-id="${inputId}">
            <input type="text" class="searchable-select-input" 
                   placeholder="${placeholder || '请选择或输入'}"
                   value="${selectedOption ? selectedOption.label : ''}"
                   autocomplete="off">
            <button type="button" class="searchable-select-clear" aria-label="清空" title="清空">
                <svg class="icon" aria-hidden="true"><use href="#i-close"></use></svg>
                <span class="sr-only">清空</span>
            </button>
            <span class="searchable-select-arrow">▼</span>
            <div class="searchable-select-dropdown"></div>
        </div>
    `;
    
    const wrapper = container.querySelector('.searchable-select');
    const input = wrapper.querySelector('.searchable-select-input');
    const clearBtn = wrapper.querySelector('.searchable-select-clear');
    const dropdown = wrapper.querySelector('.searchable-select-dropdown');
    
    // 存储数据
    wrapper._options = normalizedOptions;
    wrapper._selectedValue = selectedOption ? selectedOption.value : '';
    wrapper._onChange = onChange;
    
    // 渲染选项列表
    function renderOptions(filter = '') {
        const filterLower = filter.toLowerCase();
        const filtered = normalizedOptions.filter(opt => 
            opt.label.toLowerCase().includes(filterLower)
        );
        
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="searchable-select-empty">无匹配选项</div>';
        } else {
            dropdown.innerHTML = filtered.map(opt => `
                <div class="searchable-select-option${wrapper._selectedValue === opt.value ? ' selected' : ''}" 
                     data-value="${opt.value}">
                    ${opt.label}
                </div>
            `).join('');
        }
    }
    
    // 打开下拉
    function openDropdown() {
        wrapper.classList.add('open');
        renderOptions(input.value);
    }
    
    // 关闭下拉
    function closeDropdown() {
        wrapper.classList.remove('open');
    }
    
    // 选择选项
    function selectOption(value, label) {
        wrapper._selectedValue = value;
        input.value = label;
        wrapper.classList.add('has-value');
        closeDropdown();
        if (wrapper._onChange) {
            wrapper._onChange(value, label);
        }
    }
    
    // 事件：点击输入框
    input.addEventListener('click', function(e) {
        e.stopPropagation();
        if (wrapper.classList.contains('open')) {
            closeDropdown();
        } else {
            openDropdown();
            // 如果有值，选中全部文字便于重新输入
            this.select();
        }
    });
    
    // 事件：输入搜索
    input.addEventListener('input', function() {
        openDropdown();
        renderOptions(this.value);
        // 清空选中状态
        wrapper._selectedValue = '';
        wrapper.classList.remove('has-value');
    });
    
    // 事件：键盘导航
    input.addEventListener('keydown', function(e) {
        const options = dropdown.querySelectorAll('.searchable-select-option');
        const highlighted = dropdown.querySelector('.searchable-select-option.highlighted');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!wrapper.classList.contains('open')) {
                openDropdown();
            } else if (options.length > 0) {
                const next = highlighted ? highlighted.nextElementSibling : options[0];
                if (next && next.classList.contains('searchable-select-option')) {
                    if (highlighted) highlighted.classList.remove('highlighted');
                    next.classList.add('highlighted');
                    next.scrollIntoView({ block: 'nearest' });
                }
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (options.length > 0 && highlighted) {
                const prev = highlighted.previousElementSibling;
                if (prev && prev.classList.contains('searchable-select-option')) {
                    highlighted.classList.remove('highlighted');
                    prev.classList.add('highlighted');
                    prev.scrollIntoView({ block: 'nearest' });
                }
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlighted) {
                selectOption(highlighted.dataset.value, highlighted.textContent.trim());
            } else if (options.length === 1) {
                // 只有一个选项时直接选中
                selectOption(options[0].dataset.value, options[0].textContent.trim());
            }
        } else if (e.key === 'Escape') {
            closeDropdown();
        }
    });
    
    // 事件：失去焦点时，如果没选中有效值则恢复或清空
    input.addEventListener('blur', function() {
        setTimeout(() => {
            if (!wrapper._selectedValue && this.value) {
                // 尝试匹配输入值
                const match = normalizedOptions.find(opt => 
                    opt.label.toLowerCase() === this.value.toLowerCase()
                );
                if (match) {
                    selectOption(match.value, match.label);
                } else {
                    // 允许自定义输入
                    wrapper._selectedValue = this.value;
                    wrapper.classList.add('has-value');
                    if (wrapper._onChange) {
                        wrapper._onChange(this.value, this.value);
                    }
                }
            }
            closeDropdown();
        }, 150);
    });
    
    // 事件：点击选项
    dropdown.addEventListener('click', function(e) {
        const option = e.target.closest('.searchable-select-option');
        if (option) {
            selectOption(option.dataset.value, option.textContent.trim());
        }
    });
    
    // 事件：清空按钮
    clearBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        input.value = '';
        wrapper._selectedValue = '';
        wrapper.classList.remove('has-value');
        input.focus();
        openDropdown();
        renderOptions('');
        if (wrapper._onChange) {
            wrapper._onChange('', '');
        }
    });
    
    // 点击外部关闭
    document.addEventListener('click', function(e) {
        if (!wrapper.contains(e.target)) {
            closeDropdown();
        }
    });
    
    return {
        getValue: () => wrapper._selectedValue,
        setValue: (value) => {
            const opt = normalizedOptions.find(o => o.value === value || o.label === value);
            if (opt) {
                selectOption(opt.value, opt.label);
            } else {
                input.value = value;
                wrapper._selectedValue = value;
                wrapper.classList.toggle('has-value', !!value);
            }
        },
        updateOptions: (newOptions) => {
            wrapper._options = newOptions.map(opt => {
                if (typeof opt === 'string') return { value: opt, label: opt };
                return { value: opt.value || opt.label, label: opt.label || opt.value };
            });
            renderOptions(input.value);
        }
    };
}

// 获取搜索下拉组件的值
function getSearchableSelectValue(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return '';
    const wrapper = container.querySelector('.searchable-select');
    return wrapper ? wrapper._selectedValue : '';
}
// ========== 搜索下拉组件结束 ==========



// 默认设置（开放使用模板：用途拆分为自用/无盈利、同人商用，买断*3、企业*5，其余默认值偏保守）
const defaultSettings = {
    // 基础详细信息
    artistInfo: {
        id: '',           // 用户ID
        role: '美工',     // 身份：美工/画师
        contact: '',      // 联系方式
        defaultDuration: 7                // 默认工期（天）
    },
    orderRemark: '',      // 订单备注（设置页增加备注弹窗内容）
    // 用途系数：自用/无盈利 1，同人商用 2，买断 3，企业/书店 5
    usageCoefficients: {
        personal: { value: 1, name: '自用/无盈利' },
        doujin: { value: 2, name: '同人商用' },
        buyout: { value: 3, name: '买断（可要求不公开）' },
        enterprise: { value: 5, name: '企业/书店/出版社等' }
    },
    // 加急系数（默认偏保守）
    urgentCoefficients: {
        normal: { value: 1, name: '无' },
        oneWeek: { value: 1.2, name: '一周加急' },
        seventyTwoHours: { value: 1.5, name: '72H加急' },
        fortyEightHours: { value: 1.8, name: '48H加急' },
        twentyFourHours: { value: 2, name: '24H加急' }
    },
    // 同模设置
    sameModelMode: 'coefficient', // 'coefficient' (系数) 或 'minus' (减金额)
    sameModelMinusAmount: 10,     // 减免金额（元/件）
    sameModelCoefficients: {
        basic: { value: 0.4, name: '改字、色、柄图' },
        advanced: { value: 0.6, name: '改字、色、柄图、元素' }
    },
    // 折扣系数
    discountCoefficients: {
        none: { value: 1, name: '无' },
        sample: { value: 0.95, name: '上次合作寄样' }
    },
    // 平台手续费（%，约稿平台比例固定）
    platformFees: {
        none: { value: 0, name: '无' },
        mihua: { value: 5, name: '米画师' },
        painter: { value: 5, name: '画加' }
    },
    // 其他费用
    otherFees: {
        // 其他费用类别，可动态添加
    },
    // 结算规则配置（撤单/废稿默认值 + 优惠原因）
    settlementRules: {
        cancelFee: {
            defaultRule: 'percent',
            defaultRate: 0.05,      // 默认 5%
            defaultFixedAmount: 30,
            minAmount: 0,
            maxAmount: null
        },
        wasteFee: {
            mode: 'percent_total',
            defaultRate: 20,       // 默认 20%
            defaultFixedPerItem: 10,
            minAmount: null,
            maxAmount: null,
            defaultPartialProducts: false,
            defaultExcludeNoProcess: false
        },
        discountReasons: [
            { id: 1, name: '延期补偿', defaultAmount: 0, defaultRate: 0.97, preferType: 'rate' },
            { id: 2, name: '老客优惠', defaultAmount: 5, defaultRate: null, preferType: 'amount' }
        ]
    },
    // 定金比例（0~1）
    depositRate: 0.2,
    // 可扩展的加价类系数
    extraPricingUp: [
        {
            id: 1,
            name: "不公开展示系数",
            options: {
                none: { value: 1, name: '无' },
                private: { value: 1.2, name: '不公开展示' }
            }
        }
    ],
    // 背景费（元）
    backgroundFee: 5,
    // 可扩展的折扣类系数（折扣为内置；此处为后期添加的）
    extraPricingDown: [],
    // 小票自定义设置
    receiptCustomization: {
        theme: 'classic',  // 主题名称：classic, modern, warm, dark, minimal
        headerImage: null,  // 头部图片的base64数据
        titleText: 'LIST',  // 标题文本
        receiptInfo: {  // 小票信息行
            orderNotification: '',  // 订单通知
            showStartTime: true,  // 是否显示开始时间
            showDeadline: true,  // 是否显示截稿时间
            showOrderTime: true,  // 是否体现下单时间
            showDesigner: true,  // 是否显示设计师
            showContactInfo: true,  // 是否显示联系方式
            customText: '',  // 自定义文本
            followSystemTheme: false  // 是否跟随系统主题颜色
        },
        footerText1: '温馨提示',  // 尾部文本1
        footerText2: '感谢惠顾',  // 尾部文本2
        footerImage: null,  // 尾部图片的base64数据
        fontSettings: {  // 字体设置
            fontFamily: 'Courier New, Source Han Sans SC, Noto Sans SC, PingFang SC, Hiragino Sans GB, Courier, Monaco, Consolas, monospace',
            fontSize: 13,
            fontWeight: 400,
            lineHeight: 1.3,
            categoryFonts: {  // 分类字体设置
                enabled: false,
                title: '',      // 标题字体
                body: '',        // 正文字体
                number: '',      // 价格/数字字体
                summary: '',     // 汇总字体
                footer: ''       // 尾部字体
            }
        }
    },
    customThemes: {},  // 自定义主题存储 {themeId: {name, bg, text, accent, title, divider, borderRadius}}
    importedFonts: {}  // 导入的字体存储 {fontId: {name, family, data, format, size}}
};

// 默认制品分类（单一定义，避免多处硬编码）
const DEFAULT_CATEGORIES = ['吧唧类', '纸片类', '亚克力类'];

// ========== 昼夜模式（黑夜模式） ==========
const THEME_STORAGE_KEY = 'appTheme'; // 'light' | 'dark' | 'system'，默认跟随系统

function getStoredTheme() {
    try {
        const v = localStorage.getItem(THEME_STORAGE_KEY);
        return (v === 'light' || v === 'dark' || v === 'system') ? v : 'system';
    } catch (e) {
        return 'system';
    }
}

function setStoredTheme(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {}
}

function getSystemPrefersDark() {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getEffectiveTheme() {
    const stored = getStoredTheme();
    if (stored === 'system') return getSystemPrefersDark() ? 'dark' : 'light';
    return stored;
}

function applyTheme() {
    const effective = getEffectiveTheme();
    const root = document.documentElement;
    if (effective === 'dark') {
        root.classList.add('theme-dark');
    } else {
        root.classList.remove('theme-dark');
    }
    // 强制重排，避免黑夜模式下 Today/今日 首次切换时变量未生效导致不可见
    void root.offsetHeight;
    updateThemeToggleIcon();
    // 切换主题后重新渲染排单日历和 todo，使彩条/圆点使用对应配色
    if (typeof renderScheduleCalendar === 'function' && document.getElementById('scheduleCalendar')) {
        renderScheduleCalendar();
    }
    if (typeof renderScheduleTodoSection === 'function' && document.getElementById('scheduleTodoModules')) {
        renderScheduleTodoSection();
    }
}

function updateThemeToggleIcon() {
    const effective = getEffectiveTheme();
    const sunEl = document.querySelector('#themeToggleBtn .theme-icon-sun');
    const moonEl = document.querySelector('#themeToggleBtn .theme-icon-moon');
    if (sunEl && moonEl) {
        sunEl.classList.toggle('d-none', effective !== 'dark');
        moonEl.classList.toggle('d-none', effective !== 'light');
    }
}

function toggleThemeOnClick() {
    const stored = getStoredTheme();
    const effective = getEffectiveTheme();
    if (stored === 'system') {
        setStoredTheme(effective === 'dark' ? 'light' : 'dark');
    } else {
        setStoredTheme(stored === 'dark' ? 'light' : 'dark');
    }
    applyTheme();
}

function toggleThemeLongPress(event) {
    event.preventDefault();
    setStoredTheme('system');
    applyTheme();
    if (typeof showGlobalToast === 'function') {
        showGlobalToast('已切换为跟随系统');
    } else {
        try { alert('已切换为跟随系统'); } catch (e) {}
    }
}

// 初始化应用
function init() {
    // 加载未同步订单列表
    loadUnsyncedOrders();
    
    // 昼夜模式：先应用主题，再监听系统偏好
    applyTheme();
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
            if (getStoredTheme() === 'system') applyTheme();
        });
    }
    // 主题按钮长按（触摸）：500ms 后视为长按，切换为跟随系统
    (function () {
        var themeBtn = document.getElementById('themeToggleBtn');
        if (!themeBtn) return;
        var timer = null;
        function clearTimer() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        }
        themeBtn.addEventListener('touchstart', function (e) {
            clearTimer();
            timer = setTimeout(function () {
                timer = null;
                toggleThemeLongPress(e);
            }, 500);
        }, { passive: true });
        themeBtn.addEventListener('touchend', clearTimer, { passive: true });
        themeBtn.addEventListener('touchcancel', clearTimer, { passive: true });
    })();

    // 加载本地存储的数据
    loadData();
    
    // 确保小票自定义设置中有主题字段
    if (!defaultSettings.receiptCustomization.theme) {
        defaultSettings.receiptCustomization.theme = 'classic';
    }
    
    // 确保自定义主题对象存在
    if (!defaultSettings.customThemes) {
        defaultSettings.customThemes = {};
    }
    
    // 确保导入字体对象存在
    if (!defaultSettings.importedFonts) {
        defaultSettings.importedFonts = {};
    }
    
    // 加载已导入的字体
    loadImportedFonts();
    
    // 确保字体设置存在
    if (!defaultSettings.receiptCustomization.fontSettings) {
        defaultSettings.receiptCustomization.fontSettings = {
            fontFamily: 'Courier New, Source Han Sans SC, Noto Sans SC, PingFang SC, Hiragino Sans GB, Courier, Monaco, Consolas, monospace',
            fontSize: 13,
            fontWeight: 400,
            lineHeight: 1.3,
            categoryFonts: {
                enabled: false,
                title: '',
                body: '',
                number: '',
                summary: '',
                footer: ''
            }
        };
    }
    
    // 确保分类字体设置存在
    if (!defaultSettings.receiptCustomization.fontSettings.categoryFonts) {
        defaultSettings.receiptCustomization.fontSettings.categoryFonts = {
            enabled: false,
            title: '',
            body: '',
            number: '',
            summary: '',
            footer: ''
        };
    }
    // 确保结算规则与定金存在（旧数据兼容）
    if (!defaultSettings.settlementRules) {
        defaultSettings.settlementRules = {
            cancelFee: { defaultRule: 'percent', defaultRate: 0.05, defaultFixedAmount: 30, minAmount: 0, maxAmount: null },
            wasteFee: { mode: 'percent_total', defaultRate: 20, defaultFixedPerItem: 10, defaultFixedAmount: 30, minAmount: null, maxAmount: null, defaultPartialProducts: false, defaultExcludeNoProcess: false },
            discountReasons: [
                { id: 1, name: '延期补偿', defaultAmount: 0, defaultRate: 0.97, preferType: 'rate' },
                { id: 2, name: '老客优惠', defaultAmount: 5, defaultRate: null, preferType: 'amount' }
            ]
        };
    }
    if (!defaultSettings.settlementRules.discountReasons || !Array.isArray(defaultSettings.settlementRules.discountReasons)) {
        defaultSettings.settlementRules.discountReasons = [
            { id: 1, name: '延期补偿', defaultAmount: 0, defaultRate: 0.97, preferType: 'rate' },
            { id: 2, name: '老客优惠', defaultAmount: 5, defaultRate: null, preferType: 'amount' }
        ];
    }
    // 旧数据迁移：wasteFee.defaultRule → mode，defaultRate 从 0~1 → 0~100
    if (defaultSettings.settlementRules.wasteFee) {
        var wf = defaultSettings.settlementRules.wasteFee;
        if (wf.defaultRule && !wf.mode) {
            wf.mode = wf.defaultRule;
            delete wf.defaultRule;
        }
        if (wf.defaultRate != null && wf.defaultRate <= 1) {
            wf.defaultRate = wf.defaultRate * 100; // 0.3 → 30
        }
        if (wf.minAmount === 0) wf.minAmount = null;
    }
    if (defaultSettings.depositRate == null || defaultSettings.depositRate === undefined) {
        defaultSettings.depositRate = 0.2;
    }
    
    // 应用当前主题样式（如果是自定义主题）
    const currentTheme = defaultSettings.receiptCustomization.theme;
    if (currentTheme && currentTheme.startsWith('custom_')) {
        applyCustomThemeStyles(currentTheme);
    }
    
    // 应用字体设置
    applyFontSettings();
    
    // 更新主题选择器（添加自定义主题选项）
    updateThemeSelector();
    
    // 确保默认设置不为空
    addDefaultProductSettings();
    addDefaultProcessSettings();
    
    // 如果制品列表为空，添加第一个制品项（确保默认只显示一个）
    if (products.length === 0) {
        addProduct();
    }
    
    // 初始化其他费用类型选项
    initOtherFeeTypeOptions();
    initOtherFeeAutoAddBindings();
    
    // 初始化计算页彩条颜色预览
    if (typeof initScheduleColorPreview === 'function') {
        initScheduleColorPreview();
    }
    
    // 更新显示
    updateDisplay();
    
    // 初始化计算页彩条颜色预览
    if (typeof initScheduleColorPreview === 'function') {
        initScheduleColorPreview();
    }

    // 总是渲染制品设置和工艺设置，确保数据被渲染到页面上
    renderProductSettings();
    renderProcessSettings();
    renderCoefficientSettings();
    initClientTemplateEditor();
    
    // 更新计算页中的系数选择器
    updateCalculatorCoefficientSelects();
    
    // 添加开始时间事件监听器，实现自动计算截稿时间
    document.addEventListener('DOMContentLoaded', function() {
        const startTime = document.getElementById('startTime');
        if (startTime) {
            startTime.value = toYmd(new Date());
            
            startTime.addEventListener('change', calculateDeadline);
        }
        
        // 设置默认选中自定义选项并触发更新
        const otherFeeTypeSelect = document.getElementById('otherFeeType');
        if (otherFeeTypeSelect) {
            otherFeeTypeSelect.value = 'custom';
            updateOtherFeeAmount();
        }
        
        // 初始化背景费输入框
        const backgroundFeeInput = document.getElementById('backgroundFeeInput');
        if (backgroundFeeInput) {
            backgroundFeeInput.value = defaultSettings.backgroundFee || 10;
        }
        
        // 初始化主题选择器
        const themeSelector = document.getElementById('themeSelector');
        if (themeSelector) {
            const currentTheme = defaultSettings.receiptCustomization?.theme || 'classic';
            themeSelector.value = currentTheme;
            
            // 初始化移动端分段控件
            const segmentBtns = document.querySelectorAll('.theme-segment-btn');
            segmentBtns.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.theme === currentTheme) {
                    btn.classList.add('active');
                }
            });
        }
        
        // 初始化小票设置功能
        initReceiptCustomization();
        
        // 标题区日期选择器绑定事件
        const scheduleTitleDateInput = document.getElementById('scheduleTitleDateInput');
        if (scheduleTitleDateInput) {
            scheduleTitleDateInput.addEventListener('change', onScheduleTitleDateChange);
        }
        // 离开页面前立即落盘，避免防抖导致未保存
        window.addEventListener('beforeunload', function () {
            clearTimeout(_saveDataTimer);
            if (typeof doSaveData === 'function') doSaveData();
        });
    });

    // 默认进入时渲染排单页（报价页），确保刷新后排单日历正常显示
    if (typeof showPage === 'function') {
        showPage('quote');
    }
}

// 兼容处理：将旧格式系数转换为新格式（默认名称以 defaultSettings 为准，不在此处重复维护）
function normalizeCoefficients(settings) {
    const coefficientTypes = ['usageCoefficients', 'urgentCoefficients', 'sameModelCoefficients', 'discountCoefficients', 'platformFees'];
    function getDefaultName(type, key) {
        const obj = defaultSettings[type];
        return (obj && obj[key] && typeof obj[key] === 'object' && obj[key].name) ? obj[key].name : key;
    }

    coefficientTypes.forEach(type => {
        if (settings[type]) {
            Object.keys(settings[type]).forEach(key => {
                const item = settings[type][key];
                // 如果是旧格式（直接是数值），转换为新格式
                if (typeof item === 'number') {
                    settings[type][key] = {
                        value: item,
                        name: getDefaultName(type, key)
                    };
                } else if (item && typeof item === 'object' && !item.value && !item.name) {
                    // 如果已经是对象但没有value和name字段，可能是其他格式，跳过
                } else if (item && typeof item === 'object' && item.value !== undefined) {
                    // 新格式，确保有name字段
                    if (!item.name) {
                        item.name = getDefaultName(type, key);
                    }
                }
            });
        }
    });
}

// 获取系数值（兼容新旧格式）
function getCoefficientValue(coefficientObj) {
    if (typeof coefficientObj === 'number') {
        return coefficientObj;
    }
    if (coefficientObj && typeof coefficientObj === 'object' && coefficientObj.value !== undefined) {
        return coefficientObj.value;
    }
    return coefficientObj || 0;
}

// 加载本地存储的数据
function loadData() {
    // 先单独加载 templates，避免受其他键 parse 失败影响，确保刷新后模板不丢失
    try {
        const savedTemplates = localStorage.getItem('templates');
        if (savedTemplates) {
            const parsed = JSON.parse(savedTemplates);
            templates = Array.isArray(parsed) ? parsed : [];
        } else {
            templates = [];
        }
    } catch (e) {
        templates = [];
    }

    try {
        const savedHistory = localStorage.getItem('quoteHistory');
        const savedSettings = localStorage.getItem('calculatorSettings');
        const savedProductSettings = localStorage.getItem('productSettings');
        const savedProcessSettings = localStorage.getItem('processSettings');
        
        if (savedHistory) {
            history = JSON.parse(savedHistory);
            // 排单 todo 兼容：旧数据补全 productDoneStates（制品+赠品）
            history.forEach(item => {
                ensureProductDoneStates(item);
            });
        }
        
        if (savedSettings) {
            const loadedSettings = JSON.parse(savedSettings);
            // 兼容旧数据格式：将旧格式（直接存储数值）转换为新格式（存储对象）
            normalizeCoefficients(loadedSettings);
            
            // 安全合并设置，避免空对象覆盖默认值
            Object.keys(loadedSettings).forEach(key => {
                // 如果是系数相关的设置，且加载的值是空对象，则跳过（保留默认值）
                if ((key.endsWith('Coefficients') || key.endsWith('Fees')) && 
                    loadedSettings[key] && 
                    typeof loadedSettings[key] === 'object' && 
                    Object.keys(loadedSettings[key]).length === 0) {
                    return;
                }
                
                // 对于receiptCustomization，需要特殊处理，确保结构完整
                if (key === 'receiptCustomization' && loadedSettings[key] && typeof loadedSettings[key] === 'object') {
                    // 合并receiptCustomization对象，而不是完全替换
                    Object.keys(loadedSettings[key]).forEach(subKey => {
                        // 对于receiptInfo，也需要合并
                        if (subKey === 'receiptInfo' && loadedSettings[key][subKey] && typeof loadedSettings[key][subKey] === 'object') {
                            if (!defaultSettings.receiptCustomization.receiptInfo) {
                                defaultSettings.receiptCustomization.receiptInfo = {};
                            }
                            Object.keys(loadedSettings[key][subKey]).forEach(infoKey => {
                                defaultSettings.receiptCustomization.receiptInfo[infoKey] = loadedSettings[key][subKey][infoKey];
                            });
                        } else {
                            defaultSettings.receiptCustomization[subKey] = loadedSettings[key][subKey];
                        }
                    });
                } else {
                    // 其他情况直接赋值
                    defaultSettings[key] = loadedSettings[key];
                }
            });
            if (!Array.isArray(defaultSettings.extraPricingUp)) defaultSettings.extraPricingUp = [];
            if (!Array.isArray(defaultSettings.extraPricingDown)) defaultSettings.extraPricingDown = [];
            
            // 确保receiptCustomization结构完整
            if (!defaultSettings.receiptCustomization) {
                defaultSettings.receiptCustomization = {
                    theme: 'classic',
                    headerImage: null,
                    titleText: 'LIST',
                    receiptInfo: {
                        orderNotification: '',
                        showStartTime: true,
                        showDeadline: true,
                        showOrderTime: true,
                        showDesigner: true,
                        showContactInfo: true,
                        customText: '',
                        followSystemTheme: false
                    },
                    footerText1: '温馨提示',
                    footerText2: '感谢惠顾',
                    footerImage: null,
                    fontSettings: {
                        fontFamily: 'Courier New, Source Han Sans SC, Noto Sans SC, PingFang SC, Hiragino Sans GB, Courier, Monaco, Consolas, monospace',
                        fontSize: 13,
                        fontWeight: 400,
                        lineHeight: 1.3,
                        categoryFonts: {
                            enabled: false,
                            title: '',
                            body: '',
                            number: '',
                            summary: '',
                            footer: ''
                        }
                    }
                };
            } else {
                // 确保receiptInfo结构完整
                if (!defaultSettings.receiptCustomization.receiptInfo) {
                    defaultSettings.receiptCustomization.receiptInfo = {
                        orderNotification: '',
                        showStartTime: true,
                        showDeadline: true,
                        showOrderTime: true,
                        showDesigner: true,
                        showContactInfo: true,
                        customText: '',
                        followSystemTheme: false
                    };
                }
                // 确保fontSettings结构完整
                if (!defaultSettings.receiptCustomization.fontSettings) {
                    defaultSettings.receiptCustomization.fontSettings = {
                        fontFamily: 'Courier New, Source Han Sans SC, Noto Sans SC, PingFang SC, Hiragino Sans GB, Courier, Monaco, Consolas, monospace',
                        fontSize: 13,
                        fontWeight: 400,
                        lineHeight: 1.3,
                        categoryFonts: {
                            enabled: false,
                            title: '',
                            body: '',
                            number: '',
                            summary: '',
                            footer: ''
                        }
                    };
                }
            }
        }
        
        if (savedProductSettings) {
            productSettings = JSON.parse(savedProductSettings);
        }
        
        if (savedProcessSettings) {
            processSettings = JSON.parse(savedProcessSettings);
        }
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

// 保存数据到本地存储（防抖：短时间多次调用只写入一次）
var _saveDataTimer;
function doSaveData() {
    try {
        localStorage.setItem('quoteHistory', JSON.stringify(history));
        localStorage.setItem('calculatorSettings', JSON.stringify(defaultSettings));
        localStorage.setItem('productSettings', JSON.stringify(productSettings));
        localStorage.setItem('processSettings', JSON.stringify(processSettings));
    } catch (error) {
        console.error('保存数据失败:', error);
    }
    try {
        const data = Array.isArray(templates) ? templates : [];
        localStorage.setItem('templates', JSON.stringify(data));
    } catch (e) {
        console.error('保存模板失败:', e);
    }
    
    // 如果启用了云端模式，自动同步设置到云端
    // 合并模式下也会自动同步（因为已经智能合并过了）
    if (mgIsCloudEnabled() && localStorage.getItem('mg_cloud_enabled') === '1') {
        // 所有模式都自动同步设置（延迟执行，避免频繁请求）
        clearTimeout(window._autoSyncSettingsTimer);
        window._autoSyncSettingsTimer = setTimeout(() => {
            // 自动同步时不显示提示，静默同步
            mgSyncSettingsToCloud(true).catch(err => {
                console.error('自动同步设置到云端失败:', err);
            });
        }, 2000); // 延迟2秒，避免频繁同步
    }
}
function saveData() {
    clearTimeout(_saveDataTimer);
    _saveDataTimer = setTimeout(doSaveData, 250);
}

// 导出设置为JSON文件
function exportSettings() {
    try {
        // 收集所有设置数据
        const exportData = {
            calculatorSettings: defaultSettings,
            productSettings: productSettings,
            processSettings: processSettings,
            templates: templates,
            exportDate: new Date().toISOString()
        };
        
        // 将设置转换为JSON字符串，添加缩进以提高可读性
        const settingsJSON = JSON.stringify(exportData, null, 2);
        
        // 创建Blob对象
        const blob = new Blob([settingsJSON], { type: 'application/json' });
        
        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // 生成包含日期的文件名
        const date = new Date();
        const timestamp = date.toISOString().replace(/[:.]/g, '-');
        a.download = `calculator-settings-${timestamp}.json`;
        
        // 触发下载
        document.body.appendChild(a);
        a.click();
        
        // 清理
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        if (typeof showGlobalToast === 'function') showGlobalToast('设置已导出');
        else alert('设置导出成功！');
    } catch (e) {
        console.error('导出设置失败:', e);
        alert('导出设置失败，请重试');
    }
}

// 添加默认制品设置（统一：固定价50，单面50双面80，基础50递增30）
function addDefaultProductSettings() {
    if (productSettings.length === 0) {
        productSettings = [
            { id: 1, name: '普通吧唧', category: '吧唧类', priceType: 'fixed', price: 50 },
            { id: 2, name: '异形吧唧', category: '吧唧类', priceType: 'fixed', price: 50 },
            { id: 3, name: '背卡', category: '纸片类', priceType: 'double', priceSingle: 50, priceDouble: 80 },
            { id: 4, name: '卡头', category: '纸片类', priceType: 'double', priceSingle: 50, priceDouble: 80 },
            { id: 5, name: '方卡', category: '纸片类', priceType: 'double', priceSingle: 50, priceDouble: 80 },
            { id: 6, name: '小卡', category: '纸片类', priceType: 'double', priceSingle: 50, priceDouble: 80 },
            { id: 7, name: '透卡', category: '纸片类', priceType: 'double', priceSingle: 50, priceDouble: 80 },
            { id: 8, name: '邮票', category: '纸片类', priceType: 'double', priceSingle: 50, priceDouble: 80 },
            { id: 9, name: '色纸', category: '纸片类', priceType: 'double', priceSingle: 50, priceDouble: 80 },
            { id: 10, name: '拍立得', category: '纸片类', priceType: 'double', priceSingle: 50, priceDouble: 80 },
            { id: 11, name: '明信片', category: '纸片类', priceType: 'double', priceSingle: 50, priceDouble: 80 },
            { id: 12, name: '票根', category: '纸片类', priceType: 'double', priceSingle: 50, priceDouble: 80 },
            { id: 13, name: '纸夹相卡', category: '纸片类', priceType: 'double', priceSingle: 50, priceDouble: 80 },
            { id: 14, name: '立牌', category: '亚克力类', priceType: 'config', basePrice: 50, baseConfig: '立牌+底座', additionalConfigs: [
                { name: '底座', price: 30, unit: '个' },
                { name: '插件', price: 30, unit: '个' }
            ]},
            { id: 15, name: '麻将', category: '亚克力类', priceType: 'config', basePrice: 50, baseConfig: '1面', additionalConfigs: [
                { name: '面', price: 30, unit: '面' }
            ]},
            { id: 16, name: '头像', category: '绘制类', priceType: 'nodes', price: 140, nodes: [
                { name: '草稿', percent: 30 },
                { name: '色稿', percent: 40 },
                { name: '成图', percent: 30 }
            ]}
        ];
    }
}

// 添加默认工艺设置
function addDefaultProcessSettings() {
    if (processSettings.length === 0) {
        processSettings = [
            { id: 1, name: '烫色', price: 10 },
            { id: 2, name: '白墨', price: 10 },
            { id: 3, name: 'UV', price: 10 },
            { id: 4, name: '逆向', price: 10 }
        ];
    }
}

// 更新小票自定义设置
function updateReceiptCustomization(field, value) {
    if (field === 'headerImage' || field === 'footerImage') {
        // 如果是图片文件，将其转换为base64
        if (value && value.type && value.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                defaultSettings.receiptCustomization[field] = e.target.result;
                saveData();
                debouncedRefreshReceipt(); // 实时预览
            };
            reader.readAsDataURL(value);
        }
    } else {
        // 如果是文本内容，直接更新
        defaultSettings.receiptCustomization[field] = value;
        saveData();
        debouncedRefreshReceipt(); // 实时预览（标题、尾部文本等）
    }
}

// 预览图片
function previewImage(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        if (!file.type.match('image.*')) {
            alert('请选择图片文件');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="图片预览">`;
        };
        
        reader.readAsDataURL(file);
    }
}

// 切换小票自定义设置面板
function toggleReceiptCustomizationPanel() {
    const modal = document.getElementById('receiptCustomizationModal');
    const drawer = document.getElementById('receiptDrawer');
    
    if (modal.classList.contains('d-none')) {
        // 打开小票设置时，确保小票头/尾图片可见（避免被“排单后折叠图片”状态隐藏）
        const quotePage = document.getElementById('quote');
        if (quotePage) {
            quotePage.classList.remove('quote-receipt-images-collapsed');
        }

        // 手机端：先把小票滚到视口上方，方便上半屏预览
        if (window.innerWidth <= 768) {
            const quoteEl = document.getElementById('quoteContent');
            if (quoteEl && quoteEl.scrollIntoView) {
                quoteEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        modal.classList.remove('d-none');
        if (drawer) drawer.classList.add('customization-open');
        loadReceiptCustomizationToForm();
    } else {
        modal.classList.add('d-none');
        if (drawer) drawer.classList.remove('customization-open');
    }
}

// 关闭小票自定义设置面板
function closeReceiptCustomizationPanel() {
    const modal = document.getElementById('receiptCustomizationModal');
    const drawer = document.getElementById('receiptDrawer');
    if (modal) modal.classList.add('d-none');
    if (drawer) drawer.classList.remove('customization-open');
}

// 切换小票设置标签页
function switchReceiptTab(tabName) {
    // 隐藏所有标签页内容
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 移除所有标签按钮的active状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 显示选中的标签页
    const targetTab = document.getElementById(tabName + '-tab');
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // 激活对应的标签按钮
    const targetBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => {
        return btn.textContent.trim() === (tabName === 'settings' ? '设置' : tabName === 'theme' ? '主题' : '字体');
    });
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
    
    // 如果是主题标签页，加载当前主题到表单（保证边框等颜色显示正确）并刷新拾色器
    if (tabName === 'theme') {
        loadCustomThemesList();
        loadCurrentThemeToCustom();
        updateCustomThemePreview();
        if (typeof updateCustomThemeBorder === 'function') updateCustomThemeBorder();
        syncBorderColorInputDisplay();
    }
    
    // 如果是字体标签页，加载字体设置
    if (tabName === 'font') {
        loadFontSettings();
    }
}

// 将颜色统一为 #rrggbb 六位十六进制格式（用于保存与展示 #000000 格式）
function toHex6(color) {
    if (!color || typeof color !== 'string') return '#000000';
    const c = color.trim();
    const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(c);
    if (short) return '#' + short[1] + short[1] + short[2] + short[2] + short[3] + short[3];
    const full = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(c);
    if (full) return '#' + full[1].toLowerCase() + full[2].toLowerCase() + full[3].toLowerCase();
    return '#000000';
}

// 保存自定义主题
function saveCustomTheme() {
    const name = document.getElementById('customThemeName').value.trim();
    if (!name) {
        alert('请输入主题名称');
        return;
    }
    
    const themeId = 'custom_' + Date.now();
    const theme = {
        name: name,
        bg: toHex6(document.getElementById('customThemeBg').value),
        text: toHex6(document.getElementById('customThemeText').value),
        accent: toHex6(document.getElementById('customThemeAccent').value),
        title: toHex6(document.getElementById('customThemeTitle').value),
        divider: toHex6(document.getElementById('customThemeDivider').value),
        borderRadius: parseInt(document.getElementById('customThemeBorderRadius').value) || 0,
        borderStyle: document.getElementById('customThemeBorderStyle').value || 'none',
        borderWidth: parseInt(document.getElementById('customThemeBorderWidth').value) || 0,
        borderColor: toHex6(document.getElementById('customThemeBorderColor').value) || '#cbd5e0',
        texture: document.getElementById('customThemeTexture').value || 'none',
        textureOpacity: parseFloat(document.getElementById('customThemeTextureOpacity').value) || 0.1
    };
    
    if (!defaultSettings.customThemes) {
        defaultSettings.customThemes = {};
    }
    defaultSettings.customThemes[themeId] = theme;
    saveData();
    
    // 更新主题选择器
    updateThemeSelector();
    
    // 重新加载自定义主题列表
    loadCustomThemesList();
    
    alert('自定义主题已保存！');
}

// 更新颜色值显示（统一 #000000 格式），若当前使用自定义主题则实时预览
function updateCustomThemePreview() {
    const colorInputs = ['customThemeBg', 'customThemeText', 'customThemeAccent', 'customThemeTitle', 'customThemeDivider'];
    const fieldMap = { customThemeBg: 'bg', customThemeText: 'text', customThemeAccent: 'accent', customThemeTitle: 'title', customThemeDivider: 'divider' };
    colorInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        const valueSpan = document.getElementById(inputId + 'Value');
        if (input && valueSpan) {
            valueSpan.textContent = toHex6(input.value).toUpperCase();
        }
    });

    const currentTheme = defaultSettings.receiptCustomization?.theme || 'classic';
    if (currentTheme.startsWith('custom_') && defaultSettings.customThemes && defaultSettings.customThemes[currentTheme]) {
        const theme = defaultSettings.customThemes[currentTheme];
        colorInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            const field = fieldMap[inputId];
            if (input && field) theme[field] = toHex6(input.value);
        });
        const radiusInput = document.getElementById('customThemeBorderRadius');
        if (radiusInput) theme.borderRadius = parseInt(radiusInput.value) || 0;
        saveData();
        applyCustomThemeStyles(currentTheme);
        debouncedRefreshReceipt(); // 实时预览
    }

    const borderColorInput = document.getElementById('customThemeBorderColor');
    const borderColorValue = document.getElementById('customThemeBorderColorValue');
    if (borderColorInput && borderColorValue) {
        borderColorValue.textContent = toHex6(borderColorInput.value).toUpperCase();
    }
}

// 从当前主题加载到自定义主题编辑器
function loadCurrentThemeToCustom() {
    const currentTheme = defaultSettings.receiptCustomization?.theme || 'classic';
    
    // 如果是自定义主题，直接加载
    if (currentTheme.startsWith('custom_') && defaultSettings.customThemes && defaultSettings.customThemes[currentTheme]) {
        const theme = defaultSettings.customThemes[currentTheme];
        document.getElementById('customThemeName').value = theme.name;
        document.getElementById('customThemeBg').value = toHex6(theme.bg);
        document.getElementById('customThemeText').value = toHex6(theme.text);
        document.getElementById('customThemeAccent').value = toHex6(theme.accent);
        document.getElementById('customThemeTitle').value = toHex6(theme.title);
        document.getElementById('customThemeDivider').value = toHex6(theme.divider);
        document.getElementById('customThemeBorderRadius').value = theme.borderRadius || 0;
        
        if (document.getElementById('customThemeBorderStyle')) {
            document.getElementById('customThemeBorderStyle').value = theme.borderStyle || 'none';
        }
        if (document.getElementById('customThemeBorderWidth')) {
            document.getElementById('customThemeBorderWidth').value = theme.borderWidth || 0;
        }
        if (document.getElementById('customThemeBorderColor')) {
            document.getElementById('customThemeBorderColor').value = toHex6(theme.borderColor || '#cbd5e0');
        }
        
        // 加载底纹设置
        if (document.getElementById('customThemeTexture')) {
            document.getElementById('customThemeTexture').value = theme.texture || 'none';
        }
        if (document.getElementById('customThemeTextureOpacity')) {
            document.getElementById('customThemeTextureOpacity').value = theme.textureOpacity || 0.1;
        }
        
        updateCustomThemePreview();
        updateCustomThemeBorder();
        updateCustomThemeTexture();
        syncBorderColorInputDisplay();
        return;
    }
    
    // 如果是预设主题，从CSS变量读取
    const themeColors = {
        classic: { bg: '#fdfdfd', text: '#2d3748', accent: '#4a5568', title: '#2d3748', divider: '#cbd5e0', borderRadius: 0 },
        modern: { bg: '#ffffff', text: '#2c3e50', accent: '#2563eb', title: '#2c3e50', divider: '#cbd5e0', borderRadius: 0 },
        warm: { bg: '#fff7ed', text: '#9a3412', accent: '#fb923c', title: '#92400e', divider: '#fed7aa', borderRadius: 14 },
        dark: { bg: '#1a1a2e', text: '#e2e8f0', accent: '#fbbf24', title: '#e2e8f0', divider: '#475569', borderRadius: 0 },
        nature: { bg: '#f6fdf7', text: '#2f855a', accent: '#48bb78', title: '#15803d', divider: '#c6f6d5', borderRadius: 0 },
        vintage: { bg: '#f8f0e3', text: '#5c1a1a', accent: '#8b3e2f', title: '#5c1a1a', divider: '#c89b6e', borderRadius: 0 },
        sakura: { bg: '#fef7fb', text: '#4a5568', accent: '#be185d', title: '#be185d', divider: '#fecdd3', borderRadius: 0 },
        iceBlue: { bg: '#f0f9ff', text: '#1f2933', accent: '#0284c7', title: '#075985', divider: '#bae6fd', borderRadius: 0 }
    };
    
    const colors = themeColors[currentTheme] || themeColors.classic;
    document.getElementById('customThemeBg').value = toHex6(colors.bg);
    document.getElementById('customThemeText').value = toHex6(colors.text);
    document.getElementById('customThemeAccent').value = toHex6(colors.accent);
    document.getElementById('customThemeTitle').value = toHex6(colors.title);
    document.getElementById('customThemeDivider').value = toHex6(colors.divider);
    document.getElementById('customThemeBorderRadius').value = colors.borderRadius;
    
    // 设置默认边框和底纹
    if (document.getElementById('customThemeBorderStyle')) {
        document.getElementById('customThemeBorderStyle').value = 'none';
    }
    if (document.getElementById('customThemeBorderWidth')) {
        document.getElementById('customThemeBorderWidth').value = '0';
    }
    if (document.getElementById('customThemeBorderColor')) {
        document.getElementById('customThemeBorderColor').value = toHex6('#cbd5e0');
    }
    if (document.getElementById('customThemeTexture')) {
        document.getElementById('customThemeTexture').value = 'none';
    }
    if (document.getElementById('customThemeTextureOpacity')) {
        document.getElementById('customThemeTextureOpacity').value = '0.1';
    }
    
    updateCustomThemePreview();
    updateCustomThemeBorder();
    updateCustomThemeTexture();
    syncBorderColorInputDisplay();
}

// 更新边框颜色自定义色块显示（正圆 + 颜色与 HEX 一致）
function updateBorderColorSwatch(hex) {
    const swatch = document.getElementById('customThemeBorderColorSwatch');
    const input = document.getElementById('customThemeBorderColor');
    if (!swatch) return;
    const color = hex != null ? toHex6(hex) : (input && input.value ? toHex6(input.value) : '#cbd5e0');
    swatch.style.backgroundColor = color;
}

// 强制边框颜色 input 与自定义色块同步
function syncBorderColorInputDisplay() {
    const el = document.getElementById('customThemeBorderColor');
    if (!el || !el.value) return;
    const hex = toHex6(el.value);
    el.setAttribute('value', hex);
    el.value = hex;
    updateBorderColorSwatch(hex);
}

// 加载自定义主题列表
function loadCustomThemesList() {
    const listContainer = document.getElementById('customThemesList');
    if (!listContainer) return;
    
    if (!defaultSettings.customThemes || Object.keys(defaultSettings.customThemes).length === 0) {
        listContainer.innerHTML = '<p class="text-gray">暂无自定义主题</p>';
        return;
    }
    
    listContainer.innerHTML = Object.entries(defaultSettings.customThemes).map(([id, theme]) => `
        <div class="custom-theme-item">
            <div class="custom-theme-preview" style="background: ${theme.bg}; color: ${theme.text}; border-radius: ${theme.borderRadius}px; padding: 0.5rem; margin-bottom: 0.5rem;">
                <strong style="color: ${theme.title};">${theme.name}</strong>
            </div>
            <div class="d-flex gap-2">
                <button class="btn small" onclick="applyCustomTheme('${id}')">应用</button>
                <button class="btn small secondary" onclick="editCustomTheme('${id}')">编辑</button>
                <button class="icon-action-btn delete" onclick="deleteCustomTheme('${id}')" aria-label="删除主题" title="删除">
                    <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                </button>
            </div>
        </div>
    `).join('');
}

// 应用自定义主题
function applyCustomTheme(themeId) {
    if (!defaultSettings.customThemes || !defaultSettings.customThemes[themeId]) {
        alert('主题不存在');
        return;
    }
    
    defaultSettings.receiptCustomization.theme = themeId;
    saveData();
    
    // 应用主题样式
    applyCustomThemeStyles(themeId);
    
    // 更新主题选择器
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
        themeSelector.value = themeId;
    }
    
    // 重新处理图片
    reprocessImagesForTheme();

    refreshReceiptDisplay();
}

// 编辑自定义主题
function editCustomTheme(themeId) {
    if (!defaultSettings.customThemes || !defaultSettings.customThemes[themeId]) {
        alert('主题不存在');
        return;
    }
    
    const theme = defaultSettings.customThemes[themeId];
    document.getElementById('customThemeName').value = theme.name;
    document.getElementById('customThemeBg').value = toHex6(theme.bg);
    document.getElementById('customThemeText').value = toHex6(theme.text);
    document.getElementById('customThemeAccent').value = toHex6(theme.accent);
    document.getElementById('customThemeTitle').value = toHex6(theme.title);
    document.getElementById('customThemeDivider').value = toHex6(theme.divider);
    document.getElementById('customThemeBorderRadius').value = theme.borderRadius || 0;
    
    if (document.getElementById('customThemeBorderStyle')) {
        document.getElementById('customThemeBorderStyle').value = theme.borderStyle || 'none';
    }
    if (document.getElementById('customThemeBorderWidth')) {
        document.getElementById('customThemeBorderWidth').value = theme.borderWidth || 0;
    }
    if (document.getElementById('customThemeBorderColor')) {
        document.getElementById('customThemeBorderColor').value = toHex6(theme.borderColor || '#cbd5e0');
    }
    
    // 加载底纹设置
    if (document.getElementById('customThemeTexture')) {
        document.getElementById('customThemeTexture').value = theme.texture || 'none';
    }
    if (document.getElementById('customThemeTextureOpacity')) {
        document.getElementById('customThemeTextureOpacity').value = theme.textureOpacity || 0.1;
    }
    
    updateCustomThemePreview();
    updateCustomThemeBorder();
    updateCustomThemeTexture();
    
    // 切换到主题标签页
    switchReceiptTab('theme');
}

// 删除自定义主题
function deleteCustomTheme(themeId) {
    if (!confirm('确定要删除这个自定义主题吗？')) {
        return;
    }
    
    if (defaultSettings.customThemes && defaultSettings.customThemes[themeId]) {
        delete defaultSettings.customThemes[themeId];
        saveData();
        
        // 如果当前使用的是这个主题，切换到经典主题
        if (defaultSettings.receiptCustomization.theme === themeId) {
            applyReceiptTheme('classic');
        }
        
        // 更新主题选择器
        updateThemeSelector();
        
        // 重新加载列表
        loadCustomThemesList();
    }
}

// 更新主题选择器（添加自定义主题选项）
function updateThemeSelector() {
    const themeSelector = document.getElementById('themeSelector');
    if (!themeSelector) return;
    
    // 移除现有的自定义主题选项
    const customGroup = document.getElementById('customThemesGroup');
    if (customGroup) {
        customGroup.innerHTML = '';
    }
    
    // 添加自定义主题选项
    if (defaultSettings.customThemes && Object.keys(defaultSettings.customThemes).length > 0) {
        Object.entries(defaultSettings.customThemes).forEach(([id, theme]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = theme.name;
            if (customGroup) {
                customGroup.appendChild(option);
            }
        });
    }
}

// 应用自定义主题样式
function applyCustomThemeStyles(themeId) {
    if (!defaultSettings.customThemes || !defaultSettings.customThemes[themeId]) {
        return;
    }
    
    const theme = defaultSettings.customThemes[themeId];
    const styleId = 'custom-theme-style';
    let styleElement = document.getElementById(styleId);
    
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
    }
    
    // 构建边框样式
    let borderStyle = 'none';
    if (theme.borderStyle && theme.borderStyle !== 'none' && theme.borderWidth && theme.borderWidth > 0) {
        borderStyle = `${theme.borderWidth}px ${theme.borderStyle} ${theme.borderColor || '#cbd5e0'}`;
    }
    
    // 构建底纹样式
    let textureStyle = '';
    if (theme.texture && theme.texture !== 'none') {
        const opacity = theme.textureOpacity || 0.1;
        textureStyle = getTextureStyle(theme.texture, opacity);
    }
    
    styleElement.textContent = `
        .receipt-theme-${themeId} {
            --receipt-bg: ${theme.bg};
            --receipt-text: ${theme.text};
            --receipt-accent: ${theme.accent};
            --receipt-title-color: ${theme.title};
            --receipt-divider-color: ${theme.divider};
            --receipt-border-radius: ${theme.borderRadius}px;
            --receipt-border: ${borderStyle};
        }
        .receipt-theme-${themeId} .receipt-title {
            color: ${theme.title};
        }
        ${textureStyle ? `
        .receipt-theme-${themeId}.receipt,
        .receipt.receipt-theme-${themeId} {
            position: relative;
        }
        .receipt-theme-${themeId}.receipt::before,
        .receipt.receipt-theme-${themeId}::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            ${textureStyle}
            opacity: ${theme.textureOpacity || 0.1};
        }
        ` : ''}
    `;
}

// 获取底纹样式
function getTextureStyle(textureType, opacity) {
    const styles = {
        'paper': `
            background-image: 
                repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px),
                repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px);
        `,
        'lined': `
            background-image: repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(0,0,0,0.1) 19px, rgba(0,0,0,0.1) 20px);
        `,
        'grid': `
            background-image: 
                repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(0,0,0,0.08) 19px, rgba(0,0,0,0.08) 20px),
                repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(0,0,0,0.08) 19px, rgba(0,0,0,0.08) 20px);
        `,
        'dots': `
            background-image: radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px);
            background-size: 10px 10px;
        `,
        'vintage': `
            background-image: 
                repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(139, 69, 19, 0.05) 10px, rgba(139, 69, 19, 0.05) 20px),
                repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(139, 69, 19, 0.05) 10px, rgba(139, 69, 19, 0.05) 20px);
        `,
        'noise': `
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" /></filter><rect width="100" height="100" filter="url(%23noise)" opacity="0.3"/></svg>');
            background-size: 100px 100px;
        `
    };
    return styles[textureType] || '';
}

// 更新边框设置
function updateCustomThemeBorder() {
    const borderStyle = document.getElementById('customThemeBorderStyle').value;
    const borderWidth = parseInt(document.getElementById('customThemeBorderWidth').value) || 0;
    const borderColor = document.getElementById('customThemeBorderColor').value;
    const hex = toHex6(borderColor);
    
    const colorValueSpan = document.getElementById('customThemeBorderColorValue');
    if (colorValueSpan) colorValueSpan.textContent = hex.toUpperCase();
    updateBorderColorSwatch(hex);
    
    // 如果当前使用的是自定义主题，实时更新样式
    const currentTheme = defaultSettings.receiptCustomization?.theme || 'classic';
    if (currentTheme.startsWith('custom_') && defaultSettings.customThemes && defaultSettings.customThemes[currentTheme]) {
        const theme = defaultSettings.customThemes[currentTheme];
        theme.borderStyle = borderStyle;
        theme.borderWidth = borderWidth;
        theme.borderColor = borderColor;
        saveData();
        applyCustomThemeStyles(currentTheme);
        refreshReceiptDisplay();
    }
}

// 更新底纹设置
function updateCustomThemeTexture() {
    const texture = document.getElementById('customThemeTexture').value;
    const opacity = parseFloat(document.getElementById('customThemeTextureOpacity').value) || 0.1;
    
    // 更新透明度显示
    const opacityValueSpan = document.getElementById('textureOpacityValue');
    if (opacityValueSpan) {
        opacityValueSpan.textContent = Math.round(opacity * 100) + '%';
    }
    
    // 如果当前使用的是自定义主题，实时更新样式
    const currentTheme = defaultSettings.receiptCustomization?.theme || 'classic';
    if (currentTheme.startsWith('custom_') && defaultSettings.customThemes && defaultSettings.customThemes[currentTheme]) {
        const theme = defaultSettings.customThemes[currentTheme];
        theme.texture = texture;
        theme.textureOpacity = opacity;
        saveData();
        applyCustomThemeStyles(currentTheme);
        refreshReceiptDisplay();
    }
}

// 处理字体选择变化
function handleFontFamilyChange(value) {
    const customContainer = document.getElementById('customFontContainer');
    const hint = document.getElementById('fontFamilyHint');
    const detectedList = document.getElementById('detectedFontsList');
    
    if (value === 'custom') {
        // 显示自定义输入框容器
        if (customContainer) {
            customContainer.style.display = 'block';
        }
        if (hint) {
            hint.style.display = 'block';
        }
        
        // 如果已有自定义字体值，填充到输入框
        const customInput = document.getElementById('customFontFamily');
        const fontSettings = defaultSettings.receiptCustomization.fontSettings;
        if (customInput && fontSettings && fontSettings.fontFamily && 
            !['Courier New, Source Han Sans SC, Noto Sans SC, PingFang SC, Hiragino Sans GB, Courier, Monaco, Consolas, monospace',
              'Source Han Sans SC, Noto Sans SC, PingFang SC, sans-serif',
              'Source Han Serif SC, Noto Serif SC, Times New Roman, serif',
              'Source Han Sans SC, Noto Sans SC, sans-serif',
              'Source Han Serif SC, Noto Serif SC, serif'].includes(fontSettings.fontFamily)) {
            customInput.value = fontSettings.fontFamily;
        } else if (customInput) {
            customInput.value = '';
        }
        
        // 聚焦输入框
        if (customInput) {
            setTimeout(() => customInput.focus(), 100);
        }
    } else {
        // 隐藏自定义输入框容器
        if (customContainer) {
            customContainer.style.display = 'none';
        }
        if (hint) {
            hint.style.display = 'none';
        }
        if (detectedList) {
            detectedList.style.display = 'none';
        }
        
        // 更新字体设置
        updateReceiptFont('fontFamily', value);
    }
}

// 更新字体设置
function updateReceiptFont(field, value) {
    if (!defaultSettings.receiptCustomization.fontSettings) {
        defaultSettings.receiptCustomization.fontSettings = {
            fontFamily: 'Courier New, Source Han Sans SC, Noto Sans SC, PingFang SC, Hiragino Sans GB, Courier, Monaco, Consolas, monospace',
            fontSize: 13,
            fontWeight: 400,
            lineHeight: 1.3
        };
    }
    
    // 如果输入的是自定义字体，确保值不为空
    if (field === 'fontFamily' && value && value.trim()) {
        defaultSettings.receiptCustomization.fontSettings[field] = value.trim();
    } else if (field === 'fontFamily') {
        // 如果自定义字体为空，使用默认值
        defaultSettings.receiptCustomization.fontSettings[field] = 'Courier New, Source Han Sans SC, Noto Sans SC, PingFang SC, Hiragino Sans GB, Courier, Monaco, Consolas, monospace';
    } else {
        defaultSettings.receiptCustomization.fontSettings[field] = field === 'fontSize' || field === 'fontWeight' ? parseInt(value) : (field === 'lineHeight' ? parseFloat(value) : value);
    }
    
    saveData();
    
    // 应用字体样式（使用防抖版本）
    applyFontSettings();
    
    // 更新预览（使用防抖版本）
    debouncedApplyFontSettings();
}

// 加载字体设置到表单
function loadFontSettings() {
    const fontSettings = defaultSettings.receiptCustomization.fontSettings || {
        fontFamily: 'Courier New, Source Han Sans SC, Noto Sans SC, PingFang SC, Hiragino Sans GB, Courier, Monaco, Consolas, monospace',
        fontSize: 13,
        fontWeight: 400,
        lineHeight: 1.3,
        categoryFonts: {
            enabled: false,
            title: '',
            body: '',
            number: '',
            summary: '',
            footer: ''
        }
    };
    
    const fontFamilySelect = document.getElementById('receiptFontFamily');
    const customInput = document.getElementById('customFontFamily');
    const hint = document.getElementById('fontFamilyHint');
    
        // 预设字体列表
        const presetFonts = [
            'Courier New, Source Han Sans SC, Noto Sans SC, PingFang SC, Hiragino Sans GB, Courier, Monaco, Consolas, monospace',
            'Source Han Sans SC, Noto Sans SC, PingFang SC, sans-serif',
            'Source Han Serif SC, Noto Serif SC, Times New Roman, serif',
            'Source Han Sans SC, Noto Sans SC, sans-serif',
            'Source Han Serif SC, Noto Serif SC, serif'
        ];
    
    // 检查是否是预设字体
    const isPresetFont = presetFonts.includes(fontSettings.fontFamily);
    
    if (fontFamilySelect) {
        if (isPresetFont) {
            fontFamilySelect.value = fontSettings.fontFamily;
            const customContainer = document.getElementById('customFontContainer');
            if (customContainer) {
                customContainer.style.display = 'none';
            }
            if (hint) {
                hint.style.display = 'none';
            }
        } else {
            // 是自定义字体
            fontFamilySelect.value = 'custom';
            if (customInput) {
                customInput.value = fontSettings.fontFamily;
            }
            const customContainer = document.getElementById('customFontContainer');
            if (customContainer) {
                customContainer.style.display = 'block';
            }
            if (hint) {
                hint.style.display = 'block';
            }
        }
    }
    
    if (document.getElementById('receiptFontSize')) {
        document.getElementById('receiptFontSize').value = fontSettings.fontSize;
    }
    if (document.getElementById('receiptFontWeight')) {
        document.getElementById('receiptFontWeight').value = fontSettings.fontWeight;
    }
    if (document.getElementById('receiptLineHeight')) {
        document.getElementById('receiptLineHeight').value = fontSettings.lineHeight;
    }
    
    // 加载分类字体设置
    if (fontSettings.categoryFonts) {
        const catFonts = fontSettings.categoryFonts;
        if (document.getElementById('enableCategoryFonts')) {
            document.getElementById('enableCategoryFonts').checked = catFonts.enabled || false;
            toggleCategoryFonts(catFonts.enabled || false);
        }
        if (document.getElementById('fontTitle')) {
            document.getElementById('fontTitle').value = catFonts.title || '';
        }
        if (document.getElementById('fontBody')) {
            document.getElementById('fontBody').value = catFonts.body || '';
        }
        if (document.getElementById('fontNumber')) {
            document.getElementById('fontNumber').value = catFonts.number || '';
        }
        if (document.getElementById('fontSummary')) {
            document.getElementById('fontSummary').value = catFonts.summary || '';
        }
        if (document.getElementById('fontFooter')) {
            document.getElementById('fontFooter').value = catFonts.footer || '';
        }
    }
    
    // 加载已导入字体列表
    loadImportedFontsList();
}

// 切换分类字体设置
function toggleCategoryFonts(enabled) {
    const container = document.getElementById('categoryFontsContainer');
    if (container) {
        container.style.display = enabled ? 'block' : 'none';
    }
    
    if (!defaultSettings.receiptCustomization.fontSettings.categoryFonts) {
        defaultSettings.receiptCustomization.fontSettings.categoryFonts = {
            enabled: false,
            title: '',
            body: '',
            number: '',
            summary: '',
            footer: ''
        };
    }
    
    defaultSettings.receiptCustomization.fontSettings.categoryFonts.enabled = enabled;
    saveData();
    
    // 应用字体设置
    applyFontSettings();
    debouncedApplyFontSettings();
}

// 更新分类字体
function updateCategoryFont(category, value) {
    if (!defaultSettings.receiptCustomization.fontSettings.categoryFonts) {
        defaultSettings.receiptCustomization.fontSettings.categoryFonts = {
            enabled: true,
            title: '',
            body: '',
            number: '',
            summary: '',
            footer: ''
        };
    }
    
    defaultSettings.receiptCustomization.fontSettings.categoryFonts[category] = value.trim();
    defaultSettings.receiptCustomization.fontSettings.categoryFonts.enabled = true;
    saveData();
    
    // 应用字体设置
    applyFontSettings();
    debouncedApplyFontSettings();
}

// 应用字体设置（用户自定义时覆盖主题字体，否则使用主题字体）
function applyFontSettings() {
    const fontSettings = defaultSettings.receiptCustomization.fontSettings || {
        fontFamily: 'Courier New, Source Han Sans SC, Noto Sans SC, PingFang SC, Hiragino Sans GB, Courier, Monaco, Consolas, monospace',
        fontSize: 13,
        fontWeight: 400,
        lineHeight: 1.3,
        categoryFonts: {
            enabled: false,
            title: '',
            body: '',
            number: '',
            summary: '',
            footer: ''
        }
    };
    
    const defaultFontFamily = 'Courier New, Source Han Sans SC, Noto Sans SC, PingFang SC, Hiragino Sans GB, Courier, Monaco, Consolas, monospace';
    const storedFont = String(fontSettings.fontFamily || '').trim();
    const isUsingDefaultFont = (fontSettings.fontFamily === defaultFontFamily) || (storedFont === 'Courier');
    
    const styleId = 'custom-font-style';
    let styleElement = document.getElementById(styleId);
    
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
    }
    
    let styleContent = '';
    
    // 如果启用了分类字体设置
    if (fontSettings.categoryFonts && fontSettings.categoryFonts.enabled) {
        const catFonts = fontSettings.categoryFonts;
        // 如果使用默认字体且 body 未设置，不设置 font-family（让主题 CSS 变量生效）
        const bodyFontRule = catFonts.body 
            ? `font-family: ${catFonts.body} !important;`
            : (isUsingDefaultFont ? '' : `font-family: ${fontSettings.fontFamily} !important;`);
        
        styleContent = `
            :root {
                ${catFonts.number ? `--receipt-number-font: ${catFonts.number};` : ''}
            }
            .receipt {
                ${bodyFontRule}
                font-size: ${fontSettings.fontSize}px !important;
                font-weight: ${fontSettings.fontWeight} !important;
                line-height: ${fontSettings.lineHeight} !important;
            }
            ${catFonts.title ? `.receipt-title { font-family: ${catFonts.title} !important; }` : ''}
            ${catFonts.number ? `.receipt-col-1, .receipt-sub-row .receipt-col-1 { font-family: ${catFonts.number} !important; }` : ''}
            ${catFonts.summary ? `.receipt-summary, .receipt-summary-row, .receipt-summary-label, .receipt-summary-value, .receipt-total { font-family: ${catFonts.summary} !important; }` : ''}
            ${catFonts.footer ? `.receipt-footer, .receipt-footer-text1, .receipt-footer-text2 { font-family: ${catFonts.footer} !important; }` : ''}
        `;
    } else {
        // 统一字体设置：如果使用默认字体，不设置 font-family（让主题 CSS 变量生效）；否则使用用户自定义字体
        const fontFamilyRule = isUsingDefaultFont 
            ? ''  // 不设置 font-family，让 CSS 变量 --receipt-font-family 生效
            : `font-family: ${fontSettings.fontFamily} !important;`;
        styleContent = `
            .receipt {
                ${fontFamilyRule}
                font-size: ${fontSettings.fontSize}px !important;
                font-weight: ${fontSettings.fontWeight} !important;
                line-height: ${fontSettings.lineHeight} !important;
            }
        `;
    }
    styleElement.textContent = styleContent;
}

// 检测系统可用字体
async function detectSystemFonts() {
    const detectedList = document.getElementById('detectedFontsList');
    if (!detectedList) return;
    
    // 显示加载状态
    detectedList.style.display = 'block';
    detectedList.innerHTML = '<div class="text-gray" style="padding: 0.5rem; text-align: center;">正在检测系统字体...</div>';
    
    // 常见系统字体列表（Windows、Mac、Linux、移动端）
    const commonFonts = [
        // 中文字体
        'SimHei', '黑体', 'FangSong', '仿宋', 'STSong', '华文宋体',
        'STHeiti', '华文黑体', 'STKaiti', '华文楷体', 'STFangsong', '华文仿宋',
        'PingFang SC', '苹方', 'Hiragino Sans GB', '冬青黑体',
        'Source Han Sans SC', '思源黑体', 'Noto Sans SC',
        'Source Han Serif SC', '思源宋体', 'Noto Serif SC',
        'LXGW WenKai', '霞鹜文楷', 'LXGW WenKai Mono',
        // 英文字体
        'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana',
        'Courier New', 'Comic Sans MS', 'Impact', 'Trebuchet MS',
        'Tahoma', 'Calibri', 'Segoe UI', 'Roboto', 'Open Sans',
        'Lato', 'Montserrat', 'Ubuntu', 'DejaVu Sans',
        // 等宽字体
        'Consolas', 'Monaco', 'Menlo', 'Courier', 'Lucida Console',
        'Monaco', 'Menlo', 'Source Code Pro', 'Fira Code'
    ];
    
    const availableFonts = [];
    const testString = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789中文测试字体';
    const testSize = '72px';
    const baselineFonts = ['monospace', 'sans-serif', 'serif'];
    
    // 创建测试canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.textBaseline = 'top';
    context.textAlign = 'left';
    
    // 获取基准宽度（使用通用字体）
    const baselineWidths = {};
    for (const baseline of baselineFonts) {
        context.font = testSize + ' ' + baseline;
        baselineWidths[baseline] = context.measureText(testString).width;
    }
    
    // 检测每个字体
    for (const fontName of commonFonts) {
        let isAvailable = false;
        
        for (const baseline of baselineFonts) {
            const testFont = testSize + ' "' + fontName + '", ' + baseline;
            context.font = testFont;
            const width = context.measureText(testString).width;
            
            // 如果宽度与基准不同，说明字体可用
            if (Math.abs(width - baselineWidths[baseline]) > 0.1) {
                isAvailable = true;
                break;
            }
        }
        
        if (isAvailable) {
            availableFonts.push(fontName);
        }
    }
    
    // 显示检测结果
    if (availableFonts.length === 0) {
        detectedList.innerHTML = '<div class="text-gray" style="padding: 0.5rem; text-align: center;">未检测到可用字体，请手动输入字体名称</div>';
    } else {
        detectedList.innerHTML = `
            <div style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); font-weight: 600;">
                检测到 ${availableFonts.length} 个可用字体（点击使用）：
            </div>
            ${availableFonts.map(font => `
                <div class="detected-font-item" onclick="selectDetectedFont('${font}')" data-font-family="${font}">
                    <div>
                        <div class="detected-font-name">${font}</div>
                        <div class="detected-font-preview" style="font-family: '${font}', sans-serif;">预览：AaBbCc 中文测试</div>
                    </div>
                </div>
            `).join('')}
        `;
    }
}

// 选择检测到的字体
function selectDetectedFont(fontName) {
    const customInput = document.getElementById('customFontFamily');
    if (customInput) {
        customInput.value = fontName;
        updateReceiptFont('fontFamily', fontName);
    }
}

// 处理字体文件上传
function handleFontFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 检查文件大小（限制5MB）
    if (file.size > 5 * 1024 * 1024) {
        alert('字体文件过大，请选择小于5MB的字体文件');
        event.target.value = '';
        return;
    }
    
    // 检查文件格式
    const validFormats = ['ttf', 'otf', 'woff', 'woff2'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!validFormats.includes(fileExtension)) {
        alert('不支持的字体格式，请选择 TTF、OTF、WOFF 或 WOFF2 格式的字体文件');
        event.target.value = '';
        return;
    }
    
    // 读取字体文件
    const reader = new FileReader();
    reader.onload = function(e) {
        const fontData = e.target.result;
        const fontId = 'imported_' + Date.now();
        
        // 从文件名提取字体名称（去掉扩展名）
        const fontName = file.name.replace(/\.[^/.]+$/, '');
        
        // 确定字体格式
        let fontFormat = 'truetype';
        if (fileExtension === 'otf') {
            fontFormat = 'opentype';
        } else if (fileExtension === 'woff') {
            fontFormat = 'woff';
        } else if (fileExtension === 'woff2') {
            fontFormat = 'woff2';
        }
        
        // 保存字体信息
        if (!defaultSettings.importedFonts) {
            defaultSettings.importedFonts = {};
        }
        defaultSettings.importedFonts[fontId] = {
            name: fontName,
            family: fontName, // 使用文件名作为字体族名
            data: fontData, // base64 数据
            format: fontFormat,
            size: file.size,
            fileName: file.name
        };
        
        saveData();
        
        // 加载字体
        loadImportedFont(fontId, defaultSettings.importedFonts[fontId]);
        
        // 更新已导入字体列表
        loadImportedFontsList();
        
        // 清空文件输入
        event.target.value = '';
        
        alert(`字体 "${fontName}" 导入成功！`);
    };
    
    reader.onerror = function() {
        alert('字体文件读取失败，请重试');
        event.target.value = '';
    };
    
    reader.readAsDataURL(file);
}

// 加载单个导入的字体
function loadImportedFont(fontId, fontInfo) {
    const styleId = 'imported-font-' + fontId;
    let styleElement = document.getElementById(styleId);
    
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
    }
    
    // 创建 @font-face 规则
    styleElement.textContent = `
        @font-face {
            font-family: '${fontInfo.family}';
            src: url('${fontInfo.data}') format('${fontInfo.format}');
            font-display: swap;
        }
    `;
}

// 加载所有已导入的字体
function loadImportedFonts() {
    if (!defaultSettings.importedFonts) {
        defaultSettings.importedFonts = {};
        return;
    }
    
    Object.entries(defaultSettings.importedFonts).forEach(([fontId, fontInfo]) => {
        loadImportedFont(fontId, fontInfo);
    });
}

// 加载已导入字体列表到UI
function loadImportedFontsList() {
    const listContainer = document.getElementById('importedFontsList');
    if (!listContainer) return;
    
    if (!defaultSettings.importedFonts || Object.keys(defaultSettings.importedFonts).length === 0) {
        listContainer.innerHTML = '<div class="text-gray" style="padding: 0.5rem; text-align: center;">暂无导入的字体</div>';
        return;
    }
    
    listContainer.innerHTML = Object.entries(defaultSettings.importedFonts).map(([fontId, fontInfo]) => {
        const formatFileSize = (bytes) => {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        };
        
        return `
            <div class="imported-font-item" data-font-family="${fontInfo.family}">
                <div class="imported-font-info">
                    <div class="imported-font-name">${fontInfo.name}</div>
                    <div class="imported-font-preview" style="font-family: '${fontInfo.family}', sans-serif;">
                        预览：AaBbCc 中文测试字体 0123456789
                    </div>
                    <div class="imported-font-file-size">${fontInfo.fileName} | ${formatFileSize(fontInfo.size)}</div>
                </div>
                <div class="imported-font-actions">
                    <button class="btn small" onclick="useImportedFont('${fontInfo.family}')">使用</button>
                    <button class="icon-action-btn delete" onclick="deleteImportedFont('${fontId}')" aria-label="删除字体" title="删除">
                        <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// 使用导入的字体
function useImportedFont(fontFamily) {
    const customInput = document.getElementById('customFontFamily');
    if (customInput) {
        customInput.value = fontFamily;
        updateReceiptFont('fontFamily', fontFamily);
    }
    
    // 切换到自定义字体选项
    const fontFamilySelect = document.getElementById('receiptFontFamily');
    if (fontFamilySelect) {
        fontFamilySelect.value = 'custom';
        handleFontFamilyChange('custom');
    }
}

// 删除导入的字体
function deleteImportedFont(fontId) {
    if (!confirm('确定要删除这个导入的字体吗？')) {
        return;
    }
    
    if (defaultSettings.importedFonts && defaultSettings.importedFonts[fontId]) {
        const fontInfo = defaultSettings.importedFonts[fontId];
        
        // 移除字体样式
        const styleElement = document.getElementById('imported-font-' + fontId);
        if (styleElement) {
            styleElement.remove();
        }
        
        // 如果当前使用的是这个字体，切换到默认字体
        const currentFont = defaultSettings.receiptCustomization.fontSettings?.fontFamily;
        if (currentFont && currentFont.includes(fontInfo.family)) {
            updateReceiptFont('fontFamily', 'Courier New, Source Han Sans SC, Noto Sans SC, PingFang SC, Hiragino Sans GB, Courier, Monaco, Consolas, monospace');
        }
        
        // 删除字体数据
        delete defaultSettings.importedFonts[fontId];
        saveData();
        
        // 更新列表
        loadImportedFontsList();
    }
}

// 打开自定义主题管理弹窗（已废弃，使用小票设置面板中的主题标签页）
// 保留此函数以保持向后兼容，但不再使用
function openCustomThemeModal() {
    switchReceiptTab('theme');
    toggleReceiptCustomizationPanel();
}

// 加载小票自定义设置到表单
// 处理小票图片上传
function handleReceiptImageUpload(field, file) {
    if (file && file.type && file.type.startsWith('image/')) {
        // 检查文件大小 (限制为2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('图片文件过大，请选择小于2MB的图片');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            // 保存原始图片数据
            const originalImageData = e.target.result;
            defaultSettings.receiptCustomization[field + 'Original'] = originalImageData;
            // 立即保存原图到本地存储
            saveData();
            
            // 检查图片尺寸
            const img = new Image();
            img.onload = function() {
                // 检查图片尺寸 (最大限制为2000x2000)
                if (img.width > 2000 || img.height > 2000) {
                    alert('图片尺寸过大，请选择尺寸不超过2000x2000的图片');
                    return;
                }
                
                // 只有在开启跟随主题颜色功能时才处理图片
                const followSystemTheme = defaultSettings.receiptCustomization.receiptInfo?.followSystemTheme || false;
                if (followSystemTheme) {
                    const currentTheme = defaultSettings.receiptCustomization?.theme || 'classic';
                    processImageForTheme(img, field, currentTheme);
                } else {
                    // 如果不跟随主题，则使用原始图片
                    defaultSettings.receiptCustomization[field] = originalImageData;
                    saveData();
                    
                    // 更新预览（包含尺寸信息）
                    updateImagePreview(field, originalImageData, img.width, img.height, file.size);
                    debouncedRefreshReceipt(); // 实时预览
                }
            };
            img.src = originalImageData;
        };
        reader.readAsDataURL(file);
    }
}

// 更新图片预览（包含尺寸和删除功能）
function updateImagePreview(field, imageData, width, height, fileSize) {
    const previewId = field === 'headerImage' ? 'headerImagePreview' : 'footerImagePreview';
    const previewElement = document.getElementById(previewId);
    if (!previewElement) return;
    
    // 格式化文件大小
    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };
    
    previewElement.innerHTML = `
        <img src="${imageData}" alt="${field === 'headerImage' ? '头部' : '尾部'}图片预览" style="max-width: 200px; max-height: 100px;">
        <button class="image-preview-delete" onclick="deleteReceiptImage('${field}')" title="删除图片">×</button>
        <div class="image-preview-info">
            尺寸: ${width} × ${height}px | 大小: ${formatFileSize(fileSize)}
        </div>
    `;
}

// 删除小票图片
function deleteReceiptImage(field) {
    if (confirm(`确定要删除${field === 'headerImage' ? '头部' : '尾部'}图片吗？`)) {
        // 删除图片数据
        delete defaultSettings.receiptCustomization[field];
        delete defaultSettings.receiptCustomization[field + 'Original'];
        saveData();
        debouncedRefreshReceipt(); // 实时预览

        // 清空预览
        const previewId = field === 'headerImage' ? 'headerImagePreview' : 'footerImagePreview';
        const previewElement = document.getElementById(previewId);
        if (previewElement) {
            previewElement.innerHTML = '';
        }
    }
}

// 处理拖拽上传
function handleImageDrop(event, field) {
    event.preventDefault();
    event.stopPropagation();
    
    const uploadArea = event.currentTarget;
    uploadArea.classList.remove('drag-over');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        handleReceiptImageUpload(field, files[0]);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');
}

// 更新小票信息设置
function updateReceiptInfo(field, value) {
    if (!defaultSettings.receiptCustomization.receiptInfo) {
        defaultSettings.receiptCustomization.receiptInfo = {
            orderNotification: '',
            showStartTime: true,
            showDeadline: true,
            showOrderTime: true,
            showDesigner: true,
            showContactInfo: true,
            customText: '',
            followSystemTheme: false
        };
    }
    
    defaultSettings.receiptCustomization.receiptInfo[field] = value;
    saveData();
    debouncedRefreshReceipt(); // 实时预览（通知文本、开关等）

    // 如果是跟随系统主题颜色设置，重新处理图片
    if (field === 'followSystemTheme') {
        if (value) {
            // 启用跟随主题：处理图片
            reprocessImagesForTheme();
        } else {
            // 禁用跟随主题：使用原始图片
            if (defaultSettings.receiptCustomization.headerImageOriginal) {
                defaultSettings.receiptCustomization.headerImage = defaultSettings.receiptCustomization.headerImageOriginal;
            }
            if (defaultSettings.receiptCustomization.footerImageOriginal) {
                defaultSettings.receiptCustomization.footerImage = defaultSettings.receiptCustomization.footerImageOriginal;
            }
            saveData();
            
            // 更新预览
            loadReceiptCustomizationToForm();
        }
    }
}

// 主题颜色映射表（确保每个主题都有正确的颜色值）
// 使用主题的标题颜色（title-color），因为这些颜色更能代表主题特色
const THEME_COLOR_MAP = {
    'classic': '#2d3748',    // rgb(45, 55, 72) - 深灰蓝色
    'modern': '#2c3e50',     // rgb(44, 62, 80) - 深灰蓝色
    'warm': '#92400e',       // rgb(146, 64, 14) - 暖棕色（使用标题颜色）
    'dark': '#e2e8f0',       // rgb(226, 232, 240) - 浅灰色
    'nature': '#15803d',     // rgb(21, 128, 61) - 清新绿色（使用标题颜色，更明显）
    'vintage': '#5c1a1a',    // rgb(92, 26, 26) - 深红色
    'sakura': '#be185d',     // rgb(190, 24, 93) - 粉红色（使用标题颜色）
    'iceBlue': '#075985'     // rgb(7, 89, 133) - 冰蓝色（使用标题颜色）
};

// 重新处理图片以适应当前主题颜色
function reprocessImagesForTheme() {
    // 优先从 DOM 读取当前勾选状态（最准确）
    const followSystemThemeCheckbox = document.getElementById('followSystemTheme');
    let followSystemTheme = true; // 默认开启
    
    if (followSystemThemeCheckbox) {
        followSystemTheme = followSystemThemeCheckbox.checked;
    } else {
        const receiptInfo = defaultSettings.receiptCustomization.receiptInfo || {};
        followSystemTheme = receiptInfo.followSystemTheme !== false;
    }
    
    if (!followSystemTheme) return;
    
    const currentTheme = defaultSettings.receiptCustomization?.theme || 'classic';
    
    // 处理头部图片
    if (defaultSettings.receiptCustomization.headerImageOriginal) {
        const img = new Image();
        img.onload = function() {
            // 传递当前主题，避免异步竞态
            processImageForTheme(img, 'headerImage', currentTheme);
        };
        img.src = defaultSettings.receiptCustomization.headerImageOriginal;
    }

    // 处理尾部图片
    if (defaultSettings.receiptCustomization.footerImageOriginal) {
        const img = new Image();
        img.onload = function() {
            // 传递当前主题，避免异步竞态
            processImageForTheme(img, 'footerImage', currentTheme);
        };
        img.src = defaultSettings.receiptCustomization.footerImageOriginal;
    }
}

// 辅助函数：将十六进制颜色转换为RGB
function hexToRgb(hex) {
    // 检查是否是十六进制颜色格式
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 创建图片处理Worker（单例）
let imageProcessorWorker = null;
function getImageProcessorWorker() {
    if (!imageProcessorWorker) {
        try {
            imageProcessorWorker = new Worker('image-processor-worker.js');
            imageProcessorWorker.onerror = function(e) {
                console.error('Worker error:', e);
                imageProcessorWorker = null;
            };
        } catch (e) {
            console.error('Failed to create worker:', e);
            return null;
        }
    }
    return imageProcessorWorker;
}

// 刷新小票显示：重新生成 quoteContent 并同步到抽屉
function refreshReceiptDisplay() {
    const qc = document.getElementById('quoteContent');
    if (!qc || !qc.innerHTML.trim()) return;
    generateQuote();
    syncReceiptDrawerContent();
    adjustReceiptScale();
}
const debouncedRefreshReceipt = debounce(refreshReceiptDisplay, 300);

// 防抖版本的字体设置更新（200ms延迟）
const debouncedApplyFontSettings = debounce(() => {
    applyFontSettings();
    refreshReceiptDisplay();
}, 200);

// 处理单个图片以适应主题颜色（使用Web Worker）
function processImageForTheme(img, field, expectedTheme) {
    const followSystemThemeCheckbox = document.getElementById('followSystemTheme');
    let followSystemTheme = true;

    if (followSystemThemeCheckbox) {
        followSystemTheme = followSystemThemeCheckbox.checked;
    } else {
        const receiptInfo = defaultSettings.receiptCustomization.receiptInfo || {};
        followSystemTheme = receiptInfo.followSystemTheme !== false;
    }

    if (!followSystemTheme) return;

    const currentTheme = expectedTheme || defaultSettings.receiptCustomization?.theme || 'classic';
    const actualTheme = defaultSettings.receiptCustomization?.theme || 'classic';
    if (expectedTheme && actualTheme !== expectedTheme) return;
    
    // 使用固定的标题颜色映射表，直接从CSS定义中获取，确保颜色一致且可靠
    // 这些颜色值来自 style.css 中的 .receipt-theme-xxx .receipt-title 选择器
    const TITLE_COLOR_MAP = {
        'classic': '#2d3748',    // rgb(45, 55, 72)
        'modern': '#2c3e50',      // rgb(44, 62, 80)
        'warm': '#92400e',        // rgb(146, 64, 14)
        'dark': '#e2e8f0',        // rgb(226, 232, 240)
        'nature': '#15803d',      // rgb(21, 128, 61) - 注意：这是标题选择器的颜色，不是CSS变量
        'vintage': '#5c1a1a',    // rgb(92, 26, 26)
        'sakura': '#be185d',      // rgb(190, 24, 93)
        'iceBlue': '#075985'      // rgb(7, 89, 133)
    };
    
    // 如果是自定义主题，从自定义主题设置中获取颜色
    let textColor;
    if (currentTheme.startsWith('custom_') && defaultSettings.customThemes && defaultSettings.customThemes[currentTheme]) {
        textColor = defaultSettings.customThemes[currentTheme].title || '#2d3748';
    } else {
        // 直接使用映射表（最可靠，避免动态读取的不确定性）
        textColor = TITLE_COLOR_MAP[currentTheme] || 'rgb(51, 51, 51)';
    }

    if (textColor.startsWith('#')) {
        const rgb = hexToRgb(textColor);
        if (rgb) {
            textColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        }
    }
    
    // 使用Canvas调整图片颜色
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    
    // 绘制原始图片
    ctx.drawImage(img, 0, 0);
    
    // 获取图片数据
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let targetR, targetG, targetB;
    
    // 解析目标颜色，支持 RGB 和十六进制格式
    if (textColor.startsWith('rgb')) {
        // 如果是 RGB 格式，提取数值
        const rgb = textColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            targetR = parseInt(rgb[0]);
            targetG = parseInt(rgb[1]);
            targetB = parseInt(rgb[2]);
        } else {
            // 默认颜色
            targetR = 51;
            targetG = 51;
            targetB = 51;
        }
    } else if (textColor.startsWith('#')) {
        // 如果是十六进制格式
        const rgb = hexToRgb(textColor);
        if (rgb) {
            targetR = rgb.r;
            targetG = rgb.g;
            targetB = rgb.b;
        } else {
            // 默认颜色
            targetR = 51;
            targetG = 51;
            targetB = 51;
        }
    } else {
        // 其他格式，使用默认颜色
        targetR = 51;
        targetG = 51;
        targetB = 51;
    }

    // 计算目标颜色的亮度（用于混合）
    const targetBrightness = 0.299 * targetR + 0.587 * targetG + 0.114 * targetB;
    const targetMax = Math.max(targetR, targetG, targetB);

    // 调整图片颜色 - 针对黑色原图的特殊处理
    // 对于黑色 PNG logo，黑色部分应该直接变成目标颜色，而不是乘以接近0的亮度值
    let darkPixelCount = 0;
    let totalPixelCount = 0;
    
    // 第一遍：统计原图的亮度分布，判断是否是黑色为主的图片
    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) continue; // 跳过透明像素
        
        totalPixelCount++;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const sourceBrightness = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // 如果像素很暗（亮度 < 50），认为是黑色像素
        if (sourceBrightness < 50) {
            darkPixelCount++;
        }
    }
    
    const isDarkImage = totalPixelCount > 0 && (darkPixelCount / totalPixelCount) > 0.5;

    // 第二遍：根据图片类型应用不同的处理策略
    let processedDarkPixels = 0;
    let processedGrayPixels = 0;
    let processedLightPixels = 0;
    let sampleProcessedColor = null;
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        // 跳过透明像素
        if (a === 0) continue;
        
        // 计算原图的亮度（0-255）
        const sourceBrightness = 0.299 * r + 0.587 * g + 0.114 * b;
        
        if (isDarkImage) {
            // 黑色原图策略：黑色部分直接替换为目标颜色
            // 对于黑色 PNG logo，黑色部分应该完全变成目标颜色，白色部分保持白色
            const sourceBrightnessNormalized = sourceBrightness / 255;
            
            // 如果像素很暗（接近黑色），直接使用目标颜色
            // 如果像素较亮（接近白色），保持白色
            if (sourceBrightness < 50) {
                // 纯黑色部分：直接使用目标颜色
                data[i] = targetR;
                data[i + 1] = targetG;
                data[i + 2] = targetB;
                processedDarkPixels++;
                // 记录第一个处理后的颜色作为样本
                if (!sampleProcessedColor) {
                    sampleProcessedColor = `rgb(${targetR}, ${targetG}, ${targetB})`;
                }
            } else if (sourceBrightness < 128) {
                // 深灰色部分：使用目标颜色，但根据亮度调整
                const darkRatio = sourceBrightness / 128;
                const colorRatio = 1 - darkRatio; // 越暗，目标颜色越明显
                data[i] = Math.round(targetR * colorRatio + sourceBrightness * (1 - colorRatio));
                data[i + 1] = Math.round(targetG * colorRatio + sourceBrightness * (1 - colorRatio));
                data[i + 2] = Math.round(targetB * colorRatio + sourceBrightness * (1 - colorRatio));
                processedGrayPixels++;
            } else {
                // 浅色部分：保持原色（白色或浅灰色）
                // 不做改变，保持原图的白色部分
                // data[i], data[i+1], data[i+2] 保持不变
                processedLightPixels++;
            }
        } else {
            // 普通图片策略：标准混合
            let sourceBrightnessNormalized = sourceBrightness / 255;
            
            // 增强对比度
            sourceBrightnessNormalized = Math.pow(sourceBrightnessNormalized, 0.8);
            
            // 根据目标颜色的亮度，调整混合方式
            if (targetBrightness > 180) {
                const enhancedRatio = Math.pow(sourceBrightnessNormalized, 0.6);
                data[i] = Math.round(targetR * enhancedRatio);
                data[i + 1] = Math.round(targetG * enhancedRatio);
                data[i + 2] = Math.round(targetB * enhancedRatio);
            } else if (targetBrightness < 80) {
                const enhancedRatio = Math.pow(sourceBrightnessNormalized, 0.9);
                data[i] = Math.round(targetR * enhancedRatio);
                data[i + 1] = Math.round(targetG * enhancedRatio);
                data[i + 2] = Math.round(targetB * enhancedRatio);
            } else {
                data[i] = Math.round(targetR * sourceBrightnessNormalized);
                data[i + 1] = Math.round(targetG * sourceBrightnessNormalized);
                data[i + 2] = Math.round(targetB * sourceBrightnessNormalized);
            }
        }
    }

    // 将调整后的数据放回Canvas
    ctx.putImageData(imageData, 0, 0);
    
    // 将Canvas转换为base64
    const adjustedImageData = canvas.toDataURL('image/png');
    
    // 最终检查：如果主题已经切换，不保存这次处理的结果
    const finalTheme = defaultSettings.receiptCustomization?.theme || 'classic';
    if (expectedTheme && finalTheme !== expectedTheme) return;

    defaultSettings.receiptCustomization[field] = adjustedImageData;
    saveData();

    // 更新预览（包含尺寸信息）
    const originalSize = defaultSettings.receiptCustomization[field + 'Original'] 
        ? (function() {
            // 估算base64大小
            const base64 = defaultSettings.receiptCustomization[field + 'Original'];
            const base64Length = base64.length;
            const padding = base64.match(/=/g) ? base64.match(/=/g).length : 0;
            return Math.floor((base64Length * 3) / 4) - padding;
        })() 
        : 0;
    updateImagePreview(field, adjustedImageData, img.width, img.height, originalSize);
    
    // 强制更新小票预览，确保显示最新处理的图片
    // 使用 setTimeout 确保 DOM 更新完成，并在更新前再次检查主题
    setTimeout(() => {
        const currentThemeWhenUpdate = defaultSettings.receiptCustomization?.theme || 'classic';
        if (expectedTheme && currentThemeWhenUpdate !== expectedTheme) return;
        debouncedRefreshReceipt();
    }, 50);
}

// 加载小票自定义设置到表单
function loadReceiptCustomizationToForm() {
    const settings = defaultSettings.receiptCustomization;
    
    if (settings) {
        // 设置主题选择（小票抽屉内 themeSelector）
        const themeSel = document.getElementById('themeSelector');
        if (themeSel) {
            themeSel.value = settings.theme || 'classic';
        }
        
        // 设置文本字段
        if (document.getElementById('receiptTitleText')) {
            document.getElementById('receiptTitleText').value = settings.titleText || 'LIST';
        }
        if (document.getElementById('receiptFooterText1')) {
            document.getElementById('receiptFooterText1').value = settings.footerText1 || '温馨提示';
        }
        if (document.getElementById('receiptFooterText2')) {
            document.getElementById('receiptFooterText2').value = settings.footerText2 || '感谢惠顾';
        }
        
        // 设置小票信息字段
        if (settings.receiptInfo) {
            if (document.getElementById('receiptOrderNotification')) {
                document.getElementById('receiptOrderNotification').value = settings.receiptInfo.orderNotification || '';
            }
            if (document.getElementById('showStartTime')) {
                document.getElementById('showStartTime').checked = settings.receiptInfo.showStartTime !== false; // 默认为true
                                            }
                                            if (document.getElementById('showDeadline')) {
                                                document.getElementById('showDeadline').checked = settings.receiptInfo.showDeadline !== false; // 默认为true
                                            }
                                            if (document.getElementById('showOrderTime')) {
                                                document.getElementById('showOrderTime').checked = settings.receiptInfo.showOrderTime !== false; // 默认为true
                                            }
                                            if (document.getElementById('showDesigner')) {
                document.getElementById('showDesigner').checked = settings.receiptInfo.showDesigner !== false; // 默认为true
            }
            if (document.getElementById('showContactInfo')) {
                document.getElementById('showContactInfo').checked = settings.receiptInfo.showContactInfo !== false; // 默认为true
            }
            if (document.getElementById('receiptCustomText')) {
                document.getElementById('receiptCustomText').value = settings.receiptInfo.customText || '';
            }
            if (document.getElementById('followSystemTheme')) {
                document.getElementById('followSystemTheme').checked = settings.receiptInfo.followSystemTheme !== false; // 默认为true
            }
        }
        
        // 设置图片预览（包含尺寸信息）
        if (settings.headerImage && document.getElementById('headerImagePreview')) {
            const img = new Image();
            img.onload = function() {
                const originalSize = defaultSettings.receiptCustomization.headerImageOriginal 
                    ? (function() {
                        // 估算base64大小
                        const base64 = defaultSettings.receiptCustomization.headerImageOriginal;
                        const base64Length = base64.length;
                        const padding = base64.match(/=/g) ? base64.match(/=/g).length : 0;
                        return Math.floor((base64Length * 3) / 4) - padding;
                    })() 
                    : 0;
                updateImagePreview('headerImage', settings.headerImage, img.width, img.height, originalSize);
            };
            img.src = settings.headerImage;
        }
        if (settings.footerImage && document.getElementById('footerImagePreview')) {
            const img = new Image();
            img.onload = function() {
                const originalSize = defaultSettings.receiptCustomization.footerImageOriginal 
                    ? (function() {
                        // 估算base64大小
                        const base64 = defaultSettings.receiptCustomization.footerImageOriginal;
                        const base64Length = base64.length;
                        const padding = base64.match(/=/g) ? base64.match(/=/g).length : 0;
                        return Math.floor((base64Length * 3) / 4) - padding;
                    })() 
                    : 0;
                updateImagePreview('footerImage', settings.footerImage, img.width, img.height, originalSize);
            };
            img.src = settings.footerImage;
        }
    }
}

// 应用小票主题
function applyReceiptTheme(themeName) {
    // 验证主题名称（包括自定义主题）
    const validThemes = ['classic', 'modern', 'warm', 'dark', 'nature', 'vintage', 'sakura', 'iceBlue'];
    const isCustomTheme = themeName.startsWith('custom_');
    
    if (!validThemes.includes(themeName) && !isCustomTheme) {
        themeName = 'classic'; // 默认使用经典主题
    }
    
    // 保存主题设置
    if (!defaultSettings.receiptCustomization) {
        defaultSettings.receiptCustomization = {};
    }
    defaultSettings.receiptCustomization.theme = themeName;
    
    // 保存到本地存储
    saveData();
    
    // 更新主题选择器状态
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
        themeSelector.value = themeName;
    }
    
    // 如果是自定义主题，应用自定义主题样式
    if (isCustomTheme) {
        applyCustomThemeStyles(themeName);
    }
    
    // 重新应用字体设置（确保主题字体生效）
    applyFontSettings();
    
    // 重新处理图片以适应新主题颜色（函数内部会检查 followSystemTheme）
    reprocessImagesForTheme();

    refreshReceiptDisplay();
}

// 初始化小票设置功能
function initReceiptCustomization() {
    // 绑定表单字段变更事件
    const formFields = document.querySelectorAll('#settings-tab input, #settings-tab select');
    formFields.forEach(field => {
        field.addEventListener('change', () => {
            // 保存设置变更
            saveData();
        });
    });
}

// 清除小票自定义设置
function clearReceiptCustomization() {
    if (confirm('确定要清除所有小票自定义设置吗？此操作不可撤销。')) {
        // 重置小票自定义设置为默认值
        defaultSettings.receiptCustomization = {
            theme: 'classic',
            headerImage: null,
            headerImageOriginal: null,
            titleText: 'LIST',
            footerText1: '温馨提示',
            footerText2: '感谢惠顾',
            footerImage: null,
            footerImageOriginal: null,
            receiptInfo: {
                orderNotification: '',
                showStartTime: true,
                showDeadline: true,
                showOrderTime: true,
                showDesigner: true,
                showContactInfo: true,
                customText: '',
                followSystemTheme: false
            },
        };
        
        // 保存设置
        saveData();
        
        // 重新加载表单以反映更改
        loadReceiptCustomizationToForm();

        refreshReceiptDisplay();

        alert('小票自定义设置已清除！');
    }
}

// ===== 页面与计算 / 小票抽屉切换状态 =====
let activeTab = 'quote';              // 'quote' | 'record' | 'stats' | 'settings'
let isCalculatorOpen = false;         // 计算抽屉是否打开
let isReceiptDrawerOpen = false;      // 小票抽屉是否打开
let isCurrentQuoteScheduled = false;  // 当前报价是否已排单保存（用于小票页关闭确认）

// 页面切换功能（底层：报价 / 设置）
function showPage(pageId) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // 显示目标页面
    const pageEl = document.getElementById(pageId);
    if (pageEl) {
        pageEl.classList.add('active');
    }
    
    // 更新导航按钮状态（排单/记录/计算/统计/设置 对应高亮）
    document.querySelectorAll('.nav-btn-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    if (pageId === 'quote') {
        activeTab = 'quote';
        const quoteBtn = document.querySelector('.nav-btn-quote');
        if (quoteBtn) quoteBtn.classList.add('active');
    } else if (pageId === 'record') {
        activeTab = 'record';
        const recordBtn = document.querySelector('.nav-btn-record');
        if (recordBtn) recordBtn.classList.add('active');
    } else if (pageId === 'stats') {
        activeTab = 'stats';
        const statsBtn = document.querySelector('.nav-btn-stats');
        if (statsBtn) statsBtn.classList.add('active');
    } else if (pageId === 'settings') {
        activeTab = 'settings';
        const settingsBtn = document.querySelector('.nav-btn-settings');
        if (settingsBtn) settingsBtn.classList.add('active');
    } else if (pageId === 'clientTemplateEditor') {
        // 编辑页归属于“我的”模块，保持“我的”导航高亮
        activeTab = 'settings';
        const settingsBtn = document.querySelector('.nav-btn-settings');
        if (settingsBtn) settingsBtn.classList.add('active');
    }
    // 计算：仅打开抽屉，不高亮
    
    if (pageId === 'quote') {
        renderScheduleCalendar();
        renderScheduleTodoSection();
        if (!quoteData) {
            const searchInput = document.getElementById('historySearchInput');
            if (searchInput) applyHistoryFilters();
            else loadHistory();
        }
    }

    // 记录页：只渲染简洁记录列表（单主ID/金额/完成状态）
    if (pageId === 'record') {
        renderRecordPage();
    }

    // 统计页：渲染 KPI / 趋势 / Top 榜
    if (pageId === 'stats') {
        renderStatsPage();
    }
    
    // 切换到报价页时，初始化筛选徽章
    if (pageId === 'quote') {
        setTimeout(function() {
            updateHistoryFilterBadge();
        }, 100);
    }
    
    // 切换到报价页时，调整小票缩放（手机端）
    if (pageId === 'quote') {
        // 延迟一下，确保 DOM 已更新
        setTimeout(function() {
            adjustReceiptScale();
        }, 100);
    }
    
    // 如果是设置页，加载设置
    if (pageId === 'settings') {
        loadSettings();
        // 初始化“我的”页输入绑定（美工ID输入防抖保存 + 失焦立即同步）
        mgInitArtistInfoBindings();
        // 异步回填云端 display_name（不阻塞页面渲染）
        mgHydrateArtistIdFromCloud();
        // 自动同步本地美工ID到云端（如果已设置）
        if (defaultSettings.artistInfo && defaultSettings.artistInfo.id) {
            mgSyncArtistDisplayNameToCloud(defaultSettings.artistInfo.id);
        }
        renderProductSettings();
        renderProcessSettings();
        renderCoefficientSettings();

        // dev=1 时才显示“单主自助填写”相关入口
        try {
            const params = new URLSearchParams(window.location.search || '');
            const isDev = params.get('dev') === '1';
            document.querySelectorAll('.dev-feature').forEach(function (el) {
                el.classList.toggle('d-none', !isDev);
            });
            // 仅在 dev 模式下初始化链接（避免开发中功能被看见/被误触发请求）
            if (isDev && typeof mgInitInviteLinkUI === 'function') {
                mgInitInviteLinkUI();
            }
        } catch (e) {
            // ignore
        }
    }

    // 如果是表单模板编辑页，初始化编辑器
    if (pageId === 'clientTemplateEditor') {
        initClientTemplateEditor();
    }
    // 页面切换时不再直接显示/隐藏计算页，只控制报价 / 设置下的逻辑
}

// ===== 记录页（简洁版）=====
function openRecordPage() {
    showPage('record');
}

function clearRecordSearch() {
    const input = document.getElementById('recordSearchInput');
    if (input) input.value = '';
    toggleRecordSearchClear();
    applyRecordFilters();
}

function toggleRecordSearchClear() {
    const wrap = document.getElementById('recordSearchWrap');
    const input = document.getElementById('recordSearchInput');
    if (!wrap || !input) return;
    if (input.value.trim()) wrap.classList.add('has-value'); else wrap.classList.remove('has-value');
}

// 结算信息（可选）：settlement 无或未设置视为未结算
// settlement: { type: 'normal', amount, discountReasons?: [{ name, amount?, rate? }], ... } 或兼容旧 discountReason 字符串
function getSettlementDiscountReasons(settlement) {
    if (!settlement) return [];
    if (Array.isArray(settlement.discountReasons) && settlement.discountReasons.length) {
        return settlement.discountReasons.map(function (e) {
            return typeof e === 'object' && e != null && e.name != null ? String(e.name) : String(e);
        });
    }
    if (settlement.discountReason != null && String(settlement.discountReason).trim()) return [String(settlement.discountReason).trim()];
    return [];
}
function getRecordProgressStatus(item) {
    if (!item) return { text: '未开始', className: 'record-status--not-started', pending: false, overdue: false };
    // 已结算：优先显示结算状态
    if (item.settlement && (item.settlement.type === 'full_refund' || item.settlement.type === 'cancel_with_fee')) {
        return { text: '已撤单', className: 'record-status--cancelled', pending: false, overdue: false };
    }
    if (item.settlement && item.settlement.type === 'waste_fee') {
        return { text: '有废稿', className: 'record-status--waste', pending: false, overdue: false };
    }
    if (item.settlement && item.settlement.type === 'normal') {
        return { text: '已结单', className: 'record-status--settled', pending: false, overdue: false };
    }
    if (item.status === 'closed') {
        return { text: '已结单', className: 'record-status--settled', pending: false, overdue: false };
    }
    ensureProductDoneStates(item);
    const states = Array.isArray(item.productDoneStates) ? item.productDoneStates : [];
    const total = states.length;
    let doneCount = 0;
    for (let i = 0; i < total; i++) if (states[i]) doneCount++;
    const hasStart = (item.startTime && String(item.startTime).trim()) ? true : false;
    const hasDeadline = (item.deadline && String(item.deadline).trim()) ? true : false;
    // 任意一项未设置都视为待排单
    const pending = !hasStart || !hasDeadline;
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    
    // 1. 待排单：未设置排单时间
    if (pending) {
        const overdue = false;
        return { text: '待排单', className: 'record-status--pending', pending, overdue };
    }
    
    // 判断时间（截止日按当天 24 点：2.4 截稿则 2.4 未逾期，2.5 才逾期）
    const startTime = item.startTime ? new Date(item.startTime).getTime() : null;
    let deadline = null;
    if (item.deadline) {
        const d = new Date(item.deadline);
        d.setHours(23, 59, 59, 999);
        deadline = d.getTime();
    }
    const nowTime = now.getTime();
    
    // 2. 已完成：所有制品已完成
    if (total > 0 && doneCount === total) {
        const overdue = false;
        return { text: '已完成', className: 'record-status--completed', pending, overdue };
    }
    
    // 3. 未开始：排单时间未到
    if (startTime && nowTime < startTime) {
        const overdue = false;
        return { text: '未开始', className: 'record-status--not-started', pending, overdue };
    }
    
    // 4. 已逾期：截止日按当天 24 点，超过该时刻未完成才算逾期
    if (deadline && nowTime > deadline && (total === 0 || doneCount < total)) {
        const overdue = true;
        return { text: '已逾期', className: 'record-status--overdue', pending, overdue };
    }
    
    // 5. 进行中：排单时间已到，结束时间未到
    const overdue = false;
    return { text: '进行中', className: 'record-status--in-progress', pending, overdue };
}

function formatMoney(value) {
    const num = Number(value);
    if (!isFinite(num)) return '—';
    return '¥' + num.toFixed(2);
}

function formatRecordShortDate(timestamp) {
    if (!timestamp) return '—';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '—';
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return m + '/' + day;
}

function escapeHtml(str) {
    if (str == null) return '';
    const s = String(str);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderRecordPage() {
    // 初次进入记录页：默认应用筛选并渲染
    updateRecordFilterBadge();
    applyRecordFilters();
}

function toggleRecordFilterDrawer() {
    const drawer = document.getElementById('recordFilterDrawer');
    if (drawer) {
        drawer.classList.toggle('active');
        if (drawer.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
            updateRecordFilterBadge();
        } else {
            document.body.style.overflow = '';
        }
    }
}

function closeRecordFilterDrawer() {
    const drawer = document.getElementById('recordFilterDrawer');
    if (drawer) {
        drawer.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function onRecordFilterChange() {
    const timeFilter = document.getElementById('recordTimeFilter');
    const customDateRange = document.getElementById('recordCustomDateRange');
    if (timeFilter && timeFilter.value === 'custom') {
        if (customDateRange) customDateRange.classList.remove('d-none');
    } else {
        if (customDateRange) customDateRange.classList.add('d-none');
    }
    updateRecordFilterBadge();
}

function updateRecordFilterBadge() {
    const badge = document.getElementById('recordFilterBadge');
    if (!badge) return;
    // 始终隐藏筛选徽章
    badge.classList.add('d-none');
}

function resetRecordFilters() {
    const timeFilter = document.getElementById('recordTimeFilter');
    const startDate = document.getElementById('recordStartDate');
    const endDate = document.getElementById('recordEndDate');
    const statusFilter = document.getElementById('recordStatusFilter');
    const minPrice = document.getElementById('recordMinPrice');
    const maxPrice = document.getElementById('recordMaxPrice');
    const groupByEl = document.getElementById('recordGroupBy');
    const customDateRange = document.getElementById('recordCustomDateRange');
    if (timeFilter) timeFilter.value = 'all';
    if (startDate) startDate.value = '';
    if (endDate) endDate.value = '';
    if (statusFilter) statusFilter.value = 'all';
    if (minPrice) minPrice.value = '';
    if (maxPrice) maxPrice.value = '';
    if (groupByEl) groupByEl.value = 'month';
    if (customDateRange) customDateRange.classList.add('d-none');
    selectedHistoryIds.clear();
    updateRecordFilterBadge();
    applyRecordFilters();
}

function getFilteredHistoryForRecord() {
    const searchInput = document.getElementById('recordSearchInput');
    const timeFilterEl = document.getElementById('recordTimeFilter');
    const startDateEl = document.getElementById('recordStartDate');
    const endDateEl = document.getElementById('recordEndDate');
    const statusFilterEl = document.getElementById('recordStatusFilter');
    const minPriceEl = document.getElementById('recordMinPrice');
    const maxPriceEl = document.getElementById('recordMaxPrice');
    const sortByEl = document.getElementById('recordSortBy');
    const groupByEl = document.getElementById('recordGroupBy');

    const searchKeyword = searchInput ? searchInput.value.trim() : '';
    const filters = {
        timeRange: timeFilterEl ? timeFilterEl.value : 'all',
        startDate: startDateEl ? startDateEl.value : '',
        endDate: endDateEl ? endDateEl.value : '',
        statusFilter: statusFilterEl ? statusFilterEl.value : 'all',
        minPrice: minPriceEl ? minPriceEl.value : '',
        maxPrice: maxPriceEl ? maxPriceEl.value : '',
        sortBy: sortByEl ? sortByEl.value : 'time-desc',
        groupBy: groupByEl ? groupByEl.value : 'month'
    };

    if (!Array.isArray(history) || history.length === 0) {
        return { list: [], groupBy: filters.groupBy };
    }

    // 基本复用 loadHistory 的筛选/排序逻辑
    let filteredHistory = history;

    if (searchKeyword) {
        const keywordLower = searchKeyword.toLowerCase();
        filteredHistory = history.filter(item => {
            return (
                (item.clientId && String(item.clientId).toLowerCase().includes(keywordLower)) ||
                (item.contact && String(item.contact).toLowerCase().includes(keywordLower)) ||
                (item.deadline && String(item.deadline).toLowerCase().includes(keywordLower)) ||
                (item.agreedAmount != null && String(item.agreedAmount).includes(keywordLower)) ||
                (item.finalTotal && String(item.finalTotal).includes(keywordLower)) ||
                (item.totalProductsPrice && String(item.totalProductsPrice).includes(keywordLower))
            );
        });
    }

    if (filters.timeRange && filters.timeRange !== 'all') {
        const now = new Date();
        filteredHistory = filteredHistory.filter(item => {
            const itemDate = new Date(item.timestamp);
            switch (filters.timeRange) {
                case 'today':
                    return itemDate.toDateString() === now.toDateString();
                case 'week': {
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return itemDate >= weekAgo;
                }
                case 'month': {
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    return itemDate >= monthAgo;
                }
                case 'custom': {
                    const start = filters.startDate ? new Date(filters.startDate) : null;
                    const end = filters.endDate ? new Date(filters.endDate) : null;
                    if (start) start.setHours(0, 0, 0, 0);
                    if (end) end.setHours(23, 59, 59, 999);
                    if (start && itemDate < start) return false;
                    if (end && itemDate > end) return false;
                    return true;
                }
                default:
                    return true;
            }
        });
    }

    if (filters.statusFilter && filters.statusFilter !== 'all') {
        filteredHistory = filteredHistory.filter(item => getRecordProgressStatus(item).text === filters.statusFilter);
    }

    if (filters.minPrice !== undefined && filters.minPrice !== '') {
        filteredHistory = filteredHistory.filter(item => ((item.agreedAmount != null ? item.agreedAmount : item.finalTotal) || 0) >= parseFloat(filters.minPrice));
    }
    if (filters.maxPrice !== undefined && filters.maxPrice !== '') {
        filteredHistory = filteredHistory.filter(item => ((item.agreedAmount != null ? item.agreedAmount : item.finalTotal) || 0) <= parseFloat(filters.maxPrice));
    }

    filteredHistory = filteredHistory.slice().sort((a, b) => {
        switch (filters.sortBy) {
            case 'time-asc':
                return new Date(a.timestamp) - new Date(b.timestamp);
            case 'price-desc':
                return ((b.agreedAmount != null ? b.agreedAmount : b.finalTotal) || 0) - ((a.agreedAmount != null ? a.agreedAmount : a.finalTotal) || 0);
            case 'price-asc':
                return ((a.agreedAmount != null ? a.agreedAmount : a.finalTotal) || 0) - ((b.agreedAmount != null ? b.agreedAmount : b.finalTotal) || 0);
            case 'client-asc':
                return (a.clientId || '').localeCompare(b.clientId || '');
            case 'client-desc':
                return (b.clientId || '').localeCompare(a.clientId || '');
            case 'time-desc':
            default:
                return new Date(b.timestamp) - new Date(a.timestamp);
        }
    });

    return { list: filteredHistory, groupBy: filters.groupBy };
}

function applyRecordFilters() {
    toggleRecordSearchClear();
    const container = document.getElementById('recordContainer');
    if (!container) return;

    const { list, groupBy } = getFilteredHistoryForRecord();
    if (!Array.isArray(list) || list.length === 0) {
        container.innerHTML = '<p class="record-empty">未找到匹配的记录</p>';
        updateBatchDeleteButton();
        return;
    }

    const renderItem = (item) => {
        const platformLabel = escapeHtml((item && item.contact) ? String(item.contact).trim() : '');
        const clientId = escapeHtml((item && item.clientId) ? String(item.clientId) : '—');
        const clientDisplay = platformLabel ? (platformLabel + ' ' + clientId) : clientId;
        const shortDate = formatRecordShortDate(item && item.timestamp);
        const receivableAmount = item && (item.agreedAmount != null ? item.agreedAmount : item.finalTotal);
        var actualAmount = receivableAmount;
        if (item && item.settlement && item.settlement.amount != null) {
            actualAmount = (item.settlement.type === 'normal' && item.depositReceived != null)
                ? Number(item.depositReceived) + Number(item.settlement.amount)
                : Number(item.settlement.amount);
        }
        const hasSettlementWithDiff = item && item.settlement && (receivableAmount == null || Math.abs((actualAmount || 0) - (receivableAmount || 0)) > 0.001);
        const amountHtml = hasSettlementWithDiff
            ? `<div class="record-item-amount-wrap"><span class="record-item-amount">${formatMoney(actualAmount)}</span><span class="record-item-date">${formatMoney(receivableAmount)}</span></div>`
            : `<span class="record-item-amount">${formatMoney(receivableAmount)}</span>`;
        const status = getRecordProgressStatus(item);
        const hasDeposit = item && item.depositReceived != null && Number(item.depositReceived) > 0;
        const depositTagHtml = hasDeposit ? '<span class="record-tag record-tag-deposit">已收定</span>' : '';
        const isSelected = selectedHistoryIds.has(item.id);
        return `
            <div class="record-item history-item record-item-clickable${isSelected ? ' selected' : ''}" data-id="${item.id}">
                <input type="checkbox" class="history-item-checkbox record-item-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''} onchange="toggleHistorySelection(${item.id})" onclick="event.stopPropagation()">
                <div class="record-item-client-wrap">
                    <span class="record-item-client">${clientDisplay}</span>
                    <div class="record-item-meta">
                        <span class="record-item-date">${shortDate}</span>
                        <span class="record-item-id">${item.id}</span>
                    </div>
                </div>
                <div class="record-item-right">
                    ${amountHtml}
                    ${depositTagHtml}
                    <span class="record-status ${status.className}">${status.text}</span>
                </div>
            </div>
        `;
    };

    if (groupBy === 'month') {
        const grouped = {};
        list.forEach(item => {
            const date = new Date(item.timestamp);
            const monthKey = `${date.getFullYear()}年${date.getMonth() + 1}月`;
            if (!grouped[monthKey]) grouped[monthKey] = [];
            grouped[monthKey].push(item);
        });
        const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
        let html = '';
        sortedMonths.forEach(month => {
            html += `<div class="history-group">`;
            html += `<div class="history-group-header">${month} (${grouped[month].length}条)</div>`;
            html += `<div class="history-group-items">`;
            grouped[month].forEach(item => { html += renderItem(item); });
            html += `</div></div>`;
        });
        container.innerHTML = html;
    } else {
        container.innerHTML = list.map(renderItem).join('');
    }

    updateBatchDeleteButton();
    restoreCheckboxStates();
}

// ===== 记录页：同步数据导出/导入（跨端手动同步） =====
function getExportSyncPayload() {
    const { list } = getFilteredHistoryForRecord();
    if (!list || list.length === 0) return null;
    return {
        quoteHistory: list,
        calculatorSettings: defaultSettings,
        productSettings: productSettings,
        processSettings: processSettings,
        templates: templates,
        exportDate: new Date().toISOString()
    };
}

function exportSyncData() {
    try {
        const exportPayload = getExportSyncPayload();
        if (!exportPayload) {
            alert('当前筛选下无记录，请调整筛选后再导出 JSON，或使用导出 Excel。');
            return;
        }
        const json = JSON.stringify(exportPayload, null, 2);
        const filename = 'sync-data-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json';
        const blob = new Blob([json], { type: 'application/json' });
        const file = new File([blob], filename, { type: 'application/json' });
        
        // 手机端优先使用 Web Share API：通过系统分享菜单保存或发送，用户可明确选择存储位置
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: '报价数据同步', text: '含历史记录与全局设置' }).then(function () {
                alert('分享完成。若已保存到文件，可在另一设备选择该文件导入；或使用「复制到剪贴板」方式同步。');
            }).catch(function (err) {
                if (err.name !== 'AbortError') {
                    doExportSyncDownload(json, filename);
                }
            });
        } else {
            doExportSyncDownload(json, filename);
        }
    } catch (e) {
        console.error('导出同步数据失败:', e);
        alert('导出失败，请重试');
    }
}

function doExportSyncDownload(json, filename) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('数据已导出（含历史记录与全局设置）。\n\n电脑端：文件已保存到「下载」文件夹。\n手机端：若未弹出分享菜单，请使用「复制到剪贴板」后到另一设备粘贴导入。');
}

function exportSyncDataToClipboard() {
    try {
        const exportPayload = getExportSyncPayload();
        if (!exportPayload) {
            alert('当前筛选下无记录，请调整筛选后再导出。');
            return;
        }
        const json = JSON.stringify(exportPayload, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(json).then(function () {
                alert('已复制到剪贴板！\n\n到另一设备打开本页面，点击「导入」→「从剪贴板导入」即可同步。');
            }).catch(function () {
                fallbackCopyToClipboard(json);
            });
        } else {
            fallbackCopyToClipboard(json);
        }
    } catch (e) {
        console.error('复制失败:', e);
        alert('复制失败，请重试');
    }
}

function fallbackCopyToClipboard(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        alert('已复制到剪贴板！\n\n到另一设备打开本页面，点击「导入」→「从剪贴板导入」即可同步。');
    } catch (e) {
        alert('复制失败，请使用「导出 JSON」通过分享菜单保存文件后，在另一设备选择文件导入。');
    }
    document.body.removeChild(ta);
}

function toggleRecordImportPopover() {
    const pop = document.getElementById('recordImportPopover');
    const btn = document.getElementById('recordImportBtn');
    if (!pop || !btn) return;
    const isHidden = pop.classList.contains('d-none');
    pop.classList.toggle('d-none', !isHidden);
    pop.setAttribute('aria-hidden', isHidden ? 'false' : 'true');
    btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    if (isHidden) {
        setTimeout(function () {
            document.addEventListener('click', function closeRecordImport(e) {
                if (!pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                    closeRecordImportPopover();
                    document.removeEventListener('click', closeRecordImport);
                }
            });
        }, 0);
    }
}

function closeRecordImportPopover() {
    const pop = document.getElementById('recordImportPopover');
    const btn = document.getElementById('recordImportBtn');
    if (pop) pop.classList.add('d-none');
    if (pop) pop.setAttribute('aria-hidden', 'true');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function importSyncDataFromClipboard() {
    function tryParseAndImport(text) {
        try {
            const data = JSON.parse(text);
            if (!data || typeof data !== 'object') {
                alert('剪贴板内容不是有效的 JSON');
                return;
            }
            const hasHistory = Array.isArray(data.quoteHistory);
            const hasSettings = data.calculatorSettings != null || data.productSettings != null || data.processSettings != null || data.templates != null;
            if (!hasHistory && !hasSettings) {
                alert('剪贴板中未包含可导入的数据（需要 quoteHistory 或设置项）');
                return;
            }
            showRecordImportModeModal(data, null);
        } catch (e) {
            alert('剪贴板内容不是有效的 JSON，请确保已复制导出的完整数据');
        }
    }
    if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (text) {
            tryParseAndImport(text);
        }).catch(function () {
            alert('无法读取剪贴板，请检查浏览器权限或使用「选择 JSON 文件」导入');
        });
    } else {
        var text = prompt('请粘贴导出的 JSON 数据（可先在另一设备复制后粘贴）');
        if (text && text.trim()) tryParseAndImport(text.trim());
    }
}

function toggleRecordExportPopover() {
    const pop = document.getElementById('recordExportPopover');
    const btn = document.getElementById('recordExportBtn');
    if (!pop || !btn) return;
    const isHidden = pop.classList.contains('d-none');
    pop.classList.toggle('d-none', !isHidden);
    pop.setAttribute('aria-hidden', isHidden ? 'false' : 'true');
    btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    if (isHidden) {
        setTimeout(function () {
            document.addEventListener('click', function closeRecordExport(e) {
                if (!pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                    closeRecordExportPopover();
                    document.removeEventListener('click', closeRecordExport);
                }
            });
        }, 0);
    }
}

function closeRecordExportPopover() {
    const pop = document.getElementById('recordExportPopover');
    const btn = document.getElementById('recordExportBtn');
    if (pop) {
        pop.classList.add('d-none');
        pop.setAttribute('aria-hidden', 'true');
    }
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function toggleRecordSortPopover() {
    const pop = document.getElementById('recordSortPopover');
    const btn = document.getElementById('recordSortBtn');
    if (!pop || !btn) return;
    const isHidden = pop.classList.contains('d-none');
    pop.classList.toggle('d-none', !isHidden);
    pop.setAttribute('aria-hidden', isHidden ? 'false' : 'true');
    btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    if (isHidden) {
        setTimeout(function () {
            document.addEventListener('click', function closeRecordSort(e) {
                if (!pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                    closeRecordSortPopover();
                    document.removeEventListener('click', closeRecordSort);
                }
            });
        }, 0);
    }
}

function closeRecordSortPopover() {
    const pop = document.getElementById('recordSortPopover');
    const btn = document.getElementById('recordSortBtn');
    if (pop) {
        pop.classList.add('d-none');
        pop.setAttribute('aria-hidden', 'true');
    }
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function setRecordSortValue(value) {
    const el = document.getElementById('recordSortBy');
    if (el) el.value = value;
    applyRecordFilters();
    closeRecordSortPopover();
}

var recordImportPendingData = null;
var recordImportPendingInput = null;

function showRecordImportModeModal(data, fileInput) {
    recordImportPendingData = data;
    recordImportPendingInput = fileInput || null;
    var modal = document.getElementById('recordImportModeModal');
    if (modal) {
        modal.classList.remove('d-none');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeRecordImportModeModal() {
    recordImportPendingData = null;
    recordImportPendingInput = null;
    var modal = document.getElementById('recordImportModeModal');
    if (modal) {
        modal.classList.add('d-none');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function applyRecordImportOverwrite() {
    var data = recordImportPendingData;
    var inp = recordImportPendingInput;
    closeRecordImportModeModal();
    if (inp) inp.value = '';
    if (!data) return;
    if (Array.isArray(data.quoteHistory)) {
        history = data.quoteHistory;
        history.forEach(function (item) { ensureProductDoneStates(item); });
    }
    if (data.calculatorSettings != null) {
        normalizeCoefficients(data.calculatorSettings);
        Object.keys(data.calculatorSettings).forEach(function (key) {
            if (data.calculatorSettings[key] != null && typeof data.calculatorSettings[key] === 'object' && Object.keys(data.calculatorSettings[key]).length === 0) return;
            defaultSettings[key] = data.calculatorSettings[key];
        });
    }
    if (data.productSettings != null) productSettings = data.productSettings;
    if (data.processSettings != null) processSettings = data.processSettings;
    if (data.templates != null) templates = data.templates;
    saveData();
    applyRecordFilters();
    alert('导入成功，数据已同步到本机。');
}

function applyRecordImportMerge() {
    var data = recordImportPendingData;
    var fileInput = recordImportPendingInput;
    closeRecordImportModeModal();
    if (fileInput) fileInput.value = '';
    if (!data) return;
    var appendedCount = 0;
    if (Array.isArray(data.quoteHistory) && data.quoteHistory.length > 0) {
        var existingIds = new Set(history.map(function (h) { return h.id; }));
        var toAppend = data.quoteHistory.filter(function (item) { return !existingIds.has(item.id); });
        toAppend.forEach(function (item) { ensureProductDoneStates(item); });
        history = history.concat(toAppend);
        history.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
        appendedCount = toAppend.length;
    }
    saveData();
    applyRecordFilters();
    alert('导入成功，已合并 ' + appendedCount + ' 条记录，本机设置未变更。');
}

function handleRecordSyncImport(event) {
    const input = event && event.target;
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function () {
        try {
            const data = JSON.parse(reader.result);
            if (!data || typeof data !== 'object') {
                alert('无效的 JSON 文件');
                input.value = '';
                return;
            }
            const hasHistory = Array.isArray(data.quoteHistory);
            const hasSettings = data.calculatorSettings != null || data.productSettings != null || data.processSettings != null || data.templates != null;
            if (!hasHistory && !hasSettings) {
                alert('文件中未包含可导入的数据（需要 quoteHistory 或设置项）');
                input.value = '';
                return;
            }
            showRecordImportModeModal(data, input);
        } catch (e) {
            console.error('导入失败:', e);
            alert('导入失败：' + (e.message || '文件格式错误'));
            input.value = '';
        }
    };
    reader.readAsText(file, 'UTF-8');
}

function exportRecordToExcel() {
    // 复用现有导出逻辑：临时将 record 的筛选条件同步到 history 的导出读取点
    // 这里直接复制一份读 record 元素的逻辑，保证记录页导出与筛选一致
    if (history.length === 0) {
        alert('暂无历史记录可导出！');
        return;
    }
    const searchInput = document.getElementById('recordSearchInput');
    const timeFilterEl = document.getElementById('recordTimeFilter');
    const startDateEl = document.getElementById('recordStartDate');
    const endDateEl = document.getElementById('recordEndDate');
    const minPriceEl = document.getElementById('recordMinPrice');
    const maxPriceEl = document.getElementById('recordMaxPrice');
    const sortByEl = document.getElementById('recordSortBy');

    const searchKeyword = searchInput ? searchInput.value.trim() : '';
    const timeFilter = timeFilterEl ? timeFilterEl.value : 'all';
    const startDate = startDateEl ? startDateEl.value : '';
    const endDate = endDateEl ? endDateEl.value : '';
    const minPrice = minPriceEl ? minPriceEl.value : '';
    const maxPrice = maxPriceEl ? maxPriceEl.value : '';
    const sortBy = sortByEl ? sortByEl.value : 'time-desc';

    let exportData = history;
    if (searchKeyword) {
        const keywordLower = searchKeyword.toLowerCase();
        exportData = exportData.filter(item => {
            return (
                (item.clientId && String(item.clientId).toLowerCase().includes(keywordLower)) ||
                (item.contact && String(item.contact).toLowerCase().includes(keywordLower)) ||
                (item.deadline && String(item.deadline).toLowerCase().includes(keywordLower)) ||
                (item.finalTotal && String(item.finalTotal).includes(keywordLower))
            );
        });
    }
    if (timeFilter && timeFilter !== 'all') {
        const now = new Date();
        exportData = exportData.filter(item => {
            const itemDate = new Date(item.timestamp);
            switch (timeFilter) {
                case 'today':
                    return itemDate.toDateString() === now.toDateString();
                case 'week': {
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return itemDate >= weekAgo;
                }
                case 'month': {
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    return itemDate >= monthAgo;
                }
                case 'custom': {
                    const start = startDate ? new Date(startDate) : null;
                    const end = endDate ? new Date(endDate) : null;
                    if (start) start.setHours(0, 0, 0, 0);
                    if (end) end.setHours(23, 59, 59, 999);
                    if (start && itemDate < start) return false;
                    if (end && itemDate > end) return false;
                    return true;
                }
                default:
                    return true;
            }
        });
    }
    if (minPrice !== '') exportData = exportData.filter(item => ((item.agreedAmount != null ? item.agreedAmount : item.finalTotal) || 0) >= parseFloat(minPrice));
    if (maxPrice !== '') exportData = exportData.filter(item => ((item.agreedAmount != null ? item.agreedAmount : item.finalTotal) || 0) <= parseFloat(maxPrice));

    exportData = exportData.slice().sort((a, b) => {
        switch (sortBy) {
            case 'time-asc': return new Date(a.timestamp) - new Date(b.timestamp);
            case 'price-desc': return ((b.agreedAmount != null ? b.agreedAmount : b.finalTotal) || 0) - ((a.agreedAmount != null ? a.agreedAmount : a.finalTotal) || 0);
            case 'price-asc': return ((a.agreedAmount != null ? a.agreedAmount : a.finalTotal) || 0) - ((b.agreedAmount != null ? b.agreedAmount : b.finalTotal) || 0);
            case 'client-asc': return (a.clientId || '').localeCompare(b.clientId || '');
            case 'client-desc': return (b.clientId || '').localeCompare(a.clientId || '');
            case 'time-desc':
            default: return new Date(b.timestamp) - new Date(a.timestamp);
        }
    });

    // 直接借用原导出函数的实现细节：把筛选后的数据临时写到一个全局变量并走同一套生成逻辑太重；
    // 这里偷懒做法：调用原函数前把 record 的值同步到 history 的筛选控件（若存在）再调用原函数。
    // 若弹窗控件不存在/未打开，则 fallback：直接临时创建导出工作簿（原函数后半段仍会使用 XLSX）。
    // 为了保持改动小，这里直接复用原函数：创建一个临时容器并赋值到对应 input（如果存在）。
    const hSearch = document.getElementById('historySearchInput');
    const hTime = document.getElementById('historyTimeFilter');
    const hStart = document.getElementById('historyStartDate');
    const hEnd = document.getElementById('historyEndDate');
    const hMin = document.getElementById('historyMinPrice');
    const hMax = document.getElementById('historyMaxPrice');
    const hSort = document.getElementById('historySortBy');
    if (hSearch) hSearch.value = searchKeyword;
    if (hTime) hTime.value = timeFilter;
    if (hStart) hStart.value = startDate;
    if (hEnd) hEnd.value = endDate;
    if (hMin) hMin.value = minPrice;
    if (hMax) hMax.value = maxPrice;
    if (hSort) hSort.value = sortBy;

    exportHistoryToExcel();
}

// ========== 统计页 ==========
function openStatsPage() {
    showPage('stats');
}

// 与 getRecordProgressStatus 对齐，支持待排单/已撤单/有废稿/已结单
function getStatsOrderStatus(item) {
    if (!item) return '未开始';
    if (item.settlement && (item.settlement.type === 'full_refund' || item.settlement.type === 'cancel_with_fee')) return '已撤单';
    if (item.settlement && item.settlement.type === 'waste_fee') return '有废稿';
    if (item.settlement && item.settlement.type === 'normal') return '已结单';
    if (item.status === 'closed') return '已结单';
    ensureProductDoneStates(item);
    const states = Array.isArray(item.productDoneStates) ? item.productDoneStates : [];
    const total = states.length;
    let doneCount = 0;
    for (let i = 0; i < total; i++) if (states[i]) doneCount++;
    const hasStart = (item.startTime && String(item.startTime).trim()) ? true : false;
    const hasDeadline = (item.deadline && String(item.deadline).trim()) ? true : false;
    const pending = !hasStart || !hasDeadline;
    if (pending) return '待排单';
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const startTime = item.startTime ? new Date(item.startTime).getTime() : null;
    let deadline = null;
    if (item.deadline) {
        const d = new Date(item.deadline);
        d.setHours(23, 59, 59, 999);
        deadline = d.getTime();
    }
    const nowTime = now.getTime();
    if (total > 0 && doneCount === total) return '已完成';
    if (startTime && nowTime < startTime) return '未开始';
    if (deadline && nowTime > deadline && (total === 0 || doneCount < total)) return '已逾期';
    return '进行中';
}

function getStatsAmount(item, amountBasis, giftMode) {
    if (!item) return 0;
    if (item.settlement && item.settlement.amount != null) {
        if (item.settlement.type === 'normal' && item.depositReceived != null)
            return (Number(item.depositReceived) || 0) + (Number(item.settlement.amount) || 0);
        return Number(item.settlement.amount) || 0;
    }
    if (amountBasis === 'totalProductsPrice') return Number(item.totalProductsPrice) || 0;
    return Number(item.agreedAmount != null ? item.agreedAmount : item.finalTotal) || 0;
}

function isStatsOrderOverdue(item) {
    if (!item || !item.deadline) return false;
    const status = getStatsOrderStatus(item);
    if (status === '已完成' || status === '已撤单' || status === '有废稿' || status === '已结单') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(item.deadline);
    d.setHours(0, 0, 0, 0);
    return d < today;
}

// 曾经逾期过：当前逾期 或 已完成但截止日已过（说明逾期后才完成）
function isStatsOrderEverOverdue(item) {
    if (!item || !item.deadline) return false;
    if (isStatsOrderOverdue(item)) return true;
    const status = getStatsOrderStatus(item);
    if (status !== '已完成') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(item.deadline);
    d.setHours(0, 0, 0, 0);
    return d < today;
}

var STATS_FILTER_STORAGE_KEY = 'mg_stats_filters_v1';

function getStatsFiltersFromUI() {
    const timeEl = document.getElementById('statsTimeFilter');
    const timeBasisEl = document.getElementById('statsTimeBasis');
    const amountBasis = document.getElementById('statsAmountBasis');
    const giftMode = document.getElementById('statsGiftMode');
    const statusFilter = document.getElementById('statsStatusFilter');
    const quickStart = document.getElementById('statsStartDate');
    const quickEnd = document.getElementById('statsEndDate');
    const viewYearEl = document.getElementById('statsViewYear');
    const viewMonthEl = document.getElementById('statsViewMonth');
    const timeRange = (timeEl && timeEl.value) ? timeEl.value : 'thisMonth';
    const timeBasis = (timeBasisEl && timeBasisEl.value) ? timeBasisEl.value : 'timestamp';
    const now = new Date();
    const viewYear = (viewYearEl && viewYearEl.value) ? parseInt(viewYearEl.value, 10) : now.getFullYear();
    const viewMonth = (viewMonthEl && viewMonthEl.value) ? parseInt(viewMonthEl.value, 10) : now.getMonth();
    return {
        timeRange: timeRange,
        timeBasis: timeBasis === 'deadline' ? 'deadline' : 'timestamp',
        viewYear: isFinite(viewYear) ? viewYear : now.getFullYear(),
        viewMonth: isFinite(viewMonth) && viewMonth >= 0 && viewMonth <= 11 ? viewMonth : now.getMonth(),
        startDate: (quickStart && quickStart.value) ? quickStart.value : '',
        endDate: (quickEnd && quickEnd.value) ? quickEnd.value : '',
        amountBasis: amountBasis ? amountBasis.value : 'finalTotal',
        giftMode: giftMode ? giftMode.value : 'exclude',
        statusFilter: statusFilter ? statusFilter.value : 'all'
    };
}

function saveStatsFilters(filters) {
    try {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(STATS_FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch (e) { }
}

function loadStatsFilters() {
    try {
        if (typeof localStorage === 'undefined') return null;
        var text = localStorage.getItem(STATS_FILTER_STORAGE_KEY);
        if (!text) return null;
        var obj = JSON.parse(text);
        if (!obj || typeof obj !== 'object') return null;
        return obj;
    } catch (e) {
        return null;
    }
}

function getStatsDateRange(filters) {
    if (filters.timeRange === 'all') return { all: true };
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let start = new Date(now);
    let end = new Date(now);
    start.setHours(0, 0, 0, 0);
    switch (filters.timeRange) {
        case 'thisMonth': {
            const y = filters.viewYear != null ? filters.viewYear : now.getFullYear();
            const m = filters.viewMonth != null ? filters.viewMonth : now.getMonth();
            start = new Date(y, m, 1, 0, 0, 0, 0);
            end = new Date(y, m + 1, 0, 23, 59, 59, 999);
            break;
        }
        case 'thisYear': {
            const y = filters.viewYear != null ? filters.viewYear : now.getFullYear();
            start = new Date(y, 0, 1, 0, 0, 0, 0);
            end = new Date(y, 11, 31, 23, 59, 59, 999);
            break;
        }
        case 'custom':
            if (filters.startDate) start = new Date(filters.startDate);
            if (filters.endDate) end = new Date(filters.endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
        default:
            start.setDate(1);
            end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
    }
    return { start, end };
}

function getStatsDataset(historySource, filters) {
    if (!Array.isArray(historySource) || historySource.length === 0) {
        return {
            filteredRecords: [],
            totals: { orderCount: 0, revenueTotal: 0, aov: 0, itemTotal: 0, itemDone: 0, itemDoneRate: 0, orderDoneCount: 0, orderDoneRate: 0, overdueOrderCount: 0, everOverdueOrderCount: 0, orderSettledCount: 0, orderSettledRate: 0, cancelOrderCount: 0, cancelAmountTotal: 0, wasteOrderCount: 0, wasteAmountTotal: 0, totalOtherFeesSum: 0, totalPlatformFeeSum: 0, discountAmountTotal: 0, discountByReason: {}, discountTotal: 0 },
            dailyAgg: [],
            weeklyAgg: [],
            monthlyAgg: [],
            byClient: [],
            byProduct: [],
            byStatus: [],
            byUsage: [],
            byUrgent: [],
            byProcess: [],
            // 制品小类汇总：rows + totals
            categorySummary: {
                rows: [],
                totals: {
                    itemCount: 0,        // 制品数（主设件数）
                    sameModelCount: 0,   // 同模数
                    quantityTotal: 0,    // 合计件数（主设+同模）
                    amountTotal: 0       // 金额合计
                }
            }
        };
    }
    const dateRange = getStatsDateRange(filters);
    let list = historySource;
    const useDeadline = filters.timeBasis === 'deadline';
    if (!dateRange.all) {
        const { start, end } = dateRange;
        const startStr = start.toISOString().slice(0, 10);
        const endStr = end.toISOString().slice(0, 10);
        list = historySource.filter(item => {
            if (useDeadline) {
                const d = item.deadline ? normalizeYmd(item.deadline) : null;
                if (!d) return false;
                return d >= startStr && d <= endStr;
            }
            const t = item.timestamp ? new Date(item.timestamp) : null;
            if (!t || isNaN(t.getTime())) return false;
            return t >= start && t <= end;
        });
    } else if (useDeadline) {
        list = historySource.filter(item => item.deadline && String(item.deadline).trim());
    }
    if (filters.statusFilter !== 'all') {
        list = list.filter(item => {
            const status = getStatsOrderStatus(item);
            if (filters.statusFilter === '已逾期') return isStatsOrderOverdue(item);
            return status === filters.statusFilter;
        });
    }
    const getAmount = (item) => getStatsAmount(item, filters.amountBasis, filters.giftMode);
    const includeGifts = filters.giftMode !== 'exclude';
    const giftRevenueAsZero = filters.giftMode === 'zero';

    let revenueTotal = 0;
    let itemTotal = 0;
    let itemDone = 0;
    let orderDoneCount = 0;
    let overdueOrderCount = 0;
    let everOverdueOrderCount = 0;
    let orderSettledCount = 0;
    let cancelOrderCount = 0;
    let cancelAmountTotal = 0;
    let wasteOrderCount = 0;
    let wasteAmountTotal = 0;
    let totalOtherFeesSum = 0;
    let totalPlatformFeeSum = 0;
    let discountAmountTotal = 0;
    let discountByCoefficientTotal = 0;
    // 折扣原因聚合：记录每个原因对应的「出现单数」和「优惠金额」
    const discountByReason = {};
    const dailyMap = {};
    const clientMap = {};
    const productMap = {};
    const statusMap = {};
    const usageMap = {};
    const urgentMap = {};
    const processMap = {};
    // 制品小类聚合：按制品名（小类）统计主设 / 同模 / 合计数量 / 金额
    const categoryMap = {};
    let categoryMainCountTotal = 0;
    let categorySameModelTotal = 0;
    let categoryQuantityTotal = 0;
    let categoryMainAmountTotal = 0;
    let categorySameAmountTotal = 0;
    let categoryAmountTotal = 0;

    list.forEach(item => {
        ensureProductDoneStates(item);
        const revenue = getAmount(item);
        revenueTotal += revenue;
        const products = Array.isArray(item.productPrices) ? item.productPrices : [];
        const gifts = includeGifts && Array.isArray(item.giftPrices) ? item.giftPrices : [];
        const states = item.productDoneStates || [];
        let nItems = products.length + gifts.length;
        let nDone = 0;
        for (let i = 0; i < nItems && i < states.length; i++) if (states[i]) nDone++;
        itemTotal += nItems;
        itemDone += nDone;
        const orderStatus = getStatsOrderStatus(item);
        if (orderStatus === '已完成') orderDoneCount++;
        if (isStatsOrderOverdue(item)) overdueOrderCount++;
        if (isStatsOrderEverOverdue(item)) everOverdueOrderCount++;
        if (item.settlement && (item.settlement.type === 'full_refund' || item.settlement.type === 'cancel_with_fee' || item.settlement.type === 'waste_fee' || item.settlement.type === 'normal')) orderSettledCount++;
        if (item.settlement && (item.settlement.type === 'full_refund' || item.settlement.type === 'cancel_with_fee')) {
            cancelOrderCount++;
            cancelAmountTotal += (item.settlement.amount != null ? Number(item.settlement.amount) : 0) || 0;
        }
        if (item.settlement && item.settlement.type === 'waste_fee') {
            wasteOrderCount++;
            var wf = item.settlement.wasteFee || {};
            var wasteFeeAmt = (wf.feeAmount != null && isFinite(wf.feeAmount)) ? Number(wf.feeAmount) : (wf.totalReceivable != null && isFinite(wf.totalReceivable)) ? Number(wf.totalReceivable) : (wf.totalWasteReceivable != null && isFinite(wf.totalWasteReceivable)) ? Number(wf.totalWasteReceivable) : null;
            if (wasteFeeAmt == null || !isFinite(wasteFeeAmt)) {
                var depW = Number(item.depositReceived || 0);
                if (!isFinite(depW) || depW < 0) depW = 0;
                var amtW = item.settlement.amount != null ? Number(item.settlement.amount) : 0;
                wasteFeeAmt = amtW + depW;
            }
            wasteAmountTotal += wasteFeeAmt || 0;
        }
        if (item.settlement && item.settlement.type === 'normal') {
            var receivable = Number(item.agreedAmount != null ? item.agreedAmount : item.finalTotal) || 0;
            var actual = receivable;
            if (item.settlement.amount != null)
                actual = (Number(item.depositReceived || 0)) + Number(item.settlement.amount);
            if (receivable > actual) {
                var orderDiscount = receivable - actual;
                discountAmountTotal += orderDiscount;
                var reasonAmountSum = 0;
                if (Array.isArray(item.settlement.discountReasons) && item.settlement.discountReasons.length) {
                    item.settlement.discountReasons.forEach(function (e) {
                        var name = (e && typeof e === 'object' && e.name != null) ? String(e.name).trim() : '';
                        if (!name) return;
                        var amt = (e.amount != null && isFinite(e.amount)) ? Number(e.amount) : 0;
                        if (amt > 0) {
                            if (!discountByReason[name]) {
                                discountByReason[name] = { name: name, orderCount: 0, amountTotal: 0 };
                            }
                            discountByReason[name].orderCount += 1;
                            discountByReason[name].amountTotal += amt;
                            reasonAmountSum += amt;
                        }
                    });
                }
                var remainder = orderDiscount - reasonAmountSum;
                if (remainder > 0) {
                    var otherLabel = '其他';
                    if (!discountByReason[otherLabel]) {
                        discountByReason[otherLabel] = { name: otherLabel, orderCount: 0, amountTotal: 0 };
                    }
                    discountByReason[otherLabel].orderCount += 1;
                    discountByReason[otherLabel].amountTotal += remainder;
                }
            }
        }
        // 折扣类系数减少的金额（按主折扣、各扩展折扣分别统计，与结单优惠原因分开）
        var twc = item.totalWithCoefficients != null && isFinite(item.totalWithCoefficients) ? Number(item.totalWithCoefficients) : null;
        
        // --- 新增：手动改动约定实收产生的优惠统计 ---
        // 这里的逻辑是：(系统计算原价 totalBeforePlatformFee) - (你手动改后的约定实收 agreedAmount)
        // 只要这个差额 > 0，就说明你手动给了优惠，计入统计
        var baseBeforePlat = item.totalBeforePlatformFee != null && isFinite(item.totalBeforePlatformFee) ? Number(item.totalBeforePlatformFee) : null;
        var finalAgreed = item.agreedAmount != null && isFinite(item.agreedAmount) ? Number(item.agreedAmount) : null;
        if (baseBeforePlat != null && finalAgreed != null) {
            var manualDiff = baseBeforePlat - finalAgreed;
            if (manualDiff >= 0.005) { // 超过 0.5 分钱视作有效差额
                var manualLabel = '手动调价/抹零';
                if (!discountByReason[manualLabel]) {
                    discountByReason[manualLabel] = { name: manualLabel, orderCount: 0, amountTotal: 0 };
                }
                discountByReason[manualLabel].orderCount += 1;
                discountByReason[manualLabel].amountTotal += manualDiff;
                discountByCoefficientTotal += manualDiff;
            }
        }
        // --- 手动优惠统计结束 ---

        if (twc != null && twc > 0) {
            var pricingDown = 1;
            if (item.pricingDownProduct != null && isFinite(item.pricingDownProduct)) pricingDown = Number(item.pricingDownProduct);
            else if (item.discount != null && isFinite(item.discount)) pricingDown = Number(item.discount);
            else if (item.discountType != null && defaultSettings.discountCoefficients && defaultSettings.discountCoefficients[item.discountType]) pricingDown = getCoefficientValue(defaultSettings.discountCoefficients[item.discountType]) || 1;
            if (pricingDown < 1) {
                var baseBeforeDown = twc / pricingDown;
                var running = baseBeforeDown;
                var hadAnyCoeff = false;
                // 主折扣系数
                var mainVal = 1;
                var mainName = '折扣系数';
                if (item.discountType != null && defaultSettings.discountCoefficients && defaultSettings.discountCoefficients[item.discountType]) {
                    var mainOpt = defaultSettings.discountCoefficients[item.discountType];
                    mainVal = getCoefficientValue(mainOpt) || 1;
                    mainName = (mainOpt && mainOpt.name) ? mainOpt.name : mainName;
                } else if (item.discount != null && isFinite(item.discount)) {
                    mainVal = Number(item.discount);
                }
                if (mainVal < 1) {
                    hadAnyCoeff = true;
                    var mainReduction = running * (1 - mainVal);
                    if (!discountByReason[mainName]) {
                        discountByReason[mainName] = { name: mainName, orderCount: 0, amountTotal: 0 };
                    }
                    discountByReason[mainName].orderCount += 1;
                    discountByReason[mainName].amountTotal += mainReduction;
                    discountByCoefficientTotal += mainReduction;
                    running *= mainVal;
                }
                // 扩展折扣类系数（顺序与报价一致）
                (defaultSettings.extraPricingDown || []).forEach(function (e, ei) {
                    var sel = (item.extraDownSelections && item.extraDownSelections[ei]) ? item.extraDownSelections[ei] : null;
                    var key = sel && (sel.optionValue != null ? sel.optionValue : sel.selectedKey);
                    var opt = (e.options && key != null && e.options[key]) ? e.options[key] : null;
                    var v = opt != null ? (getCoefficientValue(opt) || 1) : (sel && sel.value != null && isFinite(sel.value) ? Number(sel.value) : 1);
                    var nm = (opt && opt.name) ? opt.name : (sel && sel.optionName) ? sel.optionName : (e && e.name) ? e.name : '扩展折扣';
                    if (v < 1) {
                        hadAnyCoeff = true;
                        var extReduction = running * (1 - v);
                        if (!discountByReason[nm]) {
                            discountByReason[nm] = { name: nm, orderCount: 0, amountTotal: 0 };
                        }
                        discountByReason[nm].orderCount += 1;
                        discountByReason[nm].amountTotal += extReduction;
                        discountByCoefficientTotal += extReduction;
                        running *= v;
                    }
                });
                // 旧数据无法按系数拆分时，整笔计入「折扣类系数」
                if (!hadAnyCoeff) {
                    var fallbackReduction = baseBeforeDown - twc;
                    if (fallbackReduction > 0) {
                        var fallbackName = '折扣类系数';
                        if (!discountByReason[fallbackName]) {
                            discountByReason[fallbackName] = { name: fallbackName, orderCount: 0, amountTotal: 0 };
                        }
                        discountByReason[fallbackName].orderCount += 1;
                        discountByReason[fallbackName].amountTotal += fallbackReduction;
                        discountByCoefficientTotal += fallbackReduction;
                    }
                }
            }
        }
        totalOtherFeesSum += (item.totalOtherFees != null ? Number(item.totalOtherFees) : 0) || 0;
        totalPlatformFeeSum += (item.platformFeeAmount != null ? Number(item.platformFeeAmount) : 0) || 0;
        const status = orderStatus;
        if (!statusMap[status]) statusMap[status] = { status: status, orderCount: 0, amountTotal: 0 };
        statusMap[status].orderCount += 1;
        statusMap[status].amountTotal += revenue;

        const dateStr = useDeadline ? (item.deadline ? normalizeYmd(item.deadline) : '') : (item.timestamp ? new Date(item.timestamp).toISOString().slice(0, 10) : '');
        if (dateStr) {
            if (!dailyMap[dateStr]) dailyMap[dateStr] = { date: dateStr, revenue: 0, orders: 0, itemTotal: 0, itemDone: 0 };
            dailyMap[dateStr].revenue += revenue;
            dailyMap[dateStr].orders += 1;
            dailyMap[dateStr].itemTotal += nItems;
            dailyMap[dateStr].itemDone += nDone;
        }

        const cid = item.clientId || '—';
        if (!clientMap[cid]) clientMap[cid] = { clientId: cid, orderCount: 0, revenueTotal: 0 };
        clientMap[cid].orderCount += 1;
        clientMap[cid].revenueTotal += revenue;

        products.forEach(p => {
            const name = p.product || '制品';
            if (!productMap[name]) productMap[name] = { productName: name, count: 0, revenueTotal: 0 };
            productMap[name].count += 1;
            productMap[name].revenueTotal += (Number(p.productTotal) || 0);
        });
        if (includeGifts) {
            gifts.forEach(p => {
                const name = '[赠品] ' + (p.product || '赠品');
                if (!productMap[name]) productMap[name] = { productName: name, count: 0, revenueTotal: 0 };
                productMap[name].count += 1;
                productMap[name].revenueTotal += giftRevenueAsZero ? 0 : (Number(p.productTotal) || 0);
            });
        }
        const usageType = item.usageType || '—';
        const usageDisplayName = (usageType !== '—' && defaultSettings.usageCoefficients && defaultSettings.usageCoefficients[usageType] && defaultSettings.usageCoefficients[usageType].name)
            ? defaultSettings.usageCoefficients[usageType].name : usageType;
        if (!usageMap[usageType]) usageMap[usageType] = { name: usageDisplayName, orderCount: 0, amountTotal: 0 };
        usageMap[usageType].orderCount += 1;
        usageMap[usageType].amountTotal += revenue;
        const urgentType = item.urgentType || '—';
        const urgentDisplayName = (urgentType !== '—' && defaultSettings.urgentCoefficients && defaultSettings.urgentCoefficients[urgentType] && defaultSettings.urgentCoefficients[urgentType].name)
            ? defaultSettings.urgentCoefficients[urgentType].name : urgentType;
        if (!urgentMap[urgentType]) urgentMap[urgentType] = { name: urgentDisplayName, orderCount: 0, amountTotal: 0 };
        urgentMap[urgentType].orderCount += 1;
        urgentMap[urgentType].amountTotal += revenue;
        const allItems = products.concat(includeGifts ? gifts : []);
        allItems.forEach(p => {
            const details = p.processDetails || [];
            details.forEach(proc => {
                const pname = proc.name || '工艺';
                if (!processMap[pname]) processMap[pname] = { name: pname, count: 0, feeTotal: 0 };
                processMap[pname].count += 1;
                processMap[pname].feeTotal += (Number(proc.fee) || 0);
            });
        });

        // ===== 按制品小类汇总（如拍立得） =====
        // 制品：使用 productPrices 中的 product（制品名）/ quantity / sameModelCount / productTotal
        products.forEach(p => {
            const subCatName = p.product || '其他';
            if (!categoryMap[subCatName]) {
                categoryMap[subCatName] = {
                    category: subCatName,
                    itemCount: 0,        // 主设件数
                    sameModelCount: 0,   // 同模件数
                    quantityTotal: 0,   // 合计件数
                    mainAmount: 0,      // 主设金额
                    sameModelAmount: 0,  // 同模金额
                    amountTotal: 0       // 金额合计
                };
            }
            const qty = Number(p.quantity) || 0;
            const same = Number(p.sameModelCount) || 0;
            const main = Math.max(qty - same, 0);
            const amount = Number(p.productTotal) || 0;
            // 将整单金额按件数平均拆分为主设金额和同模金额，便于统计
            let mainAmount = 0;
            let sameAmount = 0;
            if (qty > 0 && amount) {
                const per = amount / qty;
                mainAmount = per * main;
                sameAmount = amount - mainAmount;
            }

            categoryMap[subCatName].itemCount += main;
            categoryMap[subCatName].sameModelCount += same;
            categoryMap[subCatName].quantityTotal += qty;
            categoryMap[subCatName].mainAmount += mainAmount;
            categoryMap[subCatName].sameModelAmount += sameAmount;
            categoryMap[subCatName].amountTotal += amount;

            categoryMainCountTotal += main;
            categorySameModelTotal += same;
            categoryQuantityTotal += qty;
            categoryMainAmountTotal += mainAmount;
            categorySameAmountTotal += sameAmount;
            categoryAmountTotal += amount;
        });

        // 赠品：是否计入由 giftMode 决定；金额基于 giftOriginalPrice
        if (includeGifts) {
            gifts.forEach(p => {
                const subCatName = p.product || '其他';
                if (!categoryMap[subCatName]) {
                    categoryMap[subCatName] = {
                        category: subCatName,
                        itemCount: 0,
                        sameModelCount: 0,
                        quantityTotal: 0,
                        mainAmount: 0,
                        sameModelAmount: 0,
                        amountTotal: 0
                    };
                }
                const qty = Number(p.quantity) || 0;
                const same = Number(p.sameModelCount) || 0;
                const main = Math.max(qty - same, 0);
                const amount = giftRevenueAsZero ? 0 : (Number(p.giftOriginalPrice) || 0);
                let mainAmount = 0;
                let sameAmount = 0;
                if (qty > 0 && amount) {
                    const per = amount / qty;
                    mainAmount = per * main;
                    sameAmount = amount - mainAmount;
                }

                categoryMap[subCatName].itemCount += main;
                categoryMap[subCatName].sameModelCount += same;
                categoryMap[subCatName].quantityTotal += qty;
                categoryMap[subCatName].mainAmount += mainAmount;
                categoryMap[subCatName].sameModelAmount += sameAmount;
                categoryMap[subCatName].amountTotal += amount;

                categoryMainCountTotal += main;
                categorySameModelTotal += same;
                categoryQuantityTotal += qty;
                categoryMainAmountTotal += mainAmount;
                categorySameAmountTotal += sameAmount;
                categoryAmountTotal += amount;
            });
        }
    });

    const orderCount = list.length;
    const aov = orderCount > 0 ? revenueTotal / orderCount : 0;
    const itemDoneRate = itemTotal > 0 ? (itemDone / itemTotal) * 100 : 0;
    const orderDoneRate = orderCount > 0 ? (orderDoneCount / orderCount) * 100 : 0;
    const orderSettledRate = orderCount > 0 ? (orderSettledCount / orderCount) * 100 : 0;

    const dailyAgg = Object.keys(dailyMap).sort().map(k => dailyMap[k]);
    var weeklyMap = {};
    dailyAgg.forEach(function (d) {
        var dt = new Date(d.date);
        var day = dt.getDay() || 7;
        var monday = new Date(dt);
        monday.setDate(dt.getDate() - day + 1);
        var weekKey = monday.toISOString().slice(0, 10);
        if (!weeklyMap[weekKey]) weeklyMap[weekKey] = { weekStart: weekKey, revenue: 0, orders: 0, itemTotal: 0, itemDone: 0 };
        weeklyMap[weekKey].revenue += d.revenue;
        weeklyMap[weekKey].orders += d.orders;
        weeklyMap[weekKey].itemTotal += d.itemTotal;
        weeklyMap[weekKey].itemDone += d.itemDone;
    });
    var weeklyAgg = Object.keys(weeklyMap).sort().map(function (k) { return weeklyMap[k]; });
    var monthlyMap = {};
    dailyAgg.forEach(function (d) {
        var monthKey = d.date.slice(0, 7);
        if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { month: monthKey, revenue: 0, orders: 0, itemTotal: 0, itemDone: 0 };
        monthlyMap[monthKey].revenue += d.revenue;
        monthlyMap[monthKey].orders += d.orders;
        monthlyMap[monthKey].itemTotal += d.itemTotal;
        monthlyMap[monthKey].itemDone += d.itemDone;
    });
    var monthlyAgg = Object.keys(monthlyMap).sort().map(function (k) { return monthlyMap[k]; });
    const byClient = Object.values(clientMap).sort((a, b) => b.revenueTotal - a.revenueTotal);
    const byProduct = Object.values(productMap).sort((a, b) => b.revenueTotal - a.revenueTotal);
    const byStatus = ['待排单', '未开始', '进行中', '已完成', '已逾期', '已撤单', '有废稿', '已结单'].map(s => statusMap[s] || { status: s, orderCount: 0, amountTotal: 0 });
    const byUsage = Object.values(usageMap).sort((a, b) => b.amountTotal - a.amountTotal);
    const byUrgent = Object.values(urgentMap).sort((a, b) => b.amountTotal - a.amountTotal);
    const byProcess = Object.values(processMap).sort((a, b) => b.feeTotal - a.feeTotal);

    const categoryRows = Object.values(categoryMap).sort((a, b) => {
        // 默认按金额从高到低，其次按合计件数
        if (b.amountTotal !== a.amountTotal) return b.amountTotal - a.amountTotal;
        return b.quantityTotal - a.quantityTotal;
    });
    const categorySummary = {
        rows: categoryRows,
        totals: {
            itemCount: categoryMainCountTotal,
            sameModelCount: categorySameModelTotal,
            quantityTotal: categoryQuantityTotal,
            mainAmount: categoryMainAmountTotal,
            sameModelAmount: categorySameAmountTotal,
            amountTotal: categoryAmountTotal
        }
    };

    return {
        filteredRecords: list,
        totals: {
            orderCount,
            revenueTotal,
            aov,
            itemTotal,
            itemDone,
            itemDoneRate,
            orderDoneCount,
            orderDoneRate,
            overdueOrderCount,
            everOverdueOrderCount,
            orderSettledCount,
            orderSettledRate,
            cancelOrderCount,
            cancelAmountTotal,
            wasteOrderCount,
            wasteAmountTotal,
            totalOtherFeesSum,
            totalPlatformFeeSum,
            discountAmountTotal,
            discountByReason,
            discountTotal: discountAmountTotal + discountByCoefficientTotal
        },
        dailyAgg,
        weeklyAgg,
        monthlyAgg,
        byClient,
        byProduct,
        byStatus,
        byUsage,
        byUrgent,
        byProcess,
        categorySummary
    };
}

function getStatsComparison(filters, currentTotals) {
    if (filters.timeRange !== 'thisMonth' && filters.timeRange !== 'thisYear') return null;
    var prevFilters = { timeRange: filters.timeRange, viewYear: filters.viewYear, viewMonth: filters.viewMonth, statusFilter: filters.statusFilter || 'all', amountBasis: filters.amountBasis || 'finalTotal', giftMode: filters.giftMode || 'exclude' };
    if (filters.timeRange === 'thisMonth') {
        prevFilters.viewMonth = filters.viewMonth - 1;
        if (prevFilters.viewMonth < 0) { prevFilters.viewMonth = 11; prevFilters.viewYear--; }
    } else if (filters.timeRange === 'thisYear') {
        prevFilters.viewYear = filters.viewYear - 1;
    }
    var prevDataset = getStatsDataset(history, prevFilters);
    var prev = prevDataset.totals;
    if (prev.orderCount === 0 && prev.revenueTotal === 0) return null;
    var changeOrderPct = prev.orderCount > 0 ? ((currentTotals.orderCount - prev.orderCount) / prev.orderCount * 100) : null;
    var changeRevenuePct = prev.revenueTotal > 0 ? ((currentTotals.revenueTotal - prev.revenueTotal) / prev.revenueTotal * 100) : null;
    return { prevTotals: prev, changeOrderPct: changeOrderPct, changeRevenuePct: changeRevenuePct };
}

function renderStatsComparison(filters, totals) {
    var wrap = document.getElementById('statsComparisonWrap');
    if (!wrap) return;
    var comp = getStatsComparison(filters, totals);
    if (!comp) { wrap.innerHTML = ''; wrap.classList.add('d-none'); return; }
    wrap.classList.remove('d-none');
    var fmt = function (v) {
        if (v == null || !isFinite(v)) return { text: '—', cls: '' };
        var s = (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
        return { text: s, cls: v > 0 ? 'stats-change-up' : (v < 0 ? 'stats-change-down' : '') };
    };
    var o = fmt(comp.changeOrderPct);
    var r = fmt(comp.changeRevenuePct);
    var label = filters.timeRange === 'thisMonth' ? '环比上月' : '环比去年';
    wrap.innerHTML = '<p class="stats-comparison">' + label + '：订单 <span class="' + o.cls + '">' + o.text + '</span>，收入 <span class="' + r.cls + '">' + r.text + '</span></p>';
}

function renderStatsDistribution(byStatus, byUsage, byUrgent, byProcess, discountByReason) {
    const container = document.getElementById('statsDistribution');
    if (!container) return;
    var hasStatus = byStatus && byStatus.some(function (s) { return s.orderCount > 0 || s.amountTotal > 0; });
    var hasUsage = byUsage && byUsage.length > 0;
    var hasUrgent = byUrgent && byUrgent.length > 0;
    var hasProcess = byProcess && byProcess.length > 0;
    // 折扣原因：与「用途」「加急」类似，按「单数 / 金额」展示
    var discountReasons = (discountByReason && typeof discountByReason === 'object')
        ? Object.values(discountByReason).filter(function (r) {
            return r && (r.orderCount > 0 || r.amountTotal > 0);
        })
        : [];
    var hasDiscount = discountReasons.length > 0;
    if (!hasStatus && !hasUsage && !hasUrgent && !hasProcess && !hasDiscount) { container.innerHTML = ''; container.classList.add('d-none'); return; }
    container.classList.remove('d-none');
    var tabs = [];
    var panels = [];
    if (hasStatus) {
        tabs.push('<button type="button" class="btn secondary small active" data-dist-tab="status">状态</button>');
        var shtml = '';
        byStatus.forEach(function (s) {
            if (s.orderCount > 0 || s.amountTotal > 0) {
                shtml += '<div class="stats-status-item"><span class="stats-status-name">' + (s.status || '—') + '</span><span class="stats-status-val">' + s.orderCount + ' 单 / ¥' + (s.amountTotal || 0).toFixed(2) + '</span></div>';
            }
        });
        panels.push({ id: 'status', html: '<div class="stats-status-list">' + shtml + '</div>' });
    }
    if (hasUsage) {
        tabs.push('<button type="button" class="btn secondary small' + (tabs.length === 0 ? ' active' : '') + '" data-dist-tab="usage">用途</button>');
        var uhtml = '';
        byUsage.forEach(function (r) { uhtml += '<div class="stats-dim-item"><span>' + (r.name || '—') + '</span><span>' + r.orderCount + ' 单 / ¥' + (r.amountTotal || 0).toFixed(2) + '</span></div>'; });
        panels.push({ id: 'usage', html: '<div class="stats-dim-list">' + uhtml + '</div>' });
    }
    if (hasUrgent) {
        tabs.push('<button type="button" class="btn secondary small' + (tabs.length === 0 ? ' active' : '') + '" data-dist-tab="urgent">加急</button>');
        var ghtml = '';
        byUrgent.forEach(function (r) { ghtml += '<div class="stats-dim-item"><span>' + (r.name || '—') + '</span><span>' + r.orderCount + ' 单 / ¥' + (r.amountTotal || 0).toFixed(2) + '</span></div>'; });
        panels.push({ id: 'urgent', html: '<div class="stats-dim-list">' + ghtml + '</div>' });
    }
    if (hasProcess) {
        tabs.push('<button type="button" class="btn secondary small' + (tabs.length === 0 ? ' active' : '') + '" data-dist-tab="process">工艺</button>');
        var prhtml = '';
        byProcess.forEach(function (r) { prhtml += '<div class="stats-dim-item"><span>' + (r.name || '—') + '</span><span>' + r.count + ' 次 / ¥' + (r.feeTotal || 0).toFixed(2) + '</span></div>'; });
        panels.push({ id: 'process', html: '<div class="stats-dim-list">' + prhtml + '</div>' });
    }
    if (hasDiscount) {
        tabs.push('<button type="button" class="btn secondary small' + (tabs.length === 0 ? ' active' : '') + '" data-dist-tab="discount">折扣</button>');
        var dhtml = discountReasons.map(function (r) {
            var name = (r && r.name) ? r.name : '—';
            var count = (r && r.orderCount) ? r.orderCount : 0;
            var amt = (r && r.amountTotal != null && isFinite(r.amountTotal)) ? Number(r.amountTotal) : 0;
            return '<div class="stats-dim-item"><span>' + name + '</span><span>' + count + ' 单 / -¥' + amt.toFixed(2) + '</span></div>';
        }).join('');
        panels.push({ id: 'discount', html: '<div class="stats-dim-list">' + dhtml + '</div>' });
    }
    var firstId = panels.length ? panels[0].id : null;
    var html = '<h3 class="stats-block-title">数据分布</h3>';
    html += '<div class="stats-top-tabs">' + tabs.join('') + '</div>';
    panels.forEach(function (p, i) {
        html += '<div id="statsDistPanel' + p.id + '" class="stats-dist-panel-wrap' + (p.id === firstId ? '' : ' d-none') + '">' + p.html + '</div>';
    });
    container.innerHTML = html;
    container.querySelectorAll('[data-dist-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var tab = this.dataset.distTab;
            container.querySelectorAll('[data-dist-tab]').forEach(function (b) { b.classList.remove('active'); });
            this.classList.add('active');
            container.querySelectorAll('.stats-dist-panel-wrap').forEach(function (w) { w.classList.add('d-none'); });
            var panel = document.getElementById('statsDistPanel' + tab);
            if (panel) panel.classList.remove('d-none');
        });
    });
}

function renderStatsKpis(totals) {
    const grid = document.getElementById('statsKpiGrid');
    if (!grid) return;
    const fmt = (v, isMoney) => {
        if (typeof v !== 'number' || !isFinite(v)) return '—';
        if (isMoney) return '¥' + v.toFixed(2);
        if (v === Math.floor(v)) return String(v);
        return v.toFixed(1);
    };
    const discountTotalVal = totals.discountTotal != null ? totals.discountTotal : (totals.discountAmountTotal || 0);
    const discountTotalDisplay = discountTotalVal > 0 ? ('-¥' + discountTotalVal.toFixed(2)) : fmt(discountTotalVal, true);
    grid.innerHTML = `
        <div class="kpi-section-title">核心指标</div>
        <div class="kpi-card kpi-card-primary"><div class="kpi-label">订单数</div><div class="kpi-value" id="kpiOrderCount">${totals.orderCount}</div></div>
        <div class="kpi-card kpi-card-primary"><div class="kpi-label">总收入</div><div class="kpi-value" id="kpiRevenueTotal">${fmt(totals.revenueTotal, true)}</div></div>
        <div class="kpi-card kpi-card-primary"><div class="kpi-label">客单价</div><div class="kpi-value" id="kpiAov">${fmt(totals.aov, true)}</div></div>
        <div class="kpi-card kpi-card-primary"><div class="kpi-label">制品项</div><div class="kpi-value" id="kpiItemTotal">${totals.itemTotal}</div></div>
        <div class="kpi-section-title">进度与结算</div>
        <div class="kpi-card"><div class="kpi-label">制品项完成率</div><div class="kpi-value" id="kpiItemDoneRate">${fmt(totals.itemDoneRate)}%</div></div>
        <div class="kpi-card"><div class="kpi-label">订单完结率</div><div class="kpi-value" id="kpiOrderSettledRate">${fmt(totals.orderSettledRate || 0)}%</div></div>
        <div class="kpi-card"><div class="kpi-label">逾期</div><div class="kpi-value" id="kpiOverdueOrders">${totals.overdueOrderCount}</div></div>
        <div class="kpi-card"><div class="kpi-label">曾经逾期</div><div class="kpi-value" id="kpiEverOverdueOrders">${totals.everOverdueOrderCount ?? 0}</div></div>
        <div class="kpi-card"><div class="kpi-label">撤单</div><div class="kpi-value kpi-value-small" id="kpiCancel">${totals.cancelOrderCount || 0} 单 / ${fmt(totals.cancelAmountTotal || 0, true)}</div></div>
        <div class="kpi-card"><div class="kpi-label">废稿</div><div class="kpi-value kpi-value-small" id="kpiWaste">${totals.wasteOrderCount || 0} 单 / ${fmt(totals.wasteAmountTotal || 0, true)}</div></div>
        <div class="kpi-section-title">费用</div>
        <div class="kpi-card"><div class="kpi-label">其他费用</div><div class="kpi-value" id="kpiOtherFees">${fmt(totals.totalOtherFeesSum || 0, true)}</div></div>
        <div class="kpi-card"><div class="kpi-label">平台费</div><div class="kpi-value" id="kpiPlatformFee">${fmt(totals.totalPlatformFeeSum || 0, true)}</div></div>
        <div class="kpi-card"><div class="kpi-label">折扣合计</div><div class="kpi-value kpi-value-small" id="kpiDiscountTotal">${discountTotalDisplay}</div></div>
    `;
    let orderRateEl = document.getElementById('kpiOrderDoneRate');
    if (!orderRateEl) {
        orderRateEl = document.createElement('div');
        orderRateEl.className = 'stats-order-done-rate text-gray';
        orderRateEl.id = 'kpiOrderDoneRate';
        grid.parentNode.insertBefore(orderRateEl, grid.nextSibling);
    }
    orderRateEl.textContent = '制品全完成率：' + fmt(totals.orderDoneRate) + '%（制品全完成 ' + totals.orderDoneCount + ' / ' + totals.orderCount + '）；订单完结率：' + fmt(totals.orderSettledRate || 0) + '%（已结算 ' + (totals.orderSettledCount || 0) + ' / ' + totals.orderCount + '）';
}

function renderStatsTrends(dailyAgg, weeklyAgg, monthlyAgg) {
    const container = document.getElementById('statsTrends');
    if (!container) return;
    var currentTab = (window.statsTrendGranularity || 'month');
    if (currentTab !== 'month' && currentTab !== 'year') currentTab = 'month';
    var yearlyMap = {};
    (monthlyAgg || []).forEach(function (d) {
        var y = d.month ? String(d.month).slice(0, 4) : '';
        if (!y) return;
        if (!yearlyMap[y]) yearlyMap[y] = { year: y, revenue: 0, orders: 0, itemTotal: 0, itemDone: 0 };
        yearlyMap[y].revenue += d.revenue || 0;
        yearlyMap[y].orders += d.orders || 0;
        yearlyMap[y].itemTotal += d.itemTotal || 0;
        yearlyMap[y].itemDone += d.itemDone || 0;
    });
    var yearlyAgg = Object.keys(yearlyMap).sort().map(function (k) { return yearlyMap[k]; });
    var agg = currentTab === 'year' ? yearlyAgg : (monthlyAgg || []);
    if (!agg || agg.length === 0) {
        container.innerHTML = '<p class="text-gray">暂无趋势数据</p>';
        return;
    }
    var labelKey = currentTab === 'year' ? 'year' : 'month';
    const maxRev = Math.max(1, ...agg.map(d => d.revenue));
    const maxOrd = Math.max(1, ...agg.map(d => d.orders));
    const maxRate = 100;
    var html = '<h3 class="stats-block-title">趋势</h3>';
    html += '<div class="stats-top-tabs"><button type="button" class="btn secondary small' + (currentTab === 'month' ? ' active' : '') + '" data-gran="month">按月</button><button type="button" class="btn secondary small' + (currentTab === 'year' ? ' active' : '') + '" data-gran="year">按年</button></div>';
    html += '<div class="stats-mini-bars">';
    agg.forEach(function (d) {
        var rate = d.itemTotal > 0 ? (d.itemDone / d.itemTotal) * 100 : 0;
        var lbl = d[labelKey] || d.month || d.year || '—';
        html += '<div class="stats-bar-row">';
        html += '<span class="stats-bar-label">' + lbl + '</span>';
        html += '<div class="stats-bar-wrap"><div class="stats-bar stats-bar-rev" style="width:' + (d.revenue / maxRev * 100) + '%"></div></div><span class="stats-bar-legend">¥' + (d.revenue || 0).toFixed(0) + '</span>';
        html += '<div class="stats-bar-wrap"><div class="stats-bar stats-bar-ord" style="width:' + (d.orders / maxOrd * 100) + '%"></div></div><span class="stats-bar-legend">' + d.orders + '单</span>';
        html += '<div class="stats-bar-wrap"><div class="stats-bar stats-bar-rate" style="width:' + (rate / maxRate * 100) + '%"></div></div><span class="stats-bar-legend">' + rate.toFixed(0) + '%</span>';
        html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.stats-top-tabs button[data-gran]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            window.statsTrendGranularity = this.dataset.gran;
            applyStatsFilters();
        });
    });
}

function renderStatsTopLists(byClient, byProduct) {
    const container = document.getElementById('statsTopLists');
    if (!container) return;
    const defaultShow = 10;
    const clientByOrders = [...byClient].sort((a, b) => b.orderCount - a.orderCount);
    const clientByRevenue = byClient.slice();
    let html = '<h3 class="stats-block-title">Top 单主</h3>';
    html += '<div class="stats-top-header">';
    html += '<div class="stats-top-tabs"><button type="button" class="btn secondary small active" data-tab="clientOrders">按订单数</button><button type="button" class="btn secondary small" data-tab="clientRevenue">按金额</button></div>';
    html += '<div class="stats-top-more-wrap">';
    if (clientByOrders.length > defaultShow) {
        html += '<button type="button" class="btn secondary small stats-top-more-btn" data-list="clientOrders" id="statsTopMoreBtnOrders">更多</button>';
    }
    if (clientByRevenue.length > defaultShow) {
        html += '<button type="button" class="btn secondary small stats-top-more-btn" data-list="clientRevenue" id="statsTopMoreBtnRevenue">更多</button>';
    }
    html += '</div>';
    html += '</div>';
    html += '<div id="statsTopClientOrders" class="stats-top-list-wrap">';
    html += '<div id="statsTopClientOrdersList" class="stats-top-list">';
    clientByOrders.slice(0, defaultShow).forEach((c, i) => { html += '<div class="stats-top-item"><span class="stats-top-rank">' + (i + 1) + '</span><span class="stats-top-name">' + (c.clientId || '—') + '</span><span class="stats-top-val">' + c.orderCount + ' 单</span></div>'; });
    html += '</div>';
    if (clientByOrders.length > defaultShow) {
        html += '<div id="statsTopClientOrdersMore" class="stats-top-list d-none">';
        clientByOrders.slice(defaultShow).forEach((c, i) => { html += '<div class="stats-top-item"><span class="stats-top-rank">' + (defaultShow + i + 1) + '</span><span class="stats-top-name">' + (c.clientId || '—') + '</span><span class="stats-top-val">' + c.orderCount + ' 单</span></div>'; });
        html += '</div>';
    }
    html += '</div>';
    html += '<div id="statsTopClientRevenue" class="stats-top-list-wrap d-none">';
    html += '<div id="statsTopClientRevenueList" class="stats-top-list">';
    clientByRevenue.slice(0, defaultShow).forEach((c, i) => { html += '<div class="stats-top-item"><span class="stats-top-rank">' + (i + 1) + '</span><span class="stats-top-name">' + (c.clientId || '—') + '</span><span class="stats-top-val">¥' + (c.revenueTotal || 0).toFixed(2) + '</span></div>'; });
    html += '</div>';
    if (clientByRevenue.length > defaultShow) {
        html += '<div id="statsTopClientRevenueMore" class="stats-top-list d-none">';
        clientByRevenue.slice(defaultShow).forEach((c, i) => { html += '<div class="stats-top-item"><span class="stats-top-rank">' + (defaultShow + i + 1) + '</span><span class="stats-top-name">' + (c.clientId || '—') + '</span><span class="stats-top-val">¥' + (c.revenueTotal || 0).toFixed(2) + '</span></div>'; });
        html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;
    container.querySelectorAll('.stats-top-tabs button[data-tab]').forEach(btn => {
        btn.addEventListener('click', function() {
            var tab = this.dataset.tab;
            container.querySelectorAll('.stats-top-tabs button').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            var ordersBtn = document.getElementById('statsTopMoreBtnOrders');
            var revenueBtn = document.getElementById('statsTopMoreBtnRevenue');
            if (tab === 'clientOrders') {
                document.getElementById('statsTopClientOrders').classList.remove('d-none');
                document.getElementById('statsTopClientRevenue').classList.add('d-none');
                if (ordersBtn) ordersBtn.classList.remove('d-none');
                if (revenueBtn) revenueBtn.classList.add('d-none');
                if (ordersBtn) {
                    var moreEl = document.getElementById('statsTopClientOrdersMore');
                    ordersBtn.textContent = moreEl && !moreEl.classList.contains('d-none') ? '收起' : '更多';
                }
            } else {
                document.getElementById('statsTopClientOrders').classList.add('d-none');
                document.getElementById('statsTopClientRevenue').classList.remove('d-none');
                if (ordersBtn) ordersBtn.classList.add('d-none');
                if (revenueBtn) revenueBtn.classList.remove('d-none');
                if (revenueBtn) {
                    var moreEl = document.getElementById('statsTopClientRevenueMore');
                    revenueBtn.textContent = moreEl && !moreEl.classList.contains('d-none') ? '收起' : '更多';
                }
            }
        });
    });
    // 初始只显示「按订单数」对应的更多按钮，「按金额」的更多按钮先隐藏
    var revenueBtn = document.getElementById('statsTopMoreBtnRevenue');
    if (revenueBtn) revenueBtn.classList.add('d-none');
    container.querySelectorAll('.stats-top-more-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            var listId = this.dataset.list;
            var moreEl = document.getElementById('statsTopClient' + (listId === 'clientOrders' ? 'Orders' : 'Revenue') + 'More');
            if (!moreEl) return;
            if (moreEl.classList.contains('d-none')) {
                moreEl.classList.remove('d-none');
                this.textContent = '收起';
            } else {
                moreEl.classList.add('d-none');
                this.textContent = '更多';
            }
        });
    });
}

function renderStatsCategorySummary(summary) {
    const container = document.getElementById('statsCategorySummary');
    if (!container) return;
    container._categorySummary = summary;
    const rows = summary && Array.isArray(summary.rows) ? summary.rows : [];
    const totals = summary && summary.totals ? summary.totals : null;
    const fmtInt = (v) => {
        const n = Number(v);
        if (!isFinite(n)) return '—';
        return String(Math.round(n));
    };
    const fmtMoney = (v) => {
        const n = Number(v);
        if (!isFinite(n)) return '—';
        return '¥' + n.toFixed(2);
    };

    if (!rows.length || !totals) {
        container.innerHTML = '<div class="stats-category-summary-card"><div class="stats-category-summary-header"><div class="stats-category-summary-title">制品小类汇总</div><div class="stats-category-summary-total">暂无数据</div></div></div>';
        return;
    }

    var sortState = container._categorySummarySort || { key: 'mainAmount', dir: 'desc' };
    var sortedRows = rows.slice().sort(function (a, b) {
        var key = sortState.key;
        var va = key === 'category' ? (a.category || '') : (Number(a[key]) || 0);
        var vb = key === 'category' ? (b.category || '') : (Number(b[key]) || 0);
        if (key === 'category') {
            var c = (va === vb) ? 0 : (va < vb ? -1 : 1);
            return sortState.dir === 'asc' ? c : -c;
        }
        return sortState.dir === 'asc' ? (va - vb) : (vb - va);
    });

    var sortLabel = function (label, key) {
        var active = sortState.key === key;
        var arrow = active ? (sortState.dir === 'asc' ? ' ↑' : ' ↓') : '';
        return '<th class="stats-category-summary-th-sort' + (active ? ' is-sorted' : '') + '" data-sort="' + key + '" role="button" tabindex="0">' + label + arrow + '</th>';
    };

    let html = '<div class="stats-category-summary-card">';
    html += '<div class="stats-category-summary-header">';
    html += '<div class="stats-category-summary-title">制品小类汇总</div>';
    html += '</div>';
    html += '<div class="stats-category-summary-table-wrap">';
    html += '<table class="stats-category-summary-table">';
    html += '<thead><tr>';
    html += sortLabel('制品小类', 'category');
    html += sortLabel('主设数', 'itemCount');
    html += sortLabel('主设金额', 'mainAmount');
    html += sortLabel('同模数', 'sameModelCount');
    html += sortLabel('同模金额', 'sameModelAmount');
    html += '</tr></thead><tbody>';
    sortedRows.forEach(row => {
        html += '<tr class="stats-category-summary-row">';
        html += '<td>' + (row.category || '其他') + '</td>';
        html += '<td>' + fmtInt(row.itemCount) + '</td>';
        html += '<td class="stats-category-summary-amount">' + fmtMoney(row.mainAmount ?? 0) + '</td>';
        html += '<td>' + fmtInt(row.sameModelCount) + '</td>';
        html += '<td class="stats-category-summary-amount">' + fmtMoney(row.sameModelAmount ?? 0) + '</td>';
        html += '</tr>';
    });
    html += '<tr class="stats-category-summary-row stats-category-summary-row-total">';
    html += '<td>合计</td>';
    html += '<td>' + fmtInt(totals.itemCount) + '</td>';
    html += '<td class="stats-category-summary-amount">' + fmtMoney(totals.mainAmount ?? totals.amountTotal) + '</td>';
    html += '<td>' + fmtInt(totals.sameModelCount) + '</td>';
    html += '<td class="stats-category-summary-amount">' + fmtMoney(totals.sameModelAmount ?? 0) + '</td>';
    html += '</tr>';
    html += '</tbody></table></div></div>';
    container.innerHTML = html;

    container.querySelectorAll('.stats-category-summary-th-sort').forEach(function (th) {
        function applySort() {
            var key = th.dataset.sort;
            if (!key) return;
            var s = container._categorySummarySort || { key: 'mainAmount', dir: 'desc' };
            container._categorySummarySort = {
                key: key,
                dir: (s.key === key && s.dir === 'desc') ? 'asc' : 'desc'
            };
            renderStatsCategorySummary(container._categorySummary);
        }
        th.addEventListener('click', applySort);
        th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applySort(); } });
    });
}

function updateStatsFilterBadge() {
    const badge = document.getElementById('statsFilterBadge');
    if (!badge) return;
    // 始终隐藏筛选徽章
    badge.classList.add('d-none');
}

function toggleStatsFilterDrawer() {
    const drawer = document.getElementById('statsFilterDrawer');
    if (drawer) {
        drawer.classList.toggle('active');
        if (drawer.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
            updateStatsFilterBadge();
        } else document.body.style.overflow = '';
    }
}

function closeStatsFilterDrawer() {
    const drawer = document.getElementById('statsFilterDrawer');
    if (drawer) { drawer.classList.remove('active'); document.body.style.overflow = ''; }
}

function onStatsFilterChange() {
    updateStatsFilterBadge();
}

function resetStatsFilters() {
    const timeEl = document.getElementById('statsTimeFilter');
    const timeBasisEl = document.getElementById('statsTimeBasis');
    const amountEl = document.getElementById('statsAmountBasis');
    const giftEl = document.getElementById('statsGiftMode');
    const statusEl = document.getElementById('statsStatusFilter');
    const quickStart = document.getElementById('statsStartDate');
    const quickEnd = document.getElementById('statsEndDate');
    const viewYearEl = document.getElementById('statsViewYear');
    const viewMonthEl = document.getElementById('statsViewMonth');
    const now = new Date();
    if (timeEl) timeEl.value = 'thisMonth';
    if (timeBasisEl) timeBasisEl.value = 'timestamp';
    if (viewYearEl) viewYearEl.value = String(now.getFullYear());
    if (viewMonthEl) viewMonthEl.value = String(now.getMonth());
    if (amountEl) amountEl.value = 'finalTotal';
    if (giftEl) giftEl.value = 'exclude';
    if (statusEl) statusEl.value = 'all';
    if (quickStart) quickStart.value = '';
    if (quickEnd) quickEnd.value = '';
    updateStatsFilterBadge();
    applyStatsFilters();
}

function toggleStatsCustomDate() {
    setStatsQuickRange('custom');
}

function onStatsQuickCustomChange() {
    const timeEl = document.getElementById('statsTimeFilter');
    if (timeEl) timeEl.value = 'custom';
    onStatsFilterChange();
    applyStatsFilters();
}

function setStatsQuickRange(range) {
    const timeEl = document.getElementById('statsTimeFilter');
    const dateNavWrap = document.getElementById('statsDateNavWrap');
    const customWrap = document.getElementById('statsCustomDateWrap');
    const viewYearEl = document.getElementById('statsViewYear');
    const viewMonthEl = document.getElementById('statsViewMonth');
    const now = new Date();
    if (timeEl) timeEl.value = range;
    if (range === 'thisMonth' || range === 'thisYear') {
        if (viewYearEl) viewYearEl.value = String(now.getFullYear());
        if (viewMonthEl) viewMonthEl.value = String(now.getMonth());
        if (dateNavWrap) dateNavWrap.classList.remove('d-none');
        if (customWrap) customWrap.classList.add('d-none');
    } else if (range === 'all') {
        if (dateNavWrap) dateNavWrap.classList.add('d-none');
        if (customWrap) customWrap.classList.add('d-none');
    } else if (range === 'custom') {
        if (dateNavWrap) dateNavWrap.classList.add('d-none');
        if (customWrap) customWrap.classList.remove('d-none');
        const quickStart = document.getElementById('statsStartDate');
        const quickEnd = document.getElementById('statsEndDate');
        if (quickStart && !quickStart.value) {
            const end = new Date();
            const start = new Date(end);
            start.setDate(start.getDate() - 29);
            quickStart.value = toYmd(start);
            quickEnd.value = toYmd(end);
        }
    }
    onStatsFilterChange();
    applyStatsFilters();
}

function setStatsDateNav(delta) {
    const timeEl = document.getElementById('statsTimeFilter');
    const viewYearEl = document.getElementById('statsViewYear');
    const viewMonthEl = document.getElementById('statsViewMonth');
    const range = timeEl ? timeEl.value : 'thisMonth';
    const now = new Date();
    let y = (viewYearEl && viewYearEl.value) ? parseInt(viewYearEl.value, 10) : now.getFullYear();
    let m = (viewMonthEl && viewMonthEl.value) ? parseInt(viewMonthEl.value, 10) : now.getMonth();
    if (!isFinite(y)) y = now.getFullYear();
    if (!isFinite(m) || m < 0 || m > 11) m = now.getMonth();
    if (range === 'thisMonth') {
        m += delta;
        if (m > 11) { m = 0; y++; }
        else if (m < 0) { m = 11; y--; }
        if (viewYearEl) viewYearEl.value = String(y);
        if (viewMonthEl) viewMonthEl.value = String(m);
    } else if (range === 'thisYear') {
        y += delta;
        if (viewYearEl) viewYearEl.value = String(y);
    }
    applyStatsFilters();
}

function applyStatsFilters() {
    const f = getStatsFiltersFromUI();
    const dateNavWrap = document.getElementById('statsDateNavWrap');
    const customWrap = document.getElementById('statsCustomDateWrap');
    const dateNavLabel = document.getElementById('statsDateNavLabel');
    document.querySelectorAll('.stats-quick-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.range === f.timeRange);
    });
    if (dateNavWrap) {
        if (f.timeRange === 'thisMonth' || f.timeRange === 'thisYear') {
            dateNavWrap.classList.remove('d-none');
            var vy = document.getElementById('statsViewYear');
            var vm = document.getElementById('statsViewMonth');
            if (vy && !vy.value) { vy.value = String(f.viewYear); }
            if (vm && !vm.value && f.timeRange === 'thisMonth') { vm.value = String(f.viewMonth); }
            if (dateNavLabel) {
                dateNavLabel.textContent = f.timeRange === 'thisMonth' ? (f.viewYear + '年' + (f.viewMonth + 1) + '月') : (f.viewYear + '年');
            }
        } else {
            dateNavWrap.classList.add('d-none');
        }
    }
    if (customWrap) customWrap.classList.toggle('d-none', f.timeRange !== 'custom');
    // 持久化当前筛选到 localStorage，刷新后继续沿用
    saveStatsFilters(f);
    const dataset = getStatsDataset(history, f);
    var emptyHint = document.getElementById('statsEmptyHint');
    if (emptyHint) {
        if (dataset.filteredRecords.length === 0) {
            emptyHint.textContent = '当前筛选条件下暂无订单数据';
            emptyHint.classList.remove('d-none');
        } else {
            emptyHint.textContent = '';
            emptyHint.classList.add('d-none');
        }
    }
    renderStatsKpis(dataset.totals);
    renderStatsComparison(f, dataset.totals);
    renderStatsTrends(dataset.dailyAgg, dataset.weeklyAgg, dataset.monthlyAgg);
    renderStatsTopLists(dataset.byClient, dataset.byProduct);
    renderStatsCategorySummary(dataset.categorySummary);
    renderStatsDistribution(dataset.byStatus, dataset.byUsage, dataset.byUrgent, dataset.byProcess, dataset.totals.discountByReason);
}

function renderStatsPage() {
    // 若存在上次的筛选配置，优先还原到 UI
    const saved = loadStatsFilters();
    if (saved) {
        const timeEl = document.getElementById('statsTimeFilter');
        const timeBasisEl = document.getElementById('statsTimeBasis');
        const amountEl = document.getElementById('statsAmountBasis');
        const giftEl = document.getElementById('statsGiftMode');
        const statusEl = document.getElementById('statsStatusFilter');
        const quickStart = document.getElementById('statsStartDate');
        const quickEnd = document.getElementById('statsEndDate');
        const viewYearEl = document.getElementById('statsViewYear');
        const viewMonthEl = document.getElementById('statsViewMonth');
        if (timeEl && saved.timeRange) timeEl.value = saved.timeRange;
        if (timeBasisEl && saved.timeBasis) timeBasisEl.value = saved.timeBasis;
        if (amountEl && saved.amountBasis) amountEl.value = saved.amountBasis;
        if (giftEl && saved.giftMode) giftEl.value = saved.giftMode;
        if (statusEl && saved.statusFilter) statusEl.value = saved.statusFilter;
        if (viewYearEl && typeof saved.viewYear === 'number') viewYearEl.value = String(saved.viewYear);
        if (viewMonthEl && typeof saved.viewMonth === 'number') viewMonthEl.value = String(saved.viewMonth);
        if (saved.startDate && quickStart) quickStart.value = saved.startDate;
        if (saved.endDate && quickEnd) quickEnd.value = saved.endDate;
        onStatsFilterChange();
    }
    updateStatsFilterBadge();
    applyStatsFilters();
}

function getStatsReportPeriodLabel(filters) {
    if (!filters) return '这段时间';
    function fmtYmd(d) {
        if (!(d instanceof Date) || isNaN(d.getTime())) return '';
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '年' + m + '月' + day + '日';
    }
    var now = new Date();
    if (filters.timeRange === 'thisMonth') {
        var y = isFinite(filters.viewYear) ? filters.viewYear : now.getFullYear();
        var m = isFinite(filters.viewMonth) ? filters.viewMonth : now.getMonth();
        return y + '年' + (m + 1) + '月';
    }
    if (filters.timeRange === 'thisYear') {
        var yy = isFinite(filters.viewYear) ? filters.viewYear : now.getFullYear();
        return yy + '年';
    }
    if (filters.timeRange === 'custom' && (filters.startDate || filters.endDate)) {
        var cStart = filters.startDate ? new Date(filters.startDate + 'T00:00:00') : null;
        var cEnd = filters.endDate ? new Date(filters.endDate + 'T00:00:00') : null;
        return (cStart ? fmtYmd(cStart) : '起') + ' 至 ' + (cEnd ? fmtYmd(cEnd) : '今');
    }
    if (filters.timeRange === 'all') return '全部时间';
    return '这段时间';
}

function getStatsReportState() {
    if (!window.statsReportState) {
        window.statsReportState = {
            preset: 'social',
            modules: { opening: true, kpi: true, busy: true, topProduct: true, aov: true, revenue: true, closing: true },
            showAmount: true,
            themeId: 'follow'
        };
    }
    return window.statsReportState;
}

function buildStatsReportThemeOptions() {
    const st = getStatsReportState();
    const select = document.getElementById('statsReportThemeSelect');
    if (!select) return;
    const currentReceiptTheme = (defaultSettings && defaultSettings.receiptCustomization && defaultSettings.receiptCustomization.theme) || 'classic';
    const preset = [
        { id: 'classic', name: '经典' },
        { id: 'modern', name: '现代' },
        { id: 'warm', name: '暖色' },
        { id: 'dark', name: '暗色' },
        { id: 'nature', name: '自然' },
        { id: 'vintage', name: '复古' },
        { id: 'sakura', name: '樱色' },
        { id: 'iceBlue', name: '冰蓝' }
    ];
    let html = '<option value="follow">跟随小票（当前：' + currentReceiptTheme + '）</option>';
    preset.forEach(function (t) { html += '<option value="' + t.id + '">' + t.name + '</option>'; });
    if (defaultSettings && defaultSettings.customThemes) {
        Object.keys(defaultSettings.customThemes).forEach(function (id) {
            const t = defaultSettings.customThemes[id] || {};
            const name = t.name ? String(t.name) : id;
            html += '<option value="' + id + '">自定义 · ' + name + '</option>';
        });
    }
    select.innerHTML = html;
    select.value = st.themeId || 'follow';
}

function handleStatsReportThemeChange(themeId) {
    const st = getStatsReportState();
    st.themeId = themeId || 'follow';
    renderStatsReportPreview();
}

function openStatsReportModal() {
    const modal = document.getElementById('statsReportModal');
    if (!modal) return;
    const st = getStatsReportState();
    buildStatsReportThemeOptions();
    const amountEl = document.getElementById('statsReportShowAmount');
    if (amountEl) amountEl.checked = !!st.showAmount;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    renderStatsReportPreview();
}

function closeStatsReportModal() {
    const modal = document.getElementById('statsReportModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function applyStatsReportPreset(preset) {
    const st = getStatsReportState();
    st.preset = preset;
    if (preset === 'social') {
        st.modules = { opening: true, kpi: true, busy: true, topProduct: true, aov: true, revenue: true, closing: true };
        st.showAmount = false;
    } else if (preset === 'group') {
        st.modules = { opening: true, kpi: true, busy: true, topProduct: true, aov: true, revenue: true, closing: false };
        st.showAmount = true;
    } else {
        st.modules = { opening: true, kpi: true, busy: true, topProduct: true, aov: true, revenue: true, closing: true };
        st.showAmount = true;
    }
    const amountEl = document.getElementById('statsReportShowAmount');
    if (amountEl) amountEl.checked = !!st.showAmount;
    const moduleWrap = document.getElementById('statsReportModules');
    if (moduleWrap) {
        moduleWrap.querySelectorAll('input[type="checkbox"][data-module]').forEach(function (cb) {
            const key = cb.getAttribute('data-module');
            cb.checked = !!st.modules[key];
        });
    }
    renderStatsReportPreview();
}

function renderStatsReportPreview() {
    const preview = document.getElementById('statsReportPreview');
    if (!preview) return;
    const filters = getStatsFiltersFromUI();
    const dataset = getStatsDataset(history, filters);
    const st = getStatsReportState();
    const amountEl = document.getElementById('statsReportShowAmount');
    st.showAmount = amountEl ? !!amountEl.checked : !!st.showAmount;


    if (!dataset || !dataset.filteredRecords || dataset.filteredRecords.length === 0) {
        preview.innerHTML = '<p class="text-gray">当前统计条件暂无可生成的时光报告。</p>';
        return;
    }

    function money(v) {
        return st.showAmount ? formatMoney(v) : '¥***';
    }
    function getReportThemeColors() {
        var preset = {
            classic: { bg: '#fdfdfd', text: '#2d3748', accent: '#4a5568', title: '#2d3748', divider: '#cbd5e0', borderRadius: 0 },
            modern: { bg: '#ffffff', text: '#2c3e50', accent: '#2563eb', title: '#2c3e50', divider: '#cbd5e0', borderRadius: 0 },
            warm: { bg: '#fff7ed', text: '#9a3412', accent: '#fb923c', title: '#92400e', divider: '#fed7aa', borderRadius: 0 },
            dark: { bg: '#1a1a2e', text: '#e2e8f0', accent: '#fbbf24', title: '#e2e8f0', divider: '#475569', borderRadius: 0 },
            nature: { bg: '#f6fdf7', text: '#2f855a', accent: '#48bb78', title: '#15803d', divider: '#c6f6d5', borderRadius: 0 },
            vintage: { bg: '#f8f0e3', text: '#5c1a1a', accent: '#8b3e2f', title: '#5c1a1a', divider: '#c89b6e', borderRadius: 0 },
            sakura: { bg: '#fef7fb', text: '#4a5568', accent: '#be185d', title: '#be185d', divider: '#fecdd3', borderRadius: 0 },
            iceBlue: { bg: '#f0f9ff', text: '#1f2933', accent: '#0284c7', title: '#075985', divider: '#bae6fd', borderRadius: 0 }
        };
        var stateThemeId = (st && st.themeId) ? st.themeId : 'follow';
        var themeId = stateThemeId === 'follow'
            ? ((defaultSettings && defaultSettings.receiptCustomization && defaultSettings.receiptCustomization.theme) || 'classic')
            : stateThemeId;
        if (defaultSettings && defaultSettings.customThemes && defaultSettings.customThemes[themeId]) {
            var t = defaultSettings.customThemes[themeId];
            return {
                bg: t.bg || '#fff7ed',
                text: t.text || '#222',
                accent: t.accent || '#2563eb',
                title: t.title || t.text || '#222',
                divider: t.divider || 'rgba(0,0,0,.16)',
                borderRadius: isFinite(t.borderRadius) ? Number(t.borderRadius) : 12
            };
        }
        return preset[themeId] || preset.classic;
    }
    const role = (defaultSettings && defaultSettings.artistInfo && defaultSettings.artistInfo.role) ? String(defaultSettings.artistInfo.role) : '美工';
    const reportTitle = role === '画师' ? '你的绘图时光' : '你的设计时光';
    const userId = (defaultSettings && defaultSettings.artistInfo && defaultSettings.artistInfo.id) ? String(defaultSettings.artistInfo.id) : '你';
    const periodLabel = getStatsReportPeriodLabel(filters);
    const reportTheme = getReportThemeColors();
    // 获取与小票一致的字体设置
    const fontSettings = defaultSettings && defaultSettings.receiptCustomization && defaultSettings.receiptCustomization.fontSettings ? defaultSettings.receiptCustomization.fontSettings : {};
    const reportFontFamily = fontSettings.fontFamily ? String(fontSettings.fontFamily) : 'Source Han Sans SC, Noto Sans SC, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif';
    // 读取用户通过滑杆设置的字体大小
    const fontSizeEl = document.getElementById('statsReportFontSize');
    const reportFontSize = fontSizeEl ? fontSizeEl.value + 'rem' : (fontSettings.fontSize ? fontSettings.fontSize + 'px' : '1.2rem');
    const reportFontWeight = fontSettings.fontWeight ? fontSettings.fontWeight : 'normal';
    const reportLineHeight = '1.8'; // 固定行间距和段间距相同
    const reportLetterSpacing = fontSettings.letterSpacing ? fontSettings.letterSpacing : '.01em';

    // 随机文案
    const subheadings = [
        '这不是一张报表，是你这段时间被信任的证明。',
        '你交付的不只是制品，也是被看见的专业。',
        '把热爱变成作品的每一天，都值得被记录。',
        '每一份作品，都是你对专业的坚持与热爱。',
        '这段时光里，你的每一份努力都在被看见。',
        '专业的态度，让每一份委托都成为精品。'
    ];

    // 获取最受欢迎的主力制品及其数量
    let topProduct = '这份托付';
    let topProductCount = 0;
    if (dataset.byProduct && dataset.byProduct.length > 0) {
        topProduct = dataset.byProduct[0].productName || '这份托付';
        topProductCount = dataset.byProduct[0].count || 0;
    }
    const records = dataset.filteredRecords || [];
    let maxOrder = null;
    records.forEach(function (item) {
        const amt = getStatsAmount(item, filters.amountBasis, filters.giftMode);
        if (!maxOrder || amt > maxOrder.amount) maxOrder = { amount: amt, client: item.clientId || '匿名单主' };
    });

    function formatMonthLabel(monthStr) {
        if (!monthStr || typeof monthStr !== 'string') return monthStr || '-';
        var parts = monthStr.split('-');
        if (parts.length >= 2) {
            var y = parts[0];
            var m = String(parseInt(parts[1], 10) || parts[1]);
            return y + '年' + m + '月';
        }
        return monthStr;
    }
    function formatDateLabel(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return dateStr || '-';
        var parts = dateStr.split('-');
        if (parts.length >= 3) {
            var y = parts[0];
            var m = String(parseInt(parts[1], 10) || parts[1]);
            var d = String(parseInt(parts[2], 10) || parts[2]);
            return y + '年' + m + '月' + d + '日';
        }
        return dateStr;
    }

    let busyUnitLabel = '一天';
    let busyUnitPrefix = '天';
    let busyPeriodLabel = '-';
    let busyOrderCount = 0;
    let busyItemDone = 0;
    if (filters.timeRange === 'thisYear') {
        busyUnitLabel = '一月';
        busyUnitPrefix = '月';
        (dataset.monthlyAgg || []).forEach(function (r) {
            if (!busyOrderCount || r.orders > busyOrderCount) {
                busyOrderCount = r.orders || 0;
                busyItemDone = r.itemDone || 0;
                busyPeriodLabel = formatMonthLabel(r.month || '-');
            }
        });
    } else if (filters.timeRange === 'all') {
        busyUnitLabel = '一年';
        busyUnitPrefix = '年';
        const yearMap = {};
        (dataset.dailyAgg || []).forEach(function (d) {
            const y = (d.date || '').slice(0, 4) || '未知';
            if (!yearMap[y]) yearMap[y] = { orders: 0, itemDone: 0 };
            yearMap[y].orders += d.orders || 0;
            yearMap[y].itemDone += d.itemDone || 0;
        });
        Object.keys(yearMap).forEach(function (y) {
            if (!busyOrderCount || yearMap[y].orders > busyOrderCount) {
                busyOrderCount = yearMap[y].orders;
                busyItemDone = yearMap[y].itemDone;
                busyPeriodLabel = y + '年';
            }
        });
    } else {
        (dataset.dailyAgg || []).forEach(function (r) {
            if (!busyOrderCount || r.orders > busyOrderCount) {
                busyOrderCount = r.orders || 0;
                busyItemDone = r.itemDone || 0;
                busyPeriodLabel = formatDateLabel(r.date || '-');
            }
        });
    }

    const nowRevenue = dataset.totals.revenueTotal || 0;
    const range = getStatsDateRange(filters);
    let prevFilters = Object.assign({}, filters);
    if (filters.timeRange === 'thisMonth') {
        let y = filters.viewYear, m = filters.viewMonth - 1;
        if (m < 0) { m = 11; y -= 1; }
        prevFilters.viewYear = y; prevFilters.viewMonth = m;
    } else if (filters.timeRange === 'thisYear') {
        prevFilters.viewYear = filters.viewYear - 1;
    }
    const prevDataset = getStatsDataset(history, prevFilters);
    const prevRevenue = prevDataset && prevDataset.totals ? (prevDataset.totals.revenueTotal || 0) : 0;
    let change = 0;
    if (prevRevenue > 0) change = ((nowRevenue - prevRevenue) / prevRevenue) * 100;
    const trendWord = change > 0.1 ? '增长' : (change < -0.1 ? '放缓' : '持平');
    
    // 根据数据情况生成个性化收尾句
    let closingLines = [];
    if (change > 10) {
        closingLines = [
            '你的努力，正在以肉眼可见的速度成长。',
            '这样的增长势头，未来可期。',
            '保持这样的节奏，你会越来越好。'
        ];
    } else if (change > 0) {
        closingLines = [
            '稳步前进的每一步，都在积累你的专业价值。',
            '持续增长的背后，是你对专业的坚持。',
            '每一点进步，都值得被肯定。'
        ];
    } else if (change > -10) {
        closingLines = [
            '调整节奏，厚积薄发，未来会更好。',
            '暂时的放缓，是为了更好的突破。',
            '保持热爱，坚持专业，一切都会好起来。'
        ];
    } else {
        closingLines = [
            '低谷只是暂时的，专业的你一定会反弹。',
            '沉淀期也是成长的一部分，相信自己。',
            '重新出发，你会发现新的机会。'
        ];
    }
    
    // 添加通用收尾句
    closingLines = closingLines.concat([
        '这份成绩单，记录了你被信任的每一天。',
        '下一段时间，继续把热爱做成作品。',
        '专业的路上，每一步都值得被铭记。',
        '你的努力，终会成为最亮眼的成绩。',
        '保持热爱，继续创造更多精彩。'
    ]);
    
    const randomSubheading = subheadings[Math.floor(Math.random() * subheadings.length)];
    const randomClosingLine = closingLines[Math.floor(Math.random() * closingLines.length)];

    let html = '';
    html += '<div id="statsReportExportArea" style="background:' + reportTheme.bg + ';border-radius:0;padding:60px 50px;color:' + reportTheme.text + ';font-family:' + reportFontFamily + ';font-size:' + reportFontSize + ';font-weight:' + reportFontWeight + ';line-height:' + reportLineHeight + ';letter-spacing:' + reportLetterSpacing + ';max-width:800px;margin:0 auto;">';
    html += '<style>@media (max-width: 768px) { #statsReportExportArea { padding: 40px 30px !important; } }</style>';
    // 确保段落间距一致
    html += '<style>p { margin: 8px 0 !important; line-height: ' + reportLineHeight + ' !important; }</style>';
    html += '  <div style="font-size:.72rem;color:' + reportTheme.accent + ';letter-spacing:.08em;">TIME REPORT</div>';
    html += '  <div style="font-size:1.28rem;font-weight:700;margin-top:4px;color:' + reportTheme.title + ';">' + reportTitle + '</div>';
    html += '  <div style="color:' + reportTheme.text + ';opacity:.8;font-size:.84rem;margin-top:6px;">@' + escapeHtml(userId) + ' · ' + escapeHtml(periodLabel) + '</div>';
    html += '  <div style="height:1px;background:' + reportTheme.divider + ';margin:14px 0 16px 0;"></div>';

    if (st.modules.opening) {
        html += '<p>' + randomSubheading + '</p>';
    }
    if (st.modules.kpi) {
        html += '<p>这段时间，你接受了<span style="font-size:1.1em;font-weight:700;">' + (dataset.totals.orderCount || 0) + '</span>单委托，已完成<span style="font-size:1.1em;font-weight:700;">' + (dataset.totals.orderSettledCount || 0) + '</span>单委托，累计交付<span style="font-size:1.1em;font-weight:700;">' + (dataset.totals.itemDone || 0) + '</span>个制品。</p>';
    }
    if (st.modules.busy) {
        html += '<p>你最忙的' + busyUnitLabel + '是<span style="font-weight:700;">' + escapeHtml(busyPeriodLabel) + '</span>，当' + busyUnitPrefix + '处理了<span style="font-weight:700;">' + busyOrderCount + '</span>单，完成了<span style="font-weight:700;">' + busyItemDone + '</span>个制品。</p>';
    }
    if (st.modules.topProduct) {
        let topProductText = '';
        if (topProductCount > 0) {
            // 根据数量生成不同的文案
            if (topProductCount === 1) {
                topProductText = '<span style="font-weight:700;">' + escapeHtml(topProduct) + '</span>，是你这期最受欢迎的主力制品，共完成了<span style="font-weight:700;">' + topProductCount + '</span>件。';
            } else if (topProductCount < 5) {
                topProductText = '<span style="font-weight:700;">' + escapeHtml(topProduct) + '</span>，是你这期最受欢迎的主力制品，共完成了<span style="font-weight:700;">' + topProductCount + '</span>件。';
            } else if (topProductCount < 10) {
                topProductText = '<span style="font-weight:700;">' + escapeHtml(topProduct) + '</span>，是你这期的爆款制品，共完成了<span style="font-weight:700;">' + topProductCount + '</span>件，深受单主喜爱。';
            } else {
                topProductText = '<span style="font-weight:700;">' + escapeHtml(topProduct) + '</span>，是你这期的超级爆款，共完成了<span style="font-weight:700;">' + topProductCount + '</span>件，展现了你的专业实力。';
            }
        } else {
            topProductText = '<span style="font-weight:700;">' + escapeHtml(topProduct) + '</span>，是你这期最受欢迎的主力制品。';
        }
        html += '<p>' + topProductText + '</p>';
    }
    if (st.modules.aov) {
        html += '<p>你的平均客单价为<span style="font-size:1.1em;font-weight:700;color:' + reportTheme.accent + ';">' + money(dataset.totals.aov || 0) + '</span>，每一单都在稳稳沉淀价值。</p>';
    }
    if (st.modules.revenue) {
        html += '<p>这段时间，你累计营收<span style="font-size:1.1em;font-weight:700;color:' + reportTheme.accent + ';">' + money(nowRevenue) + '</span>。</p>';
        if (maxOrder) {
            html += '<p>你本期最高单笔金额是<span style="font-weight:700;">' + money(maxOrder.amount) + '</span>。</p>';
        }
        if (prevRevenue > 0) {
            html += '<p>相比上期，营收' + trendWord + '<span style="font-weight:700;">' + Math.abs(change).toFixed(1) + '%</span>，你的节奏正在被看见。</p>';
        }
    }
    if (st.modules.closing) {
        html += '<p style="padding-top:8px;border-top:1px dashed rgba(0,0,0,.16);color:#666;">' + randomClosingLine + '</p>';
    }

    html += '</div>';

    preview.innerHTML = html;
}

function saveStatsReportAsImage() {
    const exportArea = document.getElementById('statsReportExportArea');
    if (!exportArea) return;
    if (typeof html2canvas !== 'function') {
        alert('未检测到截图能力，请稍后重试');
        return;
    }
    html2canvas(exportArea, {
        backgroundColor: null,
        scale: Math.max(2, window.devicePixelRatio || 1),
        useCORS: true
    }).then(function (canvas) {
        const filename = '时光报告-' + new Date().toISOString().slice(0, 10) + '.png';
        // 更精确地区分"手机/平板"与"桌面端"
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
        const isMobile = isTouchDevice && window.innerWidth <= 768;
        
        if (isMobile) {
            // 手机端：直接触发系统分享，用户在分享界面选"保存图片"即可
            canvas.toBlob(async function (blob) {
                const file = new File([blob], filename, { type: 'image/png' });
                
                // 检查是否支持分享文件
                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({ files: [file], title: '时光报告' });
                        // 分享成功（用户选择了保存或发送）
                        showGlobalToast('时光报告图片保存成功');
                    } catch (err) {
                        // 用户取消分享，不做任何提示
                        if (err.name !== 'AbortError') {
                            // 其他错误，尝试直接下载
                            triggerDownload(canvas.toDataURL('image/png'), filename);
                            showGlobalToast('时光报告图片保存成功');
                        }
                    }
                } else {
                    // 不支持分享，直接下载（图片会存到"下载"文件夹）
                    triggerDownload(canvas.toDataURL('image/png'), filename);
                    showGlobalToast('时光报告图片保存成功');
                }
            }, 'image/png');
        } else {
            // 桌面端：直接下载
            triggerDownload(canvas.toDataURL('image/png'), filename);
            showGlobalToast('时光报告图片保存成功');
        }
    }).catch(function (e) {
        console.error('保存时光报告失败:', e);
        alert('保存失败，请重试');
    });
}

function exportStatsToExcel() {
    const f = getStatsFiltersFromUI();
    const dataset = getStatsDataset(history, f);
    if (dataset.filteredRecords.length === 0) {
        alert('当前筛选下暂无数据可导出');
        return;
    }
    try {
        const XLSX = window.XLSX;
        if (!XLSX) { alert('请确保已加载 xlsx 库'); return; }
        const wb = XLSX.utils.book_new();
        const summary = [
            ['统计汇总'],
            ['时间口径', f.timeBasis === 'deadline' ? '按截稿日' : '按记录时间'],
            ['订单数', dataset.totals.orderCount],
            ['总收入', dataset.totals.revenueTotal],
            ['客单价', dataset.totals.aov],
            ['制品项总数', dataset.totals.itemTotal],
            ['制品项完成率(%)', dataset.totals.itemDoneRate],
            ['制品全完成订单数', dataset.totals.orderDoneCount],
            ['制品全完成率(%)', dataset.totals.orderDoneRate],
            ['逾期订单数', dataset.totals.overdueOrderCount],
            ['曾经逾期订单数', dataset.totals.everOverdueOrderCount ?? 0],
            ['已结算订单数', dataset.totals.orderSettledCount || 0],
            ['订单完结率(%)', dataset.totals.orderSettledRate || 0],
            ['撤单数', dataset.totals.cancelOrderCount || 0],
            ['撤单费合计', dataset.totals.cancelAmountTotal || 0],
            ['废稿数', dataset.totals.wasteOrderCount || 0],
            ['废稿费合计', dataset.totals.wasteAmountTotal || 0],
            ['其他费用合计', dataset.totals.totalOtherFeesSum || 0],
            ['平台费合计', dataset.totals.totalPlatformFeeSum || 0]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), '汇总');
        var statusData = [['状态', '订单数', '金额合计']];
        (dataset.byStatus || []).forEach(function (row) {
            if (row.orderCount > 0 || row.amountTotal > 0) statusData.push([row.status, row.orderCount, row.amountTotal]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(statusData), '按状态分组');
        if (dataset.byUsage && dataset.byUsage.length > 0) {
            var usageData = [['用途', '订单数', '金额合计']];
            dataset.byUsage.forEach(function (row) { usageData.push([row.name, row.orderCount, row.amountTotal]); });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(usageData), '按用途');
        }
        if (dataset.byUrgent && dataset.byUrgent.length > 0) {
            var urgentData = [['加急', '订单数', '金额合计']];
            dataset.byUrgent.forEach(function (row) { urgentData.push([row.name, row.orderCount, row.amountTotal]); });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(urgentData), '按加急');
        }
        if (dataset.byProcess && dataset.byProcess.length > 0) {
            var processData = [['工艺', '出现次数', '费用合计']];
            dataset.byProcess.forEach(function (row) { processData.push([row.name, row.count, row.feeTotal]); });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(processData), '按工艺');
        }
        const clientData = [['单主ID', '订单数', '总金额']];
        dataset.byClient.forEach(c => { clientData.push([c.clientId, c.orderCount, c.revenueTotal]); });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(clientData), 'Top单主');
        const productData = [['制品名', '次数', '金额贡献']];
        dataset.byProduct.forEach(p => { productData.push([p.productName, p.count, p.revenueTotal]); });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(productData), 'Top制品');
        var discountByReason = dataset.totals && dataset.totals.discountByReason && typeof dataset.totals.discountByReason === 'object' ? dataset.totals.discountByReason : {};
        var discountRows = Object.values(discountByReason).filter(function (r) { return r && (r.orderCount > 0 || r.amountTotal > 0); });
        if (discountRows.length > 0) {
            var discountData = [['折扣原因', '单数', '优惠金额']];
            discountRows.forEach(function (r) { discountData.push([r.name || '—', r.orderCount || 0, r.amountTotal != null ? Number(r.amountTotal) : 0]); });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(discountData), '按折扣原因');
        }
        const date = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, '统计_' + date + '.xlsx');
    } catch (e) {
        console.error(e);
        alert('导出失败：' + (e.message || e));
    }
}

// 打开计算抽屉；skipOrderTimeReset 为 true 时不重置下单时间（用于编辑加载历史记录）
function openCalculatorDrawer(skipOrderTimeReset) {
    const drawer = document.getElementById('calculatorDrawer');
    if (!drawer) return;

    // 下单时间与备注：新建时清空，不填的默认为小票保存时间；编辑模式由 editHistoryItem 填充
    if (!skipOrderTimeReset) {
        var orderTimeInput = document.getElementById('orderTimeInput');
        if (orderTimeInput) orderTimeInput.value = '';
        if (defaultSettings) defaultSettings.orderRemark = '';
        var orderRemarkTextEl = document.getElementById('orderRemarkText');
        if (orderRemarkTextEl) orderRemarkTextEl.value = '';
        if (typeof updateOrderRemarkPreview === 'function') updateOrderRemarkPreview();
    }

    // 每次打开时刷新计算页的选择器与系数
    updateCalculatorBuiltinSelects();
    updateCalculatorCoefficientSelects();
    if (typeof toggleOrderPlatformClear === 'function') toggleOrderPlatformClear();

    drawer.classList.add('open');
    isCalculatorOpen = true;

    // 编辑模式下显示「保存」按钮（弹窗选择覆盖/新单）
    var isEdit = !!window.editingHistoryId;
    var saveBtn = document.getElementById('calculatorSaveBtn');
    if (saveBtn) saveBtn.classList.toggle('d-none', !isEdit);
}

// 关闭计算抽屉
function closeCalculatorDrawer() {
    const drawer = document.getElementById('calculatorDrawer');
    if (!drawer) return;
    drawer.classList.remove('open');
    isCalculatorOpen = false;
}

// 添加制品项
function addProduct() {
    productIdCounter++;
    // 创建制品对象，不默认选择制品类型
    const product = {
        id: productIdCounter,
        // 不默认选择制品类型，让用户手动选择
        type: '',
        sides: 'single',
        quantity: 1,
        sameModel: true, // 默认同模为是
        hasBackground: false,
        processes: {}
    };
    
    products.push(product);
    renderProduct(product);
}

// 渲染赠品项
function renderGift(gift) {
    const container = document.getElementById('giftsContainer');
    const giftElement = document.createElement('div');
    giftElement.className = 'product-item';
    giftElement.dataset.id = gift.id;
    
    // 查找当前选中的制品类型名称
    let selectedProductName = '';
    if (gift.type) {
        const selectedSetting = productSettings.find(setting => setting.id.toString() === gift.type);
        if (selectedSetting) {
            selectedProductName = selectedSetting.name;
        }
    }
    
    giftElement.innerHTML = `
        <div class="product-item-header">
            <div class="product-item-title">赠品 ${gift.id}</div>
            <button class="icon-action-btn delete" onclick="removeGift(${gift.id})" aria-label="删除赠品" title="删除">
                <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
            </button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>制品类型</label>
                <div id="giftTypeSelect-${gift.id}"></div>
            </div>
            <div class="form-group">
                <label for="giftQuantity-${gift.id}">数量</label>
                <div class="process-layers-stepper-wrap">
                    <button type="button" class="process-layers-stepper-btn" aria-label="减一" onclick="adjustGiftQuantity(${gift.id}, -1)">−</button>
                    <input type="number" id="giftQuantity-${gift.id}" class="process-layers-stepper-input" value="${gift.quantity}" min="1" onchange="var v = Math.max(1, parseInt(this.value) || 1); this.value = v; updateGift(${gift.id}, 'quantity', v)">
                    <button type="button" class="process-layers-stepper-btn" aria-label="加一" onclick="adjustGiftQuantity(${gift.id}, 1)">+</button>
                </div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="giftSameModel-${gift.id}">是否同模</label>
                <select id="giftSameModel-${gift.id}" onchange="updateGift(${gift.id}, 'sameModel', this.value === 'true')">
                    <option value="false" ${gift.sameModel ? '' : 'selected'}>否</option>
                    <option value="true" ${gift.sameModel ? 'selected' : ''}>是</option>
                </select>
            </div>
            <div class="form-group">
                <label for="giftHasBackground-${gift.id}">是否需要背景</label>
                <select id="giftHasBackground-${gift.id}" onchange="updateGift(${gift.id}, 'hasBackground', this.value === 'true')">
                    <option value="false" ${gift.hasBackground ? '' : 'selected'}>否</option>
                    <option value="true" ${gift.hasBackground ? 'selected' : ''}>是</option>
                </select>
            </div>
        </div>
        <div id="giftFormOptions-${gift.id}"></div>
        <div class="form-row">
            <div class="form-group">
                <label>工艺类型</label>
                <div id="giftProcessOptions-${gift.id}"></div>
            </div>
        </div>
    `;
    
    container.appendChild(giftElement);
    
    // 初始化制品类型搜索下拉组件
    const giftTypeOptions = productSettings.map(setting => ({
        value: setting.id.toString(),
        label: setting.name
    }));
    createSearchableSelect(
        `giftTypeSelect-${gift.id}`,
        giftTypeOptions,
        '选择或搜索制品类型',
        function(value, label) {
            updateGiftType(gift.id, label);
            updateGiftForm(gift.id);
        },
        gift.type
    );
    
    // 更新赠品表单选项
    updateGiftForm(gift.id);
    // 更新工艺选项
    updateProcessOptions(gift.id, true);
}

// 添加赠品项
function addGift() {
    giftIdCounter++;
    // 创建赠品对象，不默认选择制品类型
    const gift = {
        id: giftIdCounter,
        // 不默认选择制品类型，让用户手动选择
        type: '',
        sides: 'single',
        quantity: 1,
        sameModel: true, // 默认同模为是
        hasBackground: false, // 默认不需要背景
        processes: {}
    };
    
    gifts.push(gift);
    renderGift(gift);
}

// 渲染制品项
function renderProduct(product) {
    const container = document.getElementById('productsContainer');
    const productElement = document.createElement('div');
    productElement.className = 'product-item';
    productElement.dataset.id = product.id;
    
    productElement.innerHTML = `
        <div class="product-item-header">
            <div class="product-item-title">制品 ${product.id}</div>
            <button class="icon-action-btn delete" onclick="removeProduct(${product.id})" aria-label="删除制品" title="删除">
                <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                <span class="sr-only">删除</span>
            </button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>制品类型</label>
                <div id="productTypeSelect-${product.id}"></div>
            </div>
            <div class="form-group">
                <label for="productQuantity-${product.id}">制品数</label>
                <div class="process-layers-stepper-wrap">
                    <button type="button" class="process-layers-stepper-btn" aria-label="减一" onclick="adjustProductQuantity(${product.id}, -1)">−</button>
                    <input type="number" id="productQuantity-${product.id}" class="process-layers-stepper-input" value="${product.quantity}" min="1" onchange="var v = Math.max(1, parseInt(this.value) || 1); this.value = v; updateProduct(${product.id}, 'quantity', v)">
                    <button type="button" class="process-layers-stepper-btn" aria-label="加一" onclick="adjustProductQuantity(${product.id}, 1)">+</button>
                </div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="productSameModel-${product.id}">是否同模</label>
                <select id="productSameModel-${product.id}" onchange="updateProduct(${product.id}, 'sameModel', this.value === 'true')">
                    <option value="false" ${product.sameModel ? '' : 'selected'}>否</option>
                    <option value="true" ${product.sameModel ? 'selected' : ''}>是</option>
                </select>
            </div>
            <div class="form-group">
                <label for="productHasBackground-${product.id}">是否需要背景</label>
                <select id="productHasBackground-${product.id}" onchange="updateProduct(${product.id}, 'hasBackground', this.value === 'true')">
                    <option value="false" ${product.hasBackground ? '' : 'selected'}>否</option>
                    <option value="true" ${product.hasBackground ? 'selected' : ''}>是</option>
                </select>
            </div>
        </div>
        <div id="formOptions-${product.id}"></div>
        <div class="form-row">
            <div class="form-group">
                <label>工艺类型</label>
                <div id="processOptions-${product.id}"></div>
            </div>
        </div>
    `;
    
    container.appendChild(productElement);
    
    // 初始化制品类型搜索下拉组件
    const productTypeOptions = productSettings.map(setting => ({
        value: setting.id.toString(),
        label: setting.name
    }));
    createSearchableSelect(
        `productTypeSelect-${product.id}`,
        productTypeOptions,
        '选择或搜索制品类型',
        function(value, label) {
            updateProductType(product.id, label);
            updateProductForm(product.id);
        },
        product.type
    );
    
    // 更新产品表单选项
    updateProductForm(product.id);
    // 更新工艺选项
    updateProcessOptions(product.id);
}

// 更新产品表单选项
function updateProductForm(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const container = document.getElementById(`formOptions-${productId}`);
    const productSetting = productSettings.find(p => p.id === parseInt(product.type));
    
    if (!productSetting) {
        container.innerHTML = '<p>请先选择制品类型</p>';
        return;
    }
    
    let html = '';
    
    switch (productSetting.priceType) {
        case 'fixed':
            html = `<div class="form-row"><div class="form-group"><label>固定价格：¥${productSetting.price}</label></div></div>`;
            break;
            
        case 'double':
            html = `
                <div class="form-row">
                    <div class="form-group">
                        <label for="productSides-${productId}">单双面</label>
                        <select id="productSides-${productId}" onchange="updateProduct(${productId}, 'sides', this.value)">
                            <option value="single" ${product.sides === 'single' ? 'selected' : ''}>单面 (¥${productSetting.priceSingle})</option>
                            <option value="double" ${product.sides === 'double' ? 'selected' : ''}>双面 (¥${productSetting.priceDouble})</option>
                        </select>
                    </div>
                </div>
            `;
            break;
            
        case 'config':
            // 兼容旧格式：如果没有additionalConfigs，使用旧的单配置格式
            const additionalConfigs = productSetting.additionalConfigs || [];
            if (additionalConfigs.length === 0 && productSetting.additionalPrice) {
                // 兼容旧格式
                additionalConfigs.push({
                    name: productSetting.additionalUnit || '配置',
                    price: productSetting.additionalPrice,
                    unit: productSetting.additionalUnit || '个'
                });
            }
            
            html = `
                <div class="form-row">
                    <div class="form-group incremental-config-group">
                        <label>基础+递增价</label>
                        <div class="incremental-config-base">
                            <span>基础价 (${productSetting.baseConfig})：¥${productSetting.basePrice}</span>
                        </div>
                        ${additionalConfigs.map((config, index) => {
                            const configKey = `config_${productId}_${index}`;
                            const currentValue = product.additionalConfigs && product.additionalConfigs[configKey] ? product.additionalConfigs[configKey] : 0;
                            return `
                                <div class="incremental-config-item">
                                    <span class="incremental-config-label">+${config.name} (¥${config.price})</span>
                                    <div class="process-layers-stepper-wrap">
                                        <button type="button" class="process-layers-stepper-btn" aria-label="减一" onclick="adjustProductAdditionalConfig(${productId}, '${configKey}', -1)">−</button>
                                        <input type="number" id="${configKey}" value="${currentValue}" min="0" step="1" 
                                               onchange="var v = Math.max(0, parseInt(this.value) || 0); this.value = v; updateProductAdditionalConfig(${productId}, '${configKey}', v)" 
                                               class="process-layers-stepper-input">
                                        <button type="button" class="process-layers-stepper-btn" aria-label="加一" onclick="adjustProductAdditionalConfig(${productId}, '${configKey}', 1)">+</button>
                                    </div>
                                    <span class="incremental-config-unit">${config.unit}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
            break;
            
        case 'nodes':
            // 按节点收费：当前单独立维护一份节点列表，默认拷贝自设置，可在前台增删节点（只影响当前单）
            const baseNodes = productSetting.nodes || [];
            if (!Array.isArray(product.nodes) || product.nodes.length === 0) {
                product.nodes = baseNodes.map(function (n) {
                    return { name: n.name, percent: n.percent };
                });
            }
            const nodes = product.nodes || [];
            const totalPrice = (product.nodeTotalPrice != null && product.nodeTotalPrice !== '') ? product.nodeTotalPrice : (productSetting.price || '');
            const nodePercents = (product.nodePercents && product.nodePercents.length === nodes.length)
                ? product.nodePercents
                : nodes.map(function (n) { return n.percent; });
            const totalNum = parseFloat(totalPrice) || 0;
            html = `
                <div class="form-row">
                    <div class="form-group">
                        <label for="productNodeTotalPrice-${productId}">总价（元）</label>
                        <input type="number" id="productNodeTotalPrice-${productId}" value="${totalPrice}" min="0" step="1" 
                               onchange="updateProduct(${productId}, 'nodeTotalPrice', this.value); updateProductForm(${productId})" 
                               placeholder="填写总价">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group flex-1 node-percents-group">
                        <label>节点比例（可直接修改，比例之和建议 100%）</label>
                        ${nodes.map((node, idx) => {
                            const pct = nodePercents[idx] != null ? nodePercents[idx] : node.percent;
                            const amount = totalNum > 0 ? (totalNum * (pct / 100)).toFixed(2) : '—';
                            return `
                                <div class="node-percent-row d-flex gap-2 mb-2 items-center p-2 bg-light rounded">
                                    <span class="node-percent-name">${(node.name || '节点').replace(/</g, '&lt;')}</span>
                                    <input type="number" value="${pct}" min="0" max="100" step="1" style="width: 70px;"
                                           onchange="updateProductNodePercent(${productId}, ${idx}, parseFloat(this.value) || 0); updateProductForm(${productId})">
                                    <span class="text-gray">%</span>
                                    <span class="node-percent-amount text-gray">¥${amount}</span>
                                    <button type="button" class="icon-action-btn delete" onclick="removeProductNodeInstance(${productId}, ${idx})" aria-label="删除节点" title="删除节点">
                                        <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除节点</span>
                                    </button>
                                </div>
                            `;
                        }).join('')}
                        ${nodes.length ? '<p class="text-gray text-sm mt-1">比例之和：<span id="productNodePercentsSum-' + productId + '">' + (nodePercents.reduce((s, p) => s + (parseFloat(p) || 0), 0)) + '</span>%</p>' : '<p class="text-gray text-sm">请在设置页为该制品配置节点</p>'}
                        <button type="button" class="btn secondary small mt-2" onclick="addProductNodeInstance(${productId})">+ 添加节点</button>
                    </div>
                </div>
            `;
            break;
    }
    
    container.innerHTML = html;
    
    // 恢复之前展开的分类状态
    expandedCategories.forEach(category => {
        const content = document.getElementById(`${category}-content`);
        const toggle = content.parentElement.querySelector('.category-toggle');
        if (content && toggle) {
            content.classList.remove('d-none');
            toggle.textContent = '▲';
        }
    });
}

// 更新制品信息
function updateProduct(id, field, value) {
    const product = products.find(p => p.id === id);
    if (product) {
        // 确保值是字符串类型，避免类型转换问题
        product[field] = value;
    }
}

// 更新按节点收费制品的某节点比例
function updateProductNodePercent(productId, index, value) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const productSetting = productSettings.find(p => p.id === parseInt(product.type));
    const baseNodes = (product && Array.isArray(product.nodes) && product.nodes.length)
        ? product.nodes
        : (productSetting && productSetting.nodes) ? productSetting.nodes : [];
    if (!Array.isArray(product.nodePercents) || product.nodePercents.length !== baseNodes.length) {
        product.nodePercents = baseNodes.map(function (n) { return n.percent; });
    }
    product.nodePercents[index] = value;
}

// 按节点收费：当前单内添加一个节点（不修改设置，只影响本单）
function addProductNodeInstance(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const productSetting = productSettings.find(p => p.id === parseInt(product.type));
    const baseNodes = (productSetting && productSetting.nodes) ? productSetting.nodes : [];
    if (!Array.isArray(product.nodes) || product.nodes.length === 0) {
        product.nodes = baseNodes.map(function (n) {
            return { name: n.name, percent: n.percent };
        });
    }
    product.nodes.push({ name: '新节点', percent: 0 });
    // 同步扩展 nodePercents
    if (!Array.isArray(product.nodePercents)) {
        product.nodePercents = product.nodes.map(function (n) { return n.percent; });
    } else {
        product.nodePercents.push(0);
    }
    updateProductForm(productId);
}

// 按节点收费：当前单内删除一个节点（不修改设置，只影响本单）
function removeProductNodeInstance(productId, index) {
    const product = products.find(p => p.id === productId);
    if (!product || !Array.isArray(product.nodes) || !product.nodes[index]) return;
    if (!confirm('确定要删除该节点吗？')) return;
    product.nodes.splice(index, 1);
    if (Array.isArray(product.nodePercents) && product.nodePercents.length > index) {
        product.nodePercents.splice(index, 1);
    }
    updateProductForm(productId);
}

// 快捷增减制品数
function adjustProductQuantity(productId, delta) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const current = product.quantity || 1;
    const next = Math.max(1, current + delta);
    updateProduct(productId, 'quantity', next);
    const input = document.getElementById('productQuantity-' + productId);
    if (input) input.value = next;
}

// 更新制品额外配置数量
function updateProductAdditionalConfig(productId, configKey, value) {
    const product = products.find(p => p.id === productId);
    if (product) {
        if (!product.additionalConfigs) {
            product.additionalConfigs = {};
        }
        product.additionalConfigs[configKey] = value || 0;
    }
}

// 快捷增减递增数量（基础+递增价）
function adjustProductAdditionalConfig(productId, configKey, delta) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const current = (product.additionalConfigs && product.additionalConfigs[configKey]) ? product.additionalConfigs[configKey] : 0;
    const next = Math.max(0, current + delta);
    updateProductAdditionalConfig(productId, configKey, next);
    const input = document.getElementById(configKey);
    if (input) input.value = next;
}

// 更新制品类型
function updateProductType(id, productName) {
    const product = products.find(p => p.id === id);
    if (product) {
        // 根据制品名称查找对应的制品ID
        const productSetting = productSettings.find(setting => setting.name === productName);
        if (productSetting) {
            product.type = productSetting.id.toString();
        } else {
            // 如果找不到对应的制品类型，清空类型
            product.type = '';
        }
    }
}

// 删除制品项
function removeProduct(id) {
    if (!confirm('确定要删除该制品项吗？')) return;
    products = products.filter(p => p.id !== id);
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.remove();
}

// 计算价格；saveAsNew 为 true 时：另存新单（不覆盖原记录）；skipReceipt 为 true 时：覆盖保存原订单，均不打开小票；openSaveChoiceModal 为 true 时：仅计算并弹出保存方式选择弹窗；onlyRefreshDisplay 为 true 时：仅刷新报价显示（不关抽屉、不打开小票）
function calculatePrice(saveAsNew, skipReceipt, openSaveChoiceModal, onlyRefreshDisplay) {
    // 获取单主信息（支持自动生成单主ID：YYYYMMDDXNN）
    const clientIdInputEl = document.getElementById('clientId');
    let clientIdValue = clientIdInputEl ? clientIdInputEl.value.trim() : '';
    let clientId;
    if (!clientIdValue) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const prefix = y + '' + m + '' + d + 'X';
        let maxSeq = 0;
        if (Array.isArray(history)) {
            history.forEach(item => {
                if (!item || !item.clientId || typeof item.clientId !== 'string') return;
                if (!item.clientId.startsWith(prefix)) return;
                const tail = item.clientId.slice(prefix.length);
                const n = parseInt(tail, 10);
                if (!isNaN(n) && n > maxSeq) maxSeq = n;
            });
        }
        const nextSeq = maxSeq + 1;
        const seqStr = String(nextSeq).padStart(2, '0');
        clientId = prefix + seqStr;
        if (clientIdInputEl) clientIdInputEl.value = clientId;
    } else {
        clientId = clientIdValue;
    }
    const deadline = document.getElementById('deadline').value;
    
    // 获取设置选项的类型（接单平台与平台手续费联动，platform 与 orderPlatform 已同步）
    const usageType = document.getElementById('usage').value;
    const urgentType = document.getElementById('urgent').value;
    const sameModelType = document.getElementById('sameModel').value;
    const discountType = document.getElementById('discount').value;
    const platformType = (document.getElementById('platform') && document.getElementById('platform').value) || '';
    const orderPlatformInput = document.getElementById('orderPlatform');
    const contactDisplay = (orderPlatformInput && orderPlatformInput.value) ? String(orderPlatformInput.value).trim() : '';
    const contactInfoEl = document.getElementById('contactInfo');
    const contactInfoValue = (contactInfoEl && contactInfoEl.value) ? String(contactInfoEl.value).trim() : '';
    
    // 计算其他费用总和
    const otherFeesTotal = Array.isArray(dynamicOtherFees) ? dynamicOtherFees.reduce((sum, fee) => sum + fee.amount, 0) : 0;
    const totalOtherFees = otherFeesTotal;
    
    if (products.length === 0) {
        alert('请添加至少一个制品！');
        return;
    }
    
    // 从默认设置中获取对应的系数值
    const usage = getCoefficientValue(defaultSettings.usageCoefficients[usageType]) || 1;
    const urgent = getCoefficientValue(defaultSettings.urgentCoefficients[urgentType]) || 1;
    const sameModelCoefficient = getCoefficientValue(defaultSettings.sameModelCoefficients[sameModelType]) || 0.5;
    const sameModelMode = defaultSettings.sameModelMode || 'coefficient';
    const sameModelMinusAmount = Number.isFinite(Number(defaultSettings.sameModelMinusAmount)) ? Math.max(0, Number(defaultSettings.sameModelMinusAmount)) : 0;
    const discount = getCoefficientValue(defaultSettings.discountCoefficients[discountType]) || 1;
    const platformFee = getCoefficientValue(defaultSettings.platformFees[platformType]) || 0;
    // 扩展加价类、折扣类的选中值
    let extraUpProduct = 1;
    const extraUpSelections = [];
    (defaultSettings.extraPricingUp || []).forEach(e => {
        const sel = document.getElementById('extraUp_' + e.id);
        if (sel && sel.value && e.options && e.options[sel.value] != null) {
            const option = e.options[sel.value];
            const value = getCoefficientValue(option) || 1;
            extraUpProduct *= value;
            extraUpSelections.push({
                id: e.id,
                selectedKey: sel.value,
                optionValue: sel.value,
                moduleName: e.name || '扩展加价系数',
                optionName: (option && option.name) ? option.name : sel.value,
                value: value
            });
        }
    });
    let extraDownProduct = 1;
    const extraDownSelections = [];
    (defaultSettings.extraPricingDown || []).forEach(e => {
        const sel = document.getElementById('extraDown_' + e.id);
        if (sel && sel.value && e.options && e.options[sel.value] != null) {
            const option = e.options[sel.value];
            const value = getCoefficientValue(option) || 1;
            extraDownProduct *= value;
            extraDownSelections.push({
                id: e.id,
                selectedKey: sel.value,
                optionValue: sel.value,
                moduleName: e.name || '扩展折扣系数',
                optionName: (option && option.name) ? option.name : sel.value,
                value: value
            });
        }
    });
    const pricingUpProduct = usage * urgent * extraUpProduct;
    const pricingDownProduct = discount * extraDownProduct;
    
    // 计算每个制品的价格
    const productPrices = [];
    let totalProductsPrice = 0;
    
    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        // 获取制品设置 - 修复类型转换问题
        const productType = product.type;
        // 检查是否选择了制品类型
        if (!productType || productType === '') {
            alert(`请为制品${i+1}选择制品类型！`);
            return;
        }
        
        const productTypeId = parseInt(productType);
        // 使用 == 进行比较，忽略类型差异
        const productSetting = productSettings.find(p => p.id == productTypeId);
        if (!productSetting) {
            alert(`制品${i+1}的制品类型无效，请重新选择！`);
            return;
        }
        
        // 计算基础价格
        let basePrice = 0;
        switch (productSetting.priceType) {
            case 'fixed':
                basePrice = productSetting.price;
                break;
            case 'double':
                basePrice = product.sides === 'single' ? productSetting.priceSingle : productSetting.priceDouble;
                break;
            case 'config':
                basePrice = productSetting.basePrice;
                break;
            case 'nodes':
                basePrice = (product.nodeTotalPrice != null && product.nodeTotalPrice !== '') ? parseFloat(product.nodeTotalPrice) : (productSetting.price || 0);
                if (!basePrice || isNaN(basePrice) || basePrice <= 0) {
                    alert(`制品${i+1}（${productSetting.name}）请填写总价！`);
                    return;
                }
                break;
        }
        
        // 计算额外配置（如果是基础+递增价类型）
        let additionalConfigDetails = [];
        if (productSetting.priceType === 'config') {
            const additionalConfigs = productSetting.additionalConfigs || [];
            
            if (additionalConfigs.length === 0 && productSetting.additionalPrice) {
                // 兼容旧格式：单配置
                const additionalCount = product.sides !== 'single' && product.sides !== 'double' ? parseInt(product.sides) - 1 : 0;
                if (additionalCount > 0) {
                    const total = additionalCount * productSetting.additionalPrice;
                    basePrice += total;
                    additionalConfigDetails.push({
                        name: productSetting.additionalUnit || '配置',
                        price: productSetting.additionalPrice,
                        unit: productSetting.additionalUnit || '个',
                        count: additionalCount,
                        total: total
                    });
                }
            } else {
                // 新格式：多配置
                if (product.additionalConfigs) {
                    additionalConfigs.forEach((config, index) => {
                        const configKey = `config_${product.id}_${index}`;
                        const count = product.additionalConfigs[configKey] || 0;
                        if (count > 0) {
                            const total = count * config.price;
                            basePrice += total;
                            additionalConfigDetails.push({
                                name: config.name,
                                price: config.price,
                                unit: config.unit,
                                count: count,
                                total: total
                            });
                        }
                    });
                }
            }
        }
        
        // 计算同模相关数据（按节点收费不参与同模）
        const sameModelCount = productSetting.priceType === 'nodes' ? 0 : (product.sameModel ? product.quantity - 1 : 0);
        const sameModelUnitPrice = (sameModelMode === 'minus') ? Math.max(0, basePrice - sameModelMinusAmount) : (basePrice * sameModelCoefficient);
        const sameModelTotal = sameModelCount * sameModelUnitPrice;
        
        // 计算背景费（按节点收费不参与背景费）
        let backgroundFee = 0;
        if (productSetting.priceType !== 'nodes' && product.hasBackground) {
            const backgroundFeePerProduct = defaultSettings.backgroundFee || 0;
            // 主制品全额背景费，同模制品应用同模系数
            const mainBackgroundFee = backgroundFeePerProduct;
            const sameModelBackgroundUnitPrice = backgroundFeePerProduct * sameModelCoefficient;
            const sameModelBackgroundTotal = sameModelCount * sameModelBackgroundUnitPrice;
            backgroundFee = mainBackgroundFee + sameModelBackgroundTotal;
        }
        
        // 计算工艺费用（按节点收费不参与工艺）
        let totalProcessFee = 0;
        let processDetails = [];
        if (productSetting.priceType !== 'nodes') {
        // 处理多选工艺
        if (product.processes) {
            Object.values(product.processes).forEach(processChoice => {
                const processSetting = processSettings.find(p => p.id === processChoice.id);
                if (processSetting) {
                    // 工艺价格（每层）
                    const processPricePerLayer = (processSetting.price ?? 10);
                    // 工艺层数
                    const processLayers = processChoice.layers || 1;
                    // 工艺单价 = 工艺价格（每层） * 层数
                    const processUnitPrice = processPricePerLayer * processLayers;
                    // 工艺总价 = 工艺单价 * 制品数量
                    const processFee = processUnitPrice * product.quantity;
                    totalProcessFee += processFee;
                    processDetails.push({
                        name: processSetting.name,
                        unitPrice: processUnitPrice,
                        layers: processLayers,
                        quantity: product.quantity,
                        fee: processFee
                    });
                }
            });
        }
        }
        
        // 计算制品总价
        // 非同模时：每件都按全价计费（basePrice * quantity）
        // 同模时：1件全价 + (quantity-1)件按同模价
        const baseProductTotal = sameModelCount > 0
            ? (basePrice + sameModelTotal)
            : (basePrice * product.quantity);
        const productTotal = baseProductTotal + totalProcessFee + backgroundFee;
        
        // 按节点收费：生成节点明细
        let nodeDetails = [];
        if (productSetting.priceType === 'nodes') {
            const nodeTotalPrice = basePrice;
            const qty = product.quantity || 1;
            const nodes = productSetting.nodes || [];
            const percents = (product.nodePercents && product.nodePercents.length === nodes.length) ? product.nodePercents : nodes.map(n => n.percent);
            nodes.forEach((node, idx) => {
                const percent = percents[idx] != null ? percents[idx] : node.percent;
                const amount = nodeTotalPrice * qty * (percent / 100);
                nodeDetails.push({ name: node.name || '节点', percent: percent, amount: amount });
            });
        }
        
        // 保存制品价格信息
        const productPriceInfo = {
            productIndex: i + 1,
            product: productSetting.name,
            category: productSetting.category || '其他', // 添加分类字段
            basePrice: basePrice,
            baseConfigPrice: productSetting.priceType === 'config' && productSetting.baseConfig ? (productSetting.basePrice || 0) : undefined,
            quantity: product.quantity,
            sameModelCount: sameModelCount,
            sameModelUnitPrice: sameModelUnitPrice,
            sameModelTotal: sameModelTotal,
            productTotal: productTotal,
            processDetails: processDetails,
            totalProcessFee: totalProcessFee,
            // 添加基础配置信息（如果是基础+递增价类型）
            productType: productSetting.priceType,
            baseConfig: productSetting.baseConfig,
            // 添加单双面价相关信息
            sides: product.sides,
            productId: productTypeId,
            // 保留兼容旧代码的字段
            selectedProcesses: [],
            totalProcessLayers: 0
        };
        
        // 如果是基础+递增价类型，保存额外配置详情
        if (productSetting.priceType === 'config') {
            productPriceInfo.additionalConfigDetails = additionalConfigDetails || [];
            // 兼容旧格式
            if (additionalConfigDetails.length === 0 && productSetting.additionalPrice) {
                const totalAdditionalCount = product.sides !== 'single' && product.sides !== 'double' ? parseInt(product.sides) - 1 : 0;
                productPriceInfo.totalAdditionalCount = totalAdditionalCount;
                productPriceInfo.additionalUnit = productSetting.additionalUnit;
                productPriceInfo.additionalPrice = productSetting.additionalPrice;
            }
        }
        
        // 对于单双面价类型，也要确保sides和productId信息被保存
        if (productSetting.priceType === 'double') {
            productPriceInfo.sides = product.sides;
            productPriceInfo.productId = productTypeId;
        }
        
        // 按节点收费：保存总价与节点明细
        if (productSetting.priceType === 'nodes') {
            productPriceInfo.nodeTotalPrice = basePrice;
            productPriceInfo.nodeDetails = nodeDetails;
        }
        // 制品日计划（排单用，可选）
        if (Array.isArray(product.dailyPlan) && product.dailyPlan.length > 0) {
            productPriceInfo.dailyPlan = product.dailyPlan.map(function (p) { return { date: p.date, targetQty: p.targetQty }; });
        }
        if (productSetting.priceType === 'nodes' && Array.isArray(product.nodeDailyPlan) && product.nodeDailyPlan.length > 0) {
            productPriceInfo.nodeDailyPlan = product.nodeDailyPlan.map(function (p) { return { nodeIndex: p.nodeIndex, date: p.date, targetQty: p.targetQty }; });
        }
        productPrices.push(productPriceInfo);
        
        totalProductsPrice += productTotal;
    }
    
    // 计算每个赠品的价格
    const giftPrices = [];
    let totalGiftsOriginalPrice = 0;
    
    for (let i = 0; i < gifts.length; i++) {
        const gift = gifts[i];
        // 获取赠品设置 - 修复类型转换问题
        const giftType = gift.type;
        // 检查是否选择了赠品类型
        if (!giftType || giftType === '') {
            alert(`请为赠品${i+1}选择制品类型！`);
            return;
        }
        
        const giftTypeId = parseInt(giftType);
        // 使用 == 进行比较，忽略类型差异
        const productSetting = productSettings.find(p => p.id == giftTypeId);
        if (!productSetting) {
            alert(`赠品${i+1}的制品类型无效，请重新选择！`);
            return;
        }
        
        // 计算基础价格
        let basePrice = 0;
        switch (productSetting.priceType) {
            case 'fixed':
                basePrice = productSetting.price;
                break;
            case 'double':
                basePrice = gift.sides === 'single' ? productSetting.priceSingle : productSetting.priceDouble;
                break;
            case 'config':
                basePrice = productSetting.basePrice;
                break;
        }
        
        // 计算同模相关数据
        const sameModelCount = gift.sameModel ? gift.quantity - 1 : 0;
        const sameModelUnitPrice = (sameModelMode === 'minus') ? Math.max(0, basePrice - sameModelMinusAmount) : (basePrice * sameModelCoefficient);
        const sameModelTotal = sameModelCount * sameModelUnitPrice;
        
        // 计算工艺费用
        let totalProcessFee = 0;
        let processDetails = [];
        
        // 处理多选工艺
        if (gift.processes) {
            Object.values(gift.processes).forEach(processChoice => {
                const processSetting = processSettings.find(p => p.id === processChoice.id);
                if (processSetting) {
                    // 工艺价格（每层）
                    const processPricePerLayer = (processSetting.price ?? 10);
                    // 工艺层数
                    const processLayers = processChoice.layers || 1;
                    // 工艺单价 = 工艺价格（每层） * 层数
                    const processUnitPrice = processPricePerLayer * processLayers;
                    // 工艺总价 = 工艺单价 * 赠品数量
                    const processFee = processUnitPrice * gift.quantity;
                    totalProcessFee += processFee;
                    processDetails.push({
                        name: processSetting.name,
                        unitPrice: processUnitPrice,
                        layers: processLayers,
                        quantity: gift.quantity,
                        fee: processFee
                    });
                }
            });
        }
        
        // 计算背景费
        let backgroundFee = 0;
        if (gift.hasBackground) {
            const backgroundFeePerProduct = defaultSettings.backgroundFee || 0;
            // 主制品全额背景费，同模制品应用同模系数
            const mainBackgroundFee = backgroundFeePerProduct;
            const sameModelBackgroundUnitPrice = backgroundFeePerProduct * sameModelCoefficient;
            const sameModelBackgroundTotal = sameModelCount * sameModelBackgroundUnitPrice;
            backgroundFee = mainBackgroundFee + sameModelBackgroundTotal;
        }
        
        // 计算赠品原价
        const baseGiftTotal = basePrice + sameModelTotal;
        const giftOriginalPrice = baseGiftTotal + totalProcessFee + backgroundFee;
        
        // 保存赠品价格信息
        const giftPriceInfo = {
            giftIndex: i + 1,
            product: productSetting.name,
            category: productSetting.category || '其他',
            basePrice: basePrice,
            quantity: gift.quantity,
            sameModelCount: sameModelCount,
            sameModelUnitPrice: sameModelUnitPrice,
            sameModelTotal: sameModelTotal,
            giftOriginalPrice: giftOriginalPrice,
            giftDiscountedPrice: 0, // 赠品优惠价为0
            processDetails: processDetails,
            totalProcessFee: totalProcessFee,
            // 添加基础配置信息（如果是基础+递增价类型）
            productType: productSetting.priceType,
            baseConfig: productSetting.baseConfig,
            // 添加单双面价相关信息
            sides: gift.sides,
            productId: giftTypeId
        };
        // 赠品日计划（排单用，可选）
        if (Array.isArray(gift.dailyPlan) && gift.dailyPlan.length > 0) {
            giftPriceInfo.dailyPlan = gift.dailyPlan.map(function (p) { return { date: p.date, targetQty: p.targetQty }; });
        }
        if (productSetting.priceType === 'nodes' && Array.isArray(gift.nodeDailyPlan) && gift.nodeDailyPlan.length > 0) {
            giftPriceInfo.nodeDailyPlan = gift.nodeDailyPlan.map(function (p) { return { nodeIndex: p.nodeIndex, date: p.date, targetQty: p.targetQty }; });
        }
        giftPrices.push(giftPriceInfo);
        totalGiftsOriginalPrice += giftOriginalPrice;
    }
    
    // 计算总价：总价 = (制品1+…+制品N) * 加价类1*…*加价类n * 折扣类1*…*折扣类n + 其他费用合计 + 平台手续费
    const productsTotal = totalProductsPrice;
    const totalWithCoefficients = productsTotal * pricingUpProduct * pricingDownProduct;
    // 3. 报价金额 = 我要收取的总金额（制品+系数+其他费用，不含平台费）
    const totalBeforePlatformFee = totalWithCoefficients + totalOtherFees;
    // 4. 约定实收：仅当“金额基数未变化”时保留手动值；金额变化则重置为最新报价金额
    const prevBase = quoteData && Number.isFinite(Number(quoteData.totalBeforePlatformFee)) ? Number(quoteData.totalBeforePlatformFee) : null;
    const prevAgreed = quoteData && Number.isFinite(Number(quoteData.agreedAmount)) ? Number(quoteData.agreedAmount) : null;
    const prevManualBase = quoteData && Number.isFinite(Number(quoteData.manualAgreedBase)) ? Number(quoteData.manualAgreedBase) : null;
    const hasManualAgreed = !!(quoteData && quoteData.hasManualAgreed);
    const sameBase = prevBase != null && Math.abs(prevBase - totalBeforePlatformFee) < 0.005;
    const sameManualBase = prevManualBase != null && Math.abs(prevManualBase - totalBeforePlatformFee) < 0.005;
    const keepManualAgreed = hasManualAgreed && prevAgreed != null && (sameManualBase || sameBase);
    const agreedAmount = keepManualAgreed ? prevAgreed : totalBeforePlatformFee;
    const platformFeeAmount = Math.round(agreedAmount * (platformFee / 100));
    // 5. 客户实付 = 约定实收 + 平台费
    const finalTotal = agreedAmount + platformFeeAmount;
    
    // 获取开始时间
    const startTimeValue = document.getElementById('startTime')?.value;
    
    // 生成报价数据（contact 存接单平台名称，contactInfo 存联系方式）
    // 1）是否需付定金：来自计算页下拉
    var needDepositFlag = !!(typeof needDepositChecked === 'function'
        ? needDepositChecked()
        : (function () { var el = document.getElementById('needDeposit'); return el && el.value === 'yes'; })());
    // 2）建议定金 = 实付金额 × 定金比例（仅作默认值提示）
    var suggestedDeposit = 0;
    if (needDepositFlag) {
        var baseForDeposit = finalTotal != null ? finalTotal : totalBeforePlatformFee;
        if (defaultSettings && defaultSettings.depositRate != null) {
            var depRate = Number(defaultSettings.depositRate);
            if (isFinite(depRate) && depRate > 0) {
                suggestedDeposit = Math.round(baseForDeposit * depRate * 100) / 100;
            }
        } else {
            suggestedDeposit = Math.round(baseForDeposit * 0.3 * 100) / 100;
        }
    }
    // 3）已收定金：计算报价时不自动填充（避免“先看报价就显示已收定金”）
    // 只在你点击“确认已收定金”后，才会写入 quoteData.depositReceived
    var depositReceived = 0;
    quoteData = {
        clientId: clientId,
        contact: contactDisplay,
        contactInfo: contactInfoValue,
        platformType: platformType,
        startTime: startTimeValue,
        deadline: deadline,
        usage: usage,
        urgent: urgent,
        sameModelCoefficient: sameModelCoefficient,
        sameModelMode: sameModelMode,
        sameModelMinusAmount: sameModelMinusAmount,
        discount: discount,
        usageType: usageType,
        urgentType: urgentType,
        discountType: discountType,
        usageName: (defaultSettings.usageCoefficients[usageType] && defaultSettings.usageCoefficients[usageType].name) ? defaultSettings.usageCoefficients[usageType].name : '用途系数',
        urgentName: (defaultSettings.urgentCoefficients[urgentType] && defaultSettings.urgentCoefficients[urgentType].name) ? defaultSettings.urgentCoefficients[urgentType].name : '加急系数',
        discountName: (defaultSettings.discountCoefficients[discountType] && defaultSettings.discountCoefficients[discountType].name) ? defaultSettings.discountCoefficients[discountType].name : '折扣系数',
        extraUpSelections: extraUpSelections,
        extraDownSelections: extraDownSelections,
        pricingUpProduct: pricingUpProduct,
        pricingDownProduct: pricingDownProduct,
        otherFees: dynamicOtherFees,
        totalOtherFees: totalOtherFees,
        platformFee: platformFee,
        platformFeeAmount: platformFeeAmount,
        productPrices: productPrices,
        giftPrices: giftPrices,
        totalProductsPrice: totalProductsPrice,
        totalGiftsOriginalPrice: totalGiftsOriginalPrice,
        totalWithCoefficients: totalWithCoefficients,
        totalBeforePlatformFee: totalBeforePlatformFee,
        finalTotal: finalTotal,
        agreedAmount: agreedAmount,
        hasManualAgreed: keepManualAgreed,
        manualAgreedBase: keepManualAgreed ? totalBeforePlatformFee : null,
        needDeposit: needDepositFlag,
        depositReceived: depositReceived,
        scheduleColorIndex: window.currentScheduleColorIndex,
        orderRemark: (defaultSettings && defaultSettings.orderRemark != null) ? String(defaultSettings.orderRemark) : '',
        settlementRulesSnapshot: JSON.parse(JSON.stringify(defaultSettings.settlementRules || {})),
        timestamp: (function () { var el = document.getElementById('orderTimeInput'); var v = el && el.value ? el.value.trim() : ''; if (v) { var d = new Date(v + 'T00:00:00'); if (!isNaN(d.getTime())) return d.toISOString(); } return new Date().toISOString(); })()
    };
    
    // 生成报价单（主小票区域）
    generateQuote();
    
    // 如果小票抽屉当前是打开状态，同步抽屉里的小票内容
    if (typeof isReceiptDrawerOpen !== 'undefined' && isReceiptDrawerOpen) {
        syncReceiptDrawerContent();
    }
    
    // 仅刷新显示（智能提取等）：不关抽屉、不打开小票
    if (onlyRefreshDisplay) return;
    
    // 打开保存方式选择弹窗（编辑模式下点「保存」时，不直接保存）
    if (openSaveChoiceModal && window.editingHistoryId) {
        openCalculatorSaveChoiceModal();
        return;
    }
    
    // 另存新单：清除编辑 ID 后保存为新记录，关闭抽屉，不打开小票
    if (saveAsNew && window.editingHistoryId) {
        window.editingHistoryId = null;
        // 新排单：记住本单选择的颜色索引，并让下一单默认选“下一色”
        if (typeof window.currentScheduleColorIndex === 'number') {
            quoteData.scheduleColorIndex = window.currentScheduleColorIndex;
            setLastScheduleColorIndex(window.currentScheduleColorIndex);
        }
        saveToHistory();
        if (typeof closeCalculatorDrawer === 'function') closeCalculatorDrawer();
        showPage('quote');
        return;
    }
    
    // 覆盖保存：编辑模式下直接保存原订单，关闭抽屉，不打开小票
    if (skipReceipt && window.editingHistoryId) {
        saveToHistory();
        if (typeof closeCalculatorDrawer === 'function') closeCalculatorDrawer();
        showPage('quote');
        return;
    }
    
    // 默认：关闭计算抽屉并打开小票
    if (typeof closeCalculatorDrawer === 'function') {
        closeCalculatorDrawer();
    }

    // 记录本单颜色索引并更新“最后使用索引”
    if (typeof window.currentScheduleColorIndex === 'number') {
        quoteData.scheduleColorIndex = window.currentScheduleColorIndex;
        setLastScheduleColorIndex(window.currentScheduleColorIndex);
    }
    
    // 切换到报价/排单页
    showPage('quote');

    // 自动打开小票抽屉，直接展示最新小票
    openReceiptDrawer();

    // 待接协商：生成小票视为已报价（不代表已进入排单）
    if (window.currentIncomingProjectId) {
        mgUpdateProjectStatus(window.currentIncomingProjectId, 'QUOTED');
    }
    
    // 滚动到报价页顶部（排单区）
    setTimeout(function() {
        const quotePage = document.getElementById('quote');
        if (quotePage) {
            quotePage.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // 如果页面本身不在顶部，也滚动窗口到顶部
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, 100);
}

// 生成报价单
function generateQuote() {
    const container = document.getElementById('quoteContent');
    
    if (!quoteData) {
        container.innerHTML = '<p>请先在计算页完成计算</p>';
        return;
    }
    
    // 格式化日期
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    // 获取当前主题
    const currentTheme = defaultSettings.receiptCustomization.theme || 'classic';
    const themeClass = `receipt-theme-${currentTheme}`;
    
    // 生成HTML结构 - 使用购物小票样式
    let html = `
        <div class="receipt ${themeClass}">`;
    
    // 添加头部图片（如果设置了）
    if (defaultSettings.receiptCustomization.headerImage) {
        html += `<div class="receipt-header-image"><img src="${defaultSettings.receiptCustomization.headerImage}" class="receipt-img receipt-theme-${currentTheme}" alt="头部图片" style="max-width: 300px; height: auto;" /></div>`;
    }
    
    // 添加自定义标题（如果设置了）——附带主题类，方便按主题控制标题颜色
    if (defaultSettings.receiptCustomization.titleText) {
        html += `<div class="receipt-title receipt-theme-${currentTheme}">${defaultSettings.receiptCustomization.titleText}</div>`;
    }
    
    // 添加小票信息行
    let receiptInfoHtml = `<div class="receipt-info">`;
        
    // 检查是否有receiptInfo对象，如果没有则使用默认值
    const receiptInfo = defaultSettings.receiptCustomization.receiptInfo || {};
        
    // 订单通知
    if (receiptInfo.orderNotification) {
        const orderNotification = receiptInfo.orderNotification.replace('XXX', quoteData.clientId);
        receiptInfoHtml += `<p class="receipt-text-sm receipt-text-sm-center">${orderNotification}</p>`;
    }
    // 下单时间（小票用英文、仅日期 YYYY-MM-DD，不显示时分；放在开始时间前面）
    if (receiptInfo.showOrderTime !== false && quoteData.timestamp) {
        const orderDate = new Date(quoteData.timestamp);
        const y = orderDate.getFullYear();
        const m = String(orderDate.getMonth() + 1).padStart(2, '0');
        const d = String(orderDate.getDate()).padStart(2, '0');
        const orderDateStr = y + '-' + m + '-' + d;
        receiptInfoHtml += `<p class="receipt-text-sm">ORDER DATE: ${orderDateStr}</p>`;
    }
    // 开始时间
    if (receiptInfo.showStartTime !== false && quoteData.startTime) {  // 默认为true
        receiptInfoHtml += `<p class="receipt-text-sm">START TIME: ${quoteData.startTime}</p>`;
    }
    // 截稿时间
    if (receiptInfo.showDeadline !== false && quoteData.deadline) {  // 默认为true
        receiptInfoHtml += `<p class="receipt-text-sm">DEADLINE: ${quoteData.deadline}</p>`;
    }
        
    // 身份（美工/画师）
    if (receiptInfo.showDesigner !== false && defaultSettings.artistInfo.id) {  // 默认为true
        const roleLabel = (defaultSettings.artistInfo.role === '画师') ? 'ARTIST' : 'DESIGNER';
        receiptInfoHtml += `<p class="receipt-text-sm">${roleLabel}: ${defaultSettings.artistInfo.id}</p>`;
    }
        
    // 联系方式
    if (receiptInfo.showContactInfo !== false && defaultSettings.artistInfo.contact) {  // 默认为true
        receiptInfoHtml += `<p class="receipt-text-sm">CONTACT INFO: ${defaultSettings.artistInfo.contact}</p>`;
    }
        
    // 自定义文本
    if (receiptInfo.customText) {
        receiptInfoHtml += `<p class="receipt-text-sm">${receiptInfo.customText}</p>`;
    }
        
    // 可选显示原有的信息（可根据需要启用）
    // receiptInfoHtml += `<p class="receipt-text-sm">单主ID: ${quoteData.clientId}</p>`;
    // receiptInfoHtml += `<p class="receipt-text-sm">联系方式: ${quoteData.contact}</p>`;
    // receiptInfoHtml += `<p class="receipt-text-sm">报价时间: ${new Date().toLocaleString('zh-CN')}</p>`;
        
    receiptInfoHtml += `</div>`;
        
    html += receiptInfoHtml;
    
    html += `<div class="receipt-details">
                <div class="receipt-header receipt-row">
                    <div class="receipt-col-2">制品</div>
                    <div class="receipt-col-1">单价</div>
                    <div class="receipt-col-1">数量</div>
                    <div class="receipt-col-1">小计</div>
                </div>
    `;
    
    // 按大类分组显示制品
    quoteData.productPrices.forEach((item) => {
        // 判断是否满足乘法（无同模、无工艺、无配件时，fixed/double可合并；config永远不合并）
        const hasSameModel = item.sameModelCount > 0;
        const hasProcess = item.processDetails && item.processDetails.length > 0;
        const hasAdditionalConfig = item.productType === 'config' && item.additionalConfigDetails && item.additionalConfigDetails.length > 0;
        const isNodes = item.productType === 'nodes';
        const canMerge = !isNodes && !hasSameModel && !hasProcess && item.productType !== 'config' && (item.productType === 'fixed' || (item.productType === 'double' && !hasAdditionalConfig));
        
        // 获取同模系数值（用于显示）
        let sameModelRate = 0.5;
        if (hasSameModel && item.basePrice > 0 && item.sameModelUnitPrice > 0) {
            // 根据实际计算的同模单价和基础单价计算同模系数
            sameModelRate = item.sameModelUnitPrice / item.basePrice;
        } else {
            // 没有同模制品时，使用默认同模系数
            const _arr = Object.values(defaultSettings.sameModelCoefficients || {});
            const _found = _arr.find(c => c && c.name === '改字、色、柄图');
            sameModelRate = getCoefficientValue(_found || _arr[0]) || 0.5;
        }
        
        // 计算全价制品单价和数量
        const fullPriceUnitPrice = item.basePrice; // 全价制品单价（基础价，config时已包含配件）
        const fullPriceQuantity = hasSameModel ? 1 : item.quantity; // 全价制品数量
        
        // config的成品单价（basePrice已包含配件）
        const finishedProductUnitPrice = item.basePrice;
        
        // 处理制品名（double需要加单/双面；nodes 不加后缀）
        let productName = item.product;
        if (item.productType === 'double') {
            if (item.sides === 'single') {
                productName = `${item.product}(单面)`;
            } else if (item.sides === 'double') {
                productName = `${item.product}(双面)`;
            }
        }
        
        // 按节点收费：总览行 + 节点明细
        if (isNodes) {
            const nodeTotal = item.nodeTotalPrice != null ? item.nodeTotalPrice : item.basePrice;
            html += `<div class="receipt-row"><div class="receipt-col-2">${item.productIndex}. ${productName}</div><div class="receipt-col-1">¥${nodeTotal.toFixed(2)}</div><div class="receipt-col-1">${item.quantity}件</div><div class="receipt-col-1">¥${item.productTotal.toFixed(2)}</div></div>`;
            if (item.nodeDetails && item.nodeDetails.length > 0) {
                item.nodeDetails.forEach(node => {
                    html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent"></div><div class="receipt-col-2"><span class="receipt-bullet">•</span> ${(node.name || '节点').replace(/</g, '&lt;')} ${node.percent}%</div><div class="receipt-col-1"></div><div class="receipt-col-1"></div><div class="receipt-col-1">¥${(node.amount || 0).toFixed(2)}</div></div>`;
                });
            }
        } else if (canMerge) {
        // 总览行
            // fixed/double 无同模无工艺：合并到总览行
            html += `<div class="receipt-row"><div class="receipt-col-2">${item.productIndex}. ${productName}</div><div class="receipt-col-1">¥${fullPriceUnitPrice.toFixed(2)}</div><div class="receipt-col-1">${item.quantity}件</div><div class="receipt-col-1">¥${item.productTotal.toFixed(2)}</div></div>`;
        } else {
            // 需要拆明细
            if (item.productType === 'config') {
                // config：无同模无工艺时显示成品单价，有同模或工艺时显示"—"（规范要求）
                if (!hasSameModel && !hasProcess) {
                    html += `<div class="receipt-row"><div class="receipt-col-2">${item.productIndex}. ${productName}</div><div class="receipt-col-1">¥${finishedProductUnitPrice.toFixed(2)}</div><div class="receipt-col-1">${item.quantity}件</div><div class="receipt-col-1">¥${item.productTotal.toFixed(2)}</div></div>`;
                } else {
                    html += `<div class="receipt-row"><div class="receipt-col-2">${item.productIndex}. ${productName}</div><div class="receipt-col-1" style="color:#999;">—</div><div class="receipt-col-1">${item.quantity}件</div><div class="receipt-col-1">¥${item.productTotal.toFixed(2)}</div></div>`;
                }
            } else {
                // fixed/double：总览行单价留空
                html += `<div class="receipt-row"><div class="receipt-col-2">${item.productIndex}. ${productName}</div><div class="receipt-col-1" style="color:#999;">—</div><div class="receipt-col-1">${item.quantity}件</div><div class="receipt-col-1">¥${item.productTotal.toFixed(2)}</div></div>`;
            }
            
            // 明细：全价制品行
            html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent"></div><div class="receipt-col-2"><span class="receipt-bullet">•</span> 全价制品</div><div class="receipt-col-1">¥${fullPriceUnitPrice.toFixed(2)}</div><div class="receipt-col-1">${fullPriceQuantity}</div><div class="receipt-col-1">¥${(fullPriceUnitPrice * fullPriceQuantity).toFixed(2)}</div></div>`;
            
            // config：树形明细（仅单价，不显示数量和小计）
            if (item.productType === 'config' && item.baseConfig) {
                // 基础配置价格（不含配件）
                let baseConfigVal = item.baseConfigPrice;
                if (baseConfigVal == null) {
                    // 兼容旧数据：从 basePrice 减去配件总额
                    let additionalTotal = 0;
                    if (item.additionalConfigDetails && item.additionalConfigDetails.length > 0) {
                        additionalTotal = item.additionalConfigDetails.reduce((sum, c) => sum + (c.total || 0), 0);
                    } else if (item.totalAdditionalCount !== undefined && item.totalAdditionalCount > 0 && item.additionalPrice) {
                        additionalTotal = item.totalAdditionalCount * item.additionalPrice;
                    }
                    baseConfigVal = item.basePrice - additionalTotal;
                }
                html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent-align-craft"></div><div class="receipt-col-2">└ ${item.baseConfig}</div><div class="receipt-col-1">¥${baseConfigVal.toFixed(2)}</div><div class="receipt-col-1"></div><div class="receipt-col-1"></div></div>`;
                
                // 配件明细（仅单价）
                if (item.additionalConfigDetails && item.additionalConfigDetails.length > 0) {
                    item.additionalConfigDetails.forEach(config => {
                        // 每件该配件合计价
                        const perPiecePrice = config.price * config.count;
                        html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent-align-craft"></div><div class="receipt-col-2">└ ${config.name}×${config.count}</div><div class="receipt-col-1">¥${perPiecePrice.toFixed(2)}</div><div class="receipt-col-1"></div><div class="receipt-col-1"></div></div>`;
                    });
                } else if (item.totalAdditionalCount !== undefined && item.totalAdditionalCount > 0 && item.additionalPrice) {
                    // 兼容旧格式
                    const perPiecePrice = item.additionalPrice * item.totalAdditionalCount;
                    html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent-align-craft"></div><div class="receipt-col-2">└ ${item.additionalName || '附加项'}×${item.totalAdditionalCount}</div><div class="receipt-col-1">¥${perPiecePrice.toFixed(2)}</div><div class="receipt-col-1"></div><div class="receipt-col-1"></div></div>`;
                }
            }
            
            // 同模制品行
            if (hasSameModel) {
                const _sameMode = quoteData.sameModelMode || defaultSettings.sameModelMode;
                const _sameMinus = Number.isFinite(Number(quoteData.sameModelMinusAmount)) ? Math.max(0, Number(quoteData.sameModelMinusAmount)) : (Number.isFinite(Number(defaultSettings.sameModelMinusAmount)) ? Math.max(0, Number(defaultSettings.sameModelMinusAmount)) : 0);
                const sameModelHint = (_sameMode === 'minus') ? `−¥${_sameMinus.toFixed(2)}` : `${sameModelRate}x`;
                html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent"></div><div class="receipt-col-2"><span class="receipt-bullet">•</span> 同模制品(${sameModelHint})</div><div class="receipt-col-1">¥${item.sameModelUnitPrice.toFixed(2)}</div><div class="receipt-col-1">${item.sameModelCount}</div><div class="receipt-col-1">¥${item.sameModelTotal.toFixed(2)}</div></div>`;
            }
            
            // 工艺行（按每层单价分组，同单价的工艺合并为一行）
            if (hasProcess) {
                // 先显示"工艺"标题行
                html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent"></div><div class="receipt-col-2"><span class="receipt-bullet">•</span> 工艺</div><div class="receipt-col-1"></div><div class="receipt-col-1"></div><div class="receipt-col-1"></div></div>`;
                
                // 按每层单价分组（不是按工艺单价分组）
                const processGroupsByLayerPrice = {};
                item.processDetails.forEach(process => {
                    // 每层单价 = 工艺单价 / 层数（process.unitPrice 已经是 每层价格×层数）
                    const pricePerLayer = process.unitPrice / process.layers;
                    const key = pricePerLayer.toFixed(4);
                    if (!processGroupsByLayerPrice[key]) {
                        processGroupsByLayerPrice[key] = [];
                    }
                    processGroupsByLayerPrice[key].push(process);
                });
                
                // 显示每个每层单价组的工艺（每行最多显示2个）
                for (const [layerPriceKey, processes] of Object.entries(processGroupsByLayerPrice)) {
                    const pricePerLayer = parseFloat(layerPriceKey);
                    
                    // 将工艺分组，每行最多2个
                    for (let i = 0; i < processes.length; i += 2) {
                        const processesInRow = processes.slice(i, i + 2);
                        // 累计层数（仅当前行的工艺）
                        const totalLayers = processesInRow.reduce((sum, p) => sum + p.layers, 0);
                        // 计费数量 = 总层数 × 件数
                        const chargeQuantity = totalLayers * item.quantity;
                        // 总费用（仅当前行的工艺）
                        const totalFee = processesInRow.reduce((sum, p) => sum + p.fee, 0);
                        // 工艺名称（格式：工艺名×层数、工艺名×层数，最多2个）
                        const processNamesWithLayers = processesInRow.map(p => `${p.name}×${p.layers}`).join('、');
                        
                        html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent-align-craft"></div><div class="receipt-col-2">${processNamesWithLayers}</div><div class="receipt-col-1">¥${pricePerLayer.toFixed(2)}</div><div class="receipt-col-1">${chargeQuantity}</div><div class="receipt-col-1">¥${totalFee.toFixed(2)}</div></div>`;
                    }
                }
            }
        }
    });
    
    // 结束制品详情部分
    html += `</div>`;
    
    // 显示赠品信息（如果有）
    if (quoteData.giftPrices && quoteData.giftPrices.length > 0) {
        html += `<div class="receipt-divider receipt-divider-full"></div><h3 class="receipt-text-sm" style="font-weight: bold; margin: 0.5rem 0;text-align:center;">赠品信息</h3>`;
        
        // 按大类分组显示赠品
        let giftCurrentCategory = '';
        quoteData.giftPrices.forEach((item) => {
            // 如果大类改变，添加空行
            if (giftCurrentCategory && item.category !== giftCurrentCategory) {
                html += `<div class="receipt-divider"></div>`;
            }
            giftCurrentCategory = item.category;
            
            // 判断是否满足乘法（赠品规则与制品相同）
            const hasSameModelGift = item.sameModelCount > 0;
            const hasProcessGift = item.processDetails && item.processDetails.length > 0;
            const hasAdditionalConfigGift = item.productType === 'config' && item.additionalConfigDetails && item.additionalConfigDetails.length > 0;
            const canMergeGift = !hasSameModelGift && !hasProcessGift && item.productType !== 'config' && (item.productType === 'fixed' || (item.productType === 'double' && !hasAdditionalConfigGift));
            
            // 获取同模系数值（用于显示）
            let sameModelRateGift = 0.5;
            if (hasSameModelGift && item.basePrice > 0 && item.sameModelUnitPrice > 0) {
                // 根据实际计算的同模单价和基础单价计算同模系数
                sameModelRateGift = item.sameModelUnitPrice / item.basePrice;
            } else {
                // 没有同模制品时，使用默认同模系数
                const _arrG = Object.values(defaultSettings.sameModelCoefficients || {});
                const _foundG = _arrG.find(c => c && c.name === '改字、色、柄图');
                sameModelRateGift = getCoefficientValue(_foundG || _arrG[0]) || 0.5;
            }
            
            // 计算全价制品单价和数量
            const fullPriceUnitPriceGift = item.basePrice;
            const fullPriceQuantityGift = hasSameModelGift ? 1 : item.quantity;
            
            // 处理赠品名（double需要加单/双面）
            let giftProductName = item.product;
            if (item.productType === 'double') {
                if (item.sides === 'single') {
                    giftProductName = `${item.product}(单面)`;
                } else if (item.sides === 'double') {
                    giftProductName = `${item.product}(双面)`;
                }
            }
            
            const productTotalGift = item.productTotal || (item.basePrice * item.quantity);
            
            // 总览行（赠品特殊：显示¥0.00 + 划线原价）
            if (canMergeGift) {
                // fixed/double 无同模无工艺：合并到总览行
                html += `<div class="receipt-row" style="display: flex; align-items: flex-end;"><div class="receipt-col-2">[赠品] ${giftProductName}</div><div class="receipt-col-1">¥${fullPriceUnitPriceGift.toFixed(2)}</div><div class="receipt-col-1">${item.quantity}</div><div class="receipt-col-1" style="display: flex; flex-direction: column; align-items: flex-end;"><span class="receipt-gift-free-amount">¥0.00</span><span style="text-decoration: line-through; font-size: 0.9em;">¥${productTotalGift.toFixed(2)}</span></div></div>`;
            } else {
                // 需要拆明细
                if (item.productType === 'config') {
                    html += `<div class="receipt-row" style="display: flex; align-items: flex-end;"><div class="receipt-col-2">[赠品] ${giftProductName}</div><div class="receipt-col-1">¥${item.basePrice.toFixed(2)}</div><div class="receipt-col-1">${item.quantity}</div><div class="receipt-col-1" style="display: flex; flex-direction: column; align-items: flex-end;"><span class="receipt-gift-free-amount">¥0.00</span><span style="text-decoration: line-through; font-size: 0.9em;">¥${productTotalGift.toFixed(2)}</span></div></div>`;
                } else {
                    html += `<div class="receipt-row" style="display: flex; align-items: flex-end;"><div class="receipt-col-2">[赠品] ${giftProductName}</div><div class="receipt-col-1" style="color:#999;">—</div><div class="receipt-col-1">${item.quantity}件</div><div class="receipt-col-1" style="display: flex; flex-direction: column; align-items: flex-end;"><span class="receipt-gift-free-amount">¥0.00</span><span style="text-decoration: line-through; font-size: 0.9em;">¥${productTotalGift.toFixed(2)}</span></div></div>`;
                }
                
                // 明细：全价制品行（赠品显示原价）
                html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent"></div><div class="receipt-col-2"><span class="receipt-bullet">•</span> 全价制品</div><div class="receipt-col-1">¥${fullPriceUnitPriceGift.toFixed(2)}</div><div class="receipt-col-1">${fullPriceQuantityGift}</div><div class="receipt-col-1">¥${(fullPriceUnitPriceGift * fullPriceQuantityGift).toFixed(2)}</div></div>`;
                
                // config：树形明细（仅单价，不显示数量和小计）
                if (item.productType === 'config' && item.baseConfig) {
                    let baseConfigValGift = item.baseConfigPrice;
                    if (baseConfigValGift == null) {
                        let additionalTotalGift = 0;
                        if (item.additionalConfigDetails && item.additionalConfigDetails.length > 0) {
                            additionalTotalGift = item.additionalConfigDetails.reduce((sum, c) => sum + (c.total || 0), 0);
                        } else if (item.totalAdditionalCount !== undefined && item.totalAdditionalCount > 0 && item.additionalPrice) {
                            additionalTotalGift = item.totalAdditionalCount * item.additionalPrice;
                        }
                        baseConfigValGift = item.basePrice - additionalTotalGift;
                    }
                    html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent-align-craft"></div><div class="receipt-col-2">└ ${item.baseConfig}</div><div class="receipt-col-1">¥${baseConfigValGift.toFixed(2)}</div><div class="receipt-col-1"></div><div class="receipt-col-1"></div></div>`;
                    
                    // 配件明细（仅单价）
                    if (item.additionalConfigDetails && item.additionalConfigDetails.length > 0) {
                        item.additionalConfigDetails.forEach(config => {
                            const perPiecePriceGift = config.price * config.count;
                            html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent-align-craft"></div><div class="receipt-col-2">└ ${config.name}×${config.count}</div><div class="receipt-col-1">¥${perPiecePriceGift.toFixed(2)}</div><div class="receipt-col-1"></div><div class="receipt-col-1"></div></div>`;
                        });
                    } else if (item.totalAdditionalCount !== undefined && item.totalAdditionalCount > 0 && item.additionalPrice) {
                        const perPiecePriceGift = item.additionalPrice * item.totalAdditionalCount;
                        html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent-align-craft"></div><div class="receipt-col-2">└ ${item.additionalName || '附加项'}×${item.totalAdditionalCount}</div><div class="receipt-col-1">¥${perPiecePriceGift.toFixed(2)}</div><div class="receipt-col-1"></div><div class="receipt-col-1"></div></div>`;
                    }
                }
                
                // 同模制品行（赠品显示原价）
                if (hasSameModelGift) {
                    const _sameModeGift = quoteData.sameModelMode || defaultSettings.sameModelMode;
                    const _sameMinusGift = Number.isFinite(Number(quoteData.sameModelMinusAmount)) ? Math.max(0, Number(quoteData.sameModelMinusAmount)) : (Number.isFinite(Number(defaultSettings.sameModelMinusAmount)) ? Math.max(0, Number(defaultSettings.sameModelMinusAmount)) : 0);
                    const sameModelHintGift = (_sameModeGift === 'minus') ? `−¥${_sameMinusGift.toFixed(2)}` : `${sameModelRateGift}x`;
                    html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent"></div><div class="receipt-col-2"><span class="receipt-bullet">•</span> 同模制品(${sameModelHintGift})</div><div class="receipt-col-1">¥${item.sameModelUnitPrice.toFixed(2)}</div><div class="receipt-col-1">${item.sameModelCount}</div><div class="receipt-col-1">¥${item.sameModelTotal.toFixed(2)}</div></div>`;
                }
                
                // 工艺行（按每层单价分组，同单价的工艺合并为一行）
                if (hasProcessGift) {
                    // 先显示"工艺"标题行
                    html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent"></div><div class="receipt-col-2"><span class="receipt-bullet">•</span> 工艺</div><div class="receipt-col-1"></div><div class="receipt-col-1"></div><div class="receipt-col-1"></div></div>`;
                    
                    // 按每层单价分组（不是按工艺单价分组）
                    const processGroupsByLayerPriceGift = {};
                    item.processDetails.forEach(process => {
                        const pricePerLayerGift = process.unitPrice / process.layers;
                        const key = pricePerLayerGift.toFixed(4);
                        if (!processGroupsByLayerPriceGift[key]) {
                            processGroupsByLayerPriceGift[key] = [];
                        }
                        processGroupsByLayerPriceGift[key].push(process);
                    });
                    
                    // 显示每个每层单价组的工艺（每行最多显示2个，显示原价）
                    for (const [layerPriceKey, processes] of Object.entries(processGroupsByLayerPriceGift)) {
                        const pricePerLayerGift = parseFloat(layerPriceKey);
                        
                        // 将工艺分组，每行最多2个
                        for (let i = 0; i < processes.length; i += 2) {
                            const processesInRow = processes.slice(i, i + 2);
                            // 累计层数（仅当前行的工艺）
                            const totalLayersGift = processesInRow.reduce((sum, p) => sum + p.layers, 0);
                            // 计费数量 = 总层数 × 件数
                            const chargeQuantityGift = totalLayersGift * item.quantity;
                            // 总费用（赠品显示原价）
                            const totalFeeGift = processesInRow.reduce((sum, p) => sum + p.fee, 0);
                            // 工艺名称（格式：工艺名×层数、工艺名×层数，最多2个）
                            const processNamesWithLayersGift = processesInRow.map(p => `${p.name}×${p.layers}`).join('、');
                            
                            html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent-align-craft"></div><div class="receipt-col-2">${processNamesWithLayersGift}</div><div class="receipt-col-1">¥${pricePerLayerGift.toFixed(2)}</div><div class="receipt-col-1">${chargeQuantityGift}</div><div class="receipt-col-1">¥${totalFeeGift.toFixed(2)}</div></div>`;
                        }
                    }
                }
            }
        });
    }
    
    // 加价、折扣金额（总价 = 制品和*加价乘积*折扣乘积+其他+平台）
    const up = quoteData.pricingUpProduct != null ? quoteData.pricingUpProduct : (quoteData.usage * quoteData.urgent || 1);
    const down = quoteData.pricingDownProduct != null ? quoteData.pricingDownProduct : (quoteData.discount || 1);
    const addAmount = quoteData.totalProductsPrice * (up - 1);
    const discountAmount = quoteData.totalProductsPrice * up * (down - 1);
    const totalWithCoeff = quoteData.totalWithCoefficients != null ? quoteData.totalWithCoefficients : (quoteData.totalProductsPrice * up * down);
    const totalBeforePlat = quoteData.totalBeforePlatformFee != null ? quoteData.totalBeforePlatformFee : (totalWithCoeff + (quoteData.totalOtherFees || 0));
    const base = quoteData.totalProductsPrice;
    var agreed = quoteData.agreedAmount != null ? quoteData.agreedAmount : totalBeforePlat;
    var finalPay = quoteData.platformFeeAmount > 0 ? (quoteData.finalTotal != null ? quoteData.finalTotal : (agreed + quoteData.platformFeeAmount)) : agreed;
    // 有相同的只显示后一个：制品小计与应收相同则不显示制品小计，应收与实付相同则不显示应收
    var showBase = Math.abs(base - agreed) >= 0.005;
    // 是否显示“应收金额（-¥xx.xx）+ 原价划线”：以约定实收与系统计算原价的差额为准（与是否有平台费无关）
    var showAgreed = Math.abs(agreed - totalBeforePlat) >= 0.005 || (quoteData.platformFeeAmount > 0 && Math.abs(finalPay - agreed) >= 0.005);
    
    html += `<div class="receipt-summary">`;
    if (showBase) {
        html += `<div class="receipt-summary-row" style="font-weight: bold;"><div class="receipt-summary-label">制品小计</div><div class="receipt-summary-value">¥${base.toFixed(2)}</div></div>`;
    }
    
    // 区块1：加价类系数
    if (addAmount !== 0 && up !== 1) {
        html += `<div class="receipt-summary-section">`;
        // 合计行
        const upDisplay = parseFloat(up.toFixed(4)).toString();
        html += `<div class="receipt-summary-section-total receipt-summary-row"><div class="receipt-summary-label">加价合计：${upDisplay}×</div><div class="receipt-summary-value">¥${(base * up).toFixed(2)}</div></div>`;
        // 详细系数
        const upCoefficients = [];
        // 用途系数
        let usageValue = (quoteData.usage !== undefined && quoteData.usage !== null) ? Number(quoteData.usage) : 1;
        let usageName = quoteData.usageName || '用途系数';
        if (!isFinite(usageValue)) usageValue = 1;
        // 兼容老数据：若历史单未保存 usage 值，则退回按类型读取当前设置
        if ((quoteData.usage === undefined || quoteData.usage === null) && quoteData.usageType && defaultSettings.usageCoefficients[quoteData.usageType]) {
            const usageOption = defaultSettings.usageCoefficients[quoteData.usageType];
            usageValue = getCoefficientValue(usageOption);
            if (!quoteData.usageName) usageName = (usageOption && usageOption.name) ? usageOption.name : '用途系数';
        }
        if (usageValue !== 1) {
            upCoefficients.push({
                name: usageName,
                value: usageValue
            });
        }
        // 加急系数
        let urgentValue = (quoteData.urgent !== undefined && quoteData.urgent !== null) ? Number(quoteData.urgent) : 1;
        let urgentName = quoteData.urgentName || '加急系数';
        if (!isFinite(urgentValue)) urgentValue = 1;
        // 兼容老数据：若历史单未保存 urgent 值，则退回按类型读取当前设置
        if ((quoteData.urgent === undefined || quoteData.urgent === null) && quoteData.urgentType && defaultSettings.urgentCoefficients[quoteData.urgentType]) {
            const urgentOption = defaultSettings.urgentCoefficients[quoteData.urgentType];
            urgentValue = getCoefficientValue(urgentOption);
            if (!quoteData.urgentName) urgentName = (urgentOption && urgentOption.name) ? urgentOption.name : '加急系数';
        }
        if (urgentValue !== 1) {
            upCoefficients.push({
                name: urgentName,
                value: urgentValue
            });
        }
        // 扩展加价类系数
        if (quoteData.extraUpSelections && quoteData.extraUpSelections.length > 0) {
            quoteData.extraUpSelections.forEach(sel => {
                let v = (sel && sel.value != null) ? Number(sel.value) : 1;
                if (!isFinite(v)) v = 1;
                // 兼容老数据：未保存 value 时，尝试按 id+key 从当前配置回填
                if ((sel == null || sel.value == null) && sel && sel.id != null) {
                    const m = (defaultSettings.extraPricingUp || []).find(x => x && x.id == sel.id);
                    const k = sel.optionValue != null ? sel.optionValue : sel.selectedKey;
                    if (m && m.options && k != null && m.options[k] != null) v = getCoefficientValue(m.options[k]) || 1;
                }
                if (Math.abs(v - 1) > 0.001) {
                    upCoefficients.push({
                        name: sel.optionName || sel.moduleName || '扩展加价系数',
                        value: v
                    });
                }
            });
        }
        // 向后兼容：如果没有保存扩展系数信息，但up不等于usage*urgent，说明有扩展系数
        if (upCoefficients.length === 0 && up !== 1) {
            const calculatedUp = (quoteData.usage || 1) * (quoteData.urgent || 1);
            if (Math.abs(up - calculatedUp) > 0.001) {
                // 有扩展系数但未保存详细信息，显示总系数
                const extraValue = up / calculatedUp;
                if (Math.abs(extraValue - 1) > 0.001) {
                    upCoefficients.push({
                        name: '扩展加价系数',
                        value: extraValue
                    });
                }
            } else if (Math.abs(calculatedUp - 1) > 0.001) {
                // 如果calculatedUp !== 1，说明usage或urgent不是1，但它们没有被添加到upCoefficients
                // 这可能是因为找不到匹配的选项，直接使用值显示
                if (quoteData.usage !== undefined && quoteData.usage !== 1) {
                    upCoefficients.push({
                        name: '用途系数',
                        value: quoteData.usage
                    });
                }
                if (quoteData.urgent !== undefined && quoteData.urgent !== 1) {
                    upCoefficients.push({
                        name: '加急系数',
                        value: quoteData.urgent
                    });
                }
            }
        }
        // 显示系数明细
        upCoefficients.forEach(coeff => {
            const coeffDisplay = parseFloat(coeff.value.toFixed(4)).toString();
            html += `<div class="receipt-summary-coefficient-detail receipt-summary-row"><div class="receipt-summary-label">${coeff.name}：${coeffDisplay}×</div><div class="receipt-summary-value"></div></div>`;
        });
        html += `</div>`;
    }
    
    // 区块2：折扣类系数
    if (discountAmount !== 0 && down !== 1) {
        html += `<div class="receipt-summary-section">`;
        // 合计行
        const downDisplay = parseFloat(down.toFixed(4)).toString();
        html += `<div class="receipt-summary-section-total receipt-summary-row"><div class="receipt-summary-label">折扣合计：${downDisplay}×</div><div class="receipt-summary-value">-¥${Math.abs(discountAmount).toFixed(2)}</div></div>`;
        // 详细系数
        const downCoefficients = [];
        // 折扣系数
        let discountValue = (quoteData.discount !== undefined && quoteData.discount !== null) ? Number(quoteData.discount) : 1;
        let discountName = quoteData.discountName || '折扣系数';
        if (!isFinite(discountValue)) discountValue = 1;
        // 兼容老数据：若历史单未保存 discount 值，则退回按类型读取当前设置
        if ((quoteData.discount === undefined || quoteData.discount === null) && quoteData.discountType && defaultSettings.discountCoefficients[quoteData.discountType]) {
            const discountOption = defaultSettings.discountCoefficients[quoteData.discountType];
            discountValue = getCoefficientValue(discountOption);
            if (!quoteData.discountName) discountName = (discountOption && discountOption.name) ? discountOption.name : '折扣系数';
        }
        if (discountValue !== 1) {
            downCoefficients.push({
                name: discountName,
                value: discountValue
            });
        }
        // 扩展折扣类系数
        if (quoteData.extraDownSelections && quoteData.extraDownSelections.length > 0) {
            quoteData.extraDownSelections.forEach(sel => {
                let v = (sel && sel.value != null) ? Number(sel.value) : 1;
                if (!isFinite(v)) v = 1;
                // 兼容老数据：未保存 value 时，尝试按 id+key 从当前配置回填
                if ((sel == null || sel.value == null) && sel && sel.id != null) {
                    const m = (defaultSettings.extraPricingDown || []).find(x => x && x.id == sel.id);
                    const k = sel.optionValue != null ? sel.optionValue : sel.selectedKey;
                    if (m && m.options && k != null && m.options[k] != null) v = getCoefficientValue(m.options[k]) || 1;
                }
                if (Math.abs(v - 1) > 0.001) {
                    downCoefficients.push({
                        name: sel.optionName || sel.moduleName || '扩展折扣系数',
                        value: v
                    });
                }
            });
        }
        // 向后兼容：如果没有保存扩展系数信息，但down不等于discount，说明有扩展系数
        if (downCoefficients.length === 0 && down !== 1) {
            const calculatedDown = quoteData.discount || 1;
            if (Math.abs(down - calculatedDown) > 0.001) {
                // 有扩展系数但未保存详细信息，显示总系数
                const extraValue = down / calculatedDown;
                if (Math.abs(extraValue - 1) > 0.001) {
                    downCoefficients.push({
                        name: '扩展折扣系数',
                        value: extraValue
                    });
                }
            } else if (Math.abs(calculatedDown - 1) > 0.001) {
                // 如果calculatedDown !== 1，说明discount不是1，但它没有被添加到downCoefficients
                // 这可能是因为找不到匹配的选项，直接使用值显示
                if (quoteData.discount !== undefined && quoteData.discount !== 1) {
                    downCoefficients.push({
                        name: '折扣系数',
                        value: quoteData.discount
                    });
                }
            }
        }
        // 显示系数明细
        downCoefficients.forEach(coeff => {
            const coeffDisplay = parseFloat(coeff.value.toFixed(4)).toString();
            html += `<div class="receipt-summary-coefficient-detail receipt-summary-row"><div class="receipt-summary-label">${coeff.name}：${coeffDisplay}×</div><div class="receipt-summary-value"></div></div>`;
        });
        html += `</div>`;
    }
    
    // 区块3：其他费用
    if (quoteData.totalOtherFees > 0 && quoteData.otherFees && quoteData.otherFees.length > 0) {
        html += `<div class="receipt-summary-section">`;
        // 合计行
        html += `<div class="receipt-summary-section-total receipt-summary-row"><div class="receipt-summary-label">其他费用合计</div><div class="receipt-summary-value">¥${quoteData.totalOtherFees.toFixed(2)}</div></div>`;
        // 详细费用
        quoteData.otherFees.forEach(fee => {
            html += `<div class="receipt-summary-fee-detail receipt-summary-row"><div class="receipt-summary-label">${fee.name}</div><div class="receipt-summary-value">¥${fee.amount.toFixed(2)}</div></div>`;
        });
        html += `</div>`;
    }
    
    // 应收金额 = 约定实收（抹零价）；有抹零时：抹零优惠行在上、用强调色，应收金额行上强调色+下划线原价（同赠品优惠）
    // 与实付金额相同时只显示实付金额（显示后一个），不同则按原有显示
    if (showAgreed) {
        var showRounding = Math.abs((quoteData.agreedAmount != null ? quoteData.agreedAmount : totalBeforePlat) - totalBeforePlat) > 0.001;
        if (showRounding) {
            var roundingDiscount = totalBeforePlat - agreed;
            var valueHtml = `<span class="receipt-rounding-amount">¥${agreed.toFixed(2)}</span><span style="text-decoration: line-through; font-size: 0.9em;">¥${totalBeforePlat.toFixed(2)}</span>`;
            if (roundingDiscount > 0) {
                var leftLabel = `<span class="receipt-agreed-row-left"><span class="receipt-agreed-label-bold">应收金额</span><span class="receipt-rounding-discount">（-¥${roundingDiscount.toFixed(2)}）</span></span>`;
                html += `<div class="receipt-summary-row receipt-agreed-row receipt-agreed-row-with-rounding" style="font-weight: bold; align-items: flex-end; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dotted #ccc;"><div class="receipt-summary-label">${leftLabel}</div><div class="receipt-summary-value-wrap" style="flex-direction: column; align-items: flex-end;">${valueHtml}</div></div>`;
            } else {
                html += `<div class="receipt-summary-row receipt-agreed-row" style="font-weight: bold; align-items: flex-end; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dotted #ccc;"><div class="receipt-summary-label">应收金额</div><div class="receipt-summary-value-wrap" style="flex-direction: column; align-items: flex-end;">${valueHtml}</div></div>`;
            }
        } else {
            html += `<div class="receipt-summary-row" style="font-weight: bold; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dotted #ccc;"><div class="receipt-summary-label">应收金额</div><div class="receipt-summary-value-wrap">¥${agreed.toFixed(2)}</div></div>`;
        }
    }
    
    // 平台费 = 约定实收×费率（平台收取，不经过我手）
    if (quoteData.platformFeeAmount > 0) {
        const platformFeeRate = quoteData.platformFee || 0;
        html += `<div class="receipt-summary-row"><div class="receipt-summary-label">平台费 ${platformFeeRate}%</div><div class="receipt-summary-value">+¥${quoteData.platformFeeAmount.toFixed(2)}</div></div>`;
        // 客户实付 = 约定实收 + 平台费
        var customerPays = quoteData.finalTotal != null ? quoteData.finalTotal : (agreed + quoteData.platformFeeAmount);
        html += `<div class="receipt-total"><div class="receipt-summary-label">实付金额</div><div class="receipt-summary-value">¥${customerPays.toFixed(2)}</div></div>`;
    } else {
        html += `<div class="receipt-total"><div class="receipt-summary-label">实付金额</div><div class="receipt-summary-value">¥${finalPay.toFixed(2)}</div></div>`;
    }
    // 定金选是时：小票显示需付定金 = 实付金额 × 定金比例（提示值）
    if (quoteData.needDeposit) {
        var finalPays = quoteData.finalTotal != null ? quoteData.finalTotal : (quoteData.platformFeeAmount > 0 ? (agreed + quoteData.platformFeeAmount) : agreed);
        var rate = (defaultSettings && defaultSettings.depositRate != null) ? Number(defaultSettings.depositRate) : 0.3;
        var depositAmount = Math.round(finalPays * rate * 100) / 100;
        html += `<div class="receipt-summary-row receipt-deposit-row"><div class="receipt-summary-label">需付定金</div><div class="receipt-summary-value">¥${depositAmount.toFixed(2)}</div></div>`;
    }
    // 如已填写实际已收定金，则在金额小结中单独展示一行“已收定金”
    var depSummary = Number(quoteData.depositReceived || 0);
    if (isFinite(depSummary) && depSummary > 0) {
        html += `<div class="receipt-summary-row receipt-deposit-row"><div class="receipt-summary-label"><strong>已收定金</strong></div><div class="receipt-summary-value"><strong>¥${depSummary.toFixed(2)}</strong></div></div>`;
    }

    // -------- 结算信息（撤单 / 废稿 / 正常结单）--------
    if (quoteData.settlement && quoteData.settlement.type) {
        var st = quoteData.settlement;
        var dep = Number(quoteData.depositReceived || 0);
        if (!isFinite(dep) || dep < 0) dep = 0;
        var receivable = Number(quoteData.agreedAmount != null ? quoteData.agreedAmount : (quoteData.finalTotal || 0)) || 0;
        var actual = st.amount != null ? Number(st.amount) : 0;
        if (!isFinite(actual) || actual < 0) actual = 0;
        var totalReceived = dep + actual;
        
        html += `<div class="receipt-settlement-block" style="margin-top:0.75rem;padding-top:0.5rem;border-top:1px dotted #ccc;">`;
        html += `<div class="receipt-settlement-title" style="font-weight:bold;text-align:center;margin-bottom:0.25rem;">───────── 结算结果 ─────────</div>`;
        html += `<div class="receipt-settlement-subtitle" style="font-size:0.8em;color:#888;text-align:center;margin-bottom:0.35rem;">（以下为结算结果，收费/退款以撤单·废稿·结算页确认为准）</div>`;

        // 结算类型与基础行
        var typeText = '';
        if (st.type === 'full_refund') typeText = '撤单（退全款）';
        else if (st.type === 'cancel_with_fee') typeText = '撤单（收跑单费）';
        else if (st.type === 'waste_fee') typeText = '废稿结算';
        else if (st.type === 'normal') typeText = '正常结单';
        else typeText = st.type;
        html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>结算类型：</strong>${typeText}</div></div>`;

        if (st.type === 'full_refund') {
            // 撤单退全款：强调本单作废与“需退金额”
            var refundShould = dep; // 当前模型下视为退回全部定金
            html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>本单状态：</strong>已撤销，本单作废</div></div>`;
            if (dep > 0) {
                html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>原已收定金：</strong></div><div class="receipt-summary-value">¥${dep.toFixed(2)}</div></div>`;
            }
            html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>需退金额：</strong></div><div class="receipt-summary-value"><strong>¥${refundShould.toFixed(2)}</strong></div></div>`;
            html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>已退款金额：</strong></div><div class="receipt-summary-value">¥${actual.toFixed(2)}</div></div>`;
            var refundDiff = actual - refundShould;
            html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>结算结果：</strong></div><div class="receipt-summary-value">`;
            if (Math.abs(refundDiff) < 0.005) {
                html += `已全额退还定金。`;
            } else if (refundDiff < 0) {
                html += `尚未退足，还应退 ¥${Math.abs(refundDiff).toFixed(2)}。`;
            } else {
                html += `已多退 ¥${refundDiff.toFixed(2)}，请注意核对。`;
            }
            html += `</div></div>`;
        } else {
            // 非退全款场景：cancel_with_fee、waste_fee 单独输出（定金抵扣逻辑），其余先输出已收定金+本次收款
            // 小票结算区不重复上方已展示的「已收定金」，仅展示与本次结算相关的金额
            if (st.type !== 'cancel_with_fee' && st.type !== 'waste_fee') {
                html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>本次收款：</strong></div><div class="receipt-summary-value">¥${actual.toFixed(2)}</div></div>`;
            }

            if (st.type === 'cancel_with_fee') {
                // 撤单收跑单费：小票不展示已收定金、定金抵扣，结算结果只写金额
                var feeAmount = (st.cancelFee && st.cancelFee.feeAmount != null && isFinite(st.cancelFee.feeAmount)) ? Number(st.cancelFee.feeAmount) : (actual + dep);
                var depositUsed = Math.min(dep, feeAmount);
                var actualReceive = st.amount != null ? Number(st.amount) : (feeAmount - depositUsed);
                if (!isFinite(actualReceive) || actualReceive < 0) actualReceive = feeAmount - depositUsed;
                var totalReceivedFee = feeAmount;
                var refundExcess = Math.max(0, dep - feeAmount);
                var feePercentText = '';
                if (st.cancelFee && st.cancelFee.rule === 'percent' && st.cancelFee.rate != null && isFinite(st.cancelFee.rate)) {
                    var pct = st.cancelFee.rate * 100;
                    feePercentText = (pct > 0 ? pct.toFixed(0) : '0') + '%';
                }
                if (feePercentText) {
                    html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>跑单费（${feePercentText}）：</strong></div><div class="receipt-summary-value">¥${feeAmount.toFixed(2)}</div></div>`;
                } else {
                    html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>跑单费（应收）：</strong></div><div class="receipt-summary-value">¥${feeAmount.toFixed(2)}</div></div>`;
                }
                html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>本次收款：</strong></div><div class="receipt-summary-value">¥${actualReceive.toFixed(2)}</div></div>`;
                if (refundExcess > 0) {
                    html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>多余定金待退：</strong></div><div class="receipt-summary-value">¥${refundExcess.toFixed(2)}</div></div>`;
                }
                html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>合计实收：</strong></div><div class="receipt-summary-value">¥${totalReceivedFee.toFixed(2)}</div></div>`;
                var resultLine = '跑单费 ¥' + feeAmount.toFixed(2);
                if (st.memo) resultLine += '；备注：' + st.memo;
                html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>结算结果：</strong></div><div class="receipt-summary-value">${resultLine}</div></div>`;
            } else if (st.type === 'normal') {
                // 正常结单：结算优惠块
                var drs = Array.isArray(st.discountReasons) ? st.discountReasons : [];
                if (drs.length > 0) {
                    html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>结算优惠：</strong></div></div>`;
                    drs.forEach(function (e) {
                        if (!e || !e.name) return;
                        var nm = String(e.name);
                        var amt = e.amount != null && isFinite(e.amount) ? Number(e.amount) : 0;
                        var rateText = '';
                        if (e.rate != null && isFinite(e.rate) && e.rate > 0) {
                            var rShow = e.rate;
                            if (rShow > 0.99) rShow = 0.99;
                            // 显示为 0.8× 这种形式
                            var rStr = rShow.toFixed(2);
                            if (rStr.endsWith('0')) rStr = rShow.toFixed(1);
                            if (rStr.endsWith('.0')) rStr = rStr.slice(0, -2);
                            rateText = rStr + '×';
                        }
                        var leftText = rateText ? (nm + '：' + rateText) : (nm + '：');
                        var rightText = amt > 0 ? ('-¥' + amt.toFixed(2)) : '';
                        if (!rightText) return;
                        html += `<div class="receipt-summary-coefficient-detail receipt-summary-row receipt-discount-row"><div class="receipt-summary-label">${leftText}</div><div class="receipt-summary-value">` +
                                `<span class="receipt-discount-amount">${rightText}</span></div></div>`;
                    });
                }

                // 合计实收与结算结果（正常结单：订单金额=应收，定金抵扣应收，本次收款，合计实收）
                html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>订单金额（应收）：</strong></div><div class="receipt-summary-value">¥${receivable.toFixed(2)}</div></div>`;
                html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>合计实收：</strong></div><div class="receipt-summary-value">¥${totalReceived.toFixed(2)}</div></div>`;

                var diff = totalReceived - receivable;
                var discountTotal = 0;
                if (Array.isArray(st.discountReasons)) {
                    st.discountReasons.forEach(function (e) {
                        var a = e && e.amount != null && isFinite(e.amount) ? Number(e.amount) : 0;
                        if (a > 0) discountTotal += a;
                    });
                }
                html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>结算结果：</strong></div><div class="receipt-summary-value">`;
                if (Math.abs(diff) < 0.005) {
                    html += `已结清。`;
                } else if (diff < 0) {
                    // 少收（有优惠）
                    var totalDiscount = discountTotal > 0 ? discountTotal : (receivable - totalReceived);
                    html += `本次共减免 ¥${totalDiscount.toFixed(2)}。`;
                } else {
                    // 多收
                    html += `多收 ¥${diff.toFixed(2)}，应找零/退款给客户。`;
                }
                html += `</div></div>`;
            } else if (st.type === 'waste_fee') {
                // 废稿结算：小票不展示已收定金、定金抵扣废稿费，结算结果只写金额
                var wf = st.wasteFee || {};
                var baseWaste = (wf.feeAmount != null && isFinite(wf.feeAmount)) ? Number(wf.feeAmount) : (wf.totalReceivable != null && isFinite(wf.totalReceivable)) ? Number(wf.totalReceivable) : (wf.totalWasteReceivable != null && isFinite(wf.totalWasteReceivable)) ? Number(wf.totalWasteReceivable) : (actual + dep);
                var usedDeposit = Math.min(dep, baseWaste);
                var actualReceive = st.amount != null ? Number(st.amount) : (baseWaste - usedDeposit);
                if (!isFinite(actualReceive) || actualReceive < 0) actualReceive = baseWaste - usedDeposit;
                var totalWasteReceived = baseWaste;
                var refundExcess = Math.max(0, dep - baseWaste);
                html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>废稿费（应收）：</strong></div><div class="receipt-summary-value">¥${baseWaste.toFixed(2)}</div></div>`;
                html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>本次收款：</strong></div><div class="receipt-summary-value">¥${actualReceive.toFixed(2)}</div></div>`;
                if (refundExcess > 0) {
                    html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>多余定金待退：</strong></div><div class="receipt-summary-value">¥${refundExcess.toFixed(2)}</div></div>`;
                }
                html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>合计实收：</strong></div><div class="receipt-summary-value">¥${totalWasteReceived.toFixed(2)}</div></div>`;
                html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>结算结果：</strong></div><div class="receipt-summary-value">废稿费 ¥${baseWaste.toFixed(2)}</div></div>`;
            } else if (st.type !== 'normal' && st.type !== 'waste_fee') {
                // 其他类型统一展示合计与简单结果
                html += `<div class="receipt-summary-row"><div class="receipt-summary-label"><strong>合计实收：</strong></div><div class="receipt-summary-value">¥${totalReceived.toFixed(2)}</div></div>`;
            }
        }

        html += `</div>`; // end of settlement block
    }

            // 添加底部内容
            html += `<div class="receipt-footer">`;
                        
            // 添加自定义底部文本1（如果设置了）
            if (defaultSettings.receiptCustomization.footerText1) {
                html += `<p class="receipt-footer-text1">${defaultSettings.receiptCustomization.footerText1}</p>`;
            }
                        
            // 添加底部图片（如果设置了）
            if (defaultSettings.receiptCustomization.footerImage) {
                html += `<div class="receipt-footer-image"><img src="${defaultSettings.receiptCustomization.footerImage}" class="receipt-img receipt-theme-${currentTheme}" alt="尾部图片" style="max-width: 200px; height: auto; margin-top: 0.5rem;" /></div>`;
            }
                        
            // 添加自定义底部文本2（如果设置了）
            if (defaultSettings.receiptCustomization.footerText2) {
                html += `<p class="receipt-footer-text2">${defaultSettings.receiptCustomization.footerText2}</p>`;
            }
                        
            html += `</div>`;
            html += `</div>`;
    
    container.innerHTML = html;
    
    // 手机上自动缩放小票以适应屏幕宽度（保持 400px 内部排版不变）
    adjustReceiptScale();
}

// 冻结来源调试：在控制台执行 inspectQuoteFreezeSource() 查看当前小票字段来源（snapshot / fallback）
function inspectQuoteFreezeSource() {
    if (!quoteData) {
        console.log('[freeze-inspect] 当前无 quoteData');
        return;
    }

    var hasSnapshot = function (k) { return quoteData[k] !== undefined && quoteData[k] !== null; };
    var report = {
        sameModelMode: hasSnapshot('sameModelMode') ? 'snapshot' : 'fallback(defaultSettings)',
        sameModelMinusAmount: hasSnapshot('sameModelMinusAmount') ? 'snapshot' : 'fallback(defaultSettings)',
        usageValue: hasSnapshot('usage') ? 'snapshot' : 'fallback(by type/defaultSettings)',
        urgentValue: hasSnapshot('urgent') ? 'snapshot' : 'fallback(by type/defaultSettings)',
        discountValue: hasSnapshot('discount') ? 'snapshot' : 'fallback(by type/defaultSettings)',
        usageName: hasSnapshot('usageName') ? 'snapshot' : 'fallback(defaultSettings)',
        urgentName: hasSnapshot('urgentName') ? 'snapshot' : 'fallback(defaultSettings)',
        discountName: hasSnapshot('discountName') ? 'snapshot' : 'fallback(defaultSettings)',
        extraUpSelections: (Array.isArray(quoteData.extraUpSelections) && quoteData.extraUpSelections.every(function (s) { return s && s.value != null; })) ? 'snapshot' : 'fallback(partial/defaultSettings)',
        extraDownSelections: (Array.isArray(quoteData.extraDownSelections) && quoteData.extraDownSelections.every(function (s) { return s && s.value != null; })) ? 'snapshot' : 'fallback(partial/defaultSettings)',
        settlementRulesSnapshot: quoteData.settlementRulesSnapshot ? 'snapshot' : 'fallback(defaultSettings)'
    };

    console.table(report);
    return report;
}
window.inspectQuoteFreezeSource = inspectQuoteFreezeSource;

// 一键补快照（仅当前单，不改金额）：用于把老历史单补齐冻结字段
function backfillFreezeSnapshotForCurrentQuote() {
    if (!quoteData) {
        showGlobalToast('当前无小票数据，无法补快照');
        return;
    }

    if (!quoteData.id) {
        showGlobalToast('当前不是历史单，已按当前设置生成的单据无需补快照');
        return;
    }

    var idx = history.findIndex(function (h) { return h && h.id === quoteData.id; });
    if (idx === -1) {
        showGlobalToast('未在历史记录中找到当前单据');
        return;
    }

    var item = history[idx];
    if (!item) {
        showGlobalToast('历史单据读取失败');
        return;
    }

    // 仅补缺失字段，不改已有金额与结算结果
    if (item.sameModelMode == null) item.sameModelMode = defaultSettings.sameModelMode || 'coefficient';
    if (item.sameModelMinusAmount == null) item.sameModelMinusAmount = Number.isFinite(Number(defaultSettings.sameModelMinusAmount)) ? Math.max(0, Number(defaultSettings.sameModelMinusAmount)) : 0;

    if (item.usageName == null) item.usageName = (item.usageType && defaultSettings.usageCoefficients && defaultSettings.usageCoefficients[item.usageType] && defaultSettings.usageCoefficients[item.usageType].name) ? defaultSettings.usageCoefficients[item.usageType].name : '用途系数';
    if (item.urgentName == null) item.urgentName = (item.urgentType && defaultSettings.urgentCoefficients && defaultSettings.urgentCoefficients[item.urgentType] && defaultSettings.urgentCoefficients[item.urgentType].name) ? defaultSettings.urgentCoefficients[item.urgentType].name : '加急系数';
    if (item.discountName == null) item.discountName = (item.discountType && defaultSettings.discountCoefficients && defaultSettings.discountCoefficients[item.discountType] && defaultSettings.discountCoefficients[item.discountType].name) ? defaultSettings.discountCoefficients[item.discountType].name : '折扣系数';

    if (!item.settlementRulesSnapshot) {
        item.settlementRulesSnapshot = JSON.parse(JSON.stringify(defaultSettings.settlementRules || {}));
    }

    if (Array.isArray(item.extraUpSelections)) {
        item.extraUpSelections = item.extraUpSelections.map(function (s, i) {
            if (!s) return s;
            var m = (defaultSettings.extraPricingUp || []).find(function (x) { return x && x.id == s.id; }) || (defaultSettings.extraPricingUp || [])[i];
            var k = s.optionValue != null ? s.optionValue : s.selectedKey;
            var opt = (m && m.options && k != null && m.options[k] != null) ? m.options[k] : null;
            return {
                ...s,
                optionValue: s.optionValue != null ? s.optionValue : s.selectedKey,
                moduleName: s.moduleName || (m && m.name) || '扩展加价系数',
                optionName: s.optionName || (opt && opt.name) || s.selectedKey,
                value: (s.value != null) ? s.value : ((opt != null) ? (getCoefficientValue(opt) || 1) : 1)
            };
        });
    }

    if (Array.isArray(item.extraDownSelections)) {
        item.extraDownSelections = item.extraDownSelections.map(function (s, i) {
            if (!s) return s;
            var m = (defaultSettings.extraPricingDown || []).find(function (x) { return x && x.id == s.id; }) || (defaultSettings.extraPricingDown || [])[i];
            var k = s.optionValue != null ? s.optionValue : s.selectedKey;
            var opt = (m && m.options && k != null && m.options[k] != null) ? m.options[k] : null;
            return {
                ...s,
                optionValue: s.optionValue != null ? s.optionValue : s.selectedKey,
                moduleName: s.moduleName || (m && m.name) || '扩展折扣系数',
                optionName: s.optionName || (opt && opt.name) || s.selectedKey,
                value: (s.value != null) ? s.value : ((opt != null) ? (getCoefficientValue(opt) || 1) : 1)
            };
        });
    }

    history[idx] = item;
    saveData();

    // 同步当前引用并重绘小票
    quoteData = item;
    generateQuote();
    syncReceiptDrawerContent();

    showGlobalToast('已为当前历史单补齐冻结快照');
}
window.backfillFreezeSnapshotForCurrentQuote = backfillFreezeSnapshotForCurrentQuote;

// 一键补快照（全部历史单，不改金额）
function backfillFreezeSnapshotForAllHistory() {
    if (!Array.isArray(history) || history.length === 0) {
        showGlobalToast('暂无历史记录可补快照');
        return;
    }

    var updated = 0;

    history = history.map(function (item) {
        if (!item) return item;
        var changed = false;

        if (item.sameModelMode == null) {
            item.sameModelMode = defaultSettings.sameModelMode || 'coefficient';
            changed = true;
        }
        if (item.sameModelMinusAmount == null) {
            item.sameModelMinusAmount = Number.isFinite(Number(defaultSettings.sameModelMinusAmount)) ? Math.max(0, Number(defaultSettings.sameModelMinusAmount)) : 0;
            changed = true;
        }

        if (item.usageName == null) {
            item.usageName = (item.usageType && defaultSettings.usageCoefficients && defaultSettings.usageCoefficients[item.usageType] && defaultSettings.usageCoefficients[item.usageType].name) ? defaultSettings.usageCoefficients[item.usageType].name : '用途系数';
            changed = true;
        }
        if (item.urgentName == null) {
            item.urgentName = (item.urgentType && defaultSettings.urgentCoefficients && defaultSettings.urgentCoefficients[item.urgentType] && defaultSettings.urgentCoefficients[item.urgentType].name) ? defaultSettings.urgentCoefficients[item.urgentType].name : '加急系数';
            changed = true;
        }
        if (item.discountName == null) {
            item.discountName = (item.discountType && defaultSettings.discountCoefficients && defaultSettings.discountCoefficients[item.discountType] && defaultSettings.discountCoefficients[item.discountType].name) ? defaultSettings.discountCoefficients[item.discountType].name : '折扣系数';
            changed = true;
        }

        if (!item.settlementRulesSnapshot) {
            item.settlementRulesSnapshot = JSON.parse(JSON.stringify(defaultSettings.settlementRules || {}));
            changed = true;
        }

        if (Array.isArray(item.extraUpSelections)) {
            item.extraUpSelections = item.extraUpSelections.map(function (s, i) {
                if (!s) return s;
                var m = (defaultSettings.extraPricingUp || []).find(function (x) { return x && x.id == s.id; }) || (defaultSettings.extraPricingUp || [])[i];
                var k = s.optionValue != null ? s.optionValue : s.selectedKey;
                var opt = (m && m.options && k != null && m.options[k] != null) ? m.options[k] : null;
                var ns = {
                    ...s,
                    optionValue: s.optionValue != null ? s.optionValue : s.selectedKey,
                    moduleName: s.moduleName || (m && m.name) || '扩展加价系数',
                    optionName: s.optionName || (opt && opt.name) || s.selectedKey,
                    value: (s.value != null) ? s.value : ((opt != null) ? (getCoefficientValue(opt) || 1) : 1)
                };
                if (ns.optionValue !== s.optionValue || ns.moduleName !== s.moduleName || ns.optionName !== s.optionName || ns.value !== s.value) changed = true;
                return ns;
            });
        }

        if (Array.isArray(item.extraDownSelections)) {
            item.extraDownSelections = item.extraDownSelections.map(function (s, i) {
                if (!s) return s;
                var m = (defaultSettings.extraPricingDown || []).find(function (x) { return x && x.id == s.id; }) || (defaultSettings.extraPricingDown || [])[i];
                var k = s.optionValue != null ? s.optionValue : s.selectedKey;
                var opt = (m && m.options && k != null && m.options[k] != null) ? m.options[k] : null;
                var ns = {
                    ...s,
                    optionValue: s.optionValue != null ? s.optionValue : s.selectedKey,
                    moduleName: s.moduleName || (m && m.name) || '扩展折扣系数',
                    optionName: s.optionName || (opt && opt.name) || s.selectedKey,
                    value: (s.value != null) ? s.value : ((opt != null) ? (getCoefficientValue(opt) || 1) : 1)
                };
                if (ns.optionValue !== s.optionValue || ns.moduleName !== s.moduleName || ns.optionName !== s.optionName || ns.value !== s.value) changed = true;
                return ns;
            });
        }

        if (changed) updated += 1;
        return item;
    });

    saveData();
    if (quoteData && quoteData.id) {
        var current = history.find(function (h) { return h && h.id === quoteData.id; });
        if (current) quoteData = current;
        generateQuote();
        syncReceiptDrawerContent();
    }

    showGlobalToast('已补齐历史快照：' + updated + ' 条');
    return updated;
}
window.backfillFreezeSnapshotForAllHistory = backfillFreezeSnapshotForAllHistory;

// 同步小票抽屉内容为当前主小票 DOM
function syncReceiptDrawerContent() {
    const mainContainer = document.getElementById('quoteContent');
    const drawerContainer = document.getElementById('receiptDrawerContent');

    if (!drawerContainer) return;

    // 如果还没有主小票，但已有报价数据，先生成一次
    if ((!mainContainer || !mainContainer.innerHTML.trim()) && quoteData) {
        generateQuote();
    }

    if (!mainContainer || !mainContainer.innerHTML.trim()) {
        drawerContainer.innerHTML = '<p>请先在计算页完成一次报价计算</p>';
        return;
    }

    drawerContainer.innerHTML = mainContainer.innerHTML;
}

// 已收定：向下取整并更新
function roundDepositAmount(mode) {
    var inputEl = document.getElementById('receiptDepositInput');
    if (!inputEl) return;
    var base = parseFloat(inputEl.value) || 0;
    var val;
    if (mode === 'floor') val = Math.floor(base);
    else if (mode === 'ten') val = Math.floor(base / 10) * 10;
    else if (mode === 'hundred') val = Math.floor(base / 100) * 100;
    else return;
    val = Math.max(0, val);
    inputEl.value = val.toFixed(2);
    if (quoteData) {
        quoteData.depositReceived = val;
        generateQuote();
        syncReceiptDrawerContent();
    }
}

// 约定实收：取整并更新（报价金额=我要收取的，平台费=约定实收×费率）
function roundAgreedAmount(mode) {
    if (!quoteData) return;
    var base = quoteData.totalBeforePlatformFee != null ? quoteData.totalBeforePlatformFee : (quoteData.finalTotal || 0);
    var val;
    if (mode === 'round') val = Math.round(base);
    else if (mode === 'ceil') val = Math.ceil(base);
    else if (mode === 'floor') val = Math.floor(base);
    else if (mode === 'ten') val = Math.floor(base / 10) * 10;
    else if (mode === 'hundred') val = Math.floor(base / 100) * 100;
    else return;
    quoteData.agreedAmount = Math.max(0, val);
    quoteData.hasManualAgreed = true;
    quoteData.manualAgreedBase = quoteData.totalBeforePlatformFee != null ? Number(quoteData.totalBeforePlatformFee) : null;
    // 平台费 = 约定实收×费率，客户实付 = 约定实收+平台费
    var rate = (quoteData.platformFee != null ? quoteData.platformFee : 0) / 100;
    quoteData.platformFeeAmount = Math.round(quoteData.agreedAmount * rate);
    quoteData.finalTotal = quoteData.agreedAmount + quoteData.platformFeeAmount;
    updateAgreedAmountBar();
    generateQuote();
    syncReceiptDrawerContent();
}
// 确认已收定金
function confirmDepositReceived() {
    if (!quoteData) return;
    quoteData.depositConfirmed = true;
    
    // 如果之前没有填过金额，默认填入建议定金
    if (!quoteData.depositReceived || quoteData.depositReceived <= 0) {
        var finalPays = quoteData.finalTotal != null ? quoteData.finalTotal : (quoteData.agreedAmount || 0);
        var rate = (defaultSettings && defaultSettings.depositRate != null) ? Number(defaultSettings.depositRate) : 0.3;
        quoteData.depositReceived = Math.round(finalPays * rate * 100) / 100;
    }
    
    updateAgreedAmountBar();
    generateQuote();
    syncReceiptDrawerContent();
}

// 取消已收定金
function cancelDepositReceived() {
    if (!quoteData) return;
    if (!confirm('确定要取消已收定金记录吗？这会从小票正文中移除该行。')) return;
    
    quoteData.depositConfirmed = false;
    quoteData.depositReceived = 0;
    
    updateAgreedAmountBar();
    generateQuote();
    syncReceiptDrawerContent();
}

// 约定实收：同步 UI 栏
function updateAgreedAmountBar() {
    var bar = document.getElementById('receiptAgreedAmountBar');
    var calcEl = document.getElementById('receiptCalcAmount');
    var inputEl = document.getElementById('agreedAmountInput');
    if (!bar || !calcEl || !inputEl) return;
    if (!quoteData) {
        bar.classList.add('d-none');
        return;
    }
    bar.classList.remove('d-none');
    var calc = quoteData.totalBeforePlatformFee != null ? quoteData.totalBeforePlatformFee : (quoteData.finalTotal || 0);
    var agreed = quoteData.agreedAmount != null ? quoteData.agreedAmount : calc;
    calcEl.textContent = '¥' + calc.toFixed(2);
    inputEl.value = agreed;

    // 手动改价提示：仅在当前为“手动约定金额”状态时展示
    var manualHintEl = document.getElementById('receiptAgreedManualHint');
    if (!manualHintEl) {
        manualHintEl = document.createElement('div');
        manualHintEl.id = 'receiptAgreedManualHint';
        manualHintEl.style.cssText = 'margin-top:4px;font-size:12px;color:#6b7280;';
        if (bar && bar.appendChild) bar.appendChild(manualHintEl);
    }
    if (manualHintEl) {
        var isManualActive = !!quoteData.hasManualAgreed;
        if (isManualActive) {
            manualHintEl.textContent = '已手动改价（金额变动后将自动重置）';
            manualHintEl.classList.remove('d-none');
        } else {
            manualHintEl.textContent = '';
            manualHintEl.classList.add('d-none');
        }
    }
    // 已收定金确认逻辑：需要手动确认后才显示输入框；默认不展示更符合“先出报价再收定金”的流程
    var confirmWrap = document.getElementById('depositConfirmContainer');
    var inputWrap = document.getElementById('depositInputContainer');
    var depositInputEl = document.getElementById('receiptDepositInput');

    // 兼容旧数据：仅当历史记录里确实有已收定金金额时，才视为已确认
    var dep = Number(quoteData.depositReceived || 0);
    if (dep > 0 && quoteData.depositConfirmed == null) quoteData.depositConfirmed = true;
    if (quoteData.depositConfirmed == null) quoteData.depositConfirmed = false;

    if (confirmWrap && inputWrap) {
        if (quoteData.depositConfirmed) {
            confirmWrap.classList.add('d-none');
            inputWrap.classList.remove('d-none');
        } else {
            confirmWrap.classList.remove('d-none');
            inputWrap.classList.add('d-none');
        }
    }

    if (depositInputEl) {
        depositInputEl.value = (quoteData.depositConfirmed && isFinite(dep) && dep > 0) ? dep.toFixed(2) : '';
    }

    // 顶部提示：报价金额下一行展示“需付定金”（与报价金额同款展示结构）
    var topRowEl = document.getElementById('receiptDepositHintTop');
    var topValEl = document.getElementById('receiptDepositAmountTop');
    if (topRowEl && topValEl) {
        if (quoteData.needDeposit) {
            var finalPays = quoteData.finalTotal != null ? quoteData.finalTotal : (quoteData.platformFeeAmount > 0 ? (agreed + quoteData.platformFeeAmount) : agreed);
            var rate = (defaultSettings && defaultSettings.depositRate != null) ? Number(defaultSettings.depositRate) : 0.3;
            var depositAmount = Math.round(finalPays * rate * 100) / 100;
            topValEl.textContent = '¥' + depositAmount.toFixed(2);
            topRowEl.classList.remove('d-none');
        } else {
            topValEl.textContent = '¥0.00';
            topRowEl.classList.add('d-none');
        }
    }

    inputEl.onchange = inputEl.oninput = function () {
        var v = parseFloat(inputEl.value);
        if (!isNaN(v) && v >= 0) {
            quoteData.agreedAmount = v;
            quoteData.hasManualAgreed = true;
            quoteData.manualAgreedBase = quoteData.totalBeforePlatformFee != null ? Number(quoteData.totalBeforePlatformFee) : null;
            var rate = (quoteData.platformFee != null ? quoteData.platformFee : 0) / 100;
            quoteData.platformFeeAmount = Math.round(quoteData.agreedAmount * rate);
            quoteData.finalTotal = quoteData.agreedAmount + quoteData.platformFeeAmount;
            generateQuote();
            syncReceiptDrawerContent();
        }
    };
}

// 打开小票抽屉
function openReceiptDrawer() {
    const drawer = document.getElementById('receiptDrawer');
    if (!drawer) return;

    isReceiptDrawerOpen = true;

    // 确保先显示容器，再做开启动画
    drawer.classList.remove('d-none');
    drawer.classList.add('open');

    // 同步当前小票内容
    syncReceiptDrawerContent();
    updateAgreedAmountBar();

    // 打开抽屉后再次根据当前屏幕尺寸调整小票缩放
    adjustReceiptScale();

    // 移动端防止背景滚动，PC 端仍允许排单区滚动
    if (window.innerWidth <= 768) {
        document.body.style.overflow = 'hidden';
    }
}

// 关闭小票抽屉
function closeReceiptDrawer() {
    const drawer = document.getElementById('receiptDrawer');
    if (!drawer) return;

    isReceiptDrawerOpen = false;

    drawer.classList.remove('open');
    document.body.style.overflow = '';

    // 等待过渡动画结束后再隐藏容器，避免闪烁
    setTimeout(() => {
        if (!isReceiptDrawerOpen && drawer) {
            drawer.classList.add('d-none');
        }
    }, 250);
}

// 从记录页打开小票时设为 true，关闭小票时若为 true 则返回记录页
window.receiptOpenedFromRecord = false;
function setReceiptFromRecord() { window.receiptOpenedFromRecord = true; }
function maybeReturnToRecordAndCloseReceipt() {
    if (window.receiptOpenedFromRecord) {
        window.receiptOpenedFromRecord = false;
        showPage('record');
    }
    closeReceiptDrawer();
}

// 处理小票抽屉关闭（遮罩点击或关闭按钮）
function handleReceiptDrawerClose() {
    // 小票设置打开时：只关设置面板，不关小票抽屉，避免点击下半屏设置时误关小票
    const modal = document.getElementById('receiptCustomizationModal');
    if (modal && !modal.classList.contains('d-none')) {
        closeReceiptCustomizationPanel();
        return;
    }
    maybeReturnToRecordAndCloseReceipt();
}

// 在小票页内点击“排单”悬浮球时，复用保存到历史记录的逻辑
function handleReceiptSchedule() {
    if (window.editingHistoryId) {
        openReceiptScheduleChoiceModal();
        return;
    }
    saveToHistory();

    // 待接企划：在小票页点击“保存”才视为进入排单
    if (window.currentIncomingProjectId) {
        mgUpdateProjectStatus(window.currentIncomingProjectId, 'SCHEDULED');
        if (typeof mgClearIncomingContext === 'function') mgClearIncomingContext();
    }

    maybeReturnToRecordAndCloseReceipt();
}

// 打开小票页排单保存方式选择弹窗
function openReceiptScheduleChoiceModal() {
    var modal = document.getElementById('receiptScheduleChoiceModal');
    if (modal) {
        modal.classList.remove('d-none');
        modal.setAttribute('aria-hidden', 'false');
    }
}

// 关闭小票页排单保存方式选择弹窗
function closeReceiptScheduleChoiceModal() {
    var modal = document.getElementById('receiptScheduleChoiceModal');
    if (modal) {
        modal.classList.add('d-none');
        modal.setAttribute('aria-hidden', 'true');
    }
}

// 弹窗中选择「覆盖原订单」
function receiptScheduleChoiceOverwrite() {
    closeReceiptScheduleChoiceModal();
    saveToHistory();
    maybeReturnToRecordAndCloseReceipt();
}

// 弹窗中选择「另存为新排单」
function receiptScheduleChoiceSaveAsNew() {
    closeReceiptScheduleChoiceModal();
    window.editingHistoryId = null;
    saveToHistory();
    maybeReturnToRecordAndCloseReceipt();
}

// 打开计算页保存方式选择弹窗
function openCalculatorSaveChoiceModal() {
    var modal = document.getElementById('calculatorSaveChoiceModal');
    if (modal) {
        modal.classList.remove('d-none');
        modal.setAttribute('aria-hidden', 'false');
    }
}

// 关闭计算页保存方式选择弹窗
function closeCalculatorSaveChoiceModal() {
    var modal = document.getElementById('calculatorSaveChoiceModal');
    if (modal) {
        modal.classList.add('d-none');
        modal.setAttribute('aria-hidden', 'true');
    }
}

// 计算页弹窗中选择「覆盖原订单」
function calculatorSaveChoiceOverwrite() {
    closeCalculatorSaveChoiceModal();
    saveToHistory();
    if (typeof closeCalculatorDrawer === 'function') closeCalculatorDrawer();
    showPage('quote');
}

// 计算页弹窗中选择「另存为新排单」
function calculatorSaveChoiceSaveAsNew() {
    closeCalculatorSaveChoiceModal();
    window.editingHistoryId = null;
    saveToHistory();
    if (typeof closeCalculatorDrawer === 'function') closeCalculatorDrawer();
    showPage('quote');
}

// 手机上自动缩放小票以适应屏幕宽度（保持 400px 内部排版不变）
function adjustReceiptScale() {
    const receipts = document.querySelectorAll('.receipt');
    if (!receipts.length) return;
    
    receipts.forEach(receipt => {
        // 只在手机端（屏幕宽度 <= 768px）进行缩放
        if (window.innerWidth <= 768) {
            // 计算缩放比例：屏幕宽度 - 左右边距（约 3rem = 48px）后，除以 400px
            const screenWidth = window.innerWidth;
            const padding = 48; // 左右各 1.5rem，共约 48px
            const availableWidth = screenWidth - padding;
            const scale = Math.min(availableWidth / 400, 1); // 不超过 1（不放大）
            
            receipt.style.transform = 'scale(' + scale + ')';
            receipt.style.transformOrigin = 'top center';
        } else {
            // 桌面端：移除缩放
            receipt.style.transform = '';
            receipt.style.transformOrigin = '';
        }
    });
}

// 窗口大小改变时重新调整缩放
window.addEventListener('resize', function() {
    if (document.querySelector('.receipt')) {
        adjustReceiptScale();
    }
});

// 保存报价为图片
async function saveQuoteAsImage() {
    if (!quoteData) {
        alert('请先生成报价单！');
        return;
    }
    
    // 优先使用隐藏的主小票真源（避免抽屉样式干扰截图）
    const receipt =
        document.querySelector('.quote-main-receipt-section .receipt') ||
        document.querySelector('#receiptDrawerContent .receipt') ||
        document.querySelector('.receipt');
    if (!receipt) {
        alert('找不到报价单元素！');
        return;
    }
    
    // 截图前固定宽度和移除缩放，确保保存原始400px尺寸的高清图片
    const oldWidth = receipt.style.width;
    const oldMinWidth = receipt.style.minWidth;
    const oldTransform = receipt.style.transform;
    const oldTransformOrigin = receipt.style.transformOrigin;
    
    receipt.style.width = '400px';
    receipt.style.minWidth = '400px';
    receipt.style.transform = ''; // 移除缩放，确保是原始400px大小
    receipt.style.transformOrigin = '';
    
    // 等待一下，确保样式生效
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
        const canvas = await html2canvas(receipt, {
            scale: 3, // 提高分辨率：3倍缩放，400px -> 1200px，更清晰
            useCORS: true,
            logging: false,
            width: 400, // 明确指定宽度
            height: receipt.scrollHeight // 使用实际高度
        });
        
        const filename = `报价单_${quoteData.clientId}_${Date.now()}.png`;
        // 更精确地区分“手机/平板”与“桌面端”，避免桌面浏览器也走分享流程
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
        const isMobile = isTouchDevice && window.innerWidth <= 768;
        
        if (isMobile) {
            // 手机端：直接触发系统分享，用户在分享界面选"保存图片"即可
            canvas.toBlob(async function (blob) {
                const file = new File([blob], filename, { type: 'image/png' });
                
                // 检查是否支持分享文件
                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({ files: [file], title: '报价单' });
                        // 分享成功（用户选择了保存或发送）
                        showGlobalToast('小票图片保存成功');
                    } catch (err) {
                        // 用户取消分享，不做任何提示
                        if (err.name !== 'AbortError') {
                            // 其他错误，尝试直接下载
                            triggerDownload(canvas.toDataURL('image/png'), filename);
                            showGlobalToast('小票图片保存成功');
                        }
                    }
                } else {
                    // 不支持分享，直接下载（图片会存到"下载"文件夹）
                    triggerDownload(canvas.toDataURL('image/png'), filename);
                    showGlobalToast('小票图片保存成功');
                }
            }, 'image/png');
        } else {
            // 桌面端：直接下载
            triggerDownload(canvas.toDataURL('image/png'), filename);
            showGlobalToast('小票图片保存成功');
        }
    } catch (error) {
        console.error('保存图片失败:', error);
        alert('保存图片失败，请重试！');
    } finally {
        // 恢复原始样式
        receipt.style.width = oldWidth;
        receipt.style.minWidth = oldMinWidth;
        receipt.style.transform = oldTransform;
        receipt.style.transformOrigin = oldTransformOrigin;
        // 如果是手机端，重新应用缩放
        if (window.innerWidth <= 768) {
            adjustReceiptScale();
        }
    }
}

// 触发下载
function triggerDownload(dataUrl, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    
    // 确保在用户交互上下文中执行点击
    try {
        // 对于某些浏览器，需要使用 setTimeout 来确保在事件循环中执行
        setTimeout(() => {
            link.click();
            // 延迟移除链接，确保下载操作完成
            setTimeout(() => {
                document.body.removeChild(link);
            }, 100);
        }, 0);
    } catch (error) {
        console.error('下载失败:', error);
        // 失败时尝试直接点击
        link.click();
        document.body.removeChild(link);
    }
}

// 轻量提示：在底部显示一条不打断操作的消息
let globalToastTimer = null;
function showGlobalToast(message, duration = 2000) {
    const toast = document.getElementById('globalToast');
    if (!toast) {
        console.log(message);
        return;
    }
    toast.textContent = message;
    toast.classList.remove('d-none');
    // 触发表现动画
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    if (globalToastTimer) {
        clearTimeout(globalToastTimer);
    }
    globalToastTimer = setTimeout(() => {
        toast.classList.remove('show');
        globalToastTimer = setTimeout(() => {
            toast.classList.add('d-none');
        }, 200);
    }, duration);
}

// 网络守护：断网提示 + 手动重试 + 自动重连探测
function mgInitNetworkGuard() {
    if (window.__mgNetworkGuardInited) return;
    window.__mgNetworkGuardInited = true;

    const state = {
        bar: null,
        text: null,
        retryBtn: null,
        intervalId: null,
        probing: false,
        wasOfflineShown: false,
        autoReloadLocked: false
    };

    function ensureBar() {
        if (state.bar) return;
        const bar = document.createElement('div');
        bar.id = 'networkGuardBar';
        bar.style.cssText = [
            'position:fixed',
            'left:50%',
            'top:12px',
            'transform:translateX(-50%)',
            'z-index:10001',
            'max-width:min(92vw,560px)',
            'width:calc(100% - 24px)',
            'padding:10px 12px',
            'border-radius:10px',
            'background:rgba(30,41,59,0.92)',
            'color:#fff',
            'display:none',
            'align-items:center',
            'justify-content:space-between',
            'gap:10px',
            'box-shadow:0 8px 24px rgba(0,0,0,.25)'
        ].join(';');

        const text = document.createElement('div');
        text.textContent = '网络异常，正在尝试重连...';
        text.style.cssText = 'font-size:13px;line-height:1.35;';

        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.textContent = '重试';
        retryBtn.style.cssText = [
            'border:none',
            'background:#4f46e5',
            'color:#fff',
            'padding:6px 12px',
            'border-radius:8px',
            'font-size:12px',
            'cursor:pointer',
            'white-space:nowrap'
        ].join(';');
        retryBtn.onclick = function () {
            probeAndRecover(false, true);
        };

        bar.appendChild(text);
        bar.appendChild(retryBtn);
        document.body.appendChild(bar);

        state.bar = bar;
        state.text = text;
        state.retryBtn = retryBtn;
    }

    function showBar(msg) {
        ensureBar();
        if (msg) state.text.textContent = msg;
        state.bar.style.display = 'flex';
        state.wasOfflineShown = true;
        if (!state.intervalId) {
            state.intervalId = setInterval(function () {
                probeAndRecover(false, false);
            }, 15000);
        }
    }

    function hideBar() {
        if (!state.bar) return;
        state.bar.style.display = 'none';
        if (state.intervalId) {
            clearInterval(state.intervalId);
            state.intervalId = null;
        }
    }

    async function probeConnectivity() {
        const ctrl = new AbortController();
        const timer = setTimeout(function () { ctrl.abort(); }, 5000);
        try {
            // 使用同源探测，附带时间戳避免缓存
            await fetch(window.location.href.split('#')[0] + '?mg_ping=' + Date.now(), {
                method: 'GET',
                cache: 'no-store',
                mode: 'no-cors',
                signal: ctrl.signal
            });
            clearTimeout(timer);
            return true;
        } catch (e) {
            clearTimeout(timer);
            return false;
        }
    }

    async function probeAndRecover(autoReload, fromManual) {
        if (state.probing) return;
        state.probing = true;
        const ok = await probeConnectivity();
        state.probing = false;

        if (ok) {
            hideBar();
            if (state.wasOfflineShown && !state.autoReloadLocked && autoReload) {
                state.autoReloadLocked = true;
                if (typeof showGlobalToast === 'function') showGlobalToast('网络已恢复，正在重连页面...');
                setTimeout(function () {
                    window.location.reload();
                }, 700);
                return;
            }
            if (fromManual && typeof showGlobalToast === 'function') {
                showGlobalToast('网络已恢复');
            }
        } else {
            showBar('网络异常，正在尝试重连...');
            if (fromManual && typeof showGlobalToast === 'function') {
                showGlobalToast('仍未连通，请稍后再试');
            }
        }
    }

    window.addEventListener('offline', function () {
        showBar('检测到网络中断，请检查网络后重试');
    });

    window.addEventListener('online', function () {
        probeAndRecover(true, false);
    });

    window.addEventListener('focus', function () {
        if (state.wasOfflineShown || !navigator.onLine) probeAndRecover(false, false);
    });

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && (state.wasOfflineShown || !navigator.onLine)) {
            probeAndRecover(false, false);
        }
    });

    // 首次进入即检查一次
    if (!navigator.onLine) {
        showBar('检测到网络中断，请检查网络后重试');
    }
}

// 保存到历史记录
function saveToHistory() {
    if (!quoteData) {
        alert('请先生成报价单！');
        return;
    }
    
    // 从小票页同步当前输入到 quoteData，避免仅在小票页修改「已收定」「约定实收」后点保存未生效
    var depositEl = document.getElementById('receiptDepositInput');
    if (depositEl) {
        var dv = parseFloat(depositEl.value);
        if (!isNaN(dv) && dv >= 0) quoteData.depositReceived = dv;
    }
    var agreedEl = document.getElementById('agreedAmountInput');
    if (agreedEl) {
        var av = parseFloat(agreedEl.value);
        if (!isNaN(av) && av >= 0) {
            quoteData.agreedAmount = av;
            quoteData.hasManualAgreed = true;
            quoteData.manualAgreedBase = quoteData.totalBeforePlatformFee != null ? Number(quoteData.totalBeforePlatformFee) : null;
            var rate = (quoteData.platformFee != null ? quoteData.platformFee : 0) / 100;
            quoteData.platformFeeAmount = Math.round(quoteData.agreedAmount * rate);
            quoteData.finalTotal = quoteData.agreedAmount + quoteData.platformFeeAmount;
        }
    }
    
    var savedOrderId = null;

    // 检查是否在编辑模式下
    if (window.editingHistoryId) {
        // 更新现有排单
        const editingId = window.editingHistoryId;
        const index = history.findIndex(item => item.id === editingId);
        if (index !== -1) {
            const existing = history[index];
            const prevLen = (existing.productDoneStates || []).length;
            const newLen = (quoteData.productPrices || []).length;
            let doneStates = existing.productDoneStates;
            if (!Array.isArray(doneStates)) doneStates = (existing.productPrices || []).map(() => false);
            if (newLen !== prevLen) {
                doneStates = (quoteData.productPrices || []).map((_, i) => (doneStates[i] === true));
            }
            history[index] = {
                ...quoteData,
                id: editingId,
                productDoneStates: doneStates,
                productDailyDone: Array.isArray(existing.productDailyDone) ? existing.productDailyDone : [],
                settlement: existing.settlement,
                status: existing.status
            };
            savedOrderId = editingId;
            showGlobalToast('排单已更新！');
        } else {
            showGlobalToast('未找到要更新的排单！');
            window.editingHistoryId = null;
            return;
        }
        window.editingHistoryId = null;
    } else {
        // 添加新排单，补全 productDoneStates（制品+赠品）
        const productLen = (quoteData.productPrices || []).length;
        const giftLen = (quoteData.giftPrices || []).length;
        const productDoneStates = Array(productLen + giftLen).fill(false);
        const newId = Date.now();
        history.unshift({
            id: newId,
            ...quoteData,
            productDoneStates,
            productDailyDone: []
        });
        savedOrderId = newId;
        showGlobalToast('报价单已加入排单！');
        // 新单保存后清空当前备注，避免下一单未填备注时沿用本单备注
        if (defaultSettings) defaultSettings.orderRemark = '';
        var orderRemarkTextEl = document.getElementById('orderRemarkText');
        if (orderRemarkTextEl) orderRemarkTextEl.value = '';
        if (typeof updateOrderRemarkPreview === 'function') updateOrderRemarkPreview();
    }
    
    saveData();
    
    // 云端同步：如果已启用云端模式，异步同步到 Supabase
    if (mgIsCloudEnabled() && localStorage.getItem('mg_cloud_enabled') === '1') {
        const savedItem = savedOrderId != null
            ? history.find(item => item.id === savedOrderId)
            : null;
        if (savedItem) {
            // 标记为未同步，同步成功后会移除
            markOrderUnsynced(savedItem.id);
            mgCloudUpsertOrder(savedItem).catch(err => {
                console.error('云端同步失败:', err);
                updateSyncStatus();
            });
        }
    }
    
    if (document.getElementById('quote') && document.getElementById('quote').classList.contains('active')) {
        renderScheduleCalendar();
        renderScheduleTodoSection();
        
        // 自动折叠小票显示：只隐藏小票图片（头图/尾图），不隐藏整个小票
        const quotePage = document.getElementById('quote');
        if (quotePage) {
            const scheduleSection = quotePage.querySelector('.schedule-section');
            quotePage.classList.add('quote-receipt-images-collapsed');
            // 滚动到排单日历区域
            if (scheduleSection) {
                setTimeout(function() {
                    scheduleSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        }
    }
    const searchInput = document.getElementById('historySearchInput');
    if (searchInput) applyHistoryFilters();
    else loadHistory();
}

// 排单制品完成状态：取单条排单时补全 productDoneStates（含制品+赠品）及 productNodeDoneStates（按节点计价的子节点状态）
function ensureProductDoneStates(item) {
    if (!item) return item;
    const productLen = Array.isArray(item.productPrices) ? item.productPrices.length : 0;
    const giftLen = Array.isArray(item.giftPrices) ? item.giftPrices.length : 0;
    const needLen = productLen + giftLen;
    const allPrices = (item.productPrices || []).concat(item.giftPrices || []);

    // 1. 补全制品级的完成状态（旧结构：布尔）
    if (item.productDoneStates == null) {
        item.productDoneStates = Array(needLen).fill(false);
    } else if (item.productDoneStates.length < needLen) {
        while (item.productDoneStates.length < needLen) item.productDoneStates.push(false);
    } else if (item.productDoneStates.length > needLen) {
        item.productDoneStates = item.productDoneStates.slice(0, needLen);
    }

    // 1.1 补全制品级完成数量（新结构：数量，支持 2/3）
    if (!Array.isArray(item.productDoneQuantities)) {
        item.productDoneQuantities = Array(needLen).fill(0).map((_, i) => {
            const qty = Math.max(1, parseInt(allPrices[i] && allPrices[i].quantity, 10) || 1);
            return item.productDoneStates[i] ? qty : 0;
        });
    } else {
        if (item.productDoneQuantities.length < needLen) {
            while (item.productDoneQuantities.length < needLen) item.productDoneQuantities.push(0);
        } else if (item.productDoneQuantities.length > needLen) {
            item.productDoneQuantities = item.productDoneQuantities.slice(0, needLen);
        }
        item.productDoneQuantities = item.productDoneQuantities.map((v, i) => {
            const qty = Math.max(1, parseInt(allPrices[i] && allPrices[i].quantity, 10) || 1);
            let n = parseInt(v, 10);
            if (!isFinite(n)) n = item.productDoneStates[i] ? qty : 0;
            return Math.max(0, Math.min(qty, n));
        });
    }

    // 统一：由完成数量反推布尔完成状态（兼容旧逻辑）
    item.productDoneStates = item.productDoneStates.map((_, i) => {
        const qty = Math.max(1, parseInt(allPrices[i] && allPrices[i].quantity, 10) || 1);
        return (item.productDoneQuantities[i] || 0) >= qty;
    });

    // 2. 补全按节点计价的子节点完成状态
    if (item.productNodeDoneStates == null) {
        item.productNodeDoneStates = Array(needLen).fill(null).map(() => []);
    }
    
    allPrices.forEach((p, i) => {
        if (p.productType === 'nodes' && Array.isArray(p.nodeDetails)) {
            const nodeCount = p.nodeDetails.length;
            if (!Array.isArray(item.productNodeDoneStates[i]) || item.productNodeDoneStates[i].length !== nodeCount) {
                // 如果长度不符，初始化或保留旧状态
                const oldStates = Array.isArray(item.productNodeDoneStates[i]) ? item.productNodeDoneStates[i] : [];
                item.productNodeDoneStates[i] = Array(nodeCount).fill(false).map((_, ni) => !!oldStates[ni]);
            }
        } else {
            item.productNodeDoneStates[i] = []; // 非节点计价模式，不处理或置空
        }
    });

    // productDailyDone 健壮性：过滤无效 productIndex/nodeIndex
    if (Array.isArray(item.productDailyDone)) {
        const totalItems = productLen + giftLen;
        item.productDailyDone = item.productDailyDone.filter(function (e) {
            if (e.productIndex == null || e.productIndex < 0 || e.productIndex >= totalItems) return false;
            if (e.nodeIndex != null && (e.nodeIndex < 0 || !Number.isInteger(e.nodeIndex))) return false;
            return true;
        });
    } else {
        item.productDailyDone = [];
    }
    return item;
}

// 更新某条排单的子节点完成状态，并联动更新制品整体状态
function setScheduleNodeDone(scheduleId, productIndex, nodeIndex, done) {
    const item = history.find(h => h.id === scheduleId);
    if (!item) return;
    ensureProductDoneStates(item);
    
    if (!Array.isArray(item.productNodeDoneStates[productIndex])) {
        item.productNodeDoneStates[productIndex] = [];
    }
    
    // 更新子节点状态
    item.productNodeDoneStates[productIndex][nodeIndex] = !!done;
    
    // 联动判断：如果该制品所有子节点都完成了，则标记该制品整体完成
    const nodes = item.productNodeDoneStates[productIndex];
    const isAllNodesDone = nodes.length > 0 && nodes.every(n => n === true);
    const allPrices = (item.productPrices || []).concat(item.giftPrices || []);
    const qty = Math.max(1, parseInt(allPrices[productIndex] && allPrices[productIndex].quantity, 10) || 1);
    item.productDoneStates[productIndex] = isAllNodesDone;
    item.productDoneQuantities[productIndex] = isAllNodesDone ? qty : 0;
    
    saveData();
}

// 勾选子节点 TODO 的交互函数
function toggleScheduleNodeDone(checkbox, nodeIdx) {
    const id = parseInt(checkbox.dataset.id, 10);
    const idx = parseInt(checkbox.dataset.idx, 10);
    
    if (isNaN(id) || isNaN(idx)) return;
    
    const item = history.find(h => h.id === id);
    if (!item) return;
    
    ensureProductDoneStates(item);
    const wasAllDoneBefore = isOrderSettled(item); // 这里通常指订单，我们关注制品状态变化
    
    // 更新数据
    setScheduleNodeDone(id, idx, nodeIdx, checkbox.checked);
    
    // 云端同步：如果已启用云端模式，异步同步到 Supabase
    if (mgIsCloudEnabled() && localStorage.getItem('mg_cloud_enabled') === '1') {
        markOrderUnsynced(id);
        mgCloudUpsertOrder(item).catch(err => {
            console.error('云端同步失败:', err);
            updateSyncStatus();
        });
    }
    
    // 立即反馈 UI 样式
    const row = checkbox.closest('.schedule-todo-row');
    if (row) row.classList.toggle('schedule-todo-done', checkbox.checked);
    
    // 延迟重绘，以同步更新整单进度和日历
    setTimeout(function () {
        renderScheduleTodoSection();
        renderScheduleCalendar();
    }, 0);
}

// 更新某条排单的制品完成状态并持久化
function setScheduleProductDone(scheduleId, productIndex, done) {
    const item = history.find(h => h.id === scheduleId);
    if (!item) return;
    ensureProductDoneStates(item);
    if (!Array.isArray(item.productDoneStates) || productIndex < 0 || productIndex >= item.productDoneStates.length) return;

    const allPrices = (item.productPrices || []).concat(item.giftPrices || []);
    const qty = Math.max(1, parseInt(allPrices[productIndex] && allPrices[productIndex].quantity, 10) || 1);
    item.productDoneQuantities[productIndex] = !!done ? qty : 0;
    item.productDoneStates[productIndex] = !!done;
    
    // 如果是按节点计价模式，勾选制品整体时，自动同步所有子节点为该状态
    if (Array.isArray(item.productNodeDoneStates[productIndex]) && item.productNodeDoneStates[productIndex].length > 0) {
        item.productNodeDoneStates[productIndex] = item.productNodeDoneStates[productIndex].map(() => !!done);
    }
    
    saveData();
}

// 更新某条排单的制品完成数量（支持部分完成）
function setScheduleProductDoneQty(scheduleId, productIndex, doneQty) {
    const item = history.find(h => h.id === scheduleId);
    if (!item) return;
    ensureProductDoneStates(item);

    const allPrices = (item.productPrices || []).concat(item.giftPrices || []);
    if (productIndex < 0 || productIndex >= allPrices.length) return;

    const qty = Math.max(1, parseInt(allPrices[productIndex] && allPrices[productIndex].quantity, 10) || 1);
    const n = Math.max(0, Math.min(qty, parseInt(doneQty, 10) || 0));
    item.productDoneQuantities[productIndex] = n;
    item.productDoneStates[productIndex] = n >= qty;

    // 节点制品：仅在全未完成/全完成时联动节点状态
    if (Array.isArray(item.productNodeDoneStates[productIndex]) && item.productNodeDoneStates[productIndex].length > 0) {
        if (n === 0 || n >= qty) {
            const done = n >= qty;
            item.productNodeDoneStates[productIndex] = item.productNodeDoneStates[productIndex].map(() => done);
        }
    }

    saveData();
}

// 订单是否已完结（撤稿/废稿/结单后归档，不再在 todo/日历中显示）
function isOrderSettled(item) {
    if (!item || !item.settlement) return false;
    const t = item.settlement.type;
    return t === 'full_refund' || t === 'cancel_with_fee' || t === 'waste_fee' || t === 'normal';
}

// 某订单在指定日期是否有日计划（dailyPlan 或 nodeDailyPlan）
function hasDailyPlanForDate(item, targetYmd) {
    if (!item || !targetYmd) return false;
    const products = Array.isArray(item.productPrices) ? item.productPrices : [];
    const gifts = Array.isArray(item.giftPrices) ? item.giftPrices : [];
    const allItems = products.concat(gifts);
    for (var i = 0; i < allItems.length; i++) {
        var p = allItems[i];
        if (Array.isArray(p.dailyPlan)) {
            for (var j = 0; j < p.dailyPlan.length; j++) {
                if (normalizeYmd(p.dailyPlan[j].date) === targetYmd && (p.dailyPlan[j].targetQty || 0) > 0) return true;
            }
        }
        if (Array.isArray(p.nodeDailyPlan)) {
            for (var k = 0; k < p.nodeDailyPlan.length; k++) {
                if (normalizeYmd(p.nodeDailyPlan[k].date) === targetYmd && (p.nodeDailyPlan[k].targetQty || 0) > 0) return true;
            }
        }
    }
    return false;
}

// 按选中日期获取所有排单：返回该日期在时间范围内的所有排单（排除已完结）
function getScheduleItemsForDate(selectedDate) {
    if (!selectedDate) return [];
    const target = normalizeYmd(selectedDate);
    if (!target) return [];
    return history.filter(function (h) {
        if (isOrderSettled(h)) return false;
        ensureProductDoneStates(h);
        if (hasDailyPlanForDate(h, target)) return true;

        const start = h.startTime ? normalizeYmd(h.startTime) : null;
        const end = h.deadline ? normalizeYmd(h.deadline) : null;

        // start/deadline 都缺失：不显示
        if (!start && !end) return false;
        // 仅 start：只显示在 start 当天
        if (start && !end) return target === start;
        // 仅 deadline：只显示在 deadline 当天
        if (!start && end) return target === end;
        // start + deadline：显示在区间内
        return target >= start && target <= end;
    });
}

// 有排单时间的全部（有 startTime 或 deadline，排除已完结）
function getScheduleItemsAll() {
    return history.filter(h => {
        if (isOrderSettled(h)) return false;
        ensureProductDoneStates(h);
        const hasStart = (h.startTime && String(h.startTime).trim());
        const hasDeadline = (h.deadline && String(h.deadline).trim());
        return hasStart || hasDeadline;
    });
}

// 待排单：未设置排单时间（无 startTime 和 deadline，排除已完结）
function getScheduleItemsPending() {
    return history.filter(h => {
        if (isOrderSettled(h)) return false;
        ensureProductDoneStates(h);
        const hasStart = (h.startTime && String(h.startTime).trim());
        const hasDeadline = (h.deadline && String(h.deadline).trim());
        // 既无开始时间也无截稿时间视为待排单
        return !hasStart && !hasDeadline;
    });
}

window.scheduleTodoFilter = 'today';
function setScheduleTodoFilter(f) {
    window.scheduleTodoFilter = f;
    document.querySelectorAll('.schedule-todo-filter-btn').forEach(btn => {
        btn.classList.toggle('active', (btn.dataset.filter || '') === f);
    });
    debouncedRefreshScheduleView();
}

// 初始化换行模式
window.scheduleTodoWrapMode = localStorage.getItem('scheduleTodoWrapMode') || 'wrap';

function setScheduleTodoWrapMode(mode) {
    window.scheduleTodoWrapMode = mode;
    
    // 切换按钮状态
    document.querySelectorAll('.schedule-todo-wrap-btn').forEach(btn => {
        btn.classList.toggle('active', (btn.dataset.mode || '') === mode);
    });
    
    // 更新容器的data-mode属性，触发滑动效果
    const toggleContainer = document.querySelector('.schedule-todo-wrap-toggle');
    if (toggleContainer) {
        toggleContainer.setAttribute('data-mode', mode);
    }
    
    // 应用模式到所有chips wrap
    const chipsWraps = document.querySelectorAll('.schedule-todo-chips-wrap');
    chipsWraps.forEach(wrap => {
        if (mode === 'wrap') {
            wrap.classList.add('force-wrap');
            wrap.style.flexWrap = 'wrap';
            wrap.style.overflowX = 'hidden';
        } else {
            wrap.classList.remove('force-wrap');
            wrap.style.flexWrap = 'nowrap';
            wrap.style.overflowX = 'auto';
        }
    });
    
    // 保存到localStorage
    localStorage.setItem('scheduleTodoWrapMode', mode);
}

function getScheduleItemsByFilter() {
    const f = window.scheduleTodoFilter || 'today';
    const now = new Date();
    if (f === 'all') return getScheduleItemsAll();
    if (f === 'month') {
        // 使用日历当前显示的年月，而不是系统当前时间
        const y = window.scheduleCalendarYear || now.getFullYear();
        const m = window.scheduleCalendarMonth || now.getMonth() + 1;
        return getScheduleItemsForMonth(y, m);
    }
    if (f === 'pending') return getScheduleItemsPending();
    // incoming（待接）不从 history 里取，交由 renderScheduleTodoSection 单独渲染
    if (f === 'incoming') return [];
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const today = y + '-' + String(m).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    if (!window.scheduleSelectedDate) window.scheduleSelectedDate = today;
    return getScheduleItemsForDate(window.scheduleSelectedDate);
}

// 默认 todo：返回当前月内（与该月有交集）的所有排单（排除已完结）
function getScheduleItemsForMonth(year, month) {
    const monthStart = new Date(year, month - 1, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0);
    monthEnd.setHours(23, 59, 59, 999);
    return history.filter(function (h) {
        // 不再过滤已归档的排单，统计当月所有排单数据
        ensureProductDoneStates(h);

        const hasStart = h.startTime && String(h.startTime).trim();
        const hasDeadline = h.deadline && String(h.deadline).trim();
        if (!hasStart && !hasDeadline) return false;

        // 仅 startTime：只在 startTime 当天
        if (hasStart && !hasDeadline) {
            const d = new Date(h.startTime);
            if (isNaN(d.getTime())) return false;
            d.setHours(0, 0, 0, 0);
            return !(d < monthStart || d > monthEnd);
        }

        // 仅 deadline：只在 deadline 当天所在的月份显示
        if (!hasStart && hasDeadline) {
            const d = new Date(h.deadline);
            if (isNaN(d.getTime())) return false;
            d.setHours(0, 0, 0, 0);
            return !(d < monthStart || d > monthEnd);
        }

        // startTime + deadline：按区间交集
        const start = new Date(h.startTime);
        const end = new Date(h.deadline);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return !(end < monthStart || start > monthEnd);
    });
}

// 日期格式化为 YYYY-MM-DD（统一工具，减少重复）
function toYmd(d) {
    if (!d) return '';
    var x = d instanceof Date ? d : new Date(d);
    if (isNaN(x.getTime())) return '';
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}
// 同 toYmd，无效时返回 null（用于需区分“无日期”的场景）
function normalizeYmd(d) {
    var s = toYmd(d);
    return s || null;
}

function formatYmdCn(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr || '—';
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

// 订单制品总数量（按 quantity 求和：吧唧*1 + 拍立的*2 => 3）
function getOrderItemQuantityTotal(item) {
    const products = Array.isArray(item.productPrices) ? item.productPrices : [];
    const gifts = Array.isArray(item.giftPrices) ? item.giftPrices : [];
    const sum = (arr) => arr.reduce((s, p) => s + (parseInt(p.quantity, 10) || 1), 0);
    return sum(products) + sum(gifts);
}

// 订单已完成的制品数量（按 quantity 求和，支持部分完成）
function getOrderDoneQuantityTotal(item) {
    ensureProductDoneStates(item);
    const products = Array.isArray(item.productPrices) ? item.productPrices : [];
    const gifts = Array.isArray(item.giftPrices) ? item.giftPrices : [];
    const doneQty = Array.isArray(item.productDoneQuantities) ? item.productDoneQuantities : [];
    let done = 0;
    products.forEach((p, i) => {
        const qty = Math.max(1, parseInt(p.quantity, 10) || 1);
        done += Math.max(0, Math.min(qty, parseInt(doneQty[i], 10) || 0));
    });
    gifts.forEach((g, i) => {
        const idx = products.length + i;
        const qty = Math.max(1, parseInt(g.quantity, 10) || 1);
        done += Math.max(0, Math.min(qty, parseInt(doneQty[idx], 10) || 0));
    });
    return done;
}

function computeMonthProductStats(items) {
    let total = 0;
    let done = 0;
    items.forEach(item => {
        total += getOrderItemQuantityTotal(item);
        done += getOrderDoneQuantityTotal(item);
    });
    return { done, undone: Math.max(0, total - done), total };
}

function renderScheduleMonthTitleStats(year, month) {
    // 标题区月份（简洁格式：25.1）
    const monthEl = document.querySelector('.schedule-title-month');
    if (monthEl) monthEl.textContent = String(year).slice(-2) + '.' + month;

    // 标题区统计（只统计当前月）：(数字 数字 数字)
    const statsEl = document.querySelector('.schedule-title-row .schedule-title-stats');
    if (statsEl) {
        const items = getScheduleItemsForMonth(year, month);
        const s = computeMonthProductStats(items);
        statsEl.innerHTML =
            '(' +
            '<span class="schedule-stat schedule-stat-done">' + s.done + '</span>' +
            '<span class="schedule-stat schedule-stat-undone">' + s.undone + '</span>' +
            '<span class="schedule-stat schedule-stat-total">' + s.total + '</span>' +
            ')';
    }

    // 日期选择器默认值
    const now = new Date();
    const todayYmd = toYmd(now);
    const dateInput = document.getElementById('scheduleTitleDateInput');
    if (dateInput) dateInput.value = window.scheduleSelectedDate || todayYmd;

    // Today 按钮：当显示的月份不是本月，或选中日期不是今天时显示
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const isCurrentMonth = window.scheduleCalendarYear === currentYear && window.scheduleCalendarMonth === currentMonth;
    const isOtherDay = !!window.scheduleSelectedDate && window.scheduleSelectedDate !== todayYmd;
    const shouldShowToday = !isCurrentMonth || isOtherDay;
    const todayBtn = document.querySelector('.schedule-title-today-pill');
    if (todayBtn) todayBtn.classList.toggle('d-none', !shouldShowToday);
}

// 点击标题月份弹出日期选择
function openScheduleDatePicker() {
    const dateInput = document.getElementById('scheduleTitleDateInput');
    if (!dateInput) return;
    if (typeof dateInput.showPicker === 'function') dateInput.showPicker();
    else {
        dateInput.focus();
        dateInput.click();
    }
}

// 标题区日期选择器变化：跳转到对应月份并选中日期
function onScheduleTitleDateChange() {
    const dateInput = document.getElementById('scheduleTitleDateInput');
    if (!dateInput || !dateInput.value) return;
    const v = dateInput.value;
    window.scheduleSelectedDate = v;
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
        window.scheduleCalendarYear = d.getFullYear();
        window.scheduleCalendarMonth = d.getMonth() + 1;
    }
    debouncedRefreshScheduleView();
}

// 点击 Today 按钮：跳回今天
function scheduleTodoBackToToday() {
    const now = new Date();
    window.scheduleSelectedDate = toYmd(now);
    window.scheduleCalendarYear = now.getFullYear();
    window.scheduleCalendarMonth = now.getMonth() + 1;
    debouncedRefreshScheduleView();
}

// 当前批次：返回「最近截稿日」或「选中日所在截稿日」的那批排单。返回 { deadline: 'YYYY-MM-DD', items: schedule[] }（排除已完结）
function getScheduleBatchForDisplay(selectedDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items = history.filter(h => h.deadline && !isOrderSettled(h)).map(ensureProductDoneStates);
    if (items.length === 0) return { deadline: null, items: [] };
    if (selectedDate) {
        const target = normalizeYmd(selectedDate);
        if (!target) return { deadline: null, items: [] };
        const batch = items.filter(h => normalizeYmd(h.deadline) === target);
        return { deadline: target, items: batch };
    }
    const deadlines = [...new Set(items.map(h => normalizeYmd(h.deadline)))].filter(Boolean).sort();
    const todayStr = toYmd(today) || '';
    const nearest = deadlines.find(d => d >= todayStr) || deadlines[deadlines.length - 1];
    const batch = items.filter(h => normalizeYmd(h.deadline) === nearest);
    return { deadline: nearest, items: batch };
}

// 日历条带数据：指定年月，返回该月内可见的排单条带 { id, clientId, productCount, startDate, endDate }[]（已完结不渲染）
function getScheduleBarsForCalendar(year, month) {
    const bars = [];
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    history.forEach(item => {
        // 结单/撤稿/废稿：彩条也要继续显示（但在渲染时会沉底并显示划线样式）
        if (!item.startTime && !item.deadline) return;
        // 已完成（所有制品 done）：彩条也要继续显示（但在渲染时会沉底并显示划线样式）

        const hasStart = item.startTime && String(item.startTime).trim();
        const hasDeadline = item.deadline && String(item.deadline).trim();
        if (!hasStart && !hasDeadline) return;

        let start, end;
        if (hasStart && hasDeadline) {
            start = new Date(item.startTime);
            end = new Date(item.deadline);
        } else if (hasStart) {
            start = end = new Date(item.startTime);
        } else { // 仅 deadline
            start = end = new Date(item.deadline);
        }

        if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        if (end < monthStart || start > monthEnd) return;
        const startDate = toYmd(start);
        const endDate = toYmd(end);
        const productCount = getOrderItemQuantityTotal(item);
        bars.push({ id: item.id, clientId: item.clientId || '', productCount, startDate, endDate });
    });

    // 排序逻辑：完全复刻 Todo 卡片排序 (方案 A)
    bars.sort((a_bar, b_bar) => {
        const a = history.find(h => h.id === a_bar.id);
        const b = history.find(h => h.id === b_bar.id);
        if (!a || !b) return 0;

        function pickSortTime(it) {
            // 优先级：deadline -> startTime -> timestamp
            const cands = [it.deadline, it.startTime, it.timestamp];
            for (let i = 0; i < cands.length; i++) {
                const v = cands[i];
                if (!v) continue;
                const d = new Date(v);
                const t = d.getTime();
                if (isFinite(t)) return t;
            }
            return Number.POSITIVE_INFINITY;
        }

        const ta = pickSortTime(a);
        const tb = pickSortTime(b);
        if (ta !== tb) return ta - tb;

        const aSettled = isOrderSettled(a);
        const bSettled = isOrderSettled(b);
        if (aSettled !== bSettled) return Number(aSettled) - Number(bSettled);

        // 同时间：未完成排前；已完成排后；已结单最沉底
        const aTotal = (Array.isArray(a.productPrices) ? a.productPrices.length : 0) + (Array.isArray(a.giftPrices) ? a.giftPrices.length : 0);
        const bTotal = (Array.isArray(b.productPrices) ? b.productPrices.length : 0) + (Array.isArray(b.giftPrices) ? b.giftPrices.length : 0);
        const aDone = aTotal > 0 && (a.productDoneStates || []).filter(Boolean).length === aTotal;
        const bDone = bTotal > 0 && (b.productDoneStates || []).filter(Boolean).length === bTotal;

        if (aDone !== bDone) return Number(aDone) - Number(bDone);

        return a.id - b.id; // 稳定排序
    });

    return bars;
}

// 彩条配色名称（与 12 色基础色一一对应）
var SCHEDULE_COLOR_NAMES = [
    '晨光青', '雾霁蓝', '樱桃粉', '薄荷绿',
    '薰衣紫', '向日黄', '暖茶棕', '蜜橙',
    '海玻青', '可可棕', '云雾灰', '石榴红'
];

var SCHEDULE_COLOR_LAST_INDEX_KEY = 'scheduleBarColorLastIndex';

function getLastScheduleColorIndex() {
    try {
        var v = localStorage.getItem(SCHEDULE_COLOR_LAST_INDEX_KEY);
        var n = parseInt(v, 10);
        if (isNaN(n) || n < 0) return -1;
        return n;
    } catch (e) {
        return -1;
    }
}

function setLastScheduleColorIndex(idx) {
    try {
        localStorage.setItem(SCHEDULE_COLOR_LAST_INDEX_KEY, String(idx));
    } catch (e) {}
}

// 初始化计算页当前颜色预览
function initScheduleColorPreview() {
    var isDark = document.documentElement.classList.contains('theme-dark');
    var colors = isDark ? SCHEDULE_BAR_COLORS_DARK : SCHEDULE_BAR_COLORS;
    if (!colors || !colors.length) return;

    var lastIdx = getLastScheduleColorIndex();
    var defaultIdx = (lastIdx + 1 + colors.length) % colors.length;
    if (isNaN(defaultIdx) || defaultIdx < 0 || defaultIdx >= colors.length) defaultIdx = 0;

    var currentIdx = typeof window.currentScheduleColorIndex === 'number'
        ? window.currentScheduleColorIndex
        : defaultIdx;
    window.currentScheduleColorIndex = currentIdx;

    updateScheduleColorPreviewUI(currentIdx);
}

function updateScheduleColorPreviewUI(idx) {
    var isDark = document.documentElement.classList.contains('theme-dark');
    var colors = isDark ? SCHEDULE_BAR_COLORS_DARK : SCHEDULE_BAR_COLORS;
    var dotColors = SCHEDULE_BAR_DOT_COLORS;
    var dotEl = document.getElementById('scheduleColorPreviewDot');
    if (dotEl) dotEl.style.backgroundColor = dotColors[idx] || colors[idx];
}

// 打开/关闭彩条色板
function openScheduleColorPicker(event) {
    if (event) event.stopPropagation();
    var pop = document.getElementById('scheduleColorPickerPopover');
    var grid = document.getElementById('scheduleColorPopoverGrid');
    if (!pop || !grid) return;

    if (!pop.classList.contains('d-none')) {
        closeScheduleColorPicker();
        return;
    }

    var isDark = document.documentElement.classList.contains('theme-dark');
    var dotColors = SCHEDULE_BAR_DOT_COLORS;
    
    var currentIdx = typeof window.currentScheduleColorIndex === 'number'
        ? window.currentScheduleColorIndex
        : 0;

    var html = '';
    for (var i = 0; i < dotColors.length; i++) {
        var active = i === currentIdx ? ' active' : '';
        html += '<div class="theme-dot-item' + active + '" data-color-idx="' + i + '" title="' + SCHEDULE_COLOR_NAMES[i] + '" style="background-color:' + dotColors[i] + '"></div>';
    }
    grid.innerHTML = html;

    grid.onclick = function (e) {
        var dot = e.target.closest('.theme-dot-item');
        if (!dot) return;
        var idx = parseInt(dot.getAttribute('data-color-idx'), 10);
        if (isNaN(idx)) return;
        
        window.currentScheduleColorIndex = idx;
        updateScheduleColorPreviewUI(idx);
        
        // 更新排单页的彩条颜色
        if (typeof renderScheduleCalendar === 'function') renderScheduleCalendar();
        if (typeof renderScheduleTodoSection === 'function') renderScheduleTodoSection();
        
        closeScheduleColorPicker();
    };

    pop.classList.remove('d-none');
}

function closeScheduleColorPicker() {
    var pop = document.getElementById('scheduleColorPickerPopover');
    if (pop) pop.classList.add('d-none');
}

// 根据索引与昼夜模式获取具体彩条颜色/文字/圆点色
function getScheduleColorByIndex(idx) {
    var isDark = document.documentElement.classList.contains('theme-dark');
    var colors = isDark ? SCHEDULE_BAR_COLORS_DARK : SCHEDULE_BAR_COLORS;
    var textColors = isDark ? SCHEDULE_BAR_TEXT_COLORS_DARK : SCHEDULE_BAR_TEXT_COLORS;
    var dotColors = isDark ? SCHEDULE_BAR_DOT_COLORS_DARK : SCHEDULE_BAR_DOT_COLORS;
    var len = colors.length;
    if (!len) return { bar: '', text: '', dot: '' };
    var i = ((idx % len) + len) % len;
    return {
        bar: colors[i],
        text: textColors[i] || '#333',
        dot: dotColors[i] || textColors[i] || '#333'
    };
}

// 彩条配色名称（与 12 色基础色一一对应）
var SCHEDULE_COLOR_NAMES = [
    '晨光青', '雾霁蓝', '樱桃粉', '薄荷绿',
    '薰衣紫', '向日黄', '暖茶棕', '蜜橙',
    '海玻青', '可可棕', '云雾灰', '石榴红'
];

var SCHEDULE_COLOR_LAST_INDEX_KEY = 'scheduleBarColorLastIndex';

function getLastScheduleColorIndex() {
    try {
        var v = localStorage.getItem(SCHEDULE_COLOR_LAST_INDEX_KEY);
        var n = parseInt(v, 10);
        if (isNaN(n) || n < 0) return -1;
        return n;
    } catch (e) {
        return -1;
    }
}

function setLastScheduleColorIndex(idx) {
    try {
        localStorage.setItem(SCHEDULE_COLOR_LAST_INDEX_KEY, String(idx));
    } catch (e) {}
}

// 初始化计算页当前颜色预览
function initScheduleColorPreview() {
    var isDark = document.documentElement.classList.contains('theme-dark');
    var colors = isDark ? SCHEDULE_BAR_COLORS_DARK : SCHEDULE_BAR_COLORS;
    if (!colors || !colors.length) return;

    var lastIdx = getLastScheduleColorIndex();
    var defaultIdx = (lastIdx + 1 + colors.length) % colors.length;
    if (isNaN(defaultIdx) || defaultIdx < 0 || defaultIdx >= colors.length) defaultIdx = 0;

    // 如果当前单已有选中的索引（编辑模式），优先使用它
    var currentIdx = typeof window.currentScheduleColorIndex === 'number'
        ? window.currentScheduleColorIndex
        : defaultIdx;
    window.currentScheduleColorIndex = currentIdx;

    updateScheduleColorPreviewUI(currentIdx);
}

function updateScheduleColorPreviewUI(idx) {
    var isDark = document.documentElement.classList.contains('theme-dark');
    var colors = isDark ? SCHEDULE_BAR_COLORS_DARK : SCHEDULE_BAR_COLORS;
    var dotEl = document.getElementById('scheduleColorPreviewDot');
    if (dotEl) dotEl.style.backgroundColor = colors[idx];
}

// 打开/关闭彩条色板
function openScheduleColorPicker(event) {
    if (event) event.stopPropagation();
    var pop = document.getElementById('scheduleColorPickerPopover');
    var grid = document.getElementById('scheduleColorPopoverGrid');
    if (!pop || !grid) return;

    if (!pop.classList.contains('d-none')) {
        closeScheduleColorPicker();
        return;
    }

    var isDark = document.documentElement.classList.contains('theme-dark');
    var colors = isDark ? SCHEDULE_BAR_COLORS_DARK : SCHEDULE_BAR_COLORS;
    
    var currentIdx = typeof window.currentScheduleColorIndex === 'number'
        ? window.currentScheduleColorIndex
        : 0;

    var html = '';
    for (var i = 0; i < colors.length; i++) {
        var active = i === currentIdx ? ' active' : '';
        html += '<div class="theme-dot-item' + active + '" data-color-idx="' + i + '" title="' + SCHEDULE_COLOR_NAMES[i] + '" style="background-color:' + colors[i] + '"></div>';
    }
    grid.innerHTML = html;

    grid.onclick = function (e) {
        var dot = e.target.closest('.theme-dot-item');
        if (!dot) return;
        var idx = parseInt(dot.getAttribute('data-color-idx'), 10);
        if (isNaN(idx)) return;
        
        window.currentScheduleColorIndex = idx;
        updateScheduleColorPreviewUI(idx);
        closeScheduleColorPicker();
    };

    pop.classList.remove('d-none');
}

function closeScheduleColorPicker() {
    var pop = document.getElementById('scheduleColorPickerPopover');
    if (pop) pop.classList.add('d-none');
}

// 根据索引与昼夜模式获取具体彩条颜色/文字/圆点色
function getScheduleColorByIndex(idx) {
    var isDark = document.documentElement.classList.contains('theme-dark');
    var colors = isDark ? SCHEDULE_BAR_COLORS_DARK : SCHEDULE_BAR_COLORS;
    var textColors = isDark ? SCHEDULE_BAR_TEXT_COLORS_DARK : SCHEDULE_BAR_TEXT_COLORS;
    var dotColors = isDark ? SCHEDULE_BAR_DOT_COLORS_DARK : SCHEDULE_BAR_DOT_COLORS;
    var len = colors.length;
    if (!len) return { bar: '', text: '', dot: '' };
    var i = ((idx % len) + len) % len;
    return {
        bar: colors[i],
        text: textColors[i] || '#333',
        dot: dotColors[i] || textColors[i] || '#333'
    };
}

// 彩条色板（共 12 色）：青、蓝、浅粉、绿、紫、黄、茶、橙、薄荷、棕、浅灰、红
var SCHEDULE_BAR_COLORS = [
    'rgba(135, 205, 250, 0.38)',
    'rgba(190, 215, 250, 0.38)',
    'rgba(244, 143, 177, 0.38)',
    'rgba(195, 245, 225, 0.38)',
    'rgba(218, 200, 245, 0.38)',
    'rgba(255, 235, 100, 0.38)',
    'rgba(210, 180, 140, 0.38)',
    'rgba(255, 150, 100, 0.38)',
    'rgba(128, 203, 196, 0.38)',
    'rgba(121, 85, 72, 0.38)',
    'rgba(189, 189, 189, 0.38)',
    'rgba(245, 195, 195, 0.38)'
];
var SCHEDULE_BAR_TEXT_COLORS = ['#1e5a7a', '#2d4a6b', '#8b4058', '#2d6850', '#3d2d5c', '#5c4d10', '#5c4a28', '#5c2810', '#00695c', '#3e2723', '#424242', '#5c2828'];
var SCHEDULE_BAR_DOT_COLORS = ['#5eb8e8', '#7eb0e8', '#F48FB1', '#6dc49a', '#9d7ec9', '#e6c83d', '#d2b48c', '#e88a5c', '#80CBC4', '#795548', '#BDBDBD', '#c47a7a'];

var SCHEDULE_BAR_COLORS_DARK = [
    'rgba(56, 189, 248, 0.5)',
    'rgba(96, 165, 250, 0.5)',
    'rgba(244, 143, 177, 0.5)',
    'rgba(74, 222, 128, 0.5)',
    'rgba(192, 132, 252, 0.5)',
    'rgba(254, 230, 50, 0.5)',
    'rgba(217, 119, 6, 0.5)',
    'rgba(251, 106, 54, 0.5)',
    'rgba(128, 203, 196, 0.5)',
    'rgba(121, 85, 72, 0.5)',
    'rgba(189, 189, 189, 0.5)',
    'rgba(248, 113, 113, 0.5)'
];
var SCHEDULE_BAR_TEXT_COLORS_DARK = ['#7dd3fc', '#93c5fd', '#fbcfe8', '#86efac', '#c4b5fd', '#fde047', '#fcd34d', '#fd8a5c', '#99f6e4', '#d6d3d1', '#e5e5e5', '#fca5a5'];
var SCHEDULE_BAR_DOT_COLORS_DARK = ['#38bdf8', '#60a5fa', '#f9a8d4', '#4ade80', '#c084fc', '#facc15', '#f59e0b', '#f97316', '#5eead4', '#a8a29e', '#d4d4d4', '#f87171'];

// 根据屏幕宽度和日历单元格高度动态计算彩条最大轨道数（尽量多显示）
function getScheduleMaxTracks() {
    var w = typeof window !== 'undefined' ? window.innerWidth : 768;
    var isMobile = w < 768;
    
    // 根据屏幕尺寸确定单元格和彩条参数
    var cellHeight = isMobile ? 60 : 72;
    var barTop = isMobile ? 18 : 22;
    // 彩条高度：桌面端 12px + margin-bottom 0.2px ≈ 12.2px，移动端 10px + margin-bottom 0.5px ≈ 10.5px
    // 优化：减小间距以显示更多条
    var barHeight = isMobile ? 10.5 : 12.2;
    
    // 尝试获取实际日历单元格高度（如果日历已渲染）
    var container = document.getElementById('scheduleCalendar');
    if (container) {
        var cell = container.querySelector('.schedule-calendar-cell');
        if (cell && cell.offsetHeight > 0) {
            cellHeight = cell.offsetHeight;
        }
    }
    
    // 计算可用高度（单元格高度 - 彩条起始位置 - 底部留白）
    var bottomPadding = 0.5; // 底部留一点空间，避免贴边
    var availableHeight = cellHeight - barTop - bottomPadding;
    var maxTracks = Math.floor(availableHeight / barHeight);
    
    // 至少3条，最多不超过12条（色板数量），完全根据可用空间计算，不设屏幕宽度上限
    var minTracks = 3;
    var calculated = Math.max(minTracks, Math.min(maxTracks, 12));

    // 如果处于“展开全部”状态，则返回一个很大的数值（如 99），否则返回计算出的限制值
    return window.scheduleExpandAllBars ? 99 : calculated;
}

// 切换日历彩条显示：默认按 getScheduleMaxTracks() 限制；展开后显示全部（通过把 maxTracks 提升到 99）
function toggleScheduleBarsExpand() {
    window.scheduleExpandAllBars = !window.scheduleExpandAllBars;

    // 更新按钮状态（展开/收起图标切换）
    var btn = document.getElementById('scheduleExpandBtn');
    if (btn) {
        btn.classList.toggle('is-expanded', !!window.scheduleExpandAllBars);
        var expandIcon = btn.querySelector('.expand-icon');
        var collapseIcon = btn.querySelector('.collapse-icon');
        if (expandIcon) expandIcon.classList.toggle('d-none', !!window.scheduleExpandAllBars);
        if (collapseIcon) collapseIcon.classList.toggle('d-none', !window.scheduleExpandAllBars);
    }

    // 展开时抬高日历高度，避免被裁切
    try {
        if (window.scheduleExpandAllBars) {
            var y = window.scheduleCalendarYear;
            var m = window.scheduleCalendarMonth;
            if (y != null && m != null) adjustCalendarHeightForAllBars(y, m);
        }
    } catch (e) {}

    renderScheduleCalendar();
}

// 按星期视图：同周内条带轨道分配，maxTracks 随屏幕宽度动态调整
function assignWeekBarsToTracks(segments, maxTracks) {
    if (maxTracks == null) maxTracks = getScheduleMaxTracks();
    var tracks = [];
    segments.forEach(function (s) {
        var placed = false;
        for (var t = 0; t < tracks.length && t < maxTracks; t++) {
            var ok = tracks[t].every(function (o) {
                return s.endCol < o.startCol || s.startCol > o.endCol;
            });
            if (ok) {
                tracks[t].push(s);
                placed = true;
                break;
            }
        }
        if (!placed && tracks.length < maxTracks) tracks.push([s]);
    });
    return tracks.slice(0, maxTracks);
}

// 渲染排单日历：按星期显示（一～日），跨日彩条横跨多列
function renderScheduleCalendar() {
    const container = document.getElementById('scheduleCalendar');
    if (!container) return;
    const now = new Date();
    if (window.scheduleCalendarYear == null) window.scheduleCalendarYear = now.getFullYear();
    if (window.scheduleCalendarMonth == null) window.scheduleCalendarMonth = now.getMonth() + 1;
    const y = window.scheduleCalendarYear;
    const m = window.scheduleCalendarMonth;
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    const daysInMonth = last.getDate();
    // 周一为第一列：(getDay() + 6) % 7 → 0=周一, 6=周日
    const startPad = (first.getDay() + 6) % 7;
    const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7;
    const numRows = totalCells / 7;
    const bars = getScheduleBarsForCalendar(y, m).map(function (b) {
        var full = history.find(function (h) { return h.id === b.id; });
        if (full && typeof full.scheduleColorIndex === 'number') {
            b.scheduleColorIndex = full.scheduleColorIndex;
        }
        return b;
    });
    const todayYmd = toYmd(now);

    // 本月内条带起止日（1-based）
    const barsWithDays = [];
    for (let i = 0; i < bars.length; i++) {
        const b = bars[i];
        const startParts = b.startDate.split('-').map(Number);
        const endParts = b.endDate.split('-').map(Number);
        let startDay = (startParts[0] === y && startParts[1] === m) ? startParts[2] : 1;
        let endDay = (endParts[0] === y && endParts[1] === m) ? endParts[2] : daysInMonth;
        if (startParts[0] !== y || startParts[1] !== m) startDay = 1;
        if (endParts[0] !== y || endParts[1] !== m) endDay = daysInMonth;
        if (startDay > endDay) continue;
        barsWithDays.push({ startDay: startDay, endDay: endDay, bar: b });
    }

    let html = '<div class="schedule-calendar-inner">';
    // 星期表头
    html += '<div class="schedule-calendar-weekdays">';
    ['一', '二', '三', '四', '五', '六', '日'].forEach(function (w) { html += '<span>' + w + '</span>'; });
    html += '</div>';
    // 按周：每周一行日期，彩条用绝对定位层横跨
    for (let row = 0; row < numRows; row++) {
        html += '<div class="schedule-week-block" data-row="' + row + '">';
        html += '<div class="schedule-calendar-grid schedule-week-dates">';
        for (let col = 0; col < 7; col++) {
            const i = row * 7 + col;
            const dayIndex = i - startPad + 1;
            const isWeekend = col >= 5;
            let dateStr = '';
            let cellClass = 'schedule-calendar-cell';
            let label = '';
            if (dayIndex < 1) {
                const prevLast = new Date(y, m - 1, 0);
                label = String(prevLast.getDate() + dayIndex);
                cellClass += ' schedule-calendar-cell-other';
            } else if (dayIndex > daysInMonth) {
                label = String(dayIndex - daysInMonth);
                cellClass += ' schedule-calendar-cell-other';
            } else {
                dateStr = toYmd(new Date(y, m - 1, dayIndex));
                label = String(dayIndex);
                if (dateStr === todayYmd) cellClass += ' schedule-calendar-cell-today';
                if (window.scheduleSelectedDate === dateStr) cellClass += ' schedule-calendar-cell-selected';
                if (isWeekend) cellClass += ' schedule-calendar-cell-weekend';
            }
            html += '<div class="' + cellClass + '" data-date="' + (dateStr || '') + '">';
            html += '<span class="schedule-cell-num">' + label + '</span></div>';
        }
        html += '</div>';
        // 彩条层：绝对定位，横跨多个日期格
        const weekFirstDay = row * 7 - startPad + 1;
        const weekLastDay = row * 7 + 6 - startPad + 1;
        const segments = [];
        barsWithDays.forEach(function (b) {
            if (b.endDay < weekFirstDay || b.startDay > weekLastDay) return;
            const startCol = Math.max(0, b.startDay - weekFirstDay);
            const endCol = Math.min(6, b.endDay - weekFirstDay);
            if (startCol > endCol) return;
            segments.push({ startCol: startCol, endCol: endCol, bar: b.bar });
        });
        const weekTracks = assignWeekBarsToTracks(segments, getScheduleMaxTracks());
        // 展开模式下按需增高本周块，避免彩条轨道重叠
        if (window.scheduleExpandAllBars) {
            const blockMinHeight = 22 + (weekTracks.length * 12) + 8;
            html += '<style>.schedule-week-block[data-row="' + row + '"]{min-height:' + blockMinHeight + 'px;}</style>';
        }
        if (weekTracks.length > 0) {
            var isDark = document.documentElement.classList.contains('theme-dark');
            var barColors = isDark && SCHEDULE_BAR_COLORS_DARK ? SCHEDULE_BAR_COLORS_DARK : SCHEDULE_BAR_COLORS;
            var barTextColors = isDark && SCHEDULE_BAR_TEXT_COLORS_DARK ? SCHEDULE_BAR_TEXT_COLORS_DARK : SCHEDULE_BAR_TEXT_COLORS;
            html += '<div class="schedule-week-bars">';
            weekTracks.forEach(function (track, ti) {
                track.forEach(function (s) {
                    const b = s.bar;
                    var idx;
                    if (typeof b.scheduleColorIndex === 'number') {
                        idx = ((b.scheduleColorIndex % barColors.length) + barColors.length) % barColors.length;
                    } else {
                        idx = Math.abs(b.id) % barColors.length;
                    }
                    const color = barColors[idx];
                    const label = (b.clientId || '—') + '  ' + b.productCount + '制品';
                    var textColor = barTextColors[idx];
                    var singleDay = s.startCol === s.endCol ? ' data-single-day="1"' : '';

                    // 检查是否已结单或已完成，应用划线和透明度样式
                    var isSettled = false;
                    var isDone = false;
                    const fullItem = history.find(h => h.id === b.id);
                    if (fullItem) {
                        isSettled = isOrderSettled(fullItem);
                        const totalLen = (Array.isArray(fullItem.productPrices) ? fullItem.productPrices.length : 0) +
                                       (Array.isArray(fullItem.giftPrices) ? fullItem.giftPrices.length : 0);
                        const doneCount = (fullItem.productDoneStates || []).filter(Boolean).length;
                        isDone = totalLen > 0 && doneCount >= totalLen;
                    }
                    const barStyle = (isSettled || isDone) ? 'text-decoration: line-through; opacity: 0.6;' : '';

                    html += '<div class="schedule-bar-strip" style="grid-column: ' + (s.startCol + 1) + ' / ' + (s.endCol + 2) + '; grid-row: ' + (ti + 1) + '; background:' + color + '; color:' + textColor + ';' + barStyle + '" title="' + label + '" data-week-first-day="' + weekFirstDay + '" data-start-col="' + s.startCol + '" data-end-col="' + s.endCol + '"' + singleDay + '>' + label + '</div>';
                });
            });
            html += '</div>';
        }
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
    // 更新排单标题统计（本月完成/未完成/总制品数）
    renderScheduleMonthTitleStats(y, m);

    container.querySelectorAll('.schedule-calendar-cell[data-date]').forEach(el => {
        const d = el.getAttribute('data-date');
        if (!d) return;
        el.addEventListener('click', function () {
            window.scheduleSelectedDate = d;
            debouncedRefreshScheduleView();
        });
    });

    // 彩条点击事件：根据点击位置选中对应日期
    container.querySelectorAll('.schedule-bar-strip').forEach(strip => {
        strip.addEventListener('click', function(e) {
            e.stopPropagation();
            const weekFirstDay = parseInt(strip.dataset.weekFirstDay, 10);
            const startCol = parseInt(strip.dataset.startCol, 10);
            const endCol = parseInt(strip.dataset.endCol, 10);
            const relativeX = e.offsetX / e.target.offsetWidth;
            const clickedCol = startCol + Math.floor(relativeX * (endCol - startCol + 1));
            const clickedDay = weekFirstDay + clickedCol;
            if (clickedDay >= 1 && clickedDay <= daysInMonth) {
                const dateStr = toYmd(new Date(y, m - 1, clickedDay));
                window.scheduleSelectedDate = dateStr;
                debouncedRefreshScheduleView();
            }
        });
    });

    // 触摸滑动切换月份：左右滑动切换上下月，双指缩放显示所有彩条
    (function() {
        let touchStartX = null;
        let touchStartY = null;
        let touchDistance = 0;
        let isMultiTouch = false;
        const minSwipeDistance = 50; // 最小滑动距离（像素）
        const maxVerticalDistance = 100; // 最大垂直偏移（避免与页面滚动冲突）
        const zoomThreshold = 30; // 双指缩放阈值（像素）

        container.addEventListener('touchstart', function(e) {
            if (e.touches.length === 1) {
                // 单指触摸：准备滑动
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                isMultiTouch = false;
            } else if (e.touches.length === 2) {
                // 双指触摸：准备缩放
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                touchDistance = Math.sqrt(dx * dx + dy * dy);
                isMultiTouch = true;
            }
        }, { passive: true });

        container.addEventListener('touchmove', function(e) {
            if (e.touches.length === 2) {
                // 双指触摸：检测缩放
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const currentDistance = Math.sqrt(dx * dx + dy * dy);
                
                // 如果双指距离增加了一定阈值，认为是缩放操作
                if (touchDistance > 0 && currentDistance > touchDistance + zoomThreshold) {
                    // 调整日历高度以显示所有彩条
                    adjustCalendarHeightForAllBars(y, m);
                    touchDistance = currentDistance;
                }
            }
        }, { passive: true });

        container.addEventListener('touchend', function(e) {
            if (!isMultiTouch && e.changedTouches.length === 1) {
                // 单指触摸结束：检测滑动
                if (touchStartX === null || touchStartY === null) {
                    touchStartX = null;
                    touchStartY = null;
                    return;
                }

                const touchEndX = e.changedTouches[0].clientX;
                const touchEndY = e.changedTouches[0].clientY;
                const deltaX = touchEndX - touchStartX;
                const deltaY = touchEndY - touchStartY;
                const absDeltaX = Math.abs(deltaX);
                const absDeltaY = Math.abs(deltaY);

                // 确保是水平滑动（水平距离 > 垂直距离，且垂直偏移不超过阈值）
                if (absDeltaX > minSwipeDistance && absDeltaX > absDeltaY && absDeltaY < maxVerticalDistance) {
                    if (deltaX > 0) {
                        // 向右滑动 → 上一月
                        scheduleCalendarPrevMonth();
                    } else {
                        // 向左滑动 → 下一月
                        scheduleCalendarNextMonth();
                    }
                    e.preventDefault();
                }

                touchStartX = null;
                touchStartY = null;
            }
        }, { passive: false });
    })();
}

// 调整日历高度以显示所有彩条
function adjustCalendarHeightForAllBars(year, month) {
    const container = document.getElementById('scheduleCalendar');
    if (!container) return;
    
    // 获取该月的所有排单条带
    const bars = getScheduleBarsForCalendar(year, month);
    
    // 计算需要的最大轨道数
    let maxTracks = 0;
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const daysInMonth = last.getDate();
    const startPad = (first.getDay() + 6) % 7;
    const numRows = Math.ceil((startPad + daysInMonth) / 7);
    
    // 计算每个星期的轨道数
    for (let row = 0; row < numRows; row++) {
        const weekFirstDay = row * 7 - startPad + 1;
        const weekLastDay = row * 7 + 6 - startPad + 1;
        const segments = [];
        
        // 本月内条带起止日（1-based）
        bars.forEach(function (b) {
            const startParts = b.startDate.split('-').map(Number);
            const endParts = b.endDate.split('-').map(Number);
            let startDay = (startParts[0] === year && startParts[1] === month) ? startParts[2] : 1;
            let endDay = (endParts[0] === year && endParts[1] === month) ? endParts[2] : daysInMonth;
            if (startParts[0] !== year || startParts[1] !== month) startDay = 1;
            if (endParts[0] !== year || endParts[1] !== month) endDay = daysInMonth;
            if (startDay > endDay) return;
            
            if (endDay < weekFirstDay || startDay > weekLastDay) return;
            const startCol = Math.max(0, startDay - weekFirstDay);
            const endCol = Math.min(6, endDay - weekFirstDay);
            if (startCol > endCol) return;
            segments.push({ startCol: startCol, endCol: endCol, bar: b });
        });
        
        // 计算该星期需要的轨道数
        const weekTracks = assignWeekBarsToTracks(segments, 999); // 使用很大的数字以获取实际需要的轨道数
        maxTracks = Math.max(maxTracks, weekTracks.length);
    }
    
    // 如果需要更多轨道，调整日历高度逻辑
    if (window.scheduleExpandAllBars) {
        // 展开模式：根据最大轨道数动态增加高度
        container.style.height = "auto";
        container.style.maxHeight = "none";
        const calendarInner = container.querySelector('.schedule-calendar-inner');
        if (calendarInner) {
            // 计算高度：表头(30px) + 每周基础高度(80px + 每轨道14px)
            // 粗略估算：每周至少显示 maxTracks 条彩条的高度
            const trackHeight = 14; 
            const weekBaseHeight = 60; // 日期数字行高度
            const totalHeight = 30 + (numRows * (weekBaseHeight + maxTracks * trackHeight + 10));
            calendarInner.style.minHeight = totalHeight + 'px';
        }
    } else {
        // 收起模式：恢复默认高度
        container.style.height = "";
        container.style.maxHeight = "";
        const calendarInner = container.querySelector('.schedule-calendar-inner');
        if (calendarInner) calendarInner.style.minHeight = "";
    }
}

// 月份/日期切换防抖：快速连续操作只触发一次重绘
function debounce(fn, ms) {
    var t;
    return function () {
        clearTimeout(t);
        t = setTimeout(fn, ms);
    };
}
var debouncedRefreshScheduleView = debounce(function () {
    renderScheduleCalendar();
    renderScheduleTodoSection();
    updateScheduleTitleTodayButton();
}, 120);

function scheduleCalendarPrevMonth() {
    if (window.scheduleCalendarMonth <= 1) {
        window.scheduleCalendarMonth = 12;
        window.scheduleCalendarYear--;
    } else {
        window.scheduleCalendarMonth--;
    }
    debouncedRefreshScheduleView();
}

function scheduleCalendarNextMonth() {
    if (window.scheduleCalendarMonth >= 12) {
        window.scheduleCalendarMonth = 1;
        window.scheduleCalendarYear++;
    } else {
        window.scheduleCalendarMonth++;
    }
    debouncedRefreshScheduleView();
}

function updateScheduleTitleTodayButton() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const todayYmd = toYmd(now);
    const isCurrentMonth = window.scheduleCalendarYear === currentYear && window.scheduleCalendarMonth === currentMonth;
    const isOtherDay = !!window.scheduleSelectedDate && window.scheduleSelectedDate !== todayYmd;
    const shouldShowToday = !isCurrentMonth || isOtherDay;
    const todayBtn = document.querySelector('.schedule-title-today-pill');
    if (todayBtn) {
        todayBtn.classList.toggle('d-none', !shouldShowToday);
    }
}

// 渲染当前批次制品 todo 区（按快捷筛选或选中日期显示排单制品）
async function mgFetchIncomingProjects() {
    const client = mgGetSupabaseClient();
    if (!client) return [];
    const { data: { session } } = await client.auth.getSession();
    if (!session || !session.user) return [];
    const artistId = session.user.id;

    const { data, error } = await client
        .from('projects')
        .select('id, status, submitted_at, client_input_snapshot')
        .eq('artist_id', artistId)
        .eq('status', 'PENDING_REVIEW')
        .order('submitted_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('获取待接企划失败:', error);
        return [];
    }
    return data || [];
}

function mgEscapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c;
    });
}

async function mgRenderIncomingProjectsTodo(titleEl, modulesEl) {
    titleEl.textContent = '待接';
    modulesEl.innerHTML = '<p class="schedule-todo-empty">加载中...</p>';

    const rows = await mgFetchIncomingProjects();
    if (!rows.length) {
        modulesEl.innerHTML = '<p class="schedule-todo-empty">暂无待接企划</p>';
        return;
    }

    const cards = rows.map(function (p) {
        const snap = p.client_input_snapshot || {};
        const name = snap.clientName || '单主';
        const contact = snap.contact || '';
        const deadline = snap.deadline ? ('截稿 ' + formatYmdCn(snap.deadline)) : '未填截稿（待排）';
        const items = Array.isArray(snap.items) ? snap.items : [];
        const summary = items.slice(0, 3).map(function (it) {
            const n = it.typeName || '制品';
            const q = it.quantity != null ? (' x ' + it.quantity) : '';
            const sz = it.size ? ('（' + it.size + '）') : '';
            return mgEscapeHtml(n + q + sz);
        }).join('，') + (items.length > 3 ? '…' : '');

        return ''
            + '<div class="schedule-todo-card" onclick="handleIncomingProjectCardClick(\'' + String(p.id) + '\', event)">' 
            + '  <div class="schedule-todo-card-main">'
            + '    <div class="schedule-todo-card-head">'
            + '      <span class="schedule-todo-card-dot" style="background-color:#999"></span>'
            + '      <span class="schedule-todo-card-date">待接</span>'
            + '      <span class="schedule-todo-card-sep"></span>'
            + '      <span class="schedule-todo-card-range">' + mgEscapeHtml(deadline) + '</span>'
            + '      <span class="schedule-todo-card-sep-inline"></span>'
            + '      <span class="schedule-todo-card-client">' + mgEscapeHtml(name) + (contact ? ('（' + mgEscapeHtml(contact) + '）') : '') + '</span>'
            + '      <span class="record-status record-status--pending schedule-todo-card-status">待复核</span>'
            + '    </div>'
            + '    <div class="schedule-todo-card-products">'
            + '      <div class="schedule-todo-chips-wrap">' + mgEscapeHtml(summary) + '</div>'
            + '    </div>'
            + '  </div>'
            + '</div>';
    });

    modulesEl.innerHTML = cards.join('');
    
    // 应用当前的换行模式
    setScheduleTodoWrapMode(window.scheduleTodoWrapMode);
}

async function mgUpdateProjectStatus(projectId, status, extraPatch) {
    const client = mgGetSupabaseClient();
    if (!client) return false;
    const { data: { session } } = await client.auth.getSession();
    if (!session || !session.user) return false;

    try {
        const patch = Object.assign({ status: status, updated_at: new Date().toISOString() }, (extraPatch || {}));
        const { error } = await client
            .from('projects')
            .update(patch)
            .eq('artist_id', session.user.id)
            .eq('id', projectId);
        if (error) throw error;
        if (typeof mgUpdateIncomingDot === 'function') mgUpdateIncomingDot();
        return true;
    } catch (e) {
        console.warn('更新企划状态失败:', e);
        return false;
    }
}

function mgClearIncomingContext() {
    window.currentIncomingProjectId = null;
    window.isIncomingNegotiationMode = false;
}

async function mgLoadIncomingProjectToCalculator(projectId) {
    const client = mgGetSupabaseClient();
    if (!client) {
        alert('未检测到 Supabase 配置');
        return;
    }
    const { data: { session } } = await client.auth.getSession();
    if (!session || !session.user) {
        alert('请先登录');
        return;
    }
    const artistId = session.user.id;

    const { data: rows, error } = await client
        .from('projects')
        .select('id, status, submitted_at, client_input_snapshot')
        .eq('artist_id', artistId)
        .eq('id', projectId)
        .limit(1);

    if (error) {
        console.error(error);
        alert('读取待接企划失败：' + (error.message || error));
        return;
    }
    const proj = rows && rows[0];
    if (!proj) {
        alert('未找到该待接企划');
        return;
    }

    // 记录当前待接企划上下文，用于后续状态流转 (QUOTED / SCHEDULED)
    window.currentIncomingProjectId = projectId;
    window.isIncomingNegotiationMode = true;

    const snap = proj.client_input_snapshot || {};
    const clientName = snap.clientName || '';
    const contact = snap.contact || '';
    const deadline = snap.deadline || '';
    const remark = snap.remark || '';
    const items = Array.isArray(snap.items) ? snap.items : [];

    // 切换到排单页并打开计算抽屉
    if (typeof showPage === 'function') showPage('quote');
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            openCalculatorDrawer(true);
        });
    });

    // 清空当前制品和赠品
    products = [];
    gifts = [];
    productIdCounter = 0;
    giftIdCounter = 0;
    const productsContainer = document.getElementById('productsContainer');
    const giftsContainer = document.getElementById('giftsContainer');
    if (productsContainer) productsContainer.innerHTML = '';
    if (giftsContainer) giftsContainer.innerHTML = '';

    // 恢复单主信息（沿用 editHistoryItem 的字段）
    var clientIdEl = document.getElementById('clientId');
    if (clientIdEl) clientIdEl.value = clientName;
    var orderPlatformInput = document.getElementById('orderPlatform');
    if (orderPlatformInput) orderPlatformInput.value = contact;

    var deadlineEl = document.getElementById('deadline');
    if (deadlineEl) deadlineEl.value = deadline || '';

    // 订单备注：拼接尺寸信息（方案 A）
    var sizes = items
        .filter(function (it) { return it && it.size; })
        .map(function (it) {
            var n = it.typeName || '制品';
            return n + '：' + it.size;
        })
        .join('；');
    var mergedRemark = '';
    if (remark) mergedRemark += String(remark);
    if (sizes) mergedRemark += (mergedRemark ? '\n' : '') + '【尺寸】' + sizes;
    if (defaultSettings) defaultSettings.orderRemark = mergedRemark;
    var orderRemarkTextEl = document.getElementById('orderRemarkText');
    if (orderRemarkTextEl) orderRemarkTextEl.value = mergedRemark;
    if (typeof updateOrderRemarkPreview === 'function') updateOrderRemarkPreview();

    // 恢复制品（仅 typeId + quantity，其他项由用户复核补齐）
    items.forEach(function (it) {
        if (!it || !it.typeId) return;
        productIdCounter++;
        const product = {
            id: productIdCounter,
            type: String(it.typeId),
            sides: 'single',
            quantity: it.quantity || 1,
            sameModel: true,
            hasBackground: false,
            processes: {}
        };
        products.push(product);
        renderProduct(product);
        // 让下拉与工艺选项刷新
        updateProductForm(product.id);
        updateProcessOptions(product.id, false);
    });

    if (typeof showGlobalToast === 'function') showGlobalToast('已载入待接企划到计算页');
}

function handleIncomingProjectCardClick(projectId, event) {
    if (event && event.target && event.target.closest('.schedule-todo-checkbox')) return;
    mgLoadIncomingProjectToCalculator(projectId);
}

async function mgUpdateIncomingDot() {
    const dot = document.getElementById('incomingDot');
    if (!dot) return;

    // 如果未开启云端或未登录，直接隐藏
    if (!mgIsCloudEnabled()) {
        dot.classList.add('d-none');
        return;
    }

    const client = mgGetSupabaseClient();
    if (!client) return;

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session || !session.user) {
            dot.classList.add('d-none');
            return;
        }

        // 仅查询数量，只要有 PENDING_REVIEW 状态的就显示红点
        const { count, error } = await client
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('artist_id', session.user.id)
            .eq('status', 'PENDING_REVIEW');

        if (error) throw error;

        dot.classList.toggle('d-none', !(count > 0));
    } catch (e) {
        console.warn('更新待接红点失败:', e);
        dot.classList.add('d-none');
    }
}

// 渲染当前批次制品 todo 区（按快捷筛选或选中日期显示排单制品）
async function renderScheduleTodoSection() {
    const titleEl = document.getElementById('scheduleTodoTitle');
    const modulesEl = document.getElementById('scheduleTodoModules');
    if (!titleEl || !modulesEl) return;

    // 每次渲染 Todo 区时尝试异步更新红点状态
    mgUpdateIncomingDot();

    const f = window.scheduleTodoFilter || 'today';
    // 待接：从云端 projects 渲染（不走本地 history）
    if (f === 'incoming') {
        await mgRenderIncomingProjectsTodo(titleEl, modulesEl);
        return;
    }
    if (f === 'today' && !window.scheduleSelectedDate) {
        const now = new Date();
        const y0 = now.getFullYear();
        const m0 = String(now.getMonth() + 1).padStart(2, '0');
        const d0 = String(now.getDate()).padStart(2, '0');
        window.scheduleSelectedDate = y0 + '-' + m0 + '-' + d0;
    }

    const items = getScheduleItemsByFilter().filter(it => !isOrderSettled(it));
    const titles = { all: '所有', month: '当月', pending: '待排', today: '当日' };
    const sub = f === 'today' && window.scheduleSelectedDate ? '：' + formatYmdCn(window.scheduleSelectedDate) : '';
    titleEl.textContent = (titles[f] || '当日') + sub;
    if (items.length === 0) {
        modulesEl.innerHTML = '<p class="schedule-todo-empty">该日期暂无排单</p>';
        return;
    }
    // 排序：按「截稿时间 > 开始时间 > 接单时间」优先级取一个可用时间，升序；同时间下已全部完成的卡片移到最后
    const sortedItems = items.slice().sort((a, b) => {
        ensureProductDoneStates(a);
        ensureProductDoneStates(b);
        const aTotal = (Array.isArray(a.productPrices) ? a.productPrices.length : 0) + (Array.isArray(a.giftPrices) ? a.giftPrices.length : 0);
        const bTotal = (Array.isArray(b.productPrices) ? b.productPrices.length : 0) + (Array.isArray(b.giftPrices) ? b.giftPrices.length : 0);
        const aDone = aTotal > 0 && (a.productDoneStates || []).filter(Boolean).length === aTotal;
        const bDone = bTotal > 0 && (b.productDoneStates || []).filter(Boolean).length === bTotal;

        function pickSortTime(it) {
            // 优先级：deadline -> startTime -> timestamp(接单/下单时间)
            const cands = [it && it.deadline, it && it.startTime, it && it.timestamp];
            for (let i = 0; i < cands.length; i++) {
                const v = cands[i];
                if (!v) continue;
                const d = new Date(v);
                const t = d.getTime();
                if (isFinite(t)) return t;
            }
            return Number.POSITIVE_INFINITY;
        }

        const ta = pickSortTime(a);
        const tb = pickSortTime(b);
        if (ta !== tb) return ta - tb;
        // 同时间：未完成排前
        return Number(aDone) - Number(bDone);
    });
    var toMd = function(str) {
        if (!str) return '—';
        var d = new Date(str);
        return isNaN(d.getTime()) ? '—' : (d.getMonth() + 1) + '.' + d.getDate();
    };
    var cardHtmls = [];
    sortedItems.forEach(item => {
        ensureProductDoneStates(item);
        const doneStates = item.productDoneStates || [];
        const products = Array.isArray(item.productPrices) ? item.productPrices : [];
        const gifts = Array.isArray(item.giftPrices) ? item.giftPrices : [];
        const total = getOrderItemQuantityTotal(item);
        const doneCount = getOrderDoneQuantityTotal(item);
        // todo 时间显示为下单时间（timestamp）
        const orderDateStr = item.timestamp;
        const orderDate = orderDateStr ? new Date(orderDateStr) : null;
        const hasOrderDate = orderDate && !isNaN(orderDate.getTime());
        var dateText = hasOrderDate ? (String(orderDate.getMonth() + 1).padStart(2, '0') + '.' + String(orderDate.getDate()).padStart(2, '0')) : '\u2014';
        let rangeText = '—';
        if (item.startTime && item.deadline) rangeText = toMd(item.startTime) + ' → ' + toMd(item.deadline);
        else if (item.deadline) rangeText = '截稿 ' + toMd(item.deadline);
        else if (item.startTime) rangeText = '开始 ' + toMd(item.startTime);
        const client = item.clientId || '单主';
        const progress = doneCount + '/' + total;
        const status = getRecordProgressStatus(item);
        // 获取正确的圆点颜色
        let dotColor = '#999';
        try {
            const isDark = document.documentElement.classList.contains('theme-dark');
            const colorIdx = (typeof item.scheduleColorIndex === 'number')
                ? item.scheduleColorIndex
                : ((typeof item.barColorIndex === 'number') ? item.barColorIndex : 0);
            const palette = getScheduleColorByIndex(colorIdx);
            dotColor = palette.dot || palette.bar || '#999';
        } catch (e) {
            console.warn('获取 todo 圆点颜色失败', e);
        }

        // 渲染制品与赠品（极简单行布局）
        let allChipsHtml = '';
        
        // 1. 处理制品（未完成在前，已完成自动排后）
        const sortedProductEntries = products
            .map((p, i) => {
                const qty = Math.max(1, parseInt(p.quantity, 10) || 1);
                const doneQty = Math.max(0, Math.min(qty, parseInt(item.productDoneQuantities && item.productDoneQuantities[i], 10) || 0));
                return { p, i, qty, doneQty, isDone: doneQty >= qty };
            })
            .sort((a, b) => Number(a.isDone) - Number(b.isDone));

        sortedProductEntries.forEach(({ p, i, qty, doneQty, isDone }) => {
            const productLabel = (p.product || '制品');
            
            // 父节点（制品）
            allChipsHtml += `<div class="schedule-todo-chip${isDone ? ' schedule-todo-done' : ''}" style="margin:0 .3rem .2rem 0;">
                                <span class="schedule-todo-label" style="position:relative; top:1px; ${isDone ? 'text-decoration: line-through; opacity:.66;' : ''}">${productLabel}</span>
                                <span class="schedule-todo-qty-stepper" onclick="event.stopPropagation()">
                                    <button type="button" class="schedule-todo-qty-btn" data-id="${item.id}" data-idx="${i}" data-delta="-1"
                                            style="border:none;background:#e5e7eb;color:#374151;border-radius:9999px;width:.82rem;height:.82rem;display:inline-flex;align-items:center;justify-content:center;line-height:1;padding:0;font-size:.62rem;"
                                            onclick="handleScheduleTodoQtyBtnClick(event, this)"
                                            onpointerdown="startScheduleTodoQtyPress(event, this)"
                                            onpointerup="stopScheduleTodoQtyPress()"
                                            onpointercancel="stopScheduleTodoQtyPress()"
                                            onpointerleave="stopScheduleTodoQtyPress()">−</button>
                                    <span class="schedule-todo-qty-value" style="position:relative; top:2px;">${doneQty}/${qty}</span>
                                    <button type="button" class="schedule-todo-qty-btn" data-id="${item.id}" data-idx="${i}" data-delta="1"
                                            style="border:none;background:#e5e7eb;color:#374151;border-radius:9999px;width:.82rem;height:.82rem;display:inline-flex;align-items:center;justify-content:center;line-height:1;padding:0;font-size:.62rem;"
                                            onclick="handleScheduleTodoQtyBtnClick(event, this)"
                                            onpointerdown="startScheduleTodoQtyPress(event, this)"
                                            onpointerup="stopScheduleTodoQtyPress()"
                                            onpointercancel="stopScheduleTodoQtyPress()"
                                            onpointerleave="stopScheduleTodoQtyPress()">+</button>
                                </span>
                             </div>`;

            // 子节点（工序/节点）：改为“共享一根竖线”的分组容器，突出层级
            if (p.productType === 'nodes' && Array.isArray(p.nodeDetails) && p.nodeDetails.length) {
                const nodeStates = (item.productNodeDoneStates && item.productNodeDoneStates[i]) ? item.productNodeDoneStates[i] : [];
                let nodeHtml = '';
                p.nodeDetails.forEach((node, ni) => {
                    const nodeDone = !!nodeStates[ni];
                    nodeHtml += `<div class="schedule-todo-chip-node${nodeDone ? ' schedule-todo-done' : ''}">
                                    <input type="checkbox" class="schedule-todo-checkbox" ${nodeDone ? 'checked' : ''} 
                                           data-id="${item.id}" data-idx="${i}" onchange="toggleScheduleNodeDone(this, ${ni})">
                                    <span class="schedule-todo-label" style="${nodeDone ? 'text-decoration: line-through; opacity:.66;' : ''}">${node.name || '节点'}</span>
                                 </div>`;
                });

                allChipsHtml += `<div class="schedule-todo-node-group">
                                    <span class="schedule-todo-node-bar" aria-hidden="true"></span>
                                    <div class="schedule-todo-node-list">${nodeHtml}</div>
                                 </div>`;
            }
        });

        // 2. 处理赠品（未完成在前，已完成自动排后）
        const sortedGiftEntries = gifts
            .map((g, i) => {
                const giftIdx = products.length + i;
                const qty = Math.max(1, parseInt(g.quantity, 10) || 1);
                const doneQty = Math.max(0, Math.min(qty, parseInt(item.productDoneQuantities && item.productDoneQuantities[giftIdx], 10) || 0));
                return { g, i, giftIdx, qty, doneQty, isDone: doneQty >= qty };
            })
            .sort((a, b) => Number(a.isDone) - Number(b.isDone));

        sortedGiftEntries.forEach(({ g, i, giftIdx, qty, doneQty, isDone }) => {
            const giftLabel = '[赠品] ' + (g.product || '赠品');
            
            allChipsHtml += `<div class="schedule-todo-chip${isDone ? ' schedule-todo-done' : ''}">
                                <span class="schedule-todo-label" style="${isDone ? 'text-decoration: line-through; opacity:.66;' : ''}">${giftLabel}</span>
                                <span class="schedule-todo-qty-stepper" onclick="event.stopPropagation()">
                                    <button type="button" class="schedule-todo-qty-btn" data-id="${item.id}" data-idx="${giftIdx}" data-delta="-1"
                                            style="border:none;background:transparent;padding:0 6px;line-height:1;"
                                            onclick="handleScheduleTodoQtyBtnClick(event, this)"
                                            onpointerdown="startScheduleTodoQtyPress(event, this)"
                                            onpointerup="stopScheduleTodoQtyPress()"
                                            onpointercancel="stopScheduleTodoQtyPress()"
                                            onpointerleave="stopScheduleTodoQtyPress()">−</button>
                                    <span class="schedule-todo-qty-value">${doneQty}/${qty}</span>
                                    <button type="button" class="schedule-todo-qty-btn" data-id="${item.id}" data-idx="${giftIdx}" data-delta="1"
                                            style="border:none;background:transparent;padding:0 6px;line-height:1;"
                                            onclick="handleScheduleTodoQtyBtnClick(event, this)"
                                            onpointerdown="startScheduleTodoQtyPress(event, this)"
                                            onpointerup="stopScheduleTodoQtyPress()"
                                            onpointercancel="stopScheduleTodoQtyPress()"
                                            onpointerleave="stopScheduleTodoQtyPress()">+</button>
                                </span>
                             </div>`;
        });

        cardHtmls.push(''
            + '<div class="schedule-todo-card" onclick="handleScheduleTodoCardClick(' + item.id + ', event)">'
            + '  <div class="schedule-todo-card-main">'
            + '    <div class="schedule-todo-card-head">'
            + '      <span class="schedule-todo-card-dot" style="background-color:' + dotColor + '"></span>'
            + '      <span class="schedule-todo-card-date">' + dateText + '</span>'
            + '      <span class="schedule-todo-card-sep"></span>'
            + '      <span class="schedule-todo-card-range">' + rangeText + '</span>'
            + '      <span class="schedule-todo-card-sep-inline"></span>'
            + '      <span class="schedule-todo-card-client">' + client + '</span>'
            + '      <span class="schedule-todo-card-sep-dot">\u00B7</span>'
            + '      <span class="schedule-todo-card-progress">' + progress + '</span>'
            + '      <span class="record-status ' + status.className + ' schedule-todo-card-status">' + status.text + '</span>'
            + '    </div>'
            + '    <div class="schedule-todo-card-products">'
            + '      <div class="schedule-todo-chips-wrap">' + allChipsHtml + '</div>'
            + '    </div>'
            + '  </div>'
            + '</div>');
    });
    modulesEl.innerHTML = cardHtmls.join('');
    
    // 应用当前的换行模式
    setScheduleTodoWrapMode(window.scheduleTodoWrapMode);
}

function toggleScheduleTodoDone(checkbox) {
    const id = parseInt(checkbox.dataset.id, 10);
    const idx = parseInt(checkbox.dataset.idx, 10);
    
    if (isNaN(id) || isNaN(idx)) {
        console.error('Invalid data attributes:', checkbox.dataset);
        return;
    }
    const item = history.find(h => h.id === id);
    if (!item) return;
    ensureProductDoneStates(item);
    const total = (Array.isArray(item.productPrices) ? item.productPrices.length : 0) + (Array.isArray(item.giftPrices) ? item.giftPrices.length : 0);
    const doneBefore = (item.productDoneStates || []).filter(Boolean).length;
    const wasAllDone = total > 0 && doneBefore === total;

    setScheduleProductDone(id, idx, checkbox.checked);
    const row = checkbox.closest('.schedule-todo-row');
    if (row) row.classList.toggle('schedule-todo-done', checkbox.checked);
    ensureProductDoneStates(item);
    const doneAfter = (item.productDoneStates || []).filter(Boolean).length;
    const isAllDoneNow = total > 0 && doneAfter === total;
    const allDoneChanged = wasAllDone !== isAllDoneNow;

    // 保存数据
    saveData();
    
    // 云端同步：如果已启用云端模式，异步同步到 Supabase
    if (mgIsCloudEnabled() && localStorage.getItem('mg_cloud_enabled') === '1') {
        markOrderUnsynced(id);
        mgCloudUpsertOrder(item).catch(err => {
            console.error('云端同步失败:', err);
            updateSyncStatus();
        });
    }
    
    setTimeout(function () {
        renderScheduleTodoSection();
        if (allDoneChanged) renderScheduleCalendar();
    }, 0);
}

// 快捷调整制品完成数量（支持 2/3）
function adjustScheduleTodoDoneQty(el) {
    const id = parseInt(el.dataset.id, 10);
    const idx = parseInt(el.dataset.idx, 10);
    const delta = parseInt(el.dataset.delta, 10);
    if (isNaN(id) || isNaN(idx) || isNaN(delta) || !delta) return;

    const item = history.find(h => h.id === id);
    if (!item) return;
    ensureProductDoneStates(item);

    const allPrices = (item.productPrices || []).concat(item.giftPrices || []);
    if (idx < 0 || idx >= allPrices.length) return;

    const qty = Math.max(1, parseInt(allPrices[idx] && allPrices[idx].quantity, 10) || 1);
    const current = Math.max(0, Math.min(qty, parseInt(item.productDoneQuantities[idx], 10) || 0));
    const next = Math.max(0, Math.min(qty, current + delta));
    if (next === current) return;

    const total = allPrices.length;
    const doneBefore = (item.productDoneStates || []).filter(Boolean).length;
    const wasAllDone = total > 0 && doneBefore === total;

    setScheduleProductDoneQty(id, idx, next);
    ensureProductDoneStates(item);

    const doneAfter = (item.productDoneStates || []).filter(Boolean).length;
    const isAllDoneNow = total > 0 && doneAfter === total;
    const allDoneChanged = wasAllDone !== isAllDoneNow;

    if (mgIsCloudEnabled() && localStorage.getItem('mg_cloud_enabled') === '1') {
        markOrderUnsynced(id);
        mgCloudUpsertOrder(item).catch(err => {
            console.error('云端同步失败:', err);
            updateSyncStatus();
        });
    }

    setTimeout(function () {
        renderScheduleTodoSection();
        if (allDoneChanged) renderScheduleCalendar();
    }, 0);
}

// 数量按钮：点击单次 + 长按连续
var scheduleTodoQtyPressTimer = null;
var scheduleTodoQtyPressInterval = null;
var scheduleTodoQtyPressHandled = false;

function clearScheduleTodoQtyPressTimers() {
    if (scheduleTodoQtyPressTimer) {
        clearTimeout(scheduleTodoQtyPressTimer);
        scheduleTodoQtyPressTimer = null;
    }
    if (scheduleTodoQtyPressInterval) {
        clearInterval(scheduleTodoQtyPressInterval);
        scheduleTodoQtyPressInterval = null;
    }
}

function startScheduleTodoQtyPress(event, el) {
    if (event) {
        event.stopPropagation();
        if (event.preventDefault) event.preventDefault();
    }
    stopScheduleTodoQtyPress();
    scheduleTodoQtyPressHandled = false;

    // 先短延迟再连续触发，避免误触
    scheduleTodoQtyPressTimer = setTimeout(function () {
        scheduleTodoQtyPressHandled = true;
        adjustScheduleTodoDoneQty(el);
        scheduleTodoQtyPressInterval = setInterval(function () {
            adjustScheduleTodoDoneQty(el);
        }, 120);
    }, 280);
}

function stopScheduleTodoQtyPress() {
    clearScheduleTodoQtyPressTimers();
}

function handleScheduleTodoQtyBtnClick(event, el) {
    if (event) event.stopPropagation();
    // 如果已经由长按触发过，本次 click 不再重复 +1/-1
    if (scheduleTodoQtyPressHandled) {
        scheduleTodoQtyPressHandled = false;
        return;
    }
    adjustScheduleTodoDoneQty(el);
}

// 点击 todo 卡片：弹出操作菜单；勾选框 + 制品文字 + 其下方节点/赠品文字不弹窗，其余区域（包括制品区空白）均弹窗
function handleScheduleTodoCardClick(id, event) {
    if (!event) {
        openScheduleTodoCardModal(id);
        return;
    }

    const target = event.target;

    // 1. 勾选框点击：不弹窗
    if (target.closest('.schedule-todo-checkbox')) return;

    // 2. 制品/节点/赠品文字点击：不弹窗（制品信息文字部分统一使用 schedule-todo-label）
    if (target.closest('.schedule-todo-label')) return;

    // 其它区域（包括 chips 容器的空白）都弹窗
    openScheduleTodoCardModal(id);
}

// 排单卡片操作弹窗
var scheduleTodoCardModalRecordId = null;
function openScheduleTodoCardModal(recordId) {
    scheduleTodoCardModalRecordId = recordId;
    var el = document.getElementById('scheduleTodoCardModal');
    if (el) el.classList.remove('d-none');
}
function closeScheduleTodoCardModal() {
    scheduleTodoCardModalRecordId = null;
    var el = document.getElementById('scheduleTodoCardModal');
    if (el) el.classList.add('d-none');
}
// 记录页：点击行打开操作弹窗（事件委托，避免 inline onclick 与 id 类型问题）
(function () {
    var container = document.getElementById('recordContainer');
    if (container) {
        container.addEventListener('click', function (e) {
            var row = e.target.closest('.record-item-clickable');
            if (!row) return;
            if (e.target.closest('.record-item-checkbox') || e.target.closest('.record-item-delete')) return;
            var id = row.getAttribute('data-id');
            if (id == null || id === '') return;
            var num = Number(id);
            if (!isNaN(num) && String(num) === String(id)) id = num;
            openScheduleTodoCardModal(id);
        });
    }
})();
function scheduleTodoCardAction(action) {
    var id = scheduleTodoCardModalRecordId;
    closeScheduleTodoCardModal();
    if (id == null) return;
    if (action === 'edit') editHistoryItem(id);
    else if (action === 'receipt') { setReceiptFromRecord(); loadQuoteFromHistory(id); }
    else if (action === 'remark') openOrderRemarkModal(id);
    else if (action === 'cancel' || action === 'waste_fee' || action === 'normal') {
        openSettlementModal(id, action);
    } else if (action === 'delete') {
        if(confirm('确定删除该记录？')) {
            deleteHistoryItem(id);
        }
    }
}
function needDepositChecked() {
    var el = document.getElementById('needDeposit');
    return el ? el.value === 'yes' : false;
}
// 接单平台输入变更时：若与设置中某平台名称一致则自动选中该平台手续费
function syncOrderPlatformToPlatform() {
    var orderPlatformEl = document.getElementById('orderPlatform');
    var platformEl = document.getElementById('platform');
    if (!orderPlatformEl || !platformEl) return;
    var text = (orderPlatformEl.value || '').trim();
    if (!text) return;

    var platformFees = defaultSettings.platformFees;
    if (platformFees && typeof platformFees === 'object') {
        var textLower = text.toLowerCase();
        var match = Object.entries(platformFees).find(function (e) {
            return e[1] && (e[1].name || '').toLowerCase() === textLower;
        });

        if (match) {
            // 匹配到设置页配置的平台：同步选择该平台手续费
            platformEl.value = match[0];
            if (typeof onPlatformChangeForDeposit === 'function') onPlatformChangeForDeposit();
        } else {
            // 未在设置页配置的平台（如QQ/微信等）：手续费选“无”，但不要反向覆盖接单平台文本
            if (platformFees.none != null) platformEl.value = 'none';
            else platformEl.value = '';
            // 这里不要调用 onPlatformChangeForDeposit()，避免把接单平台改成“无”
        }
    }
}
// 平台手续费变更时同步到接单平台输入框（显示平台名称）
function onPlatformChangeForDeposit() {
    var platformEl = document.getElementById('platform');
    var orderPlatformEl = document.getElementById('orderPlatform');
    if (!platformEl || !orderPlatformEl) return;
    var key = platformEl.value;

    // 如果选择的是“无”，则不修改接单平台的文本，允许保留如 QQ、微信等输入
    if (key === 'none' || !key) {
        if (typeof updateQuoteDisplay === 'function') updateQuoteDisplay();
        return;
    }

    if (key && defaultSettings.platformFees && defaultSettings.platformFees[key]) {
        orderPlatformEl.value = (defaultSettings.platformFees[key].name || key);
        toggleOrderPlatformClear();
    }
    
    if (typeof updateQuoteDisplay === 'function') updateQuoteDisplay();
}
// 接单平台一键清空
function clearOrderPlatformInput() {
    var orderPlatformEl = document.getElementById('orderPlatform');
    if (orderPlatformEl) {
        orderPlatformEl.value = '';
        orderPlatformEl.focus();
        toggleOrderPlatformClear();
    }
}
// 根据接单平台输入框是否有值，显示/隐藏框内清空按钮
function toggleOrderPlatformClear() {
    var wrap = document.getElementById('orderPlatformWrap');
    var input = document.getElementById('orderPlatform');
    if (!wrap || !input) return;
    if ((input.value || '').trim()) wrap.classList.add('has-value');
    else wrap.classList.remove('has-value');
}

// 单主ID智能填充：根据关键字模糊匹配历史，显示下拉列表；选中后填充 ID、接单平台、联系方式
function getClientIdMatchList(keyword) {
    if (!keyword || !Array.isArray(history) || history.length === 0) return [];
    var keyLower = String(keyword).trim().toLowerCase();
    if (!keyLower) return [];
    var seen = {};
    var list = [];
    for (var i = history.length - 1; i >= 0; i--) {
        var item = history[i];
        if (!item) continue;
        var cid = (item.clientId != null) ? String(item.clientId).trim() : '';
        if (!cid || seen[cid]) continue;
        var cidLower = cid.toLowerCase();
        var contact = (item.contact != null) ? String(item.contact).trim() : '';
        var contactLower = contact.toLowerCase();
        var contactInfo = (item.contactInfo != null) ? String(item.contactInfo).trim() : '';
        var contactInfoLower = contactInfo.toLowerCase();
        var match = cidLower.indexOf(keyLower) >= 0 || contactLower.indexOf(keyLower) >= 0 || contactInfoLower.indexOf(keyLower) >= 0;
        if (match) {
            seen[cid] = true;
            list.push({ clientId: cid, contact: contact, contactInfo: contactInfo });
        }
    }
    return list;
}

function showClientIdMatches() {
    var clientIdEl = document.getElementById('clientId');
    var wrap = document.getElementById('clientIdMatchWrap');
    var listEl = document.getElementById('clientIdMatchList');
    if (!clientIdEl || !wrap || !listEl) return;
    var keyword = (clientIdEl.value || '').trim();
    var matches = getClientIdMatchList(keyword);
    if (matches.length === 0) {
        wrap.classList.add('d-none');
        listEl.innerHTML = '';
        return;
    }
    listEl.innerHTML = matches.map(function (m) {
        var label = m.clientId;
        if (m.contact || m.contactInfo) label += ' · ' + [m.contact, m.contactInfo].filter(Boolean).join(' ');
        var labelEsc = (label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        var cidAttr = (m.clientId || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        var contactAttr = (m.contact || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        var contactInfoAttr = (m.contactInfo || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        return '<li class="client-id-match-item" role="button" tabindex="0" data-client-id="' + cidAttr + '" data-contact="' + contactAttr + '" data-contact-info="' + contactInfoAttr + '">' + labelEsc + '</li>';
    }).join('');
    wrap.classList.remove('d-none');
    listEl.querySelectorAll('.client-id-match-item').forEach(function (li) {
        li.addEventListener('click', function () {
            var id = li.getAttribute('data-client-id') || '';
            var contact = li.getAttribute('data-contact') || '';
            var contactInfo = li.getAttribute('data-contact-info') || '';
            id = id.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
            contact = contact.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
            contactInfo = contactInfo.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
            if (clientIdEl) clientIdEl.value = id;
            var orderPlatformEl = document.getElementById('orderPlatform');
            var contactInfoEl = document.getElementById('contactInfo');
            if (orderPlatformEl) orderPlatformEl.value = contact;
            if (contactInfoEl) contactInfoEl.value = contactInfo;
            if (typeof syncOrderPlatformToPlatform === 'function') syncOrderPlatformToPlatform();
            if (typeof toggleOrderPlatformClear === 'function') toggleOrderPlatformClear();
            hideClientIdMatchList();
        });
    });
}

var clientIdMatchDebounceTimer = null;
function debouncedShowClientIdMatches() {
    if (clientIdMatchDebounceTimer) clearTimeout(clientIdMatchDebounceTimer);
    clientIdMatchDebounceTimer = setTimeout(showClientIdMatches, 200);
}

var hideClientIdMatchTimer = null;
function scheduleHideClientIdMatchList() {
    if (hideClientIdMatchTimer) clearTimeout(hideClientIdMatchTimer);
    hideClientIdMatchTimer = setTimeout(hideClientIdMatchList, 150);
}
function hideClientIdMatchList() {
    if (hideClientIdMatchTimer) clearTimeout(hideClientIdMatchTimer);
    hideClientIdMatchTimer = null;
    var wrap = document.getElementById('clientIdMatchWrap');
    if (wrap) wrap.classList.add('d-none');
}

// 选中一项时填充单主ID、接单平台、联系方式后，不再自动覆盖；仅当用户输入关键字并选择时填充
// 根据单主 ID（或关键字）从历史记录自动填充接单平台和联系方式（先精确匹配，再关键字包含匹配，取最近一条）
function fillOrderPlatformAndContactFromHistory() {
    var clientIdEl = document.getElementById('clientId');
    var orderPlatformEl = document.getElementById('orderPlatform');
    var contactInfoEl = document.getElementById('contactInfo');
    if (!clientIdEl || !orderPlatformEl || !contactInfoEl) return;
    var keyword = (clientIdEl.value || '').trim();
    if (!keyword || !Array.isArray(history) || history.length === 0) return;
    var keyLower = keyword.toLowerCase();
    for (var i = history.length - 1; i >= 0; i--) {
        var item = history[i];
        var itemId = (item && item.clientId != null) ? String(item.clientId).trim().toLowerCase() : '';
        var match = (itemId === keyLower) || (itemId.indexOf(keyLower) >= 0);
        if (match) {
            orderPlatformEl.value = (item.contact != null && item.contact !== '') ? String(item.contact).trim() : '';
            contactInfoEl.value = (item.contactInfo != null && item.contactInfo !== '') ? String(item.contactInfo).trim() : '';
            if (typeof syncOrderPlatformToPlatform === 'function') syncOrderPlatformToPlatform();
            if (typeof toggleOrderPlatformClear === 'function') toggleOrderPlatformClear();
            return;
        }
    }
}
var fillFromHistoryInputTimer = null;
function debouncedFillFromHistory() {
    if (fillFromHistoryInputTimer) clearTimeout(fillFromHistoryInputTimer);
    fillFromHistoryInputTimer = setTimeout(fillOrderPlatformAndContactFromHistory, 350);
}

function openSettlementModal(recordId, preSelectedType) {
    var item = history.find(function (h) { return h.id === recordId; });
    if (!item) {
        showGlobalToast('未找到该排单');
        return;
    }
    settlementModalRecordId = recordId;
    var step1 = document.getElementById('settlementStep1');
    var step2 = document.getElementById('settlementStep2');
    var btnBack = document.getElementById('settlementBtnBack');
    var btnNext = document.getElementById('settlementBtnNext');
    var btnConfirm = document.getElementById('settlementBtnConfirm');
    document.querySelectorAll('input[name="settlementType"]').forEach(function (r) { r.checked = (r.value === preSelectedType); });
    if (preSelectedType) {
        settlementCurrentStep = 2;
        if (step1) step1.classList.add('d-none');
        if (step2) step2.classList.remove('d-none');
        if (btnBack) btnBack.classList.add('d-none');
        if (btnNext) btnNext.classList.add('d-none');
        if (btnConfirm) btnConfirm.classList.remove('d-none');
        var origType = preSelectedType;
        if (preSelectedType === 'cancel') {
            // 需要判断是退全款还是收跑单费
            var existingSettlement = item.settlement;
            if (existingSettlement && existingSettlement.type === 'cancel_with_fee') {
                preSelectedType = 'cancel';
            } else if (existingSettlement && existingSettlement.type === 'full_refund') {
                preSelectedType = 'cancel';
            }
        }
        showSettlementForm(preSelectedType);
        if (preSelectedType === 'cancel' && origType === 'cancel') {
            var existingSettlement = item.settlement;
            if (existingSettlement && existingSettlement.type === 'cancel_with_fee') {
                document.querySelector('input[name="cancelSubType"][value="cancel_with_fee"]').checked = true;
                document.getElementById('settlementFullRefundPanel').classList.add('d-none');
                document.getElementById('settlementCancelWithFee').classList.remove('d-none');
                settlementFillCancelFeeDefaults();
                settlementUpdateCancelFeePreview();
                var feeAmt = (existingSettlement.cancelFee && existingSettlement.cancelFee.feeAmount != null) ? Number(existingSettlement.cancelFee.feeAmount) : null;
                if (feeAmt == null || !isFinite(feeAmt)) {
                    var dep = Number(item.depositReceived || 0);
                    if (!isFinite(dep) || dep < 0) dep = 0;
                    feeAmt = (existingSettlement.amount != null ? Number(existingSettlement.amount) : 0) + dep;
                }
                var amountEl = document.getElementById('settlementCancelFeeAmount');
                if (amountEl && feeAmt >= 0) { amountEl.value = feeAmt.toFixed(2); settlementUpdatePreview(); }
                var memoEl = document.getElementById('settlementMemoCancelFee');
                if (memoEl) memoEl.value = (existingSettlement.memo || '') || '';
            }
        }
    } else {
        settlementCurrentStep = 1;
        if (step1) step1.classList.remove('d-none');
        if (step2) step2.classList.add('d-none');
        if (btnBack) btnBack.classList.add('d-none');
        if (btnNext) btnNext.classList.remove('d-none');
        if (btnConfirm) btnConfirm.classList.add('d-none');
        preSelectedType = null;
    }
    var titleEl = document.getElementById('settlementModalTitle');
    if (titleEl) titleEl.textContent = preSelectedType ? ({ cancel: '撤单', waste_fee: '废稿', normal: '结算' }[preSelectedType] || '结算') : '结算';
    document.getElementById('settlementModal').classList.remove('d-none');
}
var settlementCurrentFormType = null;
function showSettlementForm(type) {
    document.getElementById('settlementFormCancel').classList.add('d-none');
    document.getElementById('settlementFormWasteFee').classList.add('d-none');
    document.getElementById('settlementFormNormal').classList.add('d-none');
    if (type === 'cancel') {
        settlementCurrentFormType = 'cancel';
        var form = document.getElementById('settlementFormCancel');
        form.classList.remove('d-none');
        document.getElementById('settlementFullRefundPanel').classList.remove('d-none');
        document.getElementById('settlementCancelWithFee').classList.add('d-none');
        var refItem = history.find(function (h) { return h.id === settlementModalRecordId; });
        if (refItem && refItem.settlement && refItem.settlement.type === 'full_refund') {
            document.getElementById('settlementMemoRefund').value = (refItem.settlement.memo || '') || '';
            var fullRefundAmountEl = document.getElementById('settlementFullRefundAmount');
            if (fullRefundAmountEl && refItem.settlement.amount != null && isFinite(refItem.settlement.amount))
                fullRefundAmountEl.value = Number(refItem.settlement.amount).toFixed(2);
        } else {
            document.getElementById('settlementMemoRefund').value = '';
            var fullRefundAmountEl = document.getElementById('settlementFullRefundAmount');
            if (fullRefundAmountEl) {
                var deposit = refItem ? Number(refItem.depositReceived || 0) : 0;
                if (!isFinite(deposit) || deposit < 0) deposit = 0;
                fullRefundAmountEl.value = deposit > 0 ? deposit.toFixed(2) : '0';
            }
        }
        var fullRefundAmountEl = document.getElementById('settlementFullRefundAmount');
        if (fullRefundAmountEl) fullRefundAmountEl.addEventListener('input', settlementUpdatePreview);
        document.querySelector('input[name="cancelSubType"][value="full_refund"]').checked = true;
        var cancelFeeAmountEl = document.getElementById('settlementCancelFeeAmount');
        if (cancelFeeAmountEl) cancelFeeAmountEl.addEventListener('input', settlementUpdatePreview);
        document.querySelectorAll('input[name="cancelSubType"]').forEach(function (r) {
            r.onclick = function () {
                var isFee = document.querySelector('input[name="cancelSubType"]:checked').value === 'cancel_with_fee';
                document.getElementById('settlementFullRefundPanel').classList.toggle('d-none', isFee);
                document.getElementById('settlementCancelWithFee').classList.toggle('d-none', !isFee);
                if (isFee) {
                    settlementFillCancelFeeDefaults();
                    settlementUpdateCancelFeePreview();
                    var ruleEl = document.getElementById('settlementCancelFeeRule');
                    var rateEl = document.getElementById('settlementCancelFeeRate');
                    var fixedEl = document.getElementById('settlementCancelFeeFixed');
                    if (ruleEl) ruleEl.addEventListener('change', function () { settlementUpdateCancelFeePreview(); settlementToggleCancelFeeFields(); });
                    if (rateEl) rateEl.addEventListener('input', settlementUpdateCancelFeePreview);
                    if (fixedEl) fixedEl.addEventListener('input', settlementUpdateCancelFeePreview);
                } else {
                    settlementUpdatePreview();
                }
            };
        });
        settlementUpdatePreview();
    } else if (type === 'waste_fee') {
        settlementCurrentFormType = 'waste_fee';
        document.getElementById('settlementFormWasteFee').classList.remove('d-none');
        settlementRenderWasteFeeForm();
        var wasteFinalAmountEl = document.getElementById('settlementWasteFinalAmount');
        if (wasteFinalAmountEl) {
            wasteFinalAmountEl.addEventListener('input', settlementUpdatePreview);
            // 编辑已有废稿记录时，预填废稿费应收（定金抵扣逻辑下 amount=本次收款，输入框=废稿费应收）
            var refItem = history.find(function (h) { return h.id === settlementModalRecordId; });
            if (refItem && refItem.settlement && refItem.settlement.type === 'waste_fee' && refItem.settlement.wasteFee) {
                var wf = refItem.settlement.wasteFee;
                var feeAmt = (wf.feeAmount != null && isFinite(wf.feeAmount)) ? Number(wf.feeAmount) : (wf.totalReceivable != null && isFinite(wf.totalReceivable)) ? Number(wf.totalReceivable) : (wf.totalWasteReceivable != null && isFinite(wf.totalWasteReceivable)) ? Number(wf.totalWasteReceivable) : null;
                if (feeAmt != null && isFinite(feeAmt)) {
                    wasteFinalAmountEl.value = feeAmt.toFixed(2);
                }
            }
        }
        settlementUpdatePreview();
    } else if (type === 'normal') {
        settlementCurrentFormType = 'normal';
        document.getElementById('settlementFormNormal').classList.remove('d-none');
        settlementRenderNormalForm();
        settlementUpdateNormalPreview();
        var refItem = history.find(function (h) { return h.id === settlementModalRecordId; });
        if (refItem && refItem.settlement && refItem.settlement.type === 'normal') {
            var amtEl = document.getElementById('settlementNormalAmount');
            if (amtEl && refItem.settlement.amount != null && isFinite(refItem.settlement.amount))
                amtEl.value = Number(refItem.settlement.amount).toFixed(2);
            var drs = Array.isArray(refItem.settlement.discountReasons) ? refItem.settlement.discountReasons : [];
            var reasonsWrap = document.getElementById('settlementDiscountReasonsWrap');
            var presetList = getDiscountReasons();
            drs.forEach(function (entry) {
                var name = (entry && entry.name) ? String(entry.name).trim() : '';
                if (!name) return;
                var isRate = entry.rate != null && (entry.amount == null || entry.amount === 0);
                var presetIdx = -1;
                for (var p = 0; p < presetList.length; p++) {
                    if ((presetList[p].name || '').trim() === name) { presetIdx = p; break; }
                }
                if (presetIdx >= 0 && reasonsWrap) {
                    var rows = reasonsWrap.querySelectorAll('.settlement-reason-row-item');
                    var row = rows[presetIdx];
                    if (row) {
                        var cb = row.querySelector('.settlement-discount-reason-cb');
                        if (cb) cb.checked = true;
                        var typeInp = row.querySelector('input.settlement-reason-type');
                        if (typeInp) typeInp.value = isRate ? 'rate' : 'amount';
                        var toggleEl = row.querySelector('.settlement-reason-type-toggle');
                        if (toggleEl) toggleEl.setAttribute('data-active', isRate ? 'rate' : 'amount');
                        row.querySelectorAll('.settlement-reason-type-btn').forEach(function (b) {
                            b.classList.toggle('active', b.dataset.value === (isRate ? 'rate' : 'amount'));
                        });
                        var amWrap = row.querySelector('.settlement-reason-amount-wrap');
                        var rtWrap = row.querySelector('.settlement-reason-rate-wrap');
                        if (amWrap) amWrap.style.display = isRate ? 'none' : '';
                        if (rtWrap) rtWrap.style.display = isRate ? '' : 'none';
                        var amountInp = row.querySelector('.settlement-reason-amount');
                        var rateInp = row.querySelector('.settlement-reason-rate');
                        if (amountInp) amountInp.value = (entry.amount != null && isFinite(entry.amount)) ? entry.amount : '0';
                        if (rateInp) rateInp.value = (entry.rate != null && isFinite(entry.rate)) ? entry.rate : '0.99';
                    }
                } else {
                    var otherInput = document.getElementById('settlementDiscountReasonOther');
                    var otherAmount = document.getElementById('settlementOtherAmount');
                    var otherRate = document.getElementById('settlementOtherRate');
                    var otherTypeEl = document.getElementById('settlementOtherType');
                    var otherToggleEl = document.getElementById('settlementOtherTypeToggle');
                    var otherAmWrap = document.getElementById('settlementOtherAmountWrap');
                    var otherRtWrap = document.getElementById('settlementOtherRateWrap');
                    if (otherInput) otherInput.value = name;
                    if (isRate) {
                        if (otherTypeEl) otherTypeEl.value = 'rate';
                        if (otherToggleEl) otherToggleEl.setAttribute('data-active', 'rate');
                        if (otherAmWrap) otherAmWrap.style.display = 'none';
                        if (otherRtWrap) otherRtWrap.style.display = '';
                        if (otherRate) otherRate.value = (entry.rate != null && isFinite(entry.rate)) ? entry.rate : '0.99';
                    } else {
                        if (otherTypeEl) otherTypeEl.value = 'amount';
                        if (otherToggleEl) otherToggleEl.setAttribute('data-active', 'amount');
                        if (otherAmWrap) otherAmWrap.style.display = '';
                        if (otherRtWrap) otherRtWrap.style.display = 'none';
                        if (otherAmount) otherAmount.value = (entry.amount != null && isFinite(entry.amount)) ? entry.amount : '0';
                    }
                }
            });
            settlementUpdateNormalPreview(true);
        }
        var normalAmountEl = document.getElementById('settlementNormalAmount');
        if (normalAmountEl) {
            normalAmountEl.addEventListener('input', settlementUpdatePreview);
        }
        settlementUpdatePreview();
    }
}
function getEffectiveSettlementType() {
    if (settlementCurrentFormType === 'cancel') {
        var r = document.querySelector('input[name="cancelSubType"]:checked');
        return r ? r.value : 'full_refund';
    }
    return settlementCurrentFormType;
}

// ---------- 结算弹窗 ----------
var settlementModalRecordId = null;
var settlementCurrentStep = 1;

function closeSettlementModal() {
    settlementModalRecordId = null;
    document.getElementById('settlementModal').classList.add('d-none');
}

function getSettlementType() {
    var r = document.querySelector('input[name="settlementType"]:checked');
    return r ? r.value : null;
}

function settlementStepNext() {
    var type = getSettlementType();
    if (!type) {
        showGlobalToast('请选择结算类型');
        return;
    }
    settlementCurrentStep = 2;
    document.getElementById('settlementStep1').classList.add('d-none');
    document.getElementById('settlementStep2').classList.remove('d-none');
    document.getElementById('settlementBtnBack').classList.remove('d-none');
    document.getElementById('settlementBtnNext').classList.add('d-none');
    document.getElementById('settlementBtnConfirm').classList.remove('d-none');
    var origType = type;
    if (type === 'full_refund' || type === 'cancel_with_fee') type = 'cancel';
    showSettlementForm(type);
    if (type === 'cancel' && origType === 'cancel_with_fee') {
        document.querySelector('input[name="cancelSubType"][value="cancel_with_fee"]').checked = true;
        document.getElementById('settlementFullRefundPanel').classList.add('d-none');
        document.getElementById('settlementCancelWithFee').classList.remove('d-none');
        settlementFillCancelFeeDefaults();
        settlementUpdateCancelFeePreview();
    }
    if (type === 'cancel') {
        var ruleEl = document.getElementById('settlementCancelFeeRule');
        var rateEl = document.getElementById('settlementCancelFeeRate');
        var fixedEl = document.getElementById('settlementCancelFeeFixed');
        var cancelFeeAmountEl = document.getElementById('settlementCancelFeeAmount');
        if (ruleEl) ruleEl.addEventListener('change', function () { settlementUpdateCancelFeePreview(); settlementToggleCancelFeeFields(); });
        if (rateEl) rateEl.addEventListener('input', settlementUpdateCancelFeePreview);
        if (fixedEl) fixedEl.addEventListener('input', settlementUpdateCancelFeePreview);
        if (cancelFeeAmountEl) cancelFeeAmountEl.addEventListener('input', settlementUpdatePreview);
    }
}

function settlementStepBack() {
    settlementCurrentStep = 1;
    document.getElementById('settlementStep2').classList.add('d-none');
    document.getElementById('settlementStep1').classList.remove('d-none');
    document.getElementById('settlementBtnBack').classList.add('d-none');
    document.getElementById('settlementBtnNext').classList.remove('d-none');
    document.getElementById('settlementBtnConfirm').classList.add('d-none');
    var previewPanel = document.getElementById('settlementPreviewPanel');
    if (previewPanel) previewPanel.classList.add('d-none');
}

function getEffectiveSettlementRulesForItem(item) {
    if (item && item.settlementRulesSnapshot) return item.settlementRulesSnapshot;
    return defaultSettings.settlementRules || {};
}

function settlementFillCancelFeeDefaults() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    var _sr = getEffectiveSettlementRulesForItem(item);
    var rules = _sr && _sr.cancelFee ? _sr.cancelFee : {};
    var ruleEl = document.getElementById('settlementCancelFeeRule');
    var rateEl = document.getElementById('settlementCancelFeeRate');
    var fixedEl = document.getElementById('settlementCancelFeeFixed');
    if (ruleEl) ruleEl.value = rules.defaultRule || 'percent';
    if (rateEl) rateEl.value = (rules.defaultRate != null ? rules.defaultRate * 100 : 5);
    if (fixedEl) fixedEl.value = rules.defaultFixedAmount != null ? rules.defaultFixedAmount : 30;
    settlementToggleCancelFeeFields();
}

function settlementToggleCancelFeeFields() {
    var rule = document.getElementById('settlementCancelFeeRule');
    var rateWrap = document.querySelector('.settlement-cancel-fee-params label:first-of-type');
    var fixedWrap = document.querySelector('.settlement-cancel-fee-params label:last-of-type');
    if (!rule) return;
    var isPercent = rule.value === 'percent';
    if (rateWrap) rateWrap.style.display = isPercent ? '' : 'none';
    if (fixedWrap) fixedWrap.style.display = isPercent ? 'none' : '';
}

function computeCancelFeeAmount(item, rule, ratePercent, fixedAmount) {
    if (rule === 'percent') {
        var base = (item.agreedAmount != null ? item.agreedAmount : item.totalBeforePlatformFee) != null ? (item.agreedAmount != null ? item.agreedAmount : item.totalBeforePlatformFee) : (item.finalTotal || 0);
        return (base || 0) * (parseFloat(ratePercent) || 0) / 100;
    }
    return parseFloat(fixedAmount) || 0;
}

function settlementUpdateCancelFeePreview() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) return;
    var ruleEl = document.getElementById('settlementCancelFeeRule');
    var rateEl = document.getElementById('settlementCancelFeeRate');
    var fixedEl = document.getElementById('settlementCancelFeeFixed');
    var rule = ruleEl ? ruleEl.value : 'percent';
    var rate = rateEl ? rateEl.value : '0';
    var fixed = fixedEl ? fixedEl.value : '0';
    var amount = computeCancelFeeAmount(item, rule, rate, fixed);
    var amountEl = document.getElementById('settlementCancelFeeAmount');
    if (amountEl) amountEl.value = Math.max(0, amount).toFixed(2);
    settlementUpdatePreview();
}

// 更新结算预览面板（实时显示关键金额信息）
function settlementUpdatePreview() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) return;
    var previewPanel = document.getElementById('settlementPreviewPanel');
    var previewContent = document.getElementById('settlementPreviewContent');
    if (!previewPanel || !previewContent) return;
    
    var effectiveType = getEffectiveSettlementType();
    if (!effectiveType) {
        previewPanel.classList.add('d-none');
        return;
    }
    previewPanel.classList.remove('d-none');
    
    // 基础数据
    var receivable = Number(item.agreedAmount != null ? item.agreedAmount : (item.finalTotal || 0)) || 0;
    var deposit = Number(item.depositReceived || 0);
    if (!isFinite(deposit) || deposit < 0) deposit = 0;
    
    var html = '';
    
    if (effectiveType === 'full_refund') {
        // 撤单退全款：计算过程 + 本次确定
        var refundAmountEl = document.getElementById('settlementFullRefundAmount');
        var refundAmount = refundAmountEl ? (parseFloat(refundAmountEl.value) || 0) : 0;
        var refundShould = deposit; // 需退金额 = 已收定金
        html += '<div class="settlement-preview-calc-note">计算：需退金额 = 已收定金。请在「已退款金额」填写实际已退金额，用于核对。</div>';
        html += '<div class="settlement-preview-row"><span class="settlement-preview-label">订单金额（应收）：</span><span class="settlement-preview-value">¥' + receivable.toFixed(2) + '</span></div>';
        if (deposit > 0) {
            html += '<div class="settlement-preview-row"><span class="settlement-preview-label">已收定金：</span><span class="settlement-preview-value">¥' + deposit.toFixed(2) + '</span></div>';
        }
        html += '<div class="settlement-preview-row"><span class="settlement-preview-label"><strong>需退金额：</strong></span><span class="settlement-preview-value"><strong>¥' + refundShould.toFixed(2) + '</strong></span></div>';
        html += '<div class="settlement-preview-row"><span class="settlement-preview-label">已退款金额（您填写）：</span><span class="settlement-preview-value">¥' + refundAmount.toFixed(2) + '</span></div>';
        var refundDiff = refundAmount - refundShould;
        html += '<div class="settlement-preview-row settlement-preview-result">';
        if (Math.abs(refundDiff) < 0.005) {
            html += '<span class="settlement-preview-label">结算结果：</span><span class="settlement-preview-value">已全额退还定金</span>';
        } else if (refundDiff < 0) {
            html += '<span class="settlement-preview-label">结算结果：</span><span class="settlement-preview-value">还应退 ¥' + Math.abs(refundDiff).toFixed(2) + '</span>';
        } else {
            html += '<span class="settlement-preview-label">结算结果：</span><span class="settlement-preview-value">已多退 ¥' + refundDiff.toFixed(2) + '，请注意核对</span>';
        }
        html += '</div>';
        html += '<div class="settlement-preview-determine">本次确定：已退 ¥' + refundAmount.toFixed(2) + '</div>';
    } else if (effectiveType === 'cancel_with_fee') {
        // 撤单收跑单费：计算过程 + 本次确定
        var amountEl = document.getElementById('settlementCancelFeeAmount');
        var feeAmount = amountEl ? (parseFloat(amountEl.value) || 0) : 0;
        feeAmount = Math.max(0, feeAmount);
        var depositUsed = Math.min(deposit, feeAmount);
        var actual = feeAmount - depositUsed;
        var totalReceived = feeAmount;
        var refundExcess = Math.max(0, deposit - feeAmount);
        var ruleEl = document.getElementById('settlementCancelFeeRule');
        var rateEl = document.getElementById('settlementCancelFeeRate');
        var feePercentText = '';
        if (ruleEl && ruleEl.value === 'percent' && rateEl) {
            var pct = parseFloat(rateEl.value) || 0;
            feePercentText = pct.toFixed(0) + '%';
        }
        html += '<div class="settlement-preview-calc-note">计算：定金抵扣 = min(已收定金, 跑单费)，本次收款 = 跑单费 − 定金抵扣；合计实收 = 跑单费。可修改「跑单费（应收）」后查看变化。</div>';
        html += '<div class="settlement-preview-row"><span class="settlement-preview-label">订单金额（应收）：</span><span class="settlement-preview-value">¥' + receivable.toFixed(2) + '</span></div>';
        if (feePercentText) {
            html += '<div class="settlement-preview-row"><span class="settlement-preview-label">跑单费（' + feePercentText + '）：</span><span class="settlement-preview-value">¥' + feeAmount.toFixed(2) + '</span></div>';
        } else {
            html += '<div class="settlement-preview-row"><span class="settlement-preview-label">跑单费（应收）：</span><span class="settlement-preview-value">¥' + feeAmount.toFixed(2) + '</span></div>';
        }
        if (deposit > 0) {
            html += '<div class="settlement-preview-row"><span class="settlement-preview-label">已收定金：</span><span class="settlement-preview-value">¥' + deposit.toFixed(2) + '</span></div>';
            html += '<div class="settlement-preview-row"><span class="settlement-preview-label">定金抵扣跑单费：</span><span class="settlement-preview-value">¥' + depositUsed.toFixed(2) + '</span></div>';
        }
        html += '<div class="settlement-preview-row"><span class="settlement-preview-label">本次收款：</span><span class="settlement-preview-value">¥' + actual.toFixed(2) + '</span></div>';
        if (refundExcess > 0) {
            html += '<div class="settlement-preview-row"><span class="settlement-preview-label">多余定金待退：</span><span class="settlement-preview-value">¥' + refundExcess.toFixed(2) + '</span></div>';
        }
        html += '<div class="settlement-preview-row"><span class="settlement-preview-label"><strong>合计实收：</strong></span><span class="settlement-preview-value"><strong>¥' + totalReceived.toFixed(2) + '</strong></span></div>';
        html += '<div class="settlement-preview-row settlement-preview-result">';
        var resultText = '跑单费 ¥' + feeAmount.toFixed(2) + '（定金抵扣 ¥' + depositUsed.toFixed(2) + '，本次收款 ¥' + actual.toFixed(2) + '）';
        var memoEl = document.getElementById('settlementMemoCancelFee');
        var memoText = memoEl && memoEl.value ? String(memoEl.value).trim() : '';
        if (memoText) resultText += '；备注：' + memoText;
        html += '<span class="settlement-preview-label">结算结果：</span><span class="settlement-preview-value">' + resultText + '</span>';
        html += '</div>';
        html += '<div class="settlement-preview-determine">本次确定：本次收款 ¥' + actual.toFixed(2) + '，合计实收 ¥' + totalReceived.toFixed(2) + (refundExcess > 0 ? '；待退定金 ¥' + refundExcess.toFixed(2) : '') + '</div>';
    } else if (effectiveType === 'waste_fee') {
        // 废稿结算：计算过程 + 本次确定（同跑单费逻辑）
        var finalAmountEl = document.getElementById('settlementWasteFinalAmount');
        var feeAmount = finalAmountEl ? (parseFloat(finalAmountEl.value) || 0) : 0;
        feeAmount = Math.max(0, feeAmount);
        var depositUsed = Math.min(deposit, feeAmount);
        var actual = feeAmount - depositUsed;
        var totalReceived = feeAmount;
        var refundExcess = Math.max(0, deposit - feeAmount);
        html += '<div class="settlement-preview-calc-note">计算：定金抵扣 = min(已收定金, 废稿费)，本次收款 = 废稿费 − 定金抵扣；合计实收 = 废稿费。可修改「废稿费（应收）」后查看变化。</div>';
        html += '<div class="settlement-preview-row"><span class="settlement-preview-label">废稿费（应收）：</span><span class="settlement-preview-value">¥' + feeAmount.toFixed(2) + '</span></div>';
        if (deposit > 0) {
            html += '<div class="settlement-preview-row"><span class="settlement-preview-label">已收定金：</span><span class="settlement-preview-value">¥' + deposit.toFixed(2) + '</span></div>';
            html += '<div class="settlement-preview-row"><span class="settlement-preview-label">定金抵扣废稿费：</span><span class="settlement-preview-value">¥' + depositUsed.toFixed(2) + '</span></div>';
        }
        html += '<div class="settlement-preview-row"><span class="settlement-preview-label">本次收款：</span><span class="settlement-preview-value">¥' + actual.toFixed(2) + '</span></div>';
        if (refundExcess > 0) {
            html += '<div class="settlement-preview-row"><span class="settlement-preview-label">多余定金待退：</span><span class="settlement-preview-value">¥' + refundExcess.toFixed(2) + '</span></div>';
        }
        html += '<div class="settlement-preview-row"><span class="settlement-preview-label"><strong>合计实收：</strong></span><span class="settlement-preview-value"><strong>¥' + totalReceived.toFixed(2) + '</strong></span></div>';
        html += '<div class="settlement-preview-row settlement-preview-result">';
        var resultText = '废稿费 ¥' + feeAmount.toFixed(2) + '（定金抵扣 ¥' + depositUsed.toFixed(2) + '，本次收款 ¥' + actual.toFixed(2) + '）';
        html += '<span class="settlement-preview-label">结算结果：</span><span class="settlement-preview-value">' + resultText + '</span>';
        html += '</div>';
        html += '<div class="settlement-preview-determine">本次确定：本次收款 ¥' + actual.toFixed(2) + '，合计实收 ¥' + totalReceived.toFixed(2) + (refundExcess > 0 ? '；待退定金 ¥' + refundExcess.toFixed(2) : '') + '</div>';
    } else if (effectiveType === 'normal') {
        // 正常结单
        var amountEl = document.getElementById('settlementNormalAmount');
        var actual = amountEl ? (parseFloat(amountEl.value) || 0) : 0;
        var totalReceived = deposit + actual;
        
        // 计算结算优惠合计
        var discountTotal = 0;
        var discountReasons = [];
        document.querySelectorAll('.settlement-discount-reason-cb:checked').forEach(function (cb) {
            var row = cb.closest('.settlement-reason-row-item');
            if (!row) return;
            var name = (cb.dataset.name || '').trim();
            if (!name) return;
            var typeInp = row.querySelector('input.settlement-reason-type');
            var toggleEl = row.querySelector('.settlement-reason-type-toggle');
            var typeVal = (typeInp && typeInp.value) ? typeInp.value : (toggleEl ? toggleEl.getAttribute('data-active') : null) || 'amount';
            var entry = { name: name };
            if (typeVal === 'amount') {
                var amtInp = row.querySelector('.settlement-reason-amount');
                var amt = amtInp ? (parseFloat(amtInp.value) || 0) : 0;
                if (amt > 0) {
                    entry.amount = amt;
                    discountTotal += amt;
                }
            } else {
                var rateInp = row.querySelector('input.settlement-reason-rate');
                var r = rateInp ? normalizeDiscountRate(parseFloat(rateInp.value)) : NaN;
                if (!isNaN(r)) {
                    entry.rate = r;
                }
            }
            if (entry.amount || entry.rate) discountReasons.push(entry);
        });
        // 其他原因
        var otherText = (document.getElementById('settlementDiscountReasonOther') && document.getElementById('settlementDiscountReasonOther').value || '').trim();
        if (otherText) {
            var otherEntry = { name: otherText };
            var oTypeEl = document.getElementById('settlementOtherType');
            var oTypeVal = oTypeEl ? oTypeEl.value : 'amount';
            if (oTypeVal === 'amount') {
                var oAmt = document.getElementById('settlementOtherAmount');
                var oa = oAmt ? parseFloat(oAmt.value) : 0;
                if (oa > 0) {
                    otherEntry.amount = oa;
                    discountTotal += oa;
                }
            } else {
                var oRate = document.getElementById('settlementOtherRate');
                var or_ = oRate ? normalizeDiscountRate(parseFloat(oRate.value)) : NaN;
                if (!isNaN(or_)) {
                    otherEntry.rate = or_;
                }
            }
            if (otherEntry.amount || otherEntry.rate) discountReasons.push(otherEntry);
        }
        
        // 结单计算逻辑：订单金额（应收）→ 已收定金 → 本次应收 → 结算优惠 → 合计实收 → 本次收款
        html += '<div class="settlement-preview-calc-note">计算：合计实收 = 已收定金 + 本次收款；本次收款默认本次应收，可在此处直接修改。</div>';
        html += '<div class="settlement-preview-row"><span class="settlement-preview-label"><strong>订单金额（应收）：</strong></span><span class="settlement-preview-value"><strong>¥' + receivable.toFixed(2) + '</strong></span></div>';
        html += '<div class="settlement-preview-row"><span class="settlement-preview-label">已收定金：</span><span class="settlement-preview-value">¥' + deposit.toFixed(2) + '</span></div>';
        if (deposit > 0) {
            var tailBeforeDiscount = Math.max(0, receivable - deposit);
            html += '<div class="settlement-preview-row"><span class="settlement-preview-label">本次应收：</span><span class="settlement-preview-value">¥' + tailBeforeDiscount.toFixed(2) + '</span></div>';
        }
        // 结算优惠
        if (discountReasons.length > 0) {
            var totalAmtOnly = 0;
            var productRateOnly = 1;
            var rateOnlyEntries = [];
            discountReasons.forEach(function (e) {
                if (e.amount != null && isFinite(e.amount) && e.amount > 0) totalAmtOnly += e.amount;
                if (e.rate != null && isFinite(e.rate) && e.rate > 0) {
                    productRateOnly *= e.rate;
                    rateOnlyEntries.push(e);
                }
            });
            var baseForRate = Math.max(0, receivable - totalAmtOnly);
            var totalRateDiscount = baseForRate * (1 - productRateOnly);
            var sumOneMinusRate = 0;
            rateOnlyEntries.forEach(function (e) { sumOneMinusRate += (1 - (e.rate || 0)); });
            html += '<div class="settlement-preview-discounts">';
            html += '<div class="settlement-preview-row"><span class="settlement-preview-label"><strong>结算优惠：</strong></span></div>';
            discountReasons.forEach(function (e) {
                var nm = String(e.name);
                var amt = e.amount != null && isFinite(e.amount) ? Number(e.amount) : 0;
                var rateText = '';
                if (e.rate != null && isFinite(e.rate) && e.rate > 0) {
                    var rShow = e.rate;
                    if (rShow > 0.99) rShow = 0.99;
                    var rStr = rShow.toFixed(2);
                    if (rStr.endsWith('0')) rStr = rShow.toFixed(1);
                    if (rStr.endsWith('.0')) rStr = rStr.slice(0, -2);
                    rateText = rStr + '×';
                }
                var leftText = rateText ? (nm + '：' + rateText) : (nm + '：');
                var rightText = '';
                if (amt > 0) {
                    rightText = '-¥' + amt.toFixed(2);
                } else if (rateText && sumOneMinusRate > 0 && totalRateDiscount > 0) {
                    var share = totalRateDiscount * (1 - (e.rate || 0)) / sumOneMinusRate;
                    rightText = '折扣减去金额 -¥' + share.toFixed(2);
                } else if (rateText) {
                    rightText = '折扣减去金额';
                }
                if (leftText) {
                    html += '<div class="settlement-preview-row settlement-preview-discount-item"><span class="settlement-preview-label">' + leftText + '</span><span class="settlement-preview-value">' + rightText + '</span></div>';
                }
            });
            var totalDiscountAmount = Math.max(0, receivable - totalReceived);
            if (totalDiscountAmount > 0) {
                html += '<div class="settlement-preview-row settlement-preview-discount-item"><span class="settlement-preview-label">共减免：</span><span class="settlement-preview-value">-¥' + totalDiscountAmount.toFixed(2) + '</span></div>';
            }
            html += '</div>';
        }
        html += '<div class="settlement-preview-row"><span class="settlement-preview-label"><strong>合计实收：</strong></span><span class="settlement-preview-value"><strong>¥' + totalReceived.toFixed(2) + '</strong></span></div>';
        html += '<div class="settlement-preview-row"><span class="settlement-preview-label"><strong>本次收款：</strong></span><span class="settlement-preview-value"><strong>¥' + actual.toFixed(2) + '</strong></span></div>';
        
        var diff = totalReceived - receivable;
        html += '<div class="settlement-preview-row settlement-preview-result">';
        if (Math.abs(diff) < 0.005) {
            html += '<span class="settlement-preview-label">结算结果：</span><span class="settlement-preview-value">已结清</span>';
        } else if (diff < 0) {
            var totalDiscount = discountTotal > 0 ? discountTotal : (receivable - totalReceived);
            html += '<span class="settlement-preview-label">结算结果：</span><span class="settlement-preview-value">本次共减免 ¥' + totalDiscount.toFixed(2) + '</span>';
        } else {
            html += '<span class="settlement-preview-label">结算结果：</span><span class="settlement-preview-value">多收 ¥' + diff.toFixed(2) + '，应找零/退款给客户</span>';
        }
        html += '</div>';
        html += '<div class="settlement-preview-determine">本次确定：本次收款 ¥' + actual.toFixed(2) + '，合计实收 ¥' + totalReceived.toFixed(2) + '</div>';
    }
    
    previewContent.innerHTML = html;
}

function settlementRenderWasteFeeForm() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) return;
    ensureProductDoneStates(item);
    
    // 从设置页读取废稿费配置
    var _sr = getEffectiveSettlementRulesForItem(item); var wf = (_sr && _sr.wasteFee) || {};
    var mode = wf.mode || 'percent_total';
    
    // 设置隐藏的 select 值（供后续读取）
    var ruleEl = document.getElementById('settlementWasteRule');
    if (ruleEl) ruleEl.value = mode;
    
    // 显示当前模式名称
    var modeNames = {
        'percent_total': '按原总额比例',
        'percent_charged_only': '按已完成制品及工艺比例（按件+同模+工艺层数+废稿比例）',
        'fixed_per_item': '按件固定',
        'fixed_amount': '按固定金额'
    };
    var modeTextEl = document.getElementById('settlementWasteModeText');
    if (modeTextEl) modeTextEl.textContent = modeNames[mode] || mode;

    var byPieceWrap = document.getElementById('settlementWasteByPieceWrap');
    var percentTotalWrap = document.getElementById('settlementWastePercentTotalWrap');
    var fixedPerItemWrap = document.getElementById('settlementWasteFixedPerItemWrap');
    var fixedAmountWrap = document.getElementById('settlementWasteFixedAmountWrap');
    
    if (byPieceWrap) byPieceWrap.classList.toggle('d-none', mode !== 'percent_charged_only');
    if (percentTotalWrap) percentTotalWrap.classList.toggle('d-none', mode !== 'percent_total');
    if (fixedPerItemWrap) fixedPerItemWrap.classList.toggle('d-none', mode !== 'fixed_per_item');
    if (fixedAmountWrap) fixedAmountWrap.classList.toggle('d-none', mode !== 'fixed_amount');
    
    if (mode === 'percent_charged_only') {
        settlementRenderWasteByPieceForm();
        return;
    }
    if (mode === 'percent_total') {
        settlementRenderPercentTotalForm();
        return;
    }
    if (mode === 'fixed_per_item') {
        settlementRenderFixedPerItemForm();
        return;
    }
    if (mode === 'fixed_amount') {
        settlementRenderFixedAmountForm();
        return;
    }
}

function computeWasteFeeAmount(item, rule, rate, fixedPerItem, minAmount, maxAmount, chargedIndices, processDoneFlags) {
    var products = item.productPrices || [];
    var gifts = item.giftPrices || [];
    var allItems = products.concat(gifts);
    ensureProductDoneStates(item);
    var doneFlags = processDoneFlags || (item.productDoneStates || []).slice(0, allItems.length);
    if (chargedIndices.length === 0) chargedIndices = allItems.map(function (_, i) { return i; });
    var base = 0;
    var count = 0;
    if (rule === 'percent_total') {
        var total = (item.agreedAmount != null ? item.agreedAmount : item.totalBeforePlatformFee != null ? item.totalBeforePlatformFee : item.finalTotal) || 0;
        if (chargedIndices.length < allItems.length) {
            total = 0;
            chargedIndices.forEach(function (i) {
                if (allItems[i] && (allItems[i].productTotal != null)) total += Number(allItems[i].productTotal) || 0;
            });
        }
        base = total * (parseFloat(rate) || 0);
    } else if (rule === 'percent_charged_only') {
        chargedIndices.forEach(function (i) {
            if (doneFlags[i] && allItems[i] && (allItems[i].productTotal != null)) base += Number(allItems[i].productTotal) || 0;
        });
        base = base * (parseFloat(rate) || 0);
    } else {
        chargedIndices.forEach(function (i) {
            if (doneFlags[i]) count++;
        });
        base = count * (parseFloat(fixedPerItem) || 0);
    }
    if (minAmount != null && minAmount !== '' && !isNaN(parseFloat(minAmount))) base = Math.max(base, parseFloat(minAmount));
    if (maxAmount != null && maxAmount !== '' && !isNaN(parseFloat(maxAmount))) base = Math.min(base, parseFloat(maxAmount));
    return Math.max(0, base);
}

function settlementUpdateWastePreview() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) return;
    var ruleEl = document.getElementById('settlementWasteRule');
    var rule = ruleEl ? ruleEl.value : 'percent_total';
    var amount;
    if (rule === 'fixed_amount') {
        var fixedAmountEl = document.getElementById('settlementWasteFixedAmount');
        amount = fixedAmountEl ? (parseFloat(fixedAmountEl.value) || 0) : 0;
        amount = Math.max(0, amount);
    } else {
        var wf = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) || {};
        var rateEl = document.getElementById('settlementWasteRate');
        var fixedPerItemEl = document.getElementById('settlementFixedPerItem');
        var minEl = document.getElementById('settlementWasteMin');
        var maxEl = document.getElementById('settlementWasteMax');
        var rate = rateEl ? rateEl.value : (wf.defaultRate != null ? String(wf.defaultRate) : '30');
        var fixedPerItem = fixedPerItemEl ? fixedPerItemEl.value : (wf.defaultFixedPerItem != null ? String(wf.defaultFixedPerItem) : '20');
        var minAmount = minEl ? minEl.value : (wf.minAmount != null ? String(wf.minAmount) : '');
        var maxAmount = maxEl ? maxEl.value : (wf.maxAmount != null ? String(wf.maxAmount) : '');
        var charged = [];
        document.querySelectorAll('.settlement-charged-item:checked').forEach(function (cb) { charged.push(parseInt(cb.dataset.idx, 10)); });
        var processDone = [];
        var list = document.querySelectorAll('.settlement-process-done-item');
        if (list.length) {
            list.forEach(function (cb) { processDone[parseInt(cb.dataset.idx, 10)] = cb.checked; });
        } else {
            var doneStates = item.productDoneStates || [];
            (item.productPrices || []).concat(item.giftPrices || []).forEach(function (_, i) { processDone[i] = !!doneStates[i]; });
        }
        amount = computeWasteFeeAmount(item, rule, rate, fixedPerItem, minAmount, maxAmount, charged, processDone);
    }
    var finalAmountEl = document.getElementById('settlementWasteFinalAmount');
    if (finalAmountEl) finalAmountEl.value = amount.toFixed(2);
}

// 按已完成制品及工艺比例：计算单行制品金额（产品+工艺，同模在行内、工艺按已做层数）
function computeWasteByPieceRowAmount(allItem, wasteQty, processLayersDone) {
    if (!allItem || wasteQty <= 0) return 0;
    var basePrice = Number(allItem.basePrice) || 0;
    var sameModelUnitPrice = Number(allItem.sameModelUnitPrice) || 0;
    var sameModel = (allItem.sameModelCount != null && allItem.sameModelCount > 0);
    var productAmount = sameModel
        ? basePrice + Math.max(0, wasteQty - 1) * sameModelUnitPrice
        : wasteQty * basePrice;
    var processAmount = 0;
    var processDetails = allItem.processDetails || [];
    for (var i = 0; i < processDetails.length; i++) {
        var p = processDetails[i];
        var layers = p.layers || 1;
        var pricePerLayer = (Number(p.unitPrice) || 0) / layers;
        var layersDone = (processLayersDone && processLayersDone[i] != null) ? Math.min(parseInt(processLayersDone[i], 10) || 0, layers) : 0;
        processAmount += pricePerLayer * layersDone * wasteQty;
    }
    return productAmount + processAmount;
}

// 按原总额比例
function settlementRenderPercentTotalForm() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) return;
    var wf = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) || {};
    var defaultRate = (wf.defaultRate != null ? wf.defaultRate : 30);
    var baseAmount = item.agreedAmount != null ? item.agreedAmount : (item.finalTotal != null ? item.finalTotal : 0);
    
    document.getElementById('settlementPercentTotalBase').textContent = '¥' + baseAmount.toFixed(2);
    document.getElementById('settlementPercentTotalRatio').textContent = defaultRate + '%';
    
    var wasteFee = baseAmount * (defaultRate / 100);
    document.getElementById('settlementPercentTotalWasteFee').textContent = '¥' + wasteFee.toFixed(2);
    
    settlementRenderOtherFeesForMode('PercentTotal', item, wf);
    settlementUpdatePercentTotalPreview();
}

// 按件固定
function settlementRenderFixedPerItemForm() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) return;
    var wf = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) || {};
    var products = item.productPrices || [];
    var gifts = item.giftPrices || [];
    var allItems = [];
    products.forEach(function (p, i) {
        var qty = p.quantity || 1;
        var sameModel = (p.sameModelCount != null && p.sameModelCount > 0);
        var sameModelPart = sameModel ? ' 同模x' + (p.sameModelCount || 1) : '';
        var label = (p.product || '制品') + 'x' + qty + sameModelPart;
        allItems.push({ idx: i, label: label, quantity: qty });
    });
    gifts.forEach(function (g, i) {
        var qty = g.quantity || 1;
        var sameModel = (g.sameModelCount != null && g.sameModelCount > 0);
        var sameModelPart = sameModel ? ' 同模x' + (g.sameModelCount || 1) : '';
        var label = '[赠品] ' + (g.product || '赠品') + 'x' + qty + sameModelPart;
        allItems.push({ idx: products.length + i, label: label, quantity: qty });
    });
    
    var listEl = document.getElementById('settlementFixedPerItemList');
    if (listEl) {
        listEl.innerHTML = allItems.map(function (it) {
            return '<label class="settlement-coeff-label"><input type="checkbox" class="settlement-fixed-per-item-check" data-idx="' + it.idx + '" data-qty="' + it.quantity + '" checked><span class="settlement-coeff-text">' + it.label + '</span></label>';
        }).join('');
        listEl.querySelectorAll('input').forEach(function (cb) {
            cb.addEventListener('change', settlementUpdateFixedPerItemPreview);
        });
    }
    
    var fixedPerItem = wf.defaultFixedPerItem != null ? wf.defaultFixedPerItem : 20;
    var priceEl = document.getElementById('settlementFixedPerItemPrice');
    if (priceEl && priceEl.tagName === 'INPUT') {
        priceEl.value = fixedPerItem;
        priceEl.removeEventListener('input', settlementUpdateFixedPerItemPreview);
        priceEl.addEventListener('input', settlementUpdateFixedPerItemPreview);
    }
    
    settlementRenderOtherFeesForMode('FixedPerItem', item, wf);
    settlementUpdateFixedPerItemPreview();
}

// 按固定金额
function settlementRenderFixedAmountForm() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) return;
    var wf = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) || {};
    var fixedAmount = wf.defaultFixedAmount != null ? wf.defaultFixedAmount : 50;
    
    var feeEl = document.getElementById('settlementFixedAmountWasteFee');
    if (feeEl && feeEl.tagName === 'INPUT') {
        feeEl.value = fixedAmount;
        feeEl.removeEventListener('input', settlementUpdateFixedAmountPreview);
        feeEl.addEventListener('input', settlementUpdateFixedAmountPreview);
    }
    
    settlementRenderOtherFeesForMode('FixedAmount', item, wf);
    settlementUpdateFixedAmountPreview();
}

// 通用：计算并渲染其他费用（用于各模式预览与确认）
function computeAndRenderOtherFeesWaste(item, wf, selectClass, containerId, amountElId) {
    var otherFeesWasteRatio = (wf && wf.otherFeesWasteRatio != null) ? Number(wf.otherFeesWasteRatio) : 0.5;
    var otherFees = item.otherFees || [];
    var otherFeesAmount = 0;
    var otherFeesEntries = [];
    otherFees.forEach(function (fee, fi) {
        var amt = Number(fee.amount) || 0;
        var selectEl = document.querySelector('.' + selectClass + '[data-fi="' + fi + '"]');
        var mode = selectEl ? selectEl.value : 'full';
        var charged = (mode === 'exclude') ? 0 : (mode === 'waste_ratio' ? amt * otherFeesWasteRatio : amt);
        otherFeesAmount += charged;
        otherFeesEntries.push({ name: fee.name, orderAmount: amt, mode: mode, chargedAmount: charged });
        var rowEl = document.querySelector('#' + containerId + ' .settlement-other-fee-row[data-fi="' + fi + '"]');
        if (rowEl) {
            var chargedEl = rowEl.querySelector('.settlement-other-fee-charged');
            if (chargedEl) chargedEl.textContent = '本条计入：¥' + charged.toFixed(2);
        }
    });
    var amountEl = document.getElementById(amountElId);
    if (amountEl) amountEl.textContent = '¥' + otherFeesAmount.toFixed(2);
    return { otherFeesAmount: otherFeesAmount, otherFeesEntries: otherFeesEntries };
}

// 通用：渲染其他费用（用于各模式）
function settlementRenderOtherFeesForMode(modePrefix, item, wf) {
    var otherFees = item.otherFees || [];
    var otherFeesEl = document.getElementById('settlement' + modePrefix + 'OtherFees');
    var otherRatioDefault = (wf && wf.otherFeesWasteRatio != null) ? Number(wf.otherFeesWasteRatio) : 0.5;
    
    if (otherFeesEl) {
        if (otherFees.length === 0) {
            otherFeesEl.innerHTML = '<p class="settlement-hint">无其他费用</p>';
        } else {
            otherFeesEl.innerHTML = otherFees.map(function (fee, fi) {
                var amt = Number(fee.amount) || 0;
                return '<div class="settlement-other-fee-row" data-fi="' + fi + '">' +
                    '<div class="settlement-other-fee-head">' +
                    '<span class="settlement-other-fee-label">' + (fi + 1) + '、' + (fee.name || '费用') + '</span>' +
                    '<select class="settlement-other-fee-select settlement-' + modePrefix.toLowerCase() + '-other-select" data-fi="' + fi + '">' +
                    '<option value="full" selected>按全价</option>' +
                    '<option value="waste_ratio">按废稿比例</option>' +
                    '<option value="exclude">不计入</option>' +
                    '</select></div>' +
                    '<p class="settlement-other-fee-charged">本条计入：¥' + amt.toFixed(2) + '</p></div>';
            }).join('');
            otherFeesEl.querySelectorAll('select').forEach(function (sel) {
                sel.addEventListener('change', function() {
                    if (modePrefix === 'PercentTotal') settlementUpdatePercentTotalPreview();
                    else if (modePrefix === 'FixedPerItem') settlementUpdateFixedPerItemPreview();
                    else if (modePrefix === 'FixedAmount') settlementUpdateFixedAmountPreview();
                });
            });
        }
    }
}

function settlementRenderWasteByPieceForm() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) return;
    var products = item.productPrices || [];
    var gifts = item.giftPrices || [];
    var allItems = [];
    products.forEach(function (p, i) {
        allItems.push({
            idx: i,
            label: (p.product || '制品') + (p.quantity > 1 ? ' x ' + p.quantity : ''),
            basePrice: p.basePrice,
            sameModelUnitPrice: p.sameModelUnitPrice,
            sameModelCount: p.sameModelCount,
            quantity: p.quantity,
            processDetails: p.processDetails || []
        });
    });
    gifts.forEach(function (g, i) {
        allItems.push({
            idx: products.length + i,
            label: '[赠品] ' + (g.product || '赠品') + (g.quantity > 1 ? ' x ' + g.quantity : ''),
            basePrice: g.basePrice,
            sameModelUnitPrice: g.sameModelUnitPrice,
            sameModelCount: g.sameModelCount || 0,
            quantity: g.quantity,
            processDetails: g.processDetails || []
        });
    });

    var wf = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) || {};
    var savedWf = (item.settlement && item.settlement.wasteFee && item.settlement.wasteFee.rule === 'percent_charged_only') ? item.settlement.wasteFee : null;
    var defaultRate = (savedWf && savedWf.wasteRatio != null) ? Math.round(savedWf.wasteRatio * 100) : (wf.defaultRate != null ? wf.defaultRate : 30);
    var defaultMin = (savedWf && savedWf.minAmount != null) ? savedWf.minAmount : (wf.minAmount != null ? wf.minAmount : '');
    var defaultMax = (savedWf && savedWf.maxAmount != null) ? savedWf.maxAmount : (wf.maxAmount != null ? wf.maxAmount : '');

    var tableEl = document.getElementById('settlementWasteDetailTable');
    if (tableEl) {
        var savedRowsByIdx = {};
        if (savedWf && Array.isArray(savedWf.rows)) savedWf.rows.forEach(function (r) { savedRowsByIdx[r.idx] = r; });
        var html = '';
        allItems.forEach(function (it, seqNum) {
            var savedRow = savedRowsByIdx[it.idx];
            var wasteQtyVal = (savedRow && savedRow.wasteQty != null) ? savedRow.wasteQty : 0;
            var productName = (it.label || '').replace(/\s*[x×]\s*\d+\s*$/i, '').trim() || (it.label || '制品');
            var qty = it.quantity || 1;
            var sameModel = (it.sameModelCount != null && it.sameModelCount > 0);
            var sameModelPart = sameModel ? ' 同模X' + (it.sameModelCount || 1) : '';
            html += '<div class="settlement-waste-detail-row" data-idx="' + it.idx + '">';
            html += '<div class="settlement-waste-row-label">' + (seqNum + 1) + '、' + productName + 'x' + qty + sameModelPart + '</div>';
            var maxQty = it.quantity || 999;
            html += '<label class="settlement-waste-qty-line">已完成 <span class="settlement-waste-qty-wrap"><button type="button" class="settlement-waste-qty-btn settlement-waste-qty-minus" data-idx="' + it.idx + '" aria-label="减">−</button><input type="number" class="settlement-waste-qty" data-idx="' + it.idx + '" min="0" max="' + maxQty + '" value="' + wasteQtyVal + '" step="1"><button type="button" class="settlement-waste-qty-btn settlement-waste-qty-plus" data-idx="' + it.idx + '" aria-label="加">+</button></span> 件</label>';
            var pd = it.processDetails || [];
            pd.forEach(function (proc, pi) {
                var layers = proc.layers || 1;
                var layersDoneVal = (savedRow && savedRow.processLayersDone && savedRow.processLayersDone[pi] != null) ? savedRow.processLayersDone[pi] : 0;
                html += '<label class="settlement-process-layers">' + (proc.name || '工艺') + ' 总' + layers + '层 已做 <span class="settlement-waste-qty-wrap"><button type="button" class="settlement-process-layers-btn settlement-process-layers-minus" data-idx="' + it.idx + '" data-pi="' + pi + '" aria-label="减">−</button><input type="number" class="settlement-process-layers-done" data-idx="' + it.idx + '" data-pi="' + pi + '" min="0" max="' + layers + '" value="' + layersDoneVal + '" step="1"><button type="button" class="settlement-process-layers-btn settlement-process-layers-plus" data-idx="' + it.idx + '" data-pi="' + pi + '" aria-label="加">+</button></span> 层</label>';
            });
            html += '<div class="settlement-waste-row-amount">本行制品金额：¥0.00</div>';
            html += '</div>';
        });
        tableEl.innerHTML = html;
        tableEl.querySelectorAll('.settlement-waste-qty-minus').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = btn.dataset.idx;
                var row = btn.closest('.settlement-waste-detail-row');
                var inp = row && row.querySelector('.settlement-waste-qty');
                if (inp) {
                    var v = parseInt(inp.value, 10) || 0;
                    inp.value = Math.max(0, v - 1);
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        });
        tableEl.querySelectorAll('.settlement-waste-qty-plus').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var row = btn.closest('.settlement-waste-detail-row');
                var inp = row && row.querySelector('.settlement-waste-qty');
                if (inp) {
                    var max = parseInt(inp.getAttribute('max'), 10) || 999;
                    var v = parseInt(inp.value, 10) || 0;
                    inp.value = Math.min(max, v + 1);
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        });
        tableEl.querySelectorAll('.settlement-process-layers-minus').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var row = btn.closest('.settlement-waste-detail-row');
                var inp = row && row.querySelector('.settlement-process-layers-done[data-idx="' + btn.dataset.idx + '"][data-pi="' + btn.dataset.pi + '"]');
                if (inp) {
                    var v = parseInt(inp.value, 10) || 0;
                    inp.value = Math.max(0, v - 1);
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        });
        tableEl.querySelectorAll('.settlement-process-layers-plus').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var row = btn.closest('.settlement-waste-detail-row');
                var inp = row && row.querySelector('.settlement-process-layers-done[data-idx="' + btn.dataset.idx + '"][data-pi="' + btn.dataset.pi + '"]');
                if (inp) {
                    var max = parseInt(inp.getAttribute('max'), 10) || 999;
                    var v = parseInt(inp.value, 10) || 0;
                    inp.value = Math.min(max, v + 1);
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        });
    }

    var ratioEl = document.getElementById('settlementWasteRatio');
    if (ratioEl) {
        ratioEl.textContent = defaultRate + '%';
    }
    var coeffEl = document.getElementById('settlementCoefficientsIncluded');
    if (coeffEl) {
        var coeffList = [];
        if (item.usageType != null && defaultSettings.usageCoefficients && defaultSettings.usageCoefficients[item.usageType]) {
            var uv = getCoefficientValue(defaultSettings.usageCoefficients[item.usageType]);
            var un = (defaultSettings.usageCoefficients[item.usageType] && defaultSettings.usageCoefficients[item.usageType].name) ? defaultSettings.usageCoefficients[item.usageType].name : '';
            coeffList.push({ key: 'usage', category: '用途', name: un, value: uv });
        }
        if (item.urgentType != null && defaultSettings.urgentCoefficients && defaultSettings.urgentCoefficients[item.urgentType]) {
            var gv = getCoefficientValue(defaultSettings.urgentCoefficients[item.urgentType]);
            var gn = (defaultSettings.urgentCoefficients[item.urgentType] && defaultSettings.urgentCoefficients[item.urgentType].name) ? defaultSettings.urgentCoefficients[item.urgentType].name : '';
            coeffList.push({ key: 'urgent', category: '加急', name: gn, value: gv });
        }
        if (item.discountType != null && defaultSettings.discountCoefficients && defaultSettings.discountCoefficients[item.discountType]) {
            var dv = getCoefficientValue(defaultSettings.discountCoefficients[item.discountType]);
            var dn = (defaultSettings.discountCoefficients[item.discountType] && defaultSettings.discountCoefficients[item.discountType].name) ? defaultSettings.discountCoefficients[item.discountType].name : '';
            coeffList.push({ key: 'discount', category: '折扣', name: dn, value: dv });
        }
        (defaultSettings.extraPricingUp || []).forEach(function (e, ei) {
            var sel = (item.extraUpSelections && item.extraUpSelections[ei]) ? item.extraUpSelections[ei] : null;
            if (sel && e.options && e.options[sel.optionValue] != null) {
                var ov = getCoefficientValue(e.options[sel.optionValue]);
                var on = (e.options[sel.optionValue] && e.options[sel.optionValue].name) ? e.options[sel.optionValue].name : (e.name || '');
                coeffList.push({ key: 'extraUp_' + ei, category: (e.name || '加价'), name: on, value: ov });
            }
        });
        (defaultSettings.extraPricingDown || []).forEach(function (e, ei) {
            var sel = (item.extraDownSelections && item.extraDownSelections[ei]) ? item.extraDownSelections[ei] : null;
            if (sel && e.options && e.options[sel.optionValue] != null) {
                var ov = getCoefficientValue(e.options[sel.optionValue]);
                var on = (e.options[sel.optionValue] && e.options[sel.optionValue].name) ? e.options[sel.optionValue].name : (e.name || '');
                coeffList.push({ key: 'extraDown_' + ei, category: (e.name || '扩展折扣'), name: on, value: ov });
            }
        });
        coeffList = coeffList.filter(function (c) {
            var valueNum = typeof c.value === 'number' ? c.value : parseFloat(c.value);
            return valueNum == null || isNaN(valueNum) || Math.abs(valueNum - 1) > 0.001;
        });
        var savedCoeff = (savedWf && savedWf.coefficientsIncluded) ? savedWf.coefficientsIncluded : null;
        coeffEl.innerHTML = coeffList.map(function (c) {
            var checked = (savedCoeff && savedCoeff[c.key]) ? ' checked' : ' checked';
            if (savedCoeff && savedCoeff.hasOwnProperty(c.key)) checked = savedCoeff[c.key] ? ' checked' : '';
            var valueNum = typeof c.value === 'number' ? c.value : parseFloat(c.value);
            var showMultiplier = (valueNum != null && !isNaN(valueNum) && Math.abs(valueNum - 1) > 0.001);
            var text = (c.category || '') + (c.name ? (c.category ? ' ' + c.name : c.name) : '') + (showMultiplier ? ' ×' + valueNum : '');
            return '<label class="settlement-coeff-label"><input type="checkbox" class="settlement-coeff-included" data-key="' + c.key + '"' + checked + '><span class="settlement-coeff-text">' + text + '</span></label>';
        }).join('');
        coeffEl.querySelectorAll('input').forEach(function (cb) {
            cb.addEventListener('change', settlementUpdateWasteByPiecePreview);
        });
    }

    var otherFees = item.otherFees || [];
    var otherFeesEl = document.getElementById('settlementOtherFeesByItem');
    var savedOtherEntries = (savedWf && savedWf.otherFeesEntries) ? savedWf.otherFeesEntries : null;
    var otherRatioDefault = (wf && wf.otherFeesWasteRatio != null) ? Number(wf.otherFeesWasteRatio) : 0.5;
    if (otherFeesEl) {
        if (otherFees.length === 0) {
            otherFeesEl.innerHTML = '<p class="settlement-hint">无其他费用</p>';
        } else {
            otherFeesEl.innerHTML = otherFees.map(function (fee, fi) {
                var amt = Number(fee.amount) || 0;
                var entry = savedOtherEntries && savedOtherEntries[fi] ? savedOtherEntries[fi] : null;
                var mode = (entry && entry.mode) ? entry.mode : 'full';
                if (mode !== 'full' && mode !== 'waste_ratio' && mode !== 'exclude') mode = 'full';
                var chargedVal = (mode === 'exclude') ? 0 : (mode === 'waste_ratio' ? amt * otherRatioDefault : amt);
                var chargedDisplay = (entry && entry.chargedAmount != null) ? entry.chargedAmount.toFixed(2) : chargedVal.toFixed(2);
                return '<div class="settlement-other-fee-row" data-fi="' + fi + '">' +
                    '<div class="settlement-other-fee-head">' +
                    '<span class="settlement-other-fee-label">' + (fi + 1) + '、' + (fee.name || '费用') + '</span>' +
                    '<select class="settlement-other-fee-select" data-fi="' + fi + '">' +
                    '<option value="full"' + (mode === 'full' ? ' selected' : '') + '>按全价</option>' +
                    '<option value="waste_ratio"' + (mode === 'waste_ratio' ? ' selected' : '') + '>按废稿比例</option>' +
                    '<option value="exclude"' + (mode === 'exclude' ? ' selected' : '') + '>不计入</option>' +
                    '</select></div>' +
                    '<p class="settlement-other-fee-charged">本条计入：¥' + chargedDisplay + '</p>';
            }).join('');
            otherFeesEl.querySelectorAll('select.settlement-other-fee-select').forEach(function (sel) {
                sel.addEventListener('change', settlementUpdateWasteByPiecePreview);
            });
        }
    }

    tableEl && tableEl.querySelectorAll('.settlement-waste-qty, .settlement-process-layers-done').forEach(function (inp) {
        inp.addEventListener('input', settlementUpdateWasteByPiecePreview);
    });
    settlementUpdateWasteByPiecePreview();
    var orderPaid = item.agreedAmount != null ? item.agreedAmount : (item.finalTotal != null ? item.finalTotal : 0);
    var previewEl = document.getElementById('settlementWastePreview');
    if (previewEl) previewEl.textContent = '应收金额：¥' + Number(orderPaid).toFixed(2);
}

// 按原总额比例：更新预览
function settlementUpdatePercentTotalPreview() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) return;
    var wf = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) || {};
    var defaultRate = (wf.defaultRate != null ? wf.defaultRate : 30);
    var baseAmount = item.agreedAmount != null ? item.agreedAmount : (item.finalTotal != null ? item.finalTotal : 0);
    var wasteFee = baseAmount * (defaultRate / 100);
    var other = computeAndRenderOtherFeesWaste(item, wf, 'settlement-percenttotal-other-select', 'settlementPercentTotalOtherFees', 'settlementPercentTotalOtherAmount');
    var totalReceivable = wasteFee + other.otherFeesAmount;
    var finalAmountEl = document.getElementById('settlementWasteFinalAmount');
    if (finalAmountEl) finalAmountEl.value = totalReceivable.toFixed(2);
    settlementUpdatePreview();
}

// 按件固定：更新预览
function settlementUpdateFixedPerItemPreview() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) return;
    var wf = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) || {};
    var priceEl = document.getElementById('settlementFixedPerItemPrice');
    var fixedPerItem = (priceEl && priceEl.value !== undefined) ? (parseFloat(priceEl.value) || 0) : (wf.defaultFixedPerItem != null ? wf.defaultFixedPerItem : 20);
    
    var count = 0;
    document.querySelectorAll('.settlement-fixed-per-item-check:checked').forEach(function (cb) {
        count += parseInt(cb.dataset.qty, 10) || 1;
    });
    document.getElementById('settlementFixedPerItemCount').textContent = count;
    
    var wasteFee = count * fixedPerItem;
    document.getElementById('settlementFixedPerItemWasteFee').textContent = '¥' + wasteFee.toFixed(2);
    
    var other = computeAndRenderOtherFeesWaste(item, wf, 'settlement-fixedperitem-other-select', 'settlementFixedPerItemOtherFees', 'settlementFixedPerItemOtherAmount');
    var totalReceivable = wasteFee + other.otherFeesAmount;
    var finalAmountEl = document.getElementById('settlementWasteFinalAmount');
    if (finalAmountEl) finalAmountEl.value = totalReceivable.toFixed(2);
    settlementUpdatePreview();
}

// 按固定金额：更新预览
function settlementUpdateFixedAmountPreview() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) return;
    var wf = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) || {};
    var feeEl = document.getElementById('settlementFixedAmountWasteFee');
    var wasteFee = (feeEl && feeEl.value !== undefined) ? (parseFloat(feeEl.value) || 0) : (wf.defaultFixedAmount != null ? wf.defaultFixedAmount : 50);
    
    var other = computeAndRenderOtherFeesWaste(item, wf, 'settlement-fixedamount-other-select', 'settlementFixedAmountOtherFees', 'settlementFixedAmountOtherAmount');
    var totalReceivable = wasteFee + other.otherFeesAmount;
    var finalAmountEl = document.getElementById('settlementWasteFinalAmount');
    if (finalAmountEl) finalAmountEl.value = totalReceivable.toFixed(2);
    settlementUpdatePreview();
}

function settlementUpdateWasteByPiecePreview() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) return;
    var products = item.productPrices || [];
    var gifts = item.giftPrices || [];
    var allItems = products.concat(gifts);

    var tableEl = document.getElementById('settlementWasteDetailTable');
    var detailAmount = 0;
    var rowAmounts = [];
    if (tableEl) {
        tableEl.querySelectorAll('.settlement-waste-detail-row').forEach(function (row) {
            var idx = parseInt(row.dataset.idx, 10);
            var wasteQtyEl = row.querySelector('.settlement-waste-qty');
            var wasteQty = wasteQtyEl ? (parseInt(wasteQtyEl.value, 10) || 0) : 0;
            var processLayersDone = [];
            row.querySelectorAll('.settlement-process-layers-done').forEach(function (inp) {
                processLayersDone.push(parseInt(inp.value, 10) || 0);
            });
            var allItem = allItems[idx];
            var rowAmt = computeWasteByPieceRowAmount(allItem, wasteQty, processLayersDone);
            rowAmounts[idx] = rowAmt;
            detailAmount += rowAmt;
            var amountSpan = row.querySelector('.settlement-waste-row-amount');
            if (amountSpan) amountSpan.textContent = '本行制品金额：¥' + rowAmt.toFixed(2);
        });
    }

    var ratioEl = document.getElementById('settlementWasteRatio');
    var ratioText = ratioEl ? (ratioEl.textContent || '').trim() : '';
    var ratio = 0.3;
    if (ratioText) {
        if (ratioText.indexOf('%') !== -1) ratio = (parseFloat(ratioText) || 30) / 100;
        else ratio = parseFloat(ratioText) || 0.3;
    }
    var feeSubtotal = detailAmount * ratio;

    var coeffProduct = 1;
    document.querySelectorAll('.settlement-coeff-included:checked').forEach(function (cb) {
        var key = cb.dataset.key;
        if (key === 'usage' && item.usageType != null && defaultSettings.usageCoefficients && defaultSettings.usageCoefficients[item.usageType]) {
            coeffProduct *= getCoefficientValue(defaultSettings.usageCoefficients[item.usageType]) || 1;
        } else if (key === 'urgent' && item.urgentType != null && defaultSettings.urgentCoefficients && defaultSettings.urgentCoefficients[item.urgentType]) {
            coeffProduct *= getCoefficientValue(defaultSettings.urgentCoefficients[item.urgentType]) || 1;
        } else if (key === 'discount' && item.discountType != null && defaultSettings.discountCoefficients && defaultSettings.discountCoefficients[item.discountType]) {
            coeffProduct *= getCoefficientValue(defaultSettings.discountCoefficients[item.discountType]) || 1;
        } else if (key && key.indexOf('extraUp_') === 0) {
            var ei = parseInt(key.replace('extraUp_', ''), 10);
            var e = (defaultSettings.extraPricingUp || [])[ei];
            var sel = (item.extraUpSelections && item.extraUpSelections[ei]) ? item.extraUpSelections[ei] : null;
            if (e && sel && e.options && e.options[sel.optionValue] != null) coeffProduct *= getCoefficientValue(e.options[sel.optionValue]) || 1;
        } else if (key && key.indexOf('extraDown_') === 0) {
            var ei = parseInt(key.replace('extraDown_', ''), 10);
            var e = (defaultSettings.extraPricingDown || [])[ei];
            var sel = (item.extraDownSelections && item.extraDownSelections[ei]) ? item.extraDownSelections[ei] : null;
            if (e && sel && e.options && e.options[sel.optionValue] != null) coeffProduct *= getCoefficientValue(e.options[sel.optionValue]) || 1;
        }
    });
    var feeBase = feeSubtotal * coeffProduct;
    var wfMinMax = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) ? defaultSettings.settlementRules.wasteFee : {};
    var minEl = document.getElementById('settlementWasteMinByPiece');
    var maxEl = document.getElementById('settlementWasteMaxByPiece');
    var minV = minEl ? minEl.value : (wfMinMax.minAmount != null && wfMinMax.minAmount !== '' ? String(wfMinMax.minAmount) : '');
    var maxV = maxEl ? maxEl.value : (wfMinMax.maxAmount != null && wfMinMax.maxAmount !== '' ? String(wfMinMax.maxAmount) : '');
    if (minV !== '' && minV != null && !isNaN(parseFloat(minV))) feeBase = Math.max(feeBase, parseFloat(minV));
    if (maxV !== '' && maxV != null && !isNaN(parseFloat(maxV))) feeBase = Math.min(feeBase, parseFloat(maxV));
    var wasteFeeAmount = Math.max(0, feeBase);

    var wfOther = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) ? defaultSettings.settlementRules.wasteFee : {};
    var otherFeesWasteRatio = (wfOther.otherFeesWasteRatio != null) ? Number(wfOther.otherFeesWasteRatio) : 0.5;
    var otherFees = item.otherFees || [];
    var otherFeesAmount = 0;
    otherFees.forEach(function (fee, fi) {
        var amt = Number(fee.amount) || 0;
        var selectEl = document.querySelector('.settlement-other-fee-row[data-fi="' + fi + '"] select.settlement-other-fee-select');
        var mode = selectEl ? selectEl.value : 'full';
        var charged = (mode === 'exclude') ? 0 : (mode === 'waste_ratio' ? amt * otherFeesWasteRatio : amt);
        otherFeesAmount += charged;
        var rowEl = document.querySelector('.settlement-other-fee-row[data-fi="' + fi + '"]');
        if (rowEl) {
            var chargedEl = rowEl.querySelector('.settlement-other-fee-charged');
            if (chargedEl) chargedEl.textContent = '本条计入：¥' + charged.toFixed(2);
        }
    });

    var totalReceivable = wasteFeeAmount + otherFeesAmount;

    var detailAmountEl = document.getElementById('settlementWasteDetailAmount');
    if (detailAmountEl) detailAmountEl.textContent = '¥' + detailAmount.toFixed(2);
    var detailTotalEl = document.getElementById('settlementWasteDetailTotal');
    if (detailTotalEl) detailTotalEl.textContent = '¥' + feeSubtotal.toFixed(2);
    var subtotalEl = document.getElementById('settlementWasteFeeSubtotal');
    if (subtotalEl) subtotalEl.textContent = '¥' + feeSubtotal.toFixed(2);
    var otherAmountEl = document.getElementById('settlementOtherFeesAmount');
    if (otherAmountEl) otherAmountEl.textContent = '¥' + otherFeesAmount.toFixed(2);
    var finalAmountEl = document.getElementById('settlementWasteFinalAmount');
    if (finalAmountEl) finalAmountEl.value = totalReceivable.toFixed(2);
    settlementUpdatePreview();
}

function settlementRenderNormalForm() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) return;
    var reasonOtherInput = document.getElementById('settlementDiscountReasonOther');
    if (reasonOtherInput) reasonOtherInput.value = '';
    var otherAmountEl = document.getElementById('settlementOtherAmount');
    if (otherAmountEl) otherAmountEl.value = '0';
    var otherRateEl = document.getElementById('settlementOtherRate');
    if (otherRateEl) otherRateEl.value = '';
    var reasonsWrap = document.getElementById('settlementDiscountReasonsWrap');
    if (reasonsWrap) {
        var reasons = getDiscountReasons();
        var html = '';
        reasons.forEach(function (r) {
            var preferType = (r.preferType === 'amount') ? 'amount' : 'rate';
            var defaultAmt = (r.defaultAmount != null && !isNaN(r.defaultAmount)) ? r.defaultAmount : 0;
            var defaultRate = (r.defaultRate != null && !isNaN(r.defaultRate)) ? Math.min(0.99, r.defaultRate) : 0.99;
            var nameEsc = (r.name || '').replace(/"/g, '&quot;');
            var amountOpt = preferType === 'amount' ? ' selected' : '';
            var rateOpt = preferType === 'rate' ? ' selected' : '';
            var amountWrapShow = preferType === 'amount' ? '' : ' style="display:none"';
            var rateWrapShow = preferType === 'rate' ? '' : ' style="display:none"';
            html += '<div class="settlement-reason-row-item"><div class="settlement-reason-row-head"><label class="settlement-reason-inline"><input type="checkbox" class="settlement-discount-reason-cb" data-id="' + r.id + '" data-name="' + nameEsc + '">' + (r.name || '') + '</label><div class="settlement-reason-type-toggle" data-active="' + preferType + '"><input type="hidden" class="settlement-reason-type" value="' + preferType + '"><span class="settlement-reason-type-thumb"></span><button type="button" class="settlement-reason-type-btn' + (preferType === 'amount' ? ' active' : '') + '" data-value="amount">减去</button><button type="button" class="settlement-reason-type-btn' + (preferType === 'rate' ? ' active' : '') + '" data-value="rate">折扣</button></div></div><div class="settlement-reason-row-input"><span class="settlement-reason-amount-wrap"' + amountWrapShow + '><input type="number" class="settlement-reason-amount settlement-reason-input" data-id="' + r.id + '" min="0" step="0.01" value="' + defaultAmt + '" placeholder="0"></span><span class="settlement-reason-rate-wrap"' + rateWrapShow + '><input type="number" class="settlement-reason-rate settlement-reason-input" data-id="' + r.id + '" min="0" max="0.99" step="0.01" value="' + defaultRate + '" placeholder="0.99"></span></div></div>';
        });
        reasonsWrap.innerHTML = html || '<span class="text-gray" style="font-size:0.85rem;">暂无预设优惠原因，可在设置页添加</span>';
        reasonsWrap.querySelectorAll('.settlement-discount-reason-cb').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var row = this.closest('.settlement-reason-row-item');
                if (row && this.checked) {
                    var preset = getDiscountReasons().find(function (x) { return String(x.id) === String(cb.dataset.id); });
                        if (preset) {
                        var preferType = (preset.preferType === 'amount') ? 'amount' : 'rate';
                        var typeInp = row.querySelector('input.settlement-reason-type');
                        var toggleEl = row.querySelector('.settlement-reason-type-toggle');
                        var amountInp = row.querySelector('.settlement-reason-amount');
                        var rateInp = row.querySelector('.settlement-reason-rate');
                        if (typeInp) typeInp.value = preferType;
                        if (toggleEl) toggleEl.setAttribute('data-active', preferType);
                        row.querySelectorAll('.settlement-reason-type-btn').forEach(function (btn) {
                            btn.classList.toggle('active', btn.dataset.value === preferType);
                        });
                        if (amountInp) amountInp.value = (preset.defaultAmount != null && !isNaN(preset.defaultAmount)) ? preset.defaultAmount : '0';
                        if (rateInp) rateInp.value = (preset.defaultRate != null && !isNaN(preset.defaultRate)) ? (preset.defaultRate > 0.99 ? 0.99 : preset.defaultRate) : '0.99';
                        var amWrap = row.querySelector('.settlement-reason-amount-wrap');
                        var rtWrap = row.querySelector('.settlement-reason-rate-wrap');
                        if (amWrap) amWrap.style.display = preferType === 'amount' ? '' : 'none';
                        if (rtWrap) rtWrap.style.display = preferType === 'rate' ? '' : 'none';
                    }
                }
                settlementUpdateNormalPreview();
                settlementUpdatePreview();
            });
        });
        reasonsWrap.querySelectorAll('.settlement-reason-type-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var row = this.closest('.settlement-reason-row-item');
                if (!row) return;
                var v = this.dataset.value || 'amount';
                row.querySelectorAll('.settlement-reason-type-btn').forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');
                var toggleEl = row.querySelector('.settlement-reason-type-toggle');
                if (toggleEl) toggleEl.setAttribute('data-active', v);
                var typeInp = row.querySelector('input.settlement-reason-type');
                if (typeInp) typeInp.value = v;
                var amWrap = row.querySelector('.settlement-reason-amount-wrap');
                var rtWrap = row.querySelector('.settlement-reason-rate-wrap');
                var amountInp = row.querySelector('.settlement-reason-amount');
                var rateInp = row.querySelector('.settlement-reason-rate');
                if (amWrap) amWrap.style.display = (v === 'amount') ? '' : 'none';
                if (rtWrap) rtWrap.style.display = (v === 'rate') ? '' : 'none';
                var preset = getDiscountReasons().find(function (x) { return String(x.id) === String(row.querySelector('.settlement-discount-reason-cb').dataset.id); });
                if (v === 'rate' && rateInp && preset) {
                    var raw = parseFloat(rateInp.value);
                    if (raw > 1 || !isFinite(raw) || raw <= 0) {
                        rateInp.value = (preset.defaultRate != null && !isNaN(preset.defaultRate)) ? (preset.defaultRate > 0.99 ? 0.99 : preset.defaultRate) : 0.95;
                    }
                } else if (v === 'amount' && amountInp && preset) {
                    var amRaw = parseFloat(amountInp.value);
                    if (!isFinite(amRaw) || amRaw < 0) {
                        amountInp.value = (preset.defaultAmount != null && !isNaN(preset.defaultAmount)) ? preset.defaultAmount : '0';
                    }
                }
                settlementUpdateNormalPreview();
                settlementUpdatePreview();
            });
        });
        reasonsWrap.querySelectorAll('.settlement-reason-amount, .settlement-reason-rate').forEach(function (inp) {
            inp.addEventListener('input', function () {
                settlementUpdateNormalPreview();
                settlementUpdatePreview();
            });
        });
    }
    otherAmountEl = document.getElementById('settlementOtherAmount');
    otherRateEl = document.getElementById('settlementOtherRate');
    var otherToggleEl = document.getElementById('settlementOtherTypeToggle');
    if (otherToggleEl) {
        otherToggleEl.querySelectorAll('.settlement-reason-type-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var v = this.dataset.value || 'amount';
                otherToggleEl.querySelectorAll('.settlement-reason-type-btn').forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');
                otherToggleEl.setAttribute('data-active', v);
                var typeInp = document.getElementById('settlementOtherType');
                if (typeInp) typeInp.value = v;
                var amWrap = document.getElementById('settlementOtherAmountWrap');
                var rtWrap = document.getElementById('settlementOtherRateWrap');
                if (amWrap) amWrap.style.display = (v === 'amount') ? '' : 'none';
                if (rtWrap) rtWrap.style.display = (v === 'rate') ? '' : 'none';
                settlementUpdateNormalPreview();
                settlementUpdatePreview();
            });
        });
    }
    if (otherAmountEl) otherAmountEl.addEventListener('input', function () {
        settlementUpdateNormalPreview();
        settlementUpdatePreview();
    });
    if (otherRateEl) otherRateEl.addEventListener('input', function () {
        settlementUpdateNormalPreview();
        settlementUpdatePreview();
    });
    var normalAmountEl = document.getElementById('settlementNormalAmount');
    if (normalAmountEl) {
        normalAmountEl.addEventListener('input', function () {
            settlementUpdateNormalPreview(true);
        });
    }
    settlementUpdateNormalPreview();
}

// 折扣系数标准化：输入 0.01~0.99 为系数，>1 按百分比解读（如 10 表示 10%  off → 0.9）
function normalizeDiscountRate(r) {
    if (r == null || !isFinite(r) || r <= 0) return NaN;
    if (r > 1) return Math.max(0.01, Math.min(0.99, 1 - r / 100));
    return r > 0.99 ? 0.99 : r;
}

function settlementUpdateNormalPreview(skipAmountUpdate) {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) return;
    var amountEl = document.getElementById('settlementNormalAmount');
    var newPlatformEl = document.getElementById('settlementNewPlatformFeeText');
    var ownerPayEl = document.getElementById('settlementOwnerPayText');
    var receivable = item.totalBeforePlatformFee != null ? item.totalBeforePlatformFee : (item.finalTotal != null && item.platformFeeAmount != null ? item.finalTotal - item.platformFeeAmount : (item.finalTotal || 0));
    var platformFeePct = (item.platformFee != null ? item.platformFee : 0) / 100;
    var hasPlatformFee = (item.platformFeeAmount || 0) > 0;
    var deposit = Number(item.depositReceived || 0);
    if (!isFinite(deposit) || deposit < 0) deposit = 0;

    var totalSubtract = 0;
    var productRate = 1;
    document.querySelectorAll('.settlement-discount-reason-cb:checked').forEach(function (cb) {
        var row = cb.closest('.settlement-reason-row-item');
        if (!row) return;
        var typeInp = row.querySelector('input.settlement-reason-type');
        var toggleEl = row.querySelector('.settlement-reason-type-toggle');
        var typeVal = (typeInp && typeInp.value) ? typeInp.value : (toggleEl ? toggleEl.getAttribute('data-active') : null) || 'amount';
        if (typeVal === 'amount') {
            var amtInp = row.querySelector('.settlement-reason-amount');
            if (amtInp) totalSubtract += parseFloat(amtInp.value) || 0;
        } else {
            var rateInp = row.querySelector('input.settlement-reason-rate');
            if (rateInp) {
                var raw = parseFloat(rateInp.value);
                var r = normalizeDiscountRate(raw);
                if (!isNaN(r)) {
                    productRate *= r;
                    if (raw > 1) rateInp.value = r.toFixed(2);
                }
            }
        }
    });
    var otherTypeEl = document.getElementById('settlementOtherType');
    var otherTypeVal = otherTypeEl ? otherTypeEl.value : 'amount';
    var otherAmtEl = document.getElementById('settlementOtherAmount');
    var otherRateEl = document.getElementById('settlementOtherRate');
    if (otherTypeVal === 'amount' && otherAmtEl) totalSubtract += parseFloat(otherAmtEl.value) || 0;
    if (otherTypeVal === 'rate' && otherRateEl) {
        var oRaw = parseFloat(otherRateEl.value);
        var or_ = normalizeDiscountRate(oRaw);
        if (!isNaN(or_)) {
            productRate *= or_;
            if (oRaw > 1) otherRateEl.value = or_.toFixed(2);
        }
    }

    var receipt = Math.max(0, (receivable - totalSubtract) * productRate);
    var receivableThisTime = Math.max(0, receipt - deposit);
    if (amountEl && !skipAmountUpdate) amountEl.value = receivableThisTime.toFixed(2);
    var currentReceipt = amountEl ? (parseFloat(amountEl.value) || receivableThisTime) : receivableThisTime;
    var newPlatformFee = hasPlatformFee ? Math.round(currentReceipt * platformFeePct * 100) / 100 : 0;
    if (newPlatformEl) {
        if (hasPlatformFee) {
            newPlatformEl.textContent = '新平台费：¥' + newPlatformFee.toFixed(2);
            newPlatformEl.classList.remove('d-none');
        } else {
            newPlatformEl.classList.add('d-none');
            newPlatformEl.textContent = '';
        }
    }
    if (ownerPayEl) {
        ownerPayEl.textContent = '实际单主支付：¥' + (receipt + newPlatformFee).toFixed(2);
        ownerPayEl.classList.remove('d-none');
    }
}

function settlementConfirm() {
    var item = history.find(function (h) { return h.id === settlementModalRecordId; });
    if (!item) { closeSettlementModal(); return; }
    var type = getEffectiveSettlementType() || getSettlementType();
    var at = new Date().toISOString();

    if (type === 'full_refund') {
        var fullRefundAmountEl = document.getElementById('settlementFullRefundAmount');
        var amount = fullRefundAmountEl ? (parseFloat(fullRefundAmountEl.value) || 0) : 0;
        amount = Math.max(0, amount);
        item.settlement = { type: 'full_refund', amount: amount, memo: (document.getElementById('settlementMemoRefund').value || '').trim(), at: at };
    } else if (type === 'cancel_with_fee') {
        var ruleEl = document.getElementById('settlementCancelFeeRule');
        var rateEl = document.getElementById('settlementCancelFeeRate');
        var fixedEl = document.getElementById('settlementCancelFeeFixed');
        var memoEl = document.getElementById('settlementMemoCancelFee');
        var amountEl = document.getElementById('settlementCancelFeeAmount');
        var rule = ruleEl ? ruleEl.value : 'percent';
        var rate = parseFloat(rateEl ? rateEl.value : 0) / 100;
        var fixedAmount = parseFloat(fixedEl ? fixedEl.value : 0) || 0;
        var feeAmount = amountEl ? (parseFloat(amountEl.value) || 0) : 0;
        feeAmount = Math.max(0, feeAmount);
        var dep = Number(item.depositReceived || 0);
        if (!isFinite(dep) || dep < 0) dep = 0;
        var depositUsed = Math.min(dep, feeAmount);
        var actualReceive = feeAmount - depositUsed;
        item.settlement = {
            type: 'cancel_with_fee',
            amount: actualReceive,
            memo: memoEl ? (memoEl.value || '').trim() : '',
            at: at,
            cancelFee: { rule: rule, rate: rate, fixedAmount: fixedAmount, feeAmount: feeAmount }
        };
    } else if (type === 'waste_fee') {
        var rule = document.getElementById('settlementWasteRule').value;
        var byPieceWrap = document.getElementById('settlementWasteByPieceWrap');
        var useByPiece = (rule === 'percent_charged_only' && byPieceWrap && !byPieceWrap.classList.contains('d-none'));
        if (useByPiece) {
            var products = item.productPrices || [];
            var gifts = item.giftPrices || [];
            var allItems = products.concat(gifts);
            var rows = [];
            var detailAmount = 0;
            var tableEl = document.getElementById('settlementWasteDetailTable');
            if (tableEl) {
                tableEl.querySelectorAll('.settlement-waste-detail-row').forEach(function (row) {
                    var idx = parseInt(row.dataset.idx, 10);
                    var wasteQtyEl = row.querySelector('.settlement-waste-qty');
                    var wasteQty = wasteQtyEl ? (parseInt(wasteQtyEl.value, 10) || 0) : 0;
                    var processLayersDone = [];
                    row.querySelectorAll('.settlement-process-layers-done').forEach(function (inp) { processLayersDone.push(parseInt(inp.value, 10) || 0); });
                    var allItem = allItems[idx];
                    var rowAmt = computeWasteByPieceRowAmount(allItem, wasteQty, processLayersDone);
                    detailAmount += rowAmt;
                    rows.push({ idx: idx, wasteQty: wasteQty, processLayersDone: processLayersDone, rowAmount: rowAmt });
                });
            }
            var ratioElConfirm = document.getElementById('settlementWasteRatio');
            var ratioTextConfirm = ratioElConfirm ? (ratioElConfirm.textContent || '').trim() : '';
            var wasteRatio = 0.3;
            if (ratioTextConfirm) {
                if (ratioTextConfirm.indexOf('%') !== -1) wasteRatio = (parseFloat(ratioTextConfirm) || 30) / 100;
                else wasteRatio = parseFloat(ratioTextConfirm) || 0.3;
            }
            var feeSubtotal = detailAmount * wasteRatio;
            var coeffIncluded = {};
            document.querySelectorAll('.settlement-coeff-included:checked').forEach(function (cb) { coeffIncluded[cb.dataset.key] = true; });
            var coeffProduct = 1;
            Object.keys(coeffIncluded).forEach(function (key) {
                if (key === 'usage' && item.usageType != null && defaultSettings.usageCoefficients && defaultSettings.usageCoefficients[item.usageType]) coeffProduct *= getCoefficientValue(defaultSettings.usageCoefficients[item.usageType]) || 1;
                else if (key === 'urgent' && item.urgentType != null && defaultSettings.urgentCoefficients && defaultSettings.urgentCoefficients[item.urgentType]) coeffProduct *= getCoefficientValue(defaultSettings.urgentCoefficients[item.urgentType]) || 1;
                else if (key === 'discount' && item.discountType != null && defaultSettings.discountCoefficients && defaultSettings.discountCoefficients[item.discountType]) coeffProduct *= getCoefficientValue(defaultSettings.discountCoefficients[item.discountType]) || 1;
                else if (key && key.indexOf('extraUp_') === 0) { var ei = parseInt(key.replace('extraUp_', ''), 10); var e = (defaultSettings.extraPricingUp || [])[ei]; var sel = (item.extraUpSelections && item.extraUpSelections[ei]) ? item.extraUpSelections[ei] : null; if (e && sel && e.options && e.options[sel.optionValue] != null) coeffProduct *= getCoefficientValue(e.options[sel.optionValue]) || 1; }
                else if (key && key.indexOf('extraDown_') === 0) { var ei = parseInt(key.replace('extraDown_', ''), 10); var e = (defaultSettings.extraPricingDown || [])[ei]; var sel = (item.extraDownSelections && item.extraDownSelections[ei]) ? item.extraDownSelections[ei] : null; if (e && sel && e.options && e.options[sel.optionValue] != null) coeffProduct *= getCoefficientValue(e.options[sel.optionValue]) || 1; }
            });
            var feeBase = feeSubtotal * coeffProduct;
            var wfMinMaxConfirm = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) ? defaultSettings.settlementRules.wasteFee : {};
            var minElConfirm = document.getElementById('settlementWasteMinByPiece');
            var maxElConfirm = document.getElementById('settlementWasteMaxByPiece');
            var minV = minElConfirm ? minElConfirm.value : (wfMinMaxConfirm.minAmount != null && wfMinMaxConfirm.minAmount !== '' ? String(wfMinMaxConfirm.minAmount) : '');
            var maxV = maxElConfirm ? maxElConfirm.value : (wfMinMaxConfirm.maxAmount != null && wfMinMaxConfirm.maxAmount !== '' ? String(wfMinMaxConfirm.maxAmount) : '');
            if (minV !== '' && minV != null && !isNaN(parseFloat(minV))) feeBase = Math.max(feeBase, parseFloat(minV));
            if (maxV !== '' && maxV != null && !isNaN(parseFloat(maxV))) feeBase = Math.min(feeBase, parseFloat(maxV));
            var wasteFeeAmount = Math.max(0, feeBase);
            var wfOtherConfirm = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) ? defaultSettings.settlementRules.wasteFee : {};
            var otherFeesWasteRatioConfirm = (wfOtherConfirm.otherFeesWasteRatio != null) ? Number(wfOtherConfirm.otherFeesWasteRatio) : 0.5;
            var otherFees = item.otherFees || [];
            var otherFeesAmount = 0;
            var otherFeesEntries = [];
            otherFees.forEach(function (fee, fi) {
                var amt = Number(fee.amount) || 0;
                var selectEl = document.querySelector('.settlement-other-fee-row[data-fi="' + fi + '"] select.settlement-other-fee-select');
                var mode = selectEl ? selectEl.value : 'full';
                var charged = (mode === 'exclude') ? 0 : (mode === 'waste_ratio' ? amt * otherFeesWasteRatioConfirm : amt);
                otherFeesAmount += charged;
                otherFeesEntries.push({ name: fee.name, orderAmount: amt, mode: mode, chargedAmount: charged });
            });
            var totalWasteReceivable = wasteFeeAmount + otherFeesAmount;
            var finalAmountEl = document.getElementById('settlementWasteFinalAmount');
            var feeAmount = finalAmountEl ? (parseFloat(finalAmountEl.value) || totalWasteReceivable) : totalWasteReceivable;
            feeAmount = Math.max(0, feeAmount);
            var dep = Number(item.depositReceived || 0);
            if (!isFinite(dep) || dep < 0) dep = 0;
            var depositUsed = Math.min(dep, feeAmount);
            var actualReceive = feeAmount - depositUsed;
            item.settlement = {
                type: 'waste_fee',
                amount: actualReceive,
                at: at,
                wasteFee: {
                    rule: 'percent_charged_only',
                    feeAmount: feeAmount,
                    detailAmount: detailAmount,
                    wasteRatio: wasteRatio,
                    rows: rows,
                    coefficientsIncluded: coeffIncluded,
                    minAmount: minV !== '' && minV != null && !isNaN(parseFloat(minV)) ? parseFloat(minV) : undefined,
                    maxAmount: maxV !== '' && maxV != null && !isNaN(parseFloat(maxV)) ? parseFloat(maxV) : null,
                    feeSubtotal: feeSubtotal,
                    wasteFeeAmount: wasteFeeAmount,
                    otherFeesEntries: otherFeesEntries,
                    otherFeesWasteRatio: otherFeesWasteRatioConfirm,
                    otherFeesAmount: otherFeesAmount,
                    totalWasteReceivable: totalWasteReceivable
                }
            };
        } else if (rule === 'percent_total') {
            var wfPercentTotal = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) || {};
            var defaultRate = (wfPercentTotal.defaultRate != null ? wfPercentTotal.defaultRate : 30);
            var baseAmount = item.agreedAmount != null ? item.agreedAmount : (item.finalTotal != null ? item.finalTotal : 0);
            var wasteFee = baseAmount * (defaultRate / 100);
            
            var otherFeesWasteRatio = (wfPercentTotal.otherFeesWasteRatio != null) ? Number(wfPercentTotal.otherFeesWasteRatio) : 0.5;
            var otherFees = item.otherFees || [];
            var otherFeesAmount = 0;
            var otherFeesEntries = [];
            otherFees.forEach(function (fee, fi) {
                var amt = Number(fee.amount) || 0;
                var selectEl = document.querySelector('.settlement-percenttotal-other-select[data-fi="' + fi + '"]');
                var mode = selectEl ? selectEl.value : 'full';
                var charged = (mode === 'exclude') ? 0 : (mode === 'waste_ratio' ? amt * otherFeesWasteRatio : amt);
                otherFeesAmount += charged;
                otherFeesEntries.push({ name: fee.name, orderAmount: amt, mode: mode, chargedAmount: charged });
            });
            
            var totalReceivable = wasteFee + otherFeesAmount;
            var finalAmountEl = document.getElementById('settlementWasteFinalAmount');
            var feeAmount = finalAmountEl ? (parseFloat(finalAmountEl.value) || totalReceivable) : totalReceivable;
            feeAmount = Math.max(0, feeAmount);
            var dep = Number(item.depositReceived || 0);
            if (!isFinite(dep) || dep < 0) dep = 0;
            var depositUsed = Math.min(dep, feeAmount);
            var actualReceive = feeAmount - depositUsed;
            item.settlement = {
                type: 'waste_fee',
                amount: actualReceive,
                at: at,
                wasteFee: {
                    rule: 'percent_total',
                    feeAmount: feeAmount,
                    rate: defaultRate / 100,
                    baseAmount: baseAmount,
                    wasteFeeAmount: wasteFee,
                    otherFeesEntries: otherFeesEntries,
                    otherFeesWasteRatio: otherFeesWasteRatio,
                    otherFeesAmount: otherFeesAmount,
                    totalReceivable: totalReceivable
                }
            };
        } else if (rule === 'fixed_per_item') {
            var wfFixedPerItem = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) || {};
            var priceElConfirm = document.getElementById('settlementFixedPerItemPrice');
            var fixedPerItem = (priceElConfirm && priceElConfirm.value !== undefined) ? (parseFloat(priceElConfirm.value) || 0) : (wfFixedPerItem.defaultFixedPerItem != null ? wfFixedPerItem.defaultFixedPerItem : 20);
            var chargedIndices = [];
            var count = 0;
            document.querySelectorAll('.settlement-fixed-per-item-check:checked').forEach(function (cb) {
                chargedIndices.push(parseInt(cb.dataset.idx, 10));
                count += parseInt(cb.dataset.qty, 10) || 1;
            });
            var wasteFee = count * fixedPerItem;
            
            var otherFeesWasteRatio = (wfFixedPerItem.otherFeesWasteRatio != null) ? Number(wfFixedPerItem.otherFeesWasteRatio) : 0.5;
            var otherFees = item.otherFees || [];
            var otherFeesAmount = 0;
            var otherFeesEntries = [];
            otherFees.forEach(function (fee, fi) {
                var amt = Number(fee.amount) || 0;
                var selectEl = document.querySelector('.settlement-fixedperitem-other-select[data-fi="' + fi + '"]');
                var mode = selectEl ? selectEl.value : 'full';
                var charged = (mode === 'exclude') ? 0 : (mode === 'waste_ratio' ? amt * otherFeesWasteRatio : amt);
                otherFeesAmount += charged;
                otherFeesEntries.push({ name: fee.name, orderAmount: amt, mode: mode, chargedAmount: charged });
            });
            
            var totalReceivable = wasteFee + otherFeesAmount;
            var finalAmountEl = document.getElementById('settlementWasteFinalAmount');
            var feeAmount = finalAmountEl ? (parseFloat(finalAmountEl.value) || totalReceivable) : totalReceivable;
            feeAmount = Math.max(0, feeAmount);
            var dep = Number(item.depositReceived || 0);
            if (!isFinite(dep) || dep < 0) dep = 0;
            var depositUsed = Math.min(dep, feeAmount);
            var actualReceive = feeAmount - depositUsed;
            item.settlement = {
                type: 'waste_fee',
                amount: actualReceive,
                at: at,
                wasteFee: {
                    rule: 'fixed_per_item',
                    feeAmount: feeAmount,
                    fixedPerItem: fixedPerItem,
                    chargedIndices: chargedIndices,
                    count: count,
                    wasteFeeAmount: wasteFee,
                    otherFeesEntries: otherFeesEntries,
                    otherFeesWasteRatio: otherFeesWasteRatio,
                    otherFeesAmount: otherFeesAmount,
                    totalReceivable: totalReceivable
                }
            };
        } else if (rule === 'fixed_amount') {
            var wfFixedAmount = (defaultSettings.settlementRules && defaultSettings.settlementRules.wasteFee) || {};
            var feeElConfirm = document.getElementById('settlementFixedAmountWasteFee');
            var wasteFee = (feeElConfirm && feeElConfirm.value !== undefined) ? (parseFloat(feeElConfirm.value) || 0) : (wfFixedAmount.defaultFixedAmount != null ? wfFixedAmount.defaultFixedAmount : 50);
            
            var otherFeesWasteRatio = (wfFixedAmount.otherFeesWasteRatio != null) ? Number(wfFixedAmount.otherFeesWasteRatio) : 0.5;
            var otherFees = item.otherFees || [];
            var otherFeesAmount = 0;
            var otherFeesEntries = [];
            otherFees.forEach(function (fee, fi) {
                var amt = Number(fee.amount) || 0;
                var selectEl = document.querySelector('.settlement-fixedamount-other-select[data-fi="' + fi + '"]');
                var mode = selectEl ? selectEl.value : 'full';
                var charged = (mode === 'exclude') ? 0 : (mode === 'waste_ratio' ? amt * otherFeesWasteRatio : amt);
                otherFeesAmount += charged;
                otherFeesEntries.push({ name: fee.name, orderAmount: amt, mode: mode, chargedAmount: charged });
            });
            
            var totalReceivable = wasteFee + otherFeesAmount;
            var finalAmountEl = document.getElementById('settlementWasteFinalAmount');
            var feeAmount = finalAmountEl ? (parseFloat(finalAmountEl.value) || totalReceivable) : totalReceivable;
            feeAmount = Math.max(0, feeAmount);
            var dep = Number(item.depositReceived || 0);
            if (!isFinite(dep) || dep < 0) dep = 0;
            var depositUsed = Math.min(dep, feeAmount);
            var actualReceive = feeAmount - depositUsed;
            item.settlement = {
                type: 'waste_fee',
                amount: actualReceive,
                at: at,
                wasteFee: {
                    rule: 'fixed_amount',
                    feeAmount: feeAmount,
                    fixedAmount: wasteFee,
                    otherFeesEntries: otherFeesEntries,
                    otherFeesWasteRatio: otherFeesWasteRatio,
                    otherFeesAmount: otherFeesAmount,
                    totalReceivable: totalReceivable
                }
            };
        } else {
            var rate = parseFloat(document.getElementById('settlementWasteRate').value) || 0;
            var fixedPerItem = parseFloat(document.getElementById('settlementFixedPerItem').value) || 0;
            var minAmount = document.getElementById('settlementWasteMin').value;
            var maxAmount = document.getElementById('settlementWasteMax').value;
            var charged = [];
            document.querySelectorAll('.settlement-charged-item:checked').forEach(function (cb) { charged.push(parseInt(cb.dataset.idx, 10)); });
            var processDone = [];
            document.querySelectorAll('.settlement-process-done-item').forEach(function (cb) { processDone[parseInt(cb.dataset.idx, 10)] = cb.checked; });
            var amount = computeWasteFeeAmount(item, rule, rate, fixedPerItem, minAmount, maxAmount, charged, processDone);
            var finalAmountEl = document.getElementById('settlementWasteFinalAmount');
            var feeAmount = finalAmountEl ? (parseFloat(finalAmountEl.value) || amount) : amount;
            feeAmount = Math.max(0, feeAmount);
            var dep = Number(item.depositReceived || 0);
            if (!isFinite(dep) || dep < 0) dep = 0;
            var depositUsed = Math.min(dep, feeAmount);
            var actualReceive = feeAmount - depositUsed;
            item.settlement = {
                type: 'waste_fee',
                amount: actualReceive,
                at: at,
                wasteFee: {
                    rule: rule,
                    feeAmount: feeAmount,
                    rate: rate,
                    chargedIndices: charged,
                    processDoneFlags: processDone,
                    fixedPerItem: fixedPerItem,
                    minAmount: minAmount === '' ? undefined : parseFloat(minAmount),
                    maxAmount: maxAmount === '' ? null : (maxAmount === '' ? null : parseFloat(maxAmount))
                }
            };
        }
    } else {
        // 收集多选优惠原因及每项的金额/系数：实收 = (应收 - Σ减去金额) × Π系数
        var discountReasons = [];
        document.querySelectorAll('.settlement-discount-reason-cb:checked').forEach(function (cb) {
            var name = (cb.dataset.name || '').trim();
            if (!name) return;
            var row = cb.closest('.settlement-reason-row-item');
            var typeInp = row ? row.querySelector('input.settlement-reason-type') : null;
            var toggleEl = row ? row.querySelector('.settlement-reason-type-toggle') : null;
            var typeVal = (typeInp && typeInp.value) ? typeInp.value : (toggleEl ? toggleEl.getAttribute('data-active') : null) || 'amount';
            var entry = { name: name };
            if (typeVal === 'amount') {
                var amtInp = row ? row.querySelector('.settlement-reason-amount') : null;
                var amt = amtInp ? (parseFloat(amtInp.value) || 0) : 0;
                if (amt > 0) entry.amount = amt;
            } else {
                var rateInp = row ? row.querySelector('input.settlement-reason-rate') : null;
                var r = rateInp ? normalizeDiscountRate(parseFloat(rateInp.value)) : NaN;
                if (!isNaN(r)) entry.rate = r;
            }
            discountReasons.push(entry);
        });
        var otherText = (document.getElementById('settlementDiscountReasonOther') && document.getElementById('settlementDiscountReasonOther').value || '').trim();
        if (otherText) {
            var otherEntry = { name: otherText };
            var oTypeEl = document.getElementById('settlementOtherType');
            var oTypeVal = oTypeEl ? oTypeEl.value : 'amount';
            if (oTypeVal === 'amount') {
                var oAmt = document.getElementById('settlementOtherAmount');
                var oa = oAmt ? parseFloat(oAmt.value) : 0;
                if (oa > 0) otherEntry.amount = oa;
            } else {
                var oRate = document.getElementById('settlementOtherRate');
                var or_ = oRate ? normalizeDiscountRate(parseFloat(oRate.value)) : NaN;
                if (!isNaN(or_)) otherEntry.rate = or_;
            }
            discountReasons.push(otherEntry);
        }
        var receivable = item.totalBeforePlatformFee != null ? item.totalBeforePlatformFee : (item.finalTotal != null && item.platformFeeAmount != null ? item.finalTotal - item.platformFeeAmount : (item.finalTotal || 0));
        var platformFeePct = (item.platformFee != null ? item.platformFee : 0) / 100;
        var totalSubtract = 0;
        var productRate = 1;
        discountReasons.forEach(function (e) {
            if (e.amount != null) totalSubtract += e.amount;
            if (e.rate != null) productRate *= e.rate;
        });
        // 折扣模式的原因保存时补算金额，便于统计页按名称归类显示
        var rateReasons = discountReasons.filter(function (e) { return e.rate != null && (e.amount == null || e.amount === 0); });
        if (rateReasons.length > 0) {
            var baseForRate = Math.max(0, receivable - totalSubtract);
            var totalRateDiscount = baseForRate * (1 - productRate);
            var sumOneMinusRate = 0;
            rateReasons.forEach(function (e) { sumOneMinusRate += (1 - (e.rate || 0)); });
            if (sumOneMinusRate > 0 && totalRateDiscount > 0) {
                rateReasons.forEach(function (e) {
                    var part = totalRateDiscount * (1 - (e.rate || 0)) / sumOneMinusRate;
                    e.amount = Math.round(part * 100) / 100;
                });
            }
        }
        var receiptTotal = Math.max(0, (receivable - totalSubtract) * productRate);
        var amountEl = document.getElementById('settlementNormalAmount');
        var deposit = Number(item.depositReceived || 0);
        if (!isFinite(deposit) || deposit < 0) deposit = 0;
        var receiptThisTime = amountEl ? (parseFloat(amountEl.value) || Math.max(0, receiptTotal - deposit)) : Math.max(0, receiptTotal - deposit);
        receiptThisTime = Math.max(0, receiptThisTime);
        var newPlatformFee = (item.platformFeeAmount || 0) > 0 ? Math.round(receiptThisTime * platformFeePct * 100) / 100 : undefined;
        item.settlement = {
            type: 'normal',
            amount: receiptThisTime,
            newPlatformFee: newPlatformFee,
            discountReasons: discountReasons,
            at: at
        };
    }

    // 标记本地订单最近更新时间（用于防止云端旧数据覆盖本地新结单状态）
    item.mg_updated_at = Date.now();
    saveData();

    // 结算/撤单/废稿后强制同步云端（如果已启用云端模式）
    try {
        if (mgIsCloudEnabled() && localStorage.getItem('mg_cloud_enabled') === '1') {
            const extId = mgEnsureExternalId(item);
            console.log('[settlement] syncing order', { id: item.id, external_id: extId, settlement: item.settlement && item.settlement.type, mg_updated_at: item.mg_updated_at });
            markOrderUnsynced(item.id);
            mgCloudUpsertOrder(item).catch(function (err) {
                console.error('结算后云端同步失败:', err);
                updateSyncStatus();
            });
        }
    } catch (e) {
        console.error('结算后触发云端同步异常:', e);
    }

    closeSettlementModal();
    if (typeof renderScheduleTodoSection === 'function') renderScheduleTodoSection();
    if (typeof renderScheduleCalendar === 'function') renderScheduleCalendar();
    if (document.getElementById('recordContainer')) applyRecordFilters();
    showGlobalToast('结算已保存，订单已归档到记录页');
}

// 加载历史记录（增强版：支持筛选、排序、分组）
function loadHistory(searchKeyword = '', filters = {}) {
    const container = document.getElementById('historyContainer');
    
    if (history.length === 0) {
        container.innerHTML = '<p>暂无历史记录</p>';
        updateBatchDeleteButton();
        return;
    }
    
    // 1. 关键词搜索过滤
    let filteredHistory = history;
    if (searchKeyword) {
        filteredHistory = history.filter(item => {
            const keywordLower = searchKeyword.toLowerCase();
            return (
                (item.clientId && item.clientId.toLowerCase().includes(keywordLower)) ||
                (item.contact && item.contact.toLowerCase().includes(keywordLower)) ||
                (item.deadline && item.deadline.toLowerCase().includes(keywordLower)) ||
                (item.agreedAmount != null && item.agreedAmount.toString().includes(keywordLower)) ||
                (item.finalTotal && item.finalTotal.toString().includes(keywordLower)) ||
                (item.totalProductsPrice && item.totalProductsPrice.toString().includes(keywordLower))
            );
        });
    }
    
    // 2. 时间范围筛选
    if (filters.timeRange && filters.timeRange !== 'all') {
        const now = new Date();
        filteredHistory = filteredHistory.filter(item => {
            const itemDate = new Date(item.timestamp);
            switch (filters.timeRange) {
                case 'today':
                    return itemDate.toDateString() === now.toDateString();
                case 'week':
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return itemDate >= weekAgo;
                case 'month':
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    return itemDate >= monthAgo;
                case 'custom':
                    const startDate = filters.startDate ? new Date(filters.startDate) : null;
                    const endDate = filters.endDate ? new Date(filters.endDate) : null;
                    if (startDate) startDate.setHours(0, 0, 0, 0);
                    if (endDate) endDate.setHours(23, 59, 59, 999);
                    if (startDate && itemDate < startDate) return false;
                    if (endDate && itemDate > endDate) return false;
                    return true;
                default:
                    return true;
            }
        });
    }
    
    // 3. 价格范围筛选
    if (filters.minPrice !== undefined && filters.minPrice !== '') {
        filteredHistory = filteredHistory.filter(item => 
            ((item.agreedAmount != null ? item.agreedAmount : item.finalTotal) || 0) >= parseFloat(filters.minPrice)
        );
    }
    if (filters.maxPrice !== undefined && filters.maxPrice !== '') {
        filteredHistory = filteredHistory.filter(item => 
            ((item.agreedAmount != null ? item.agreedAmount : item.finalTotal) || 0) <= parseFloat(filters.maxPrice)
        );
    }
    
    // 4. 排序
    if (filters.sortBy) {
        filteredHistory.sort((a, b) => {
            switch (filters.sortBy) {
                case 'time-desc':
                    return new Date(b.timestamp) - new Date(a.timestamp);
                case 'time-asc':
                    return new Date(a.timestamp) - new Date(b.timestamp);
                case 'price-desc':
                    return ((b.agreedAmount != null ? b.agreedAmount : b.finalTotal) || 0) - ((a.agreedAmount != null ? a.agreedAmount : a.finalTotal) || 0);
                case 'price-asc':
                    return ((a.agreedAmount != null ? a.agreedAmount : a.finalTotal) || 0) - ((b.agreedAmount != null ? b.agreedAmount : b.finalTotal) || 0);
                case 'client-asc':
                    return (a.clientId || '').localeCompare(b.clientId || '');
                case 'client-desc':
                    return (b.clientId || '').localeCompare(a.clientId || '');
                default:
                    return 0;
            }
        });
    } else {
        // 默认按时间倒序
        filteredHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    
    // 5. 分组显示
    if (filters.groupBy === 'month') {
        renderGroupedHistory(filteredHistory);
    } else {
        renderListHistory(filteredHistory);
    }
}

// 渲染列表形式的历史记录
function renderListHistory(filteredHistory) {
    const container = document.getElementById('historyContainer');
    let html = '';
    
    if (filteredHistory.length === 0) {
        html = '<p>未找到匹配的历史记录</p>';
    } else {
        filteredHistory.forEach(item => {
            html += generateHistoryItemHTML(item);
        });
    }
    
    container.innerHTML = html;
    updateBatchDeleteButton();
    restoreCheckboxStates();
}

// 渲染分组形式的历史记录
function renderGroupedHistory(filteredHistory) {
    const container = document.getElementById('historyContainer');
    
    if (filteredHistory.length === 0) {
        container.innerHTML = '<p>未找到匹配的历史记录</p>';
        updateBatchDeleteButton();
        return;
    }
    
    // 按月份分组
    const grouped = {};
    filteredHistory.forEach(item => {
        const date = new Date(item.timestamp);
        const monthKey = `${date.getFullYear()}年${date.getMonth() + 1}月`;
        if (!grouped[monthKey]) {
            grouped[monthKey] = [];
        }
        grouped[monthKey].push(item);
    });
    
    // 生成HTML
    let html = '';
    const sortedMonths = Object.keys(grouped).sort((a, b) => {
        // 按时间倒序排列
        return b.localeCompare(a);
    });
    
    sortedMonths.forEach(month => {
        html += `<div class="history-group">`;
        html += `<div class="history-group-header">${month} (${grouped[month].length}条)</div>`;
        html += `<div class="history-group-items">`;
        grouped[month].forEach(item => {
            html += generateHistoryItemHTML(item);
        });
        html += `</div></div>`;
    });
    
    container.innerHTML = html;
    updateBatchDeleteButton();
    restoreCheckboxStates();
}

// 生成历史记录项HTML
function generateHistoryItemHTML(item) {
    const isSelected = selectedHistoryIds.has(item.id);
    return `
        <div class="history-item${isSelected ? ' selected' : ''}" data-id="${item.id}">
            <input type="checkbox" class="history-item-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''} onchange="toggleHistorySelection(${item.id})">
            <div class="history-item-header">
                <div class="history-item-title">报价单 - ${item.clientId}</div>
                <div class="history-item-date">${new Date(item.timestamp).toLocaleString()}</div>
            </div>
            <div class="history-item-content">
                接单平台: ${item.contact || ''}\n
                联系方式: ${item.contactInfo || ''}\n
                截稿日: ${item.deadline}\n
                实收: ¥${(item.agreedAmount != null ? item.agreedAmount : item.finalTotal).toFixed(2)}
            </div>
            <div class="history-item-actions">
                <button class="icon-action-btn view" onclick="loadQuoteFromHistory(${item.id})" aria-label="查看详情" title="查看详情">
                    <svg class="icon" aria-hidden="true"><use href="#i-search"></use></svg>
                    <span class="sr-only">查看详情</span>
                </button>
                <button class="icon-action-btn edit" onclick="editHistoryItem(${item.id})" aria-label="编辑" title="编辑">
                    <svg class="icon" aria-hidden="true"><use href="#i-edit"></use></svg>
                    <span class="sr-only">编辑</span>
                </button>
                <button class="icon-action-btn delete" onclick="if(confirm('确定删除该记录？')) deleteHistoryItem(${item.id})" aria-label="删除" title="删除">
                    <svg class="icon" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                </button>
            </div>
        </div>
    `;
}

// ========== 历史记录筛选抽屉控制 ==========

// 切换筛选抽屉显示
function toggleHistoryFilterDrawer() {
    const drawer = document.getElementById('historyFilterDrawer');
    if (drawer) {
        drawer.classList.toggle('active');
        if (drawer.classList.contains('active')) {
            document.body.style.overflow = 'hidden'; // 防止背景滚动
            updateHistoryFilterBadge(); // 打开时更新徽章
        } else {
            document.body.style.overflow = '';
        }
    }
}

// 关闭筛选抽屉
function closeHistoryFilterDrawer() {
    const drawer = document.getElementById('historyFilterDrawer');
    if (drawer) {
        drawer.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// 打开价格历史记录弹窗
function openHistoryRecordModal() {
    const modal = document.getElementById('historyRecordModal');
    if (modal) {
        modal.classList.remove('d-none');
        document.body.style.overflow = 'hidden';
        applyHistoryFilters();
    }
}

// 关闭价格历史记录弹窗
function closeHistoryRecordModal() {
    const modal = document.getElementById('historyRecordModal');
    if (modal) {
        modal.classList.add('d-none');
        document.body.style.overflow = '';
        closeHistoryFilterDrawer();
        renderScheduleCalendar();
        renderScheduleTodoSection();
    }
}

// 筛选条件改变时更新徽章
function onHistoryFilterChange() {
    const timeFilter = document.getElementById('historyTimeFilter');
    const customDateRange = document.getElementById('historyCustomDateRange');
    
    // 显示/隐藏自定义日期范围
    if (timeFilter && timeFilter.value === 'custom') {
        if (customDateRange) customDateRange.classList.remove('d-none');
    } else {
        if (customDateRange) customDateRange.classList.add('d-none');
    }
    
    updateHistoryFilterBadge();
}

// 更新筛选按钮徽章（显示激活的筛选条件数量）
function updateHistoryFilterBadge() {
    const badge = document.getElementById('historyFilterBadge');
    if (!badge) return;
    // 始终隐藏筛选徽章
    badge.classList.add('d-none');
}

// 重置所有筛选条件
function resetHistoryFilters() {
    const timeFilter = document.getElementById('historyTimeFilter');
    const startDate = document.getElementById('historyStartDate');
    const endDate = document.getElementById('historyEndDate');
    const minPrice = document.getElementById('historyMinPrice');
    const maxPrice = document.getElementById('historyMaxPrice');
    const sortBy = document.getElementById('historySortBy');
    const groupBy = document.getElementById('historyGroupBy');
    const customDateRange = document.getElementById('historyCustomDateRange');
    
    if (timeFilter) timeFilter.value = 'all';
    if (startDate) startDate.value = '';
    if (endDate) endDate.value = '';
    if (minPrice) minPrice.value = '';
    if (maxPrice) maxPrice.value = '';
    if (sortBy) sortBy.value = 'time-desc';
    if (groupBy) groupBy.value = 'none';
    if (customDateRange) customDateRange.classList.add('d-none');
    
    selectedHistoryIds.clear();
    updateHistoryFilterBadge();
    applyHistoryFilters();
}

// 应用筛选条件
function applyHistoryFilters() {
    const timeFilterEl = document.getElementById('historyTimeFilter');
    const startDateEl = document.getElementById('historyStartDate');
    const endDateEl = document.getElementById('historyEndDate');
    const minPriceEl = document.getElementById('historyMinPrice');
    const maxPriceEl = document.getElementById('historyMaxPrice');
    const sortByEl = document.getElementById('historySortBy');
    const groupByEl = document.getElementById('historyGroupBy');
    const searchInput = document.getElementById('historySearchInput');
    
    if (!timeFilterEl || !sortByEl || !groupByEl) {
        const keyword = searchInput ? searchInput.value.trim() : '';
        loadHistory(keyword);
        return;
    }
    
    const timeFilter = timeFilterEl.value;
    const startDate = startDateEl ? startDateEl.value : '';
    const endDate = endDateEl ? endDateEl.value : '';
    const minPrice = minPriceEl ? minPriceEl.value : '';
    const maxPrice = maxPriceEl ? maxPriceEl.value : '';
    const sortBy = sortByEl.value;
    const groupBy = groupByEl.value;
    const searchKeyword = searchInput ? searchInput.value.trim() : '';
    
    // 显示/隐藏自定义时间选择器（在抽屉中）
    const customDateRange = document.getElementById('historyCustomDateRange');
    if (timeFilter === 'custom') {
        if (customDateRange) customDateRange.classList.remove('d-none');
    } else {
        if (customDateRange) customDateRange.classList.add('d-none');
    }
    
    const filters = {
        timeRange: timeFilter,
        startDate: startDate,
        endDate: endDate,
        minPrice: minPrice,
        maxPrice: maxPrice,
        sortBy: sortBy,
        groupBy: groupBy
    };
    
    loadHistory(searchKeyword, filters);
    updateHistoryFilterBadge(); // 应用筛选后更新徽章
}

// 搜索历史记录
function searchHistory() {
    applyHistoryFilters();
}

// 清空搜索
function clearHistorySearch() {
    const searchInput = document.getElementById('historySearchInput');
    if (searchInput) searchInput.value = '';
    
    // 重置所有筛选条件
    const timeFilterEl = document.getElementById('historyTimeFilter');
    const startDateEl = document.getElementById('historyStartDate');
    const endDateEl = document.getElementById('historyEndDate');
    const minPriceEl = document.getElementById('historyMinPrice');
    const maxPriceEl = document.getElementById('historyMaxPrice');
    const sortByEl = document.getElementById('historySortBy');
    const groupByEl = document.getElementById('historyGroupBy');
    
    if (timeFilterEl) timeFilterEl.value = 'all';
    if (startDateEl) {
        startDateEl.value = '';
        startDateEl.classList.add('d-none');
    }
    if (endDateEl) {
        endDateEl.value = '';
        endDateEl.classList.add('d-none');
    }
    if (minPriceEl) minPriceEl.value = '';
    if (maxPriceEl) maxPriceEl.value = '';
    if (sortByEl) sortByEl.value = 'time-desc';
    if (groupByEl) groupByEl.value = 'none';
    
    selectedHistoryIds.clear();
    updateHistoryFilterBadge();
    applyHistoryFilters();
}

// 切换历史记录选中状态
function toggleHistorySelection(id) {
    const checkbox = document.querySelector(`.history-item-checkbox[data-id="${id}"]`);
    if (checkbox && checkbox.checked) {
        selectedHistoryIds.add(id);
    } else {
        selectedHistoryIds.delete(id);
    }
    
    // 更新选中样式
    const item = document.querySelector(`.history-item[data-id="${id}"]`);
    if (item) {
        if (selectedHistoryIds.has(id)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    }
    
    updateBatchDeleteButton();
    updateRecordBatchDeleteButton();
}

// 全选/取消全选
function selectAllHistory() {
    const checkboxes = document.querySelectorAll('.history-item-checkbox');
    if (checkboxes.length === 0) return;
    
    const allSelected = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allSelected;
        const id = parseInt(cb.dataset.id);
        if (!allSelected) {
            selectedHistoryIds.add(id);
        } else {
            selectedHistoryIds.delete(id);
        }
    });
    
    // 更新选中样式
    document.querySelectorAll('.history-item').forEach(item => {
        const id = parseInt(item.dataset.id);
        if (selectedHistoryIds.has(id)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    
    updateBatchDeleteButton();
}

// 更新批量删除按钮状态
function updateBatchDeleteButton() {
    const btn = document.getElementById('batchDeleteBtn');
    if (btn) {
        btn.disabled = selectedHistoryIds.size === 0;
        btn.textContent = selectedHistoryIds.size > 0 ? `批量删除(${selectedHistoryIds.size})` : '批量删除';
    }
    const recordBtn = document.getElementById('recordBatchDeleteBtn');
    if (recordBtn) {
        recordBtn.disabled = selectedHistoryIds.size === 0;
        recordBtn.textContent = selectedHistoryIds.size > 0 ? `批量删除(${selectedHistoryIds.size})` : '批量删除';
    }
}

// 恢复复选框状态（在重新渲染后）
function restoreCheckboxStates() {
    selectedHistoryIds.forEach(id => {
        const checkbox = document.querySelector(`.history-item-checkbox[data-id="${id}"]`);
        if (checkbox) {
            checkbox.checked = true;
        }
        const item = document.querySelector(`.history-item[data-id="${id}"]`);
        if (item) {
            item.classList.add('selected');
        }
    });
    updateBatchDeleteButton();
    updateRecordBatchDeleteButton();
}

// 切换记录页批量操作模式
function toggleRecordBatchMode() {
    const recordContainer = document.getElementById('recordContainer');
    const batchControl = document.getElementById('recordBatchControl');
    const batchModeBtn = document.getElementById('recordBatchModeBtn');
    const batchModeBtnLabel = batchModeBtn ? batchModeBtn.querySelector('.page-action-label') : null;
    
    if (recordContainer.classList.contains('record-batch-mode')) {
        // 退出批量操作模式
        exitRecordBatchMode();
    } else {
        // 进入批量操作模式
        recordContainer.classList.add('record-batch-mode');
        batchControl.classList.remove('d-none');
        if (batchModeBtnLabel) batchModeBtnLabel.textContent = '退出批量';
        if (batchModeBtn) {
            batchModeBtn.setAttribute('aria-label', '退出批量');
            batchModeBtn.setAttribute('title', '退出批量');
        }
        // 清空之前的选择
        selectedHistoryIds.clear();
        updateRecordBatchDeleteButton();
        // 恢复复选框状态
        restoreCheckboxStates();
    }
}

// 退出记录页批量操作模式
function exitRecordBatchMode() {
    const recordContainer = document.getElementById('recordContainer');
    const batchControl = document.getElementById('recordBatchControl');
    const batchModeBtn = document.getElementById('recordBatchModeBtn');
    const batchModeBtnLabel = batchModeBtn ? batchModeBtn.querySelector('.page-action-label') : null;
    
    recordContainer.classList.remove('record-batch-mode');
    batchControl.classList.add('d-none');
    if (batchModeBtnLabel) batchModeBtnLabel.textContent = '批量';
    if (batchModeBtn) {
        batchModeBtn.setAttribute('aria-label', '批量操作');
        batchModeBtn.setAttribute('title', '批量操作');
    }
    // 清空选择
    selectedHistoryIds.clear();
    updateRecordBatchDeleteButton();
    // 移除选中样式
    document.querySelectorAll('.record-item').forEach(item => {
        item.classList.remove('selected');
    });
    // 取消勾选复选框
    document.querySelectorAll('.record-item-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
}

// 全选记录
function selectAllRecord() {
    const checkboxes = document.querySelectorAll('.record-item-checkbox');
    if (checkboxes.length === 0) return;
    
    const allSelected = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allSelected;
        const id = parseInt(cb.dataset.id);
        if (!allSelected) {
            selectedHistoryIds.add(id);
        } else {
            selectedHistoryIds.delete(id);
        }
    });
    
    // 更新选中样式
    document.querySelectorAll('.record-item').forEach(item => {
        const id = parseInt(item.dataset.id);
        if (selectedHistoryIds.has(id)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    
    updateRecordBatchDeleteButton();
}

// 批量删除记录
function batchDeleteRecord() {
    if (selectedHistoryIds.size === 0) return;
    
    if (confirm(`确定删除选中的 ${selectedHistoryIds.size} 条记录？`)) {
        selectedHistoryIds.forEach(id => {
            const index = history.findIndex(item => item.id === id);
            if (index !== -1) {
                history.splice(index, 1);
            }
        });
        
        // 保存数据
        saveData();
        // 重新渲染
        applyRecordFilters();
        // 退出批量操作模式
        exitRecordBatchMode();
        // 显示提示
        showGlobalToast(`已删除 ${selectedHistoryIds.size} 条记录`);
    }
}

// 更新记录页批量删除按钮状态
function updateRecordBatchDeleteButton() {
    const btn = document.getElementById('recordBatchDeleteBtn');
    if (btn) {
        btn.disabled = selectedHistoryIds.size === 0;
        btn.textContent = selectedHistoryIds.size > 0 ? `批量删除(${selectedHistoryIds.size})` : '批量删除(0)';
    }
}

// 批量删除历史记录
function batchDeleteHistory() {
    if (selectedHistoryIds.size === 0) {
        alert('请先选择要删除的历史记录！');
        return;
    }
    
    if (!confirm(`确定要删除选中的 ${selectedHistoryIds.size} 条历史记录吗？`)) {
        return;
    }
    
    // 保存要删除的订单（用于云端同步）
    const itemsToDelete = history.filter(item => selectedHistoryIds.has(item.id));
    
    history = history.filter(item => !selectedHistoryIds.has(item.id));
    selectedHistoryIds.clear();
    saveData();
    
    // 重新应用当前筛选条件
    applyHistoryFilters();
    if (document.getElementById('recordContainer')) {
        applyRecordFilters();
    }
    
    // 云端同步：如果已启用云端模式，同步删除云端订单
    if (mgIsCloudEnabled() && localStorage.getItem('mg_cloud_enabled') === '1') {
        itemsToDelete.forEach(item => {
            mgCloudDeleteOrder(item).catch(err => {
                console.error('云端删除订单失败:', err);
            });
        });
    }
    
    alert('已删除选中的历史记录！');
}

// 编辑历史记录（加载到计算页）
function editHistoryItem(id) {
    const quote = history.find(item => item.id === id);
    if (!quote) {
        alert('未找到该历史记录！');
        return;
    }
    
    // 切换到排单页
    if (typeof showPage === 'function') showPage('quote');
    // 延迟打开抽屉，确保弹窗关闭、DOM 稳定；在抽屉打开后再设置下单时间
    var _orderTimeYmd = quote.timestamp ? (function(){ var d = new Date(quote.timestamp); return !isNaN(d.getTime()) ? toYmd(d) : null; }()) : null;
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            openCalculatorDrawer(true);
            if (_orderTimeYmd) {
                var _oinp = document.getElementById('orderTimeInput');
                if (_oinp) { _oinp.value = _orderTimeYmd; _oinp.removeAttribute('readonly'); _oinp.removeAttribute('disabled'); }
            }
        });
    });

    // 清空当前制品和赠品
    products = [];
    gifts = [];
    productIdCounter = 0;
    giftIdCounter = 0;
    
    // 清空容器
    const productsContainer = document.getElementById('productsContainer');
    const giftsContainer = document.getElementById('giftsContainer');
    if (productsContainer) productsContainer.innerHTML = '';
    if (giftsContainer) giftsContainer.innerHTML = '';
    
    // 恢复单主信息
    if (quote.clientId) {
        document.getElementById('clientId').value = quote.clientId;
    }
    var orderPlatformInput = document.getElementById('orderPlatform');
    if (orderPlatformInput) orderPlatformInput.value = quote.contact || '';
    var contactInfoInput = document.getElementById('contactInfo');
    if (contactInfoInput) contactInfoInput.value = quote.contactInfo || '';
    // 平台手续费在下方 setTimeout 中与系数一并恢复（需等选择器选项就绪）
    // 下单时间改在 rAF 内、抽屉打开后设置，避免时序问题
    if (quote.startTime) {
        document.getElementById('startTime').value = quote.startTime;
    }
    if (quote.deadline) {
        document.getElementById('deadline').value = quote.deadline;
    }
    // 恢复配色索引
    if (typeof quote.scheduleColorIndex === 'number') {
        window.currentScheduleColorIndex = quote.scheduleColorIndex;
        if (typeof updateScheduleColorPreviewUI === 'function') {
            updateScheduleColorPreviewUI(window.currentScheduleColorIndex);
        }
    }
    // 恢复订单备注（编辑时显示该条记录的备注，新建时已在 openCalculatorDrawer 中清空）
    if (defaultSettings) defaultSettings.orderRemark = (quote.orderRemark != null) ? String(quote.orderRemark) : '';
    var orderRemarkTextEl = document.getElementById('orderRemarkText');
    if (orderRemarkTextEl) orderRemarkTextEl.value = defaultSettings ? (defaultSettings.orderRemark || '') : '';
    if (typeof updateOrderRemarkPreview === 'function') updateOrderRemarkPreview();
    
    // 恢复系数选择（需要等待选择器初始化）
    setTimeout(() => {
        // 恢复用途系数
        if (quote.usageType) {
            const usageSelect = document.getElementById('usage');
            if (usageSelect) {
                usageSelect.value = quote.usageType;
                if (usageSelect.onchange) usageSelect.onchange();
            }
        }
        
        // 恢复加急系数
        if (quote.urgentType) {
            const urgentSelect = document.getElementById('urgent');
            if (urgentSelect) {
                urgentSelect.value = quote.urgentType;
                if (urgentSelect.onchange) urgentSelect.onchange();
            }
        }
        
        // 恢复同模系数
        if (quote.sameModelType) {
            const sameModelSelect = document.getElementById('sameModel');
            if (sameModelSelect) {
                sameModelSelect.value = quote.sameModelType;
                if (sameModelSelect.onchange) sameModelSelect.onchange();
            }
        }
        
        // 恢复折扣系数
        if (quote.discountType) {
            const discountSelect = document.getElementById('discount');
            if (discountSelect) {
                discountSelect.value = quote.discountType;
                if (discountSelect.onchange) discountSelect.onchange();
            }
        }
        
        // 恢复平台手续费与接单平台（联动）；无 platformType 时尝试用 contact 按平台名称匹配（兼容旧数据）
        var platformKeyToSet = quote.platformType;
        if (!platformKeyToSet && quote.contact && defaultSettings.platformFees) {
            var contactLower = String(quote.contact).trim().toLowerCase();
            var match = Object.entries(defaultSettings.platformFees).find(function (e) {
                return (e[1] && (e[1].name || '').toLowerCase() === contactLower);
            });
            if (match) platformKeyToSet = match[0];
        }
        if (platformKeyToSet) {
            const platformSelect = document.getElementById('platform');
            if (platformSelect) {
                platformSelect.value = platformKeyToSet;
                if (platformSelect.onchange) platformSelect.onchange();
            }
            // 接单平台输入框已从 quote.contact 恢复，此处不覆盖
        }
        
        // 恢复其他加价类
        if (quote.extraUpSelections && Array.isArray(quote.extraUpSelections)) {
            quote.extraUpSelections.forEach(sel => {
                const selEl = document.getElementById('extraUp_' + sel.id);
                if (selEl) {
                    selEl.value = sel.selectedKey;
                    if (selEl.onchange) selEl.onchange();
                }
            });
        }
        
        // 恢复其他折扣类
        if (quote.extraDownSelections && Array.isArray(quote.extraDownSelections)) {
            quote.extraDownSelections.forEach(sel => {
                const selEl = document.getElementById('extraDown_' + sel.id);
                if (selEl) {
                    selEl.value = sel.selectedKey;
                    if (selEl.onchange) selEl.onchange();
                }
            });
        }
        
        // 恢复其他费用
        if (quote.otherFees && Array.isArray(quote.otherFees)) {
            dynamicOtherFees = [];
            quote.otherFees.forEach(fee => {
                addDynamicOtherFeeFromData(fee.name, fee.amount);
            });
        }
    }, 100);
    
    // 恢复制品
    if (quote.productPrices && Array.isArray(quote.productPrices)) {
        quote.productPrices.forEach(productPrice => {
            // 根据制品名称查找制品设置ID
            const productSetting = productSettings.find(setting => setting.name === productPrice.product);
            if (productSetting) {
                productIdCounter++;
                const product = {
                    id: productIdCounter,
                    type: productSetting.id.toString(),
                    sides: productPrice.sides || 'single',
                    quantity: productPrice.quantity || 1,
                    sameModel: productPrice.sameModelCount > 0,
                    hasBackground: false,
                    processes: {}
                };
                
                // 恢复工艺信息（processes 以工艺设置 id 为 key，值为 { id, layers, price }）
                if (productPrice.processDetails && Array.isArray(productPrice.processDetails)) {
                    productPrice.processDetails.forEach(process => {
                        if (process.name && process.layers) {
                            const ps = processSettings.find(p => p.name === process.name);
                            if (ps) {
                                product.processes[ps.id] = {
                                    id: ps.id,
                                    layers: process.layers,
                                    price: ps.price || 10
                                };
                            }
                        }
                    });
                }
                
                // 恢复基础+递增价的配置
                if (productPrice.productType === 'config' && productPrice.additionalConfigDetails) {
                    // 对于基础+递增价，需要根据配置恢复 sides 与各递增项数量 additionalConfigs
                    const totalConfig = productPrice.additionalConfigDetails.reduce((sum, c) => sum + (c.count || 0), 0);
                    if (totalConfig > 0) {
                        product.sides = (totalConfig + 1).toString();
                    }
                    // 恢复各递增项数量，供 updateProductForm 中显示
                    if (!product.additionalConfigs) product.additionalConfigs = {};
                    const addConfigs = productSetting.additionalConfigs || [];
                    productPrice.additionalConfigDetails.forEach((detail, index) => {
                        const configKey = 'config_' + product.id + '_' + index;
                        product.additionalConfigs[configKey] = detail.count || 0;
                    });
                } else if (productPrice.productType === 'config' && productPrice.totalAdditionalCount !== undefined) {
                    product.sides = (productPrice.totalAdditionalCount + 1).toString();
                }
                
                // 恢复按节点收费的总价与节点比例
                if (productPrice.productType === 'nodes') {
                    product.nodeTotalPrice = productPrice.nodeTotalPrice != null ? productPrice.nodeTotalPrice : productPrice.basePrice;
                    product.nodePercents = (productPrice.nodeDetails && productPrice.nodeDetails.length) ? productPrice.nodeDetails.map(d => d.percent) : [];
                }
                
                products.push(product);
                renderProduct(product);
            }
        });
    }
    
    // 恢复赠品
    if (quote.giftPrices && Array.isArray(quote.giftPrices)) {
        quote.giftPrices.forEach(giftPrice => {
            const giftSetting = productSettings.find(setting => setting.name === giftPrice.product);
            if (giftSetting) {
                giftIdCounter++;
                const gift = {
                    id: giftIdCounter,
                    type: giftSetting.id.toString(),
                    sides: giftPrice.sides || 'single',
                    quantity: giftPrice.quantity || 1,
                    sameModel: giftPrice.sameModelCount > 0,
                    hasBackground: false, // 默认不需要背景
                    processes: {}
                };
                
                // 恢复工艺信息（processes 以工艺设置 id 为 key，值为 { id, layers, price }）
                if (giftPrice.processDetails && Array.isArray(giftPrice.processDetails)) {
                    giftPrice.processDetails.forEach(process => {
                        if (process.name && process.layers) {
                            const ps = processSettings.find(p => p.name === process.name);
                            if (ps) {
                                gift.processes[ps.id] = {
                                    id: ps.id,
                                    layers: process.layers,
                                    price: ps.price || 10
                                };
                            }
                        }
                    });
                }
                
                // 恢复基础+递增价的配置
                if (giftPrice.productType === 'config' && giftPrice.additionalConfigDetails) {
                    const totalConfig = giftPrice.additionalConfigDetails.reduce((sum, c) => sum + (c.count || 0), 0);
                    if (totalConfig > 0) {
                        gift.sides = (totalConfig + 1).toString();
                    }
                    if (!gift.additionalConfigs) gift.additionalConfigs = {};
                    giftPrice.additionalConfigDetails.forEach((detail, index) => {
                        const configKey = 'config_' + gift.id + '_' + index;
                        gift.additionalConfigs[configKey] = detail.count || 0;
                    });
                } else if (giftPrice.productType === 'config' && giftPrice.totalAdditionalCount !== undefined) {
                    gift.sides = (giftPrice.totalAdditionalCount + 1).toString();
                }
                
                gifts.push(gift);
                renderGift(gift);
            }
        });
    }
    
    // 保存当前编辑的历史记录ID，用于更新
    window.editingHistoryId = id;
}

// 从数据添加其他费用（用于编辑历史记录）
function addDynamicOtherFeeFromData(name, amount) {
    if (!dynamicOtherFees) {
        dynamicOtherFees = [];
    }
    
    const fee = {
        id: Date.now(),
        name: name,
        amount: parseFloat(amount) || 0
    };
    
    dynamicOtherFees.push(fee);
    renderDynamicOtherFees();
}

// ========== 模板管理功能 ==========

// 保存模板（含设置选项：用途、加急、同模、折扣、平台、其他加价/折扣类、其他费用）
function saveTemplate() {
    const templateName = document.getElementById('templateName').value.trim();
    if (!templateName) {
        alert('请输入模板名称！');
        return;
    }
    
    if (products.length === 0 && gifts.length === 0) {
        alert('请至少添加一个制品或赠品！');
        return;
    }
    
    // 收集设置选项
    const usageType = (document.getElementById('usage') && document.getElementById('usage').value) || '';
    const urgentType = (document.getElementById('urgent') && document.getElementById('urgent').value) || '';
    const sameModelType = (document.getElementById('sameModel') && document.getElementById('sameModel').value) || '';
    const discountType = (document.getElementById('discount') && document.getElementById('discount').value) || '';
    const platformType = (document.getElementById('platform') && document.getElementById('platform').value) || '';
    const extraUpSelections = [];
    (defaultSettings.extraPricingUp || []).forEach(e => {
        const el = document.getElementById('extraUp_' + e.id);
        if (el && el.value) extraUpSelections.push({ id: e.id, selectedKey: el.value });
    });
    const extraDownSelections = [];
    (defaultSettings.extraPricingDown || []).forEach(e => {
        const el = document.getElementById('extraDown_' + e.id);
        if (el && el.value) extraDownSelections.push({ id: e.id, selectedKey: el.value });
    });
    const otherFees = (typeof dynamicOtherFees !== 'undefined' && Array.isArray(dynamicOtherFees))
        ? dynamicOtherFees.map(f => ({ name: f.name, amount: f.amount }))
        : [];
    
    const existingIndex = templates.findIndex(t => t.name === templateName);
    
    const template = {
        id: existingIndex !== -1 ? templates[existingIndex].id : Date.now(),
        name: templateName,
        products: JSON.parse(JSON.stringify(products)),
        gifts: JSON.parse(JSON.stringify(gifts)),
        settings: {
            usageType: usageType,
            urgentType: urgentType,
            sameModelType: sameModelType,
            discountType: discountType,
            platformType: platformType,
            extraUpSelections: extraUpSelections,
            extraDownSelections: extraDownSelections,
            otherFees: otherFees
        },
        timestamp: Date.now()
    };
    
    if (existingIndex !== -1) {
        templates[existingIndex] = template;
        alert('模板已更新！');
    } else {
        templates.push(template);
        alert('模板已保存！');
    }
    
    saveData();
    renderTemplateList();
    const tn = document.getElementById('templateName');
    if (tn) tn.value = '';
}

// 模版填表：切换下拉显示；打开时刷新列表并支持点击外部关闭
function toggleTemplateFillDropdown() {
    const d = document.getElementById('templateFillDropdown');
    if (!d) return;
    if (d.classList.contains('d-none')) {
        d.classList.remove('d-none');
        renderTemplateList();
        updateDeleteTemplateButton();
        setTimeout(function() { document.addEventListener('click', closeTemplateFillDropdownOnClick); }, 0);
    } else {
        d.classList.add('d-none');
        document.removeEventListener('click', closeTemplateFillDropdownOnClick);
    }
}

function closeTemplateFillDropdown() {
    const d = document.getElementById('templateFillDropdown');
    if (d) d.classList.add('d-none');
    document.removeEventListener('click', closeTemplateFillDropdownOnClick);
}

function closeTemplateFillDropdownOnClick(e) {
    if (e.target.closest('.template-fill-wrap')) return;
    closeTemplateFillDropdown();
}

// 模板选择变化时的处理
function onTemplateSelectChange() {
    updateDeleteTemplateButton();
}

// 加载选中的模板
function loadSelectedTemplate() {
    const templateSelect = document.getElementById('templateSelect');
    const templateId = parseInt(templateSelect.value);
    
    if (!templateId) {
        alert('请先选择一个模板！');
        return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (!template) {
        alert('未找到该模板！');
        return;
    }
    
    // 确认是否清空当前制品和赠品
    if (products.length > 0 || gifts.length > 0) {
        if (!confirm('加载模板将替换当前的制品和赠品，是否继续？')) {
            return;
        }
    }
    
    // 清空当前制品和赠品
    products = [];
    gifts = [];
    productIdCounter = 0;
    giftIdCounter = 0;
    
    // 清空容器
    const productsContainer = document.getElementById('productsContainer');
    const giftsContainer = document.getElementById('giftsContainer');
    if (productsContainer) productsContainer.innerHTML = '';
    if (giftsContainer) giftsContainer.innerHTML = '';
    
    // 加载模板中的制品
    if (template.products && Array.isArray(template.products)) {
        template.products.forEach(productData => {
            productIdCounter++;
            const product = {
                id: productIdCounter,
                type: productData.type || '',
                sides: productData.sides || 'single',
                quantity: productData.quantity || 1,
                sameModel: productData.sameModel !== undefined ? productData.sameModel : true,
                hasBackground: productData.hasBackground !== undefined ? productData.hasBackground : false,
                processes: productData.processes || {}
            };
            products.push(product);
            renderProduct(product);
        });
    }
    
    // 加载模板中的赠品
    if (template.gifts && Array.isArray(template.gifts)) {
        template.gifts.forEach(giftData => {
            giftIdCounter++;
            const gift = {
                id: giftIdCounter,
                type: giftData.type || '',
                sides: giftData.sides || 'single',
                quantity: giftData.quantity || 1,
                sameModel: giftData.sameModel !== undefined ? giftData.sameModel : true,
                processes: giftData.processes || {}
            };
            gifts.push(gift);
            renderGift(gift);
        });
    }
    
    // 恢复设置选项（用途、加急、同模、折扣、平台、其他加价/折扣类、其他费用）
    if (template.settings) {
        const s = template.settings;
        const setSel = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; if (el.onchange) el.onchange(); } };
        setSel('usage', s.usageType || '');
        setSel('urgent', s.urgentType || '');
        setSel('sameModel', s.sameModelType || '');
        setSel('discount', s.discountType || '');
        setSel('platform', s.platformType || '');
        var orderPlatformEl = document.getElementById('orderPlatform');
        if (orderPlatformEl) {
            orderPlatformEl.value = (s.platformType && defaultSettings.platformFees && defaultSettings.platformFees[s.platformType])
                ? (defaultSettings.platformFees[s.platformType].name || s.platformType)
                : '';
            toggleOrderPlatformClear();
        }
        (s.extraUpSelections || []).forEach(sel => {
            const el = document.getElementById('extraUp_' + sel.id);
            if (el) { el.value = sel.selectedKey; if (el.onchange) el.onchange(); }
        });
        (s.extraDownSelections || []).forEach(sel => {
            const el = document.getElementById('extraDown_' + sel.id);
            if (el) { el.value = sel.selectedKey; if (el.onchange) el.onchange(); }
        });
        if (Array.isArray(s.otherFees)) {
            dynamicOtherFees.length = 0;
            renderDynamicOtherFees();
            s.otherFees.forEach(f => addDynamicOtherFeeFromData(f.name, f.amount));
        }
    }
    
    templateSelect.value = '';
    updateDeleteTemplateButton();
    alert('模板已加载！');
}

// 删除模板
function deleteTemplate() {
    const templateSelect = document.getElementById('templateSelect');
    const templateId = parseInt(templateSelect.value);
    
    if (!templateId) {
        return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (!template) {
        alert('未找到该模板！');
        return;
    }
    
    if (!confirm(`确定要删除模板"${template.name}"吗？`)) {
        return;
    }
    
    templates = templates.filter(t => t.id !== templateId);
    saveData();
    renderTemplateList();
    
    alert('模板已删除！');
}

// 渲染模板列表（在模版填表下拉内；打开下拉时调用，打开即能看到旧模板）
function renderTemplateList() {
    const templateSelect = document.getElementById('templateSelect');
    if (!templateSelect) return;
    
    const currentValue = templateSelect.value;
    templateSelect.innerHTML = '<option value="">-- 选择模板 --</option>';
    
    const sortedTemplates = [...templates].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    sortedTemplates.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        const prods = t.products || [];
        const gs = t.gifts || [];
        opt.textContent = t.name + ' (' + prods.length + '个制品, ' + gs.length + '个赠品)';
        templateSelect.appendChild(opt);
    });
    
    if (currentValue) templateSelect.value = currentValue;
    updateDeleteTemplateButton();
}

// 更新删除模板按钮状态
function updateDeleteTemplateButton() {
    const templateSelect = document.getElementById('templateSelect');
    const deleteBtn = document.getElementById('deleteTemplateBtn');
    
    if (deleteBtn && templateSelect) {
        deleteBtn.disabled = !templateSelect.value;
    }
}


// 从历史记录加载报价
function loadQuoteFromHistory(id) {
    const quote = history.find(item => item.id === id);
    if (quote) {
        // 确保quoteData结构完整
        quoteData = {
            ...quote,
            // 确保productPrices数组存在且有正确结构
            productPrices: quote.productPrices || [],
            // 确保其他必要字段存在
            totalProductsPrice: quote.totalProductsPrice || 0,
            totalPriceBeforeFee: quote.totalPriceBeforeFee || 0,
            finalTotal: quote.finalTotal || 0,
            agreedAmount: quote.agreedAmount != null ? quote.agreedAmount : (quote.totalBeforePlatformFee != null ? quote.totalBeforePlatformFee : ((quote.finalTotal || 0) - (quote.platformFeeAmount || 0))),
            platformFeeAmount: quote.platformFeeAmount || 0,
            // 确保startTime字段存在
            startTime: quote.startTime || null,
            // 确保其他可能缺失的字段存在
            contact: quote.contact || '',
            deadline: quote.deadline || '',
            usage: quote.usage || 1,
            urgent: quote.urgent || 1,
            sameModelCoefficient: quote.sameModelCoefficient || 0.5,
            discount: quote.discount || 1,
            otherFees: quote.otherFees || [],
            totalOtherFees: quote.totalOtherFees || 0,
            platformFee: quote.platformFee || 0,
            giftPrices: quote.giftPrices || [],
            // 兼容旧数据：已收定金默认为 0
            depositReceived: quote.depositReceived != null ? quote.depositReceived : 0
        };
        
        // 为兼容旧版本历史数据，确保productPrices和giftPrices中的每个项目都有sides和productId字段
        if (quoteData.productPrices) {
            quoteData.productPrices = quoteData.productPrices.map(item => {
                // 如果sides未定义但productType是'double'，根据价格推断是单面还是双面
                let inferredSides = item.sides;
                if (inferredSides === undefined && item.productType === 'double') {
                    // 查找原始产品设置以确定单面和双面价格
                    const originalProductSetting = productSettings.find(setting => setting.name === item.product);
                    if (originalProductSetting && originalProductSetting.priceType === 'double') {
                        // 如果基础价格等于双面价格，则认为是双面；否则默认为单面
                        inferredSides = item.basePrice === originalProductSetting.priceDouble ? 'double' : 'single';
                    } else {
                        inferredSides = 'single'; // 默认为单面
                    }
                }
                return {
                    ...item,
                    sides: inferredSides,
                    productId: item.productId !== undefined ? item.productId : null
                };
            });
        }
        
        if (quoteData.giftPrices) {
            quoteData.giftPrices = quoteData.giftPrices.map(item => {
                // 如果sides未定义但productType是'double'，根据价格推断是单面还是双面
                let inferredSides = item.sides;
                if (inferredSides === undefined && item.productType === 'double') {
                    // 查找原始产品设置以确定单面和双面价格
                    const originalProductSetting = productSettings.find(setting => setting.name === item.product);
                    if (originalProductSetting && originalProductSetting.priceType === 'double') {
                        // 如果基础价格等于双面价格，则认为是双面；否则默认为单面
                        inferredSides = item.basePrice === originalProductSetting.priceDouble ? 'double' : 'single';
                    } else {
                        inferredSides = 'single'; // 默认为单面
                    }
                }
                return {
                    ...item,
                    sides: inferredSides,
                    productId: item.productId !== undefined ? item.productId : null
                };
            });
        }
        
        // 设置当前排单颜色索引为订单的颜色索引
        if (typeof quote.scheduleColorIndex === 'number') {
            window.currentScheduleColorIndex = quote.scheduleColorIndex;
        }
        
        // 从排单卡片点「小票」进入时，记下原订单 ID，使小票页内点「排单」时覆盖原订单并轻提示
        if (window.receiptOpenedFromRecord) {
            window.editingHistoryId = id;
        }
        // 先切换到报价页面
        showPage('quote');
        
        // 立即生成报价单，确保quoteData已经被设置
        setTimeout(() => {
            if (quoteData) {
                generateQuote();  // 生成报价单
                // 自动打开小票抽屉，跳转到“小票页”
                if (typeof openReceiptDrawer === 'function') {
                    openReceiptDrawer();
                }
            }
        }, 50);  // 稍微增加延迟，确保页面完全切换
    }
}

// 删除历史记录项
function deleteHistoryItem(id) {
    const item = history.find(item => item.id === id);
    if (!item) return;
    
    history = history.filter(item => item.id !== id);
    selectedHistoryIds.delete(id);
    saveData();
    applyHistoryFilters();
    // 同步刷新记录页
    if (document.getElementById('recordContainer')) {
        applyRecordFilters();
    }
    
    // 云端同步：如果已启用云端模式，同步删除云端订单
    if (mgIsCloudEnabled() && localStorage.getItem('mg_cloud_enabled') === '1') {
        mgCloudDeleteOrder(item).catch(err => {
            console.error('云端删除订单失败:', err);
        });
    }
}

// 导出历史记录为Excel
function exportHistoryToExcel() {
    if (history.length === 0) {
        alert('暂无历史记录可导出！');
        return;
    }
    
    // 获取当前筛选后的历史记录
    const searchInput = document.getElementById('historySearchInput');
    const timeFilterEl = document.getElementById('historyTimeFilter');
    const startDateEl = document.getElementById('historyStartDate');
    const endDateEl = document.getElementById('historyEndDate');
    const minPriceEl = document.getElementById('historyMinPrice');
    const maxPriceEl = document.getElementById('historyMaxPrice');
    
    const searchKeyword = searchInput ? searchInput.value.trim() : '';
    const timeFilter = timeFilterEl ? timeFilterEl.value : 'all';
    const startDate = startDateEl ? startDateEl.value : '';
    const endDate = endDateEl ? endDateEl.value : '';
    const minPrice = minPriceEl ? minPriceEl.value : '';
    const maxPrice = maxPriceEl ? maxPriceEl.value : '';
    
    // 应用筛选获取要导出的数据
    let exportData = history;
    
    // 应用搜索关键词
    if (searchKeyword) {
        const keywordLower = searchKeyword.toLowerCase();
        exportData = exportData.filter(item => {
            return (
                (item.clientId && item.clientId.toLowerCase().includes(keywordLower)) ||
                (item.contact && item.contact.toLowerCase().includes(keywordLower)) ||
                (item.deadline && item.deadline.toLowerCase().includes(keywordLower)) ||
                (item.agreedAmount != null && item.agreedAmount.toString().includes(keywordLower)) ||
                (item.finalTotal && item.finalTotal.toString().includes(keywordLower))
            );
        });
    }
    
    // 应用时间筛选
    if (timeFilter && timeFilter !== 'all') {
        const now = new Date();
        exportData = exportData.filter(item => {
            const itemDate = new Date(item.timestamp);
            switch (timeFilter) {
                case 'today':
                    return itemDate.toDateString() === now.toDateString();
                case 'week':
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return itemDate >= weekAgo;
                case 'month':
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    return itemDate >= monthAgo;
                case 'custom':
                    const start = startDate ? new Date(startDate) : null;
                    const end = endDate ? new Date(endDate) : null;
                    if (start) start.setHours(0, 0, 0, 0);
                    if (end) end.setHours(23, 59, 59, 999);
                    if (start && itemDate < start) return false;
                    if (end && itemDate > end) return false;
                    return true;
                default:
                    return true;
            }
        });
    }
    
    // 应用价格筛选
    if (minPrice) {
        exportData = exportData.filter(item => ((item.agreedAmount != null ? item.agreedAmount : item.finalTotal) || 0) >= parseFloat(minPrice));
    }
    if (maxPrice) {
        exportData = exportData.filter(item => ((item.agreedAmount != null ? item.agreedAmount : item.finalTotal) || 0) <= parseFloat(maxPrice));
    }
    
    if (exportData.length === 0) {
        alert('当前筛选条件下没有可导出的历史记录！');
        return;
    }
    
    // 格式化结算信息（用于 Excel 导出）
    function formatSettlementForExcel(item) {
        var st = item.settlement;
        var dep = Number(item.depositReceived || 0);
        if (!isFinite(dep) || dep < 0) dep = 0;
        var receivable = Number(item.agreedAmount != null ? item.agreedAmount : (item.finalTotal || 0)) || 0;
        var actual = st && st.amount != null ? Number(st.amount) : 0;
        if (!isFinite(actual) || actual < 0) actual = 0;
        var totalReceived = dep + actual;
        var typeText = '';
        var detailText = '';
        if (st && st.type) {
            if (st.type === 'full_refund') {
                typeText = '撤单（退全款）';
                detailText = '需退金额¥' + dep.toFixed(2) + '；已退款¥' + actual.toFixed(2);
            } else if (st.type === 'cancel_with_fee') {
                typeText = '撤单（收跑单费）';
                var cf = st.cancelFee || {};
                var feeAmt = (cf.feeAmount != null && isFinite(cf.feeAmount)) ? Number(cf.feeAmount) : (actual + dep);
                var depositUsed = Math.min(dep, feeAmt);
                totalReceived = feeAmt;
                if (cf.rule === 'percent' && cf.rate != null) {
                    detailText = '跑单费' + (cf.rate * 100).toFixed(0) + '%：¥' + feeAmt.toFixed(2);
                } else if (cf.rule === 'fixed' && cf.fixedAmount != null) {
                    detailText = '跑单费¥' + feeAmt.toFixed(2);
                } else {
                    detailText = '跑单费¥' + feeAmt.toFixed(2);
                }
                if (dep > 0) detailText += '；定金抵扣¥' + depositUsed.toFixed(2) + '；本次收¥' + actual.toFixed(2);
            } else if (st.type === 'waste_fee') {
                typeText = '废稿结算';
                var wf = st.wasteFee || {};
                var feeAmtWaste = (wf.feeAmount != null && isFinite(wf.feeAmount)) ? Number(wf.feeAmount) : (wf.totalReceivable != null && isFinite(wf.totalReceivable)) ? Number(wf.totalReceivable) : (wf.totalWasteReceivable != null && isFinite(wf.totalWasteReceivable)) ? Number(wf.totalWasteReceivable) : (actual + dep);
                totalReceived = feeAmtWaste;
                var depositUsedWaste = Math.min(dep, feeAmtWaste);
                detailText = '废稿费¥' + feeAmtWaste.toFixed(2);
                if (dep > 0) detailText += '；定金抵扣¥' + depositUsedWaste.toFixed(2) + '；本次收款¥' + actual.toFixed(2);
            } else if (st.type === 'normal') {
                typeText = '正常结单';
                var drs = Array.isArray(st.discountReasons) ? st.discountReasons : [];
                if (drs.length > 0) {
                    var parts = drs.map(function (e) {
                        if (!e || !e.name) return '';
                        var a = e.amount != null && isFinite(e.amount) ? e.amount : 0;
                        var r = e.rate != null && isFinite(e.rate) ? e.rate : 0;
                        if (a > 0) return e.name + '-¥' + a.toFixed(2);
                        if (r > 0) return e.name + '×' + r.toFixed(2);
                        return e.name;
                    }).filter(Boolean);
                    detailText = '结算优惠：' + parts.join('；');
                } else {
                    detailText = '本次收款¥' + actual.toFixed(2);
                }
            } else {
                typeText = st.type;
                detailText = '本次¥' + actual.toFixed(2);
            }
        }
        return { typeText: typeText, detailText: detailText, totalReceived: totalReceived, actual: actual };
    }
    
    // 准备汇总表数据
    const summaryData = exportData.map(item => {
        var settlementInfo = formatSettlementForExcel(item);
        var receivable = (item.agreedAmount != null ? item.agreedAmount : item.finalTotal) || 0;
        var dep = Number(item.depositReceived || 0);
        if (!isFinite(dep) || dep < 0) dep = 0;
        var needDep = item.needDeposit ? 1 : 0;
        var suggestedDep = 0;
        if (needDep && item.finalTotal) {
            var rate = (defaultSettings && defaultSettings.depositRate != null) ? Number(defaultSettings.depositRate) : 0.3;
            suggestedDep = Math.round((item.finalTotal || 0) * rate * 100) / 100;
        }
        return {
            '时间': new Date(item.timestamp).toLocaleString('zh-CN'),
            '单主ID': item.clientId || '',
            '接单平台': item.contact || '',
            '联系方式': item.contactInfo || '',
            '开始时间': item.startTime || '',
            '截稿时间': item.deadline || '',
            '制品总价': item.totalProductsPrice || 0,
            '其他费用': item.totalOtherFees || 0,
            '平台费': item.platformFeeAmount || 0,
            '约定实收': receivable,
            '需付定金': needDep ? suggestedDep : '',
            '已收定金': dep > 0 ? dep : '',
            '结算类型': settlementInfo.typeText || '',
            '本次收款/退款': (item.settlement && item.settlement.amount != null) ? Number(item.settlement.amount) : '',
            '合计实收': settlementInfo.typeText ? settlementInfo.totalReceived : (dep > 0 ? dep : ''),
            '结算明细': settlementInfo.detailText || '',
            '结算时间': (item.settlement && item.settlement.at) ? new Date(item.settlement.at).toLocaleString('zh-CN') : '',
            '结算备注': (item.settlement && item.settlement.memo) ? item.settlement.memo : '',
            '用途系数': item.usage || 1,
            '加急系数': item.urgent || 1,
            '折扣系数': item.discount || 1,
            '制品数量': item.productPrices ? item.productPrices.length : 0,
            '赠品数量': item.giftPrices ? item.giftPrices.length : 0
        };
    });
    
    // 准备制品明细数据
    const productDetailData = [];
    exportData.forEach(item => {
        const timestamp = new Date(item.timestamp).toLocaleString('zh-CN');
        const clientId = item.clientId || '';
        
        if (item.productPrices && item.productPrices.length > 0) {
            item.productPrices.forEach((product, index) => {
                // 格式化工艺信息
                let processInfo = '';
                if (product.processDetails && product.processDetails.length > 0) {
                    processInfo = product.processDetails.map(p => {
                        if (p.name && p.layers && p.unitPrice) {
                            return `${p.name}×${p.layers}层(¥${p.unitPrice.toFixed(2)}/层)`;
                        }
                        return '';
                    }).filter(p => p).join('; ');
                }
                
                // 格式化额外配置信息
                let additionalConfigInfo = '';
                if (product.additionalConfigDetails && product.additionalConfigDetails.length > 0) {
                    additionalConfigInfo = product.additionalConfigDetails.map(c => {
                        if (c.name && c.count && c.unitPrice) {
                            return `${c.name}×${c.count}${c.unit || ''}(¥${c.unitPrice.toFixed(2)}/${c.unit || '单位'})`;
                        }
                        return '';
                    }).filter(c => c).join('; ');
                } else if (product.totalAdditionalCount !== undefined && product.additionalUnit && product.additionalPrice) {
                    additionalConfigInfo = `额外${product.totalAdditionalCount}${product.additionalUnit}(¥${product.additionalPrice.toFixed(2)}/${product.additionalUnit})`;
                }
                
                // 格式化价格类型
                let priceTypeText = '';
                switch(product.productType) {
                    case 'fixed':
                        priceTypeText = '固定价';
                        break;
                    case 'double':
                        priceTypeText = '单双面价';
                        break;
                    case 'config':
                        priceTypeText = '基础+递增价';
                        break;
                    case 'nodes':
                        priceTypeText = '按节点收费';
                        break;
                    default:
                        priceTypeText = product.productType || '';
                }
                
                // 格式化单双面
                let sidesText = '';
                if (product.sides === 'single') {
                    sidesText = '单面';
                } else if (product.sides === 'double') {
                    sidesText = '双面';
                } else if (product.sides && product.sides !== 'single' && product.sides !== 'double') {
                    sidesText = `${product.sides}面`;
                }
                
                const detailRow = {
                    '报价时间': timestamp,
                    '单主ID': clientId,
                    '序号': product.productIndex || (index + 1),
                    '制品名称': product.product || '',
                    '分类': product.category || '其他',
                    '价格类型': priceTypeText,
                    '单双面': sidesText,
                    '基础价格': product.basePrice || 0,
                    '基础配置': product.baseConfig || '',
                    '基础配置价': product.baseConfigPrice || '',
                    '数量': product.quantity || 0,
                    '同模数量': product.sameModelCount || 0,
                    '同模单价': product.sameModelUnitPrice || 0,
                    '同模总计': product.sameModelTotal || 0,
                    '工艺信息': processInfo,
                    '工艺费用': product.totalProcessFee || 0,
                    '额外配置': additionalConfigInfo,
                    '制品小计': product.productTotal || 0
                };
                
                productDetailData.push(detailRow);
            });
        }
    });
    
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    
    // 创建汇总表
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, '历史记录汇总');
    
    // 设置汇总表列宽
    const summaryColWidths = [
        { wch: 20 }, // 时间
        { wch: 15 }, // 单主ID
        { wch: 20 }, // 接单平台
        { wch: 20 }, // 联系方式
        { wch: 12 }, // 开始时间
        { wch: 12 }, // 截稿时间
        { wch: 12 }, // 制品总价
        { wch: 12 }, // 其他费用
        { wch: 12 }, // 平台费
        { wch: 12 }, // 约定实收
        { wch: 10 }, // 需付定金
        { wch: 10 }, // 已收定金
        { wch: 14 }, // 结算类型
        { wch: 12 }, // 本次收款/退款
        { wch: 12 }, // 合计实收
        { wch: 35 }, // 结算明细
        { wch: 20 }, // 结算时间
        { wch: 20 }, // 结算备注
        { wch: 10 }, // 用途系数
        { wch: 10 }, // 加急系数
        { wch: 10 }, // 折扣系数
        { wch: 10 }, // 制品数量
        { wch: 10 }  // 赠品数量
    ];
    summaryWorksheet['!cols'] = summaryColWidths;
    
    // 创建制品明细表
    if (productDetailData.length > 0) {
        const detailWorksheet = XLSX.utils.json_to_sheet(productDetailData);
        XLSX.utils.book_append_sheet(workbook, detailWorksheet, '制品明细');
        
        // 设置制品明细表列宽
        const detailColWidths = [
            { wch: 20 }, // 报价时间
            { wch: 15 }, // 单主ID
            { wch: 8 },  // 序号
            { wch: 20 }, // 制品名称
            { wch: 12 }, // 分类
            { wch: 12 }, // 价格类型
            { wch: 10 }, // 单双面
            { wch: 12 }, // 基础价格
            { wch: 15 }, // 基础配置
            { wch: 12 }, // 基础配置价
            { wch: 8 },  // 数量
            { wch: 10 }, // 同模数量
            { wch: 12 }, // 同模单价
            { wch: 12 }, // 同模总计
            { wch: 30 }, // 工艺信息
            { wch: 12 }, // 工艺费用
            { wch: 30 }, // 额外配置
            { wch: 12 }  // 制品小计
        ];
        detailWorksheet['!cols'] = detailColWidths;
    }
    
    // 导出文件
    const filename = `历史记录_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
    
    const productCount = productDetailData.length;
    alert(`已导出 ${exportData.length} 条历史记录（${productCount} 个制品明细）到 ${filename}`);
}

// 更新用途系数
function updateUsageCoefficient(type, value) {
    if (!defaultSettings.usageCoefficients[type] || typeof defaultSettings.usageCoefficients[type] !== 'object') {
        defaultSettings.usageCoefficients[type] = { value: parseFloat(value) || 1, name: type };
    } else {
        defaultSettings.usageCoefficients[type].value = parseFloat(value) || 1;
    }
}

// 更新用途系数名称
function updateUsageCoefficientName(type, name) {
    if (!defaultSettings.usageCoefficients[type] || typeof defaultSettings.usageCoefficients[type] !== 'object') {
        // 如果系数不存在，创建一个默认对象
        defaultSettings.usageCoefficients[type] = { value: 1, name: name };
    } else {
        defaultSettings.usageCoefficients[type].name = name;
    }
}

// 更新加急系数
function updateUrgentCoefficient(type, value) {
    if (!defaultSettings.urgentCoefficients[type] || typeof defaultSettings.urgentCoefficients[type] !== 'object') {
        defaultSettings.urgentCoefficients[type] = { value: parseFloat(value) || 1, name: type };
    } else {
        defaultSettings.urgentCoefficients[type].value = parseFloat(value) || 1;
    }
}

// 更新加急系数名称
function updateUrgentCoefficientName(type, name) {
    if (!defaultSettings.urgentCoefficients[type] || typeof defaultSettings.urgentCoefficients[type] !== 'object') {
        // 如果系数不存在，创建一个默认对象
        defaultSettings.urgentCoefficients[type] = { value: 1, name: name };
    } else {
        defaultSettings.urgentCoefficients[type].name = name;
    }
}

// 更新同模系数
function updateSameModelCoefficient(type, value) {
    if (!defaultSettings.sameModelCoefficients[type] || typeof defaultSettings.sameModelCoefficients[type] !== 'object') {
        defaultSettings.sameModelCoefficients[type] = { value: parseFloat(value) || 0.5, name: type };
    } else {
        defaultSettings.sameModelCoefficients[type].value = parseFloat(value) || 0.5;
    }
}

// 更新同模系数名称
function updateSameModelCoefficientName(type, name) {
    if (!defaultSettings.sameModelCoefficients[type] || typeof defaultSettings.sameModelCoefficients[type] !== 'object') {
        // 如果系数不存在，创建一个默认对象
        defaultSettings.sameModelCoefficients[type] = { value: 0.5, name: name };
    } else {
        defaultSettings.sameModelCoefficients[type].name = name;
    }
}

// 更新折扣系数
function updateDiscountCoefficient(type, value) {
    if (!defaultSettings.discountCoefficients[type] || typeof defaultSettings.discountCoefficients[type] !== 'object') {
        defaultSettings.discountCoefficients[type] = { value: parseFloat(value) || 1, name: type };
    } else {
        defaultSettings.discountCoefficients[type].value = parseFloat(value) || 1;
    }
}

// 更新折扣系数名称
function updateDiscountCoefficientName(type, name) {
    if (!defaultSettings.discountCoefficients[type] || typeof defaultSettings.discountCoefficients[type] !== 'object') {
        // 如果系数不存在，创建一个默认对象
        defaultSettings.discountCoefficients[type] = { value: 1, name: name };
    } else {
        defaultSettings.discountCoefficients[type].name = name;
    }
}

// 更新平台手续费
function updatePlatformFee(type, value) {
    if (!defaultSettings.platformFees[type] || typeof defaultSettings.platformFees[type] !== 'object') {
        defaultSettings.platformFees[type] = { value: parseFloat(value) || 0, name: type };
    } else {
        defaultSettings.platformFees[type].value = parseFloat(value) || 0;
    }
}

// 更新平台手续费名称
function updatePlatformFeeName(type, name) {
    if (!defaultSettings.platformFees[type] || typeof defaultSettings.platformFees[type] !== 'object') {
        // 如果系数不存在，创建一个默认对象
        defaultSettings.platformFees[type] = { value: 0, name: name };
    } else {
        defaultSettings.platformFees[type].name = name;
    }
}

// 更新背景费
function updateBackgroundFee(value) {
    defaultSettings.backgroundFee = parseFloat(value) || 0;
}

// 添加其他费用
function addOtherFee() {
    const name = document.getElementById('newOtherFeeName').value.trim();
    const amount = parseFloat(document.getElementById('newOtherFeeAmount').value) || 0;
    
    if (!name) {
        alert('请输入费用名称！');
        return;
    }
    
    // 使用唯一 key，避免中文名生成相同 key（如 抠图费、修图费 都变成 ___）导致覆盖
    const key = 'fee_' + Date.now();
    
    // 添加到其他费用中
    defaultSettings.otherFees[key] = {
        name: name,
        amount: amount
    };
    
    // 清空输入框
    document.getElementById('newOtherFeeName').value = '';
    document.getElementById('newOtherFeeAmount').value = '';
    
    // 重新渲染其他费用列表
    renderOtherFees();
}

// 删除其他费用
function deleteOtherFee(key) {
    if (confirm('确定要删除这个费用类别吗？')) {
        delete defaultSettings.otherFees[key];
        renderOtherFees();
    }
}

// 更新其他费用
function updateOtherFee(key, field, value) {
    if (defaultSettings.otherFees[key]) {
        defaultSettings.otherFees[key][field] = field === 'amount' ? parseFloat(value) || 0 : value;
    }
}

// 渲染其他费用列表
function renderOtherFees() {
    const container = document.getElementById('otherFeesList');
    if (!container) return;
    
    let html = '';
    

    
    // 显示自定义其他费用选项
    html += `
        <div class="other-fee-item d-flex items-center gap-2 mb-2 mt-4 font-bold">
            <span class="flex-1">自定义其他费用</span>
        </div>
    `;
    
    // 显示用户添加的其他费用
    if (Object.keys(defaultSettings.otherFees).length === 0) {
        html += `
            <div class="other-fee-item d-flex items-center gap-2 mb-2 ml-4 text-gray">
                <span class="flex-1">暂无自定义其他费用，请在下方添加</span>
            </div>
        `;
    } else {
        for (const [key, fee] of Object.entries(defaultSettings.otherFees)) {
            html += `
                <div class="other-fee-item-row d-flex items-center gap-2 mb-2 ml-4">
                    <input type="text" value="${fee.name}" onchange="updateOtherFee('${key}', 'name', this.value)" class="other-fee-name-input" placeholder="费用名称">
                    <input type="number" value="${fee.amount}" onchange="updateOtherFee('${key}', 'amount', this.value)" min="0" step="1" class="other-fee-amount-input" placeholder="金额">
                    <button class="icon-action-btn delete other-fee-delete-btn" onclick="deleteOtherFee('${key}')" aria-label="删除费用类别" title="删除">
                        <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                    </button>
                </div>
            `;
        }
    }
    
    container.innerHTML = html;
}

// 更新美工信息
let mgArtistIdSyncTimer = null;
let mgArtistInfoBindingsInited = false;

function updateArtistInfo(field, value, options = {}) {
    const normalizedValue = (field === 'defaultDuration')
        ? (value === '' ? '' : (parseInt(value, 10) || 0))
        : String(value || '').trim();

    defaultSettings.artistInfo[field] = normalizedValue;

    // 及时持久化，避免切页后丢失
    if (typeof saveData === 'function') {
        saveData();
    }

    // 如果修改的是默认工期，重新计算截稿时间
    if (field === 'defaultDuration') {
        calculateDeadline();
    }

    // 如果修改的是美工ID：默认防抖同步，失焦时立即同步
    if (field === 'id') {
        if (options.immediate === true) {
            if (mgArtistIdSyncTimer) {
                clearTimeout(mgArtistIdSyncTimer);
                mgArtistIdSyncTimer = null;
            }
            mgSyncArtistDisplayNameToCloud(normalizedValue);
        } else {
            if (mgArtistIdSyncTimer) clearTimeout(mgArtistIdSyncTimer);
            mgArtistIdSyncTimer = setTimeout(function () {
                mgSyncArtistDisplayNameToCloud(normalizedValue);
            }, 500);
        }
    }
}

function mgInitArtistInfoBindings() {
    if (mgArtistInfoBindingsInited) return;

    const artistIdInput = document.getElementById('artistId');
    if (artistIdInput) {
        // 输入时本地保存 + 防抖云端同步
        artistIdInput.addEventListener('input', function (e) {
            updateArtistInfo('id', e.target.value);
        });
        // 失焦时立即同步一次，避免用户快速切页导致未发起请求
        artistIdInput.addEventListener('blur', function (e) {
            updateArtistInfo('id', e.target.value, { immediate: true });
        });
    }

    mgArtistInfoBindingsInited = true;
}

// 同步美工ID到云端（auth.user_metadata.display_name + artists.display_name）
let mgLastSyncedArtistDisplayName = null;
async function mgSyncArtistDisplayNameToCloud(displayName) {
    if (!mgIsCloudEnabled()) return;

    const client = mgGetSupabaseClient();
    if (!client) return;

    const normalizedDisplayName = String(displayName || '').trim();
    if (mgLastSyncedArtistDisplayName === normalizedDisplayName) return;

    const { data: { session } } = await client.auth.getSession();
    if (!session || !session.user) return;

    try {
        // 1) 优先同步到 Supabase Auth（对应 Authentication 里的 Display name）
        const { error: authErr } = await client.auth.updateUser({
            data: { display_name: normalizedDisplayName || null }
        });
        if (authErr) {
            console.error('同步 Auth display_name 失败:', authErr);
        }

        // 2) 同步到业务 artists 表（兼容现有查询/展示）
        const { error: artistErr } = await client
            .from('artists')
            .update({ display_name: normalizedDisplayName })
            .eq('id', session.user.id);

        if (artistErr) {
            console.error('同步 artists.display_name 失败:', artistErr);
            return;
        }

        mgLastSyncedArtistDisplayName = normalizedDisplayName;
        console.log('已同步美工显示名称到云端:', normalizedDisplayName);
    } catch (err) {
        console.error('同步美工显示名称异常:', err);
    }
}

// 更新定金比例（0~100 输入，内部存 0~1）
function updateDepositRate(value) {
    var n = parseFloat(value);
    if (!isNaN(n) && n >= 0 && n <= 100) {
        defaultSettings.depositRate = n / 100;
        saveData();
    }
}

function updateSettlementRule(category, field, value) {
    if (!defaultSettings.settlementRules) defaultSettings.settlementRules = { cancelFee: {}, wasteFee: {} };
    if (!defaultSettings.settlementRules[category]) defaultSettings.settlementRules[category] = {};
    var num = parseFloat(value);
    defaultSettings.settlementRules[category][field] = (field === 'defaultRate' || field === 'defaultFixedAmount' || field === 'defaultFixedPerItem') ? (isNaN(num) ? value : num) : value;
    saveData();
}

// 计算截稿时间
function calculateDeadline() {
    const startTime = document.getElementById('startTime');
    const deadline = document.getElementById('deadline');
    
    if (startTime && deadline) {
        const startDateValue = startTime.value;
        const defaultDuration = defaultSettings.artistInfo.defaultDuration;
        
        if (startDateValue && defaultDuration) {
            const startDate = new Date(startDateValue);
            // 计算截稿日期：开始时间 + 默认工期（天）
            const deadlineDate = new Date(startDate.getTime() + parseInt(defaultDuration) * 24 * 60 * 60 * 1000);
            
            // 格式化date字符串 (YYYY-MM-DD)
            const formattedDeadline = deadlineDate.toISOString().slice(0, 10);
            deadline.value = formattedDeadline;
        }
    }
}

// 动态其他费用列表
let dynamicOtherFees = [];

// 初始化其他费用类型选项
function initOtherFeeTypeOptions() {
    const select = document.getElementById('otherFeeType');
    if (!select) return;

    // 仅保留默认的“自定义”选项，避免重复追加导致下拉项重复
    while (select.options.length > 1) {
        select.remove(1);
    }

    // 添加其他费用类别选项
    for (const [key, fee] of Object.entries(defaultSettings.otherFees || {})) {
        const option = document.createElement('option');
        option.value = `other_${key}`;
        option.textContent = fee.name;
        select.appendChild(option);
    }
}

// 根据费用类型更新金额
function updateOtherFeeAmount() {
    const feeType = document.getElementById('otherFeeType').value;
    const feeAmountInput = document.getElementById('otherFeeAmount');
    const customFeeNameInput = document.getElementById('customOtherFeeName');
    
    switch(feeType) {
        case 'none':
            feeAmountInput.value = '';
            customFeeNameInput.value = '';
            customFeeNameInput.style.display = 'none';
            break;
        case 'custom':
            feeAmountInput.value = '';
            customFeeNameInput.style.display = 'block';
            break;
        default:
            // 其他费用类别
            if (feeType.startsWith('other_')) {
                const key = feeType.replace('other_', '');
                if (defaultSettings.otherFees[key]) {
                    feeAmountInput.value = defaultSettings.otherFees[key].amount;
                }
                customFeeNameInput.style.display = 'none';
                // 选择预设费用后自动加入列表，避免用户漏点“+其他费用”
                addDynamicOtherFee();
            }
            break;
    }
}

let otherFeeAutoBindingsInited = false;
function initOtherFeeAutoAddBindings() {
    if (otherFeeAutoBindingsInited) return;

    const typeEl = document.getElementById('otherFeeType');
    const nameEl = document.getElementById('customOtherFeeName');
    const amountEl = document.getElementById('otherFeeAmount');

    if (!typeEl || !nameEl || !amountEl) return;

    const tryAddCustomFee = function () {
        if (typeEl.value !== 'custom') return;
        const name = String(nameEl.value || '').trim();
        const amount = parseFloat(amountEl.value);
        if (!name || !Number.isFinite(amount) || amount <= 0) return;
        addDynamicOtherFee();
    };

    nameEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            tryAddCustomFee();
        }
    });
    amountEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            tryAddCustomFee();
        }
    });
    amountEl.addEventListener('blur', tryAddCustomFee);

    otherFeeAutoBindingsInited = true;
}

// 添加动态其他费用
function addDynamicOtherFee() {
    const feeType = document.getElementById('otherFeeType').value;
    const feeAmount = parseFloat(document.getElementById('otherFeeAmount').value);
    
    if (feeType === 'none' || isNaN(feeAmount) || feeAmount <= 0) {
        alert('请选择有效的费用类型并输入大于0的金额！');
        return;
    }
    
    let feeName = '';
    
    // 根据费用类型获取费用名称
    switch(feeType) {
        case 'custom':
            feeName = document.getElementById('customOtherFeeName').value.trim();
            if (!feeName) {
                alert('请输入自定义费用名称！');
                return;
            }
            break;
        default:
            // 其他费用类别
            if (feeType.startsWith('other_')) {
                const key = feeType.replace('other_', '');
                if (defaultSettings.otherFees[key]) {
                    feeName = defaultSettings.otherFees[key].name;
                }
            }
            break;
    }
    
    // 创建动态费用对象
    const dynamicFee = {
        id: Date.now(),
        type: feeType,
        name: feeName,
        amount: feeAmount
    };
    
    // 添加到动态费用列表
    dynamicOtherFees.push(dynamicFee);
    
    // 渲染动态费用列表
    renderDynamicOtherFees();
    
    // 重置输入框：添加后默认回到“自定义”
    document.getElementById('otherFeeType').value = 'custom';
    document.getElementById('otherFeeAmount').value = '';
    document.getElementById('customOtherFeeName').value = '';
    document.getElementById('customOtherFeeName').style.display = 'block';
}

// 移除动态其他费用
function removeDynamicOtherFee(id) {
    if (!confirm('确定要删除该其他费用项吗？')) return;
    dynamicOtherFees = dynamicOtherFees.filter(fee => fee.id !== id);
    renderDynamicOtherFees();
}

// 渲染动态其他费用列表
function renderDynamicOtherFees() {
    const container = document.getElementById('dynamicOtherFees');
    if (!container) return;
    
    let html = '';
    
    dynamicOtherFees.forEach(fee => {
        html += `
            <div style="display: flex !important; flex-direction: row !important; align-items: center !important; gap: 8px !important; flex-wrap: nowrap !important; padding: 8px !important; background-color: #f8fafc !important; border-radius: 4px !important; margin-bottom: 8px !important;">
                <span style="flex: 2 !important; text-align: left !important; min-width: 0 !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;">${fee.name}</span>
                <span style="width: 80px !important; text-align: right !important; flex-shrink: 0 !important;">¥${fee.amount}</span>
                <button class="icon-action-btn delete" onclick="removeDynamicOtherFee(${fee.id})" aria-label="删除其他费用" title="删除">
                    <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                </button>
            </div>
        `;
    });
    
    container.innerHTML = html;
}



// 从云端读取 display_name，回填到“我的-用户ID”（可选，不阻塞）
async function mgHydrateArtistIdFromCloud() {
    if (!mgIsCloudEnabled()) return;

    const client = mgGetSupabaseClient();
    if (!client) return;

    try {
        const { data: { user }, error } = await client.auth.getUser();
        if (error || !user) return;

        const cloudDisplayName = String((user.user_metadata && user.user_metadata.display_name) || '').trim();
        if (!cloudDisplayName) return;

        // 仅在本地未填写时用云端值回填，避免覆盖用户正在编辑的本地输入
        if (!defaultSettings.artistInfo.id || !String(defaultSettings.artistInfo.id).trim()) {
            defaultSettings.artistInfo.id = cloudDisplayName;
            mgLastSyncedArtistDisplayName = cloudDisplayName;

            const artistIdInput = document.getElementById('artistId');
            if (artistIdInput) artistIdInput.value = cloudDisplayName;

            if (typeof saveData === 'function') saveData();
        }
    } catch (err) {
        console.error('读取云端用户ID失败:', err);
    }
}

// 加载设置（基础信息 + 其他费用；系数由 renderCoefficientSettings 从 defaultSettings 渲染，无需在此回填）
function loadSettings() {
    document.getElementById('artistId').value = defaultSettings.artistInfo.id;
    document.getElementById('artistContact').value = defaultSettings.artistInfo.contact;
    const roleEl = document.getElementById('artistRole');
    if (roleEl) roleEl.value = defaultSettings.artistInfo.role || '美工';
    document.getElementById('defaultDuration').value = defaultSettings.artistInfo.defaultDuration;
    // 结算规则配置
    var sr = defaultSettings.settlementRules || {};
    var cf = sr.cancelFee || {};
    var wf = sr.wasteFee || {};
    var cancelFeeRuleEl = document.getElementById('cancelFeeRule');
    var cancelFeeRateEl = document.getElementById('cancelFeeRate');
    var cancelFeeFixedEl = document.getElementById('cancelFeeFixed');
    if (cancelFeeRuleEl) cancelFeeRuleEl.value = cf.defaultRule || 'percent';
    if (cancelFeeRateEl) cancelFeeRateEl.value = (cf.defaultRate != null ? cf.defaultRate * 100 : 10);
    if (cancelFeeFixedEl) cancelFeeFixedEl.value = cf.defaultFixedAmount != null ? cf.defaultFixedAmount : 50;
    var dr = defaultSettings.depositRate;
    var depositEl = document.getElementById('depositRate');
    if (depositEl) depositEl.value = (dr != null && !isNaN(dr)) ? Math.round(dr * 100) : 30;
    // 废稿费设置（新）
    var wasteRuleModeEl = document.getElementById('wasteRuleMode');
    var wasteRateDefaultEl = document.getElementById('wasteRateDefault');
    var wasteFixedPerItemDefaultEl = document.getElementById('wasteFixedPerItemDefault');
    var wasteMinAmountDefaultEl = document.getElementById('wasteMinAmountDefault');
    var wasteMaxAmountDefaultEl = document.getElementById('wasteMaxAmountDefault');
    var wasteMode = wf.mode || 'percent_total';
    if (wasteRuleModeEl) wasteRuleModeEl.value = wasteMode;
    if (wasteRateDefaultEl) wasteRateDefaultEl.value = (wf.defaultRate != null ? wf.defaultRate : 30);
    if (wasteFixedPerItemDefaultEl) wasteFixedPerItemDefaultEl.value = (wf.defaultFixedPerItem != null ? wf.defaultFixedPerItem : 20);
    var wasteFixedAmountDefaultEl = document.getElementById('wasteFixedAmountDefault');
    if (wasteFixedAmountDefaultEl) wasteFixedAmountDefaultEl.value = (wf.defaultFixedAmount != null ? wf.defaultFixedAmount : 50);
    if (wasteMinAmountDefaultEl) wasteMinAmountDefaultEl.value = (wf.minAmount != null ? wf.minAmount : '');
    if (wasteMaxAmountDefaultEl) wasteMaxAmountDefaultEl.value = (wf.maxAmount != null ? wf.maxAmount : '');
    updateWasteFeeDefaultVisibility(wasteMode);
    if (defaultSettings.orderRemark !== undefined) {
        var el = document.getElementById('orderRemarkText');
        if (el) el.value = defaultSettings.orderRemark;
    }
    updateOrderRemarkPreview();
    renderOtherFees();
    renderDiscountReasonsList();
}

// 根据废稿费模式显示对应默认值区域（选择哪个模式显示哪个模式默认值）
function updateWasteFeeDefaultVisibility(mode) {
    var rateWrap = document.getElementById('wasteRateDefaultWrap');
    var fixedPerItemWrap = document.getElementById('wasteFixedPerItemDefaultWrap');
    var fixedAmountWrap = document.getElementById('wasteFixedAmountDefaultWrap');
    if (rateWrap) rateWrap.classList.toggle('d-none', mode === 'fixed_per_item' || mode === 'fixed_amount');
    if (fixedPerItemWrap) fixedPerItemWrap.classList.toggle('d-none', mode !== 'fixed_per_item');
    if (fixedAmountWrap) fixedAmountWrap.classList.toggle('d-none', mode !== 'fixed_amount');
}

// 更新废稿费模式
function updateWasteRuleMode(value) {
    if (!defaultSettings.settlementRules) defaultSettings.settlementRules = { cancelFee: {}, wasteFee: {} };
    if (!defaultSettings.settlementRules.wasteFee) defaultSettings.settlementRules.wasteFee = {};
    defaultSettings.settlementRules.wasteFee.mode = value;
    updateWasteFeeDefaultVisibility(value);
    saveData();
}

// 更新废稿费默认比例（%）
function updateWasteRateDefault(value) {
    if (!defaultSettings.settlementRules) defaultSettings.settlementRules = { cancelFee: {}, wasteFee: {} };
    if (!defaultSettings.settlementRules.wasteFee) defaultSettings.settlementRules.wasteFee = {};
    var n = parseFloat(value);
    defaultSettings.settlementRules.wasteFee.defaultRate = (!isNaN(n) && n >= 0) ? n : 30;
    saveData();
}

// 更新废稿费默认按件金额（元）
function updateWasteFixedPerItemDefault(value) {
    if (!defaultSettings.settlementRules) defaultSettings.settlementRules = { cancelFee: {}, wasteFee: {} };
    if (!defaultSettings.settlementRules.wasteFee) defaultSettings.settlementRules.wasteFee = {};
    var n = parseFloat(value);
    defaultSettings.settlementRules.wasteFee.defaultFixedPerItem = (!isNaN(n) && n >= 0) ? n : 20;
    saveData();
}

// 更新废稿费保底金额（元）
function updateWasteMinAmountDefault(value) {
    if (!defaultSettings.settlementRules) defaultSettings.settlementRules = { cancelFee: {}, wasteFee: {} };
    if (!defaultSettings.settlementRules.wasteFee) defaultSettings.settlementRules.wasteFee = {};
    var n = parseFloat(value);
    defaultSettings.settlementRules.wasteFee.minAmount = (!isNaN(n) && n >= 0) ? n : null;
    saveData();
}

// 更新废稿费封顶金额（元）
function updateWasteMaxAmountDefault(value) {
    if (!defaultSettings.settlementRules) defaultSettings.settlementRules = { cancelFee: {}, wasteFee: {} };
    if (!defaultSettings.settlementRules.wasteFee) defaultSettings.settlementRules.wasteFee = {};
    var n = parseFloat(value);
    defaultSettings.settlementRules.wasteFee.maxAmount = (!isNaN(n) && n >= 0) ? n : null;
    saveData();
}

// 更新废稿费默认固定金额（元，用于「按固定金额」模式）
function updateWasteFixedAmountDefault(value) {
    if (!defaultSettings.settlementRules) defaultSettings.settlementRules = { cancelFee: {}, wasteFee: {} };
    if (!defaultSettings.settlementRules.wasteFee) defaultSettings.settlementRules.wasteFee = {};
    var n = parseFloat(value);
    defaultSettings.settlementRules.wasteFee.defaultFixedAmount = (!isNaN(n) && n >= 0) ? n : 50;
    saveData();
}

// ---------- 优惠原因（结算配置） ----------
function getDiscountReasons() {
    return (defaultSettings.settlementRules && defaultSettings.settlementRules.discountReasons) ? defaultSettings.settlementRules.discountReasons.slice() : [];
}

function renderDiscountReasonsList() {
    var container = document.getElementById('discountReasonsList');
    if (!container) return;
    var list = getDiscountReasons();
    var html = '';
    list.forEach(function (r) {
        html += '<div class="discount-reason-item">';
        html += '<span class="discount-reason-name">' + (r.name || '') + '</span>';
        html += '<button type="button" class="btn secondary btn-compact" onclick="openEditDiscountReasonModal(' + r.id + ')">编辑</button>';
        html += '<button type="button" class="icon-action-btn delete" onclick="deleteDiscountReason(' + r.id + ')" aria-label="删除" title="删除"><svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg><span class="sr-only">删除</span></button>';
        html += '</div>';
    });
    if (list.length === 0) {
        html = '<p class="text-gray" style="font-size:0.85rem;">暂无优惠原因，点击「添加」创建。</p>';
    }
    container.innerHTML = html;
}

function openAddDiscountReasonModal() {
    document.getElementById('addDiscountReasonModalTitle').textContent = '添加优惠原因';
    document.getElementById('editDiscountReasonId').value = '';
    document.getElementById('discountReasonName').value = '';
    document.getElementById('discountReasonPreferType').value = 'rate';
    document.getElementById('discountReasonDefaultAmount').value = '0';
    document.getElementById('discountReasonDefaultRate').value = '0.95';
    document.getElementById('addDiscountReasonModal').classList.remove('d-none');
}

function openEditDiscountReasonModal(id) {
    var list = getDiscountReasons();
    var r = list.find(function (x) { return x.id === id; });
    if (!r) return;
    document.getElementById('addDiscountReasonModalTitle').textContent = '编辑优惠原因';
    document.getElementById('editDiscountReasonId').value = r.id;
    document.getElementById('discountReasonName').value = r.name || '';
    document.getElementById('discountReasonPreferType').value = r.preferType || 'rate';
    document.getElementById('discountReasonDefaultAmount').value = (r.defaultAmount != null && r.defaultAmount !== '') ? r.defaultAmount : '0';
    document.getElementById('discountReasonDefaultRate').value = (r.defaultRate != null && r.defaultRate !== '') ? r.defaultRate : '0.99';
    document.getElementById('addDiscountReasonModal').classList.remove('d-none');
}

function closeAddDiscountReasonModal() {
    document.getElementById('addDiscountReasonModal').classList.add('d-none');
}

function saveDiscountReason() {
    var editId = document.getElementById('editDiscountReasonId').value;
    var name = (document.getElementById('discountReasonName').value || '').trim();
    if (!name) {
        alert('请输入优惠原因名称');
        return;
    }
    if (!defaultSettings.settlementRules) defaultSettings.settlementRules = { cancelFee: {}, wasteFee: {}, discountReasons: [] };
    if (!defaultSettings.settlementRules.discountReasons) defaultSettings.settlementRules.discountReasons = [];
    var list = defaultSettings.settlementRules.discountReasons;
    var preferType = (document.getElementById('discountReasonPreferType').value === 'amount') ? 'amount' : 'rate';
    var defaultAmount = parseFloat(document.getElementById('discountReasonDefaultAmount').value);
    var defaultRate = parseFloat(document.getElementById('discountReasonDefaultRate').value);
    if (isNaN(defaultAmount) || defaultAmount < 0) defaultAmount = 0;
    if (isNaN(defaultRate) || defaultRate < 0 || defaultRate > 0.99) defaultRate = 0.99;

    if (editId) {
        var idx = list.findIndex(function (x) { return String(x.id) === String(editId); });
        if (idx >= 0) {
            list[idx] = { id: list[idx].id, name: name, defaultAmount: defaultAmount, defaultRate: preferType === 'rate' ? defaultRate : null, preferType: preferType };
        }
    } else {
        var nextId = list.length ? Math.max.apply(null, list.map(function (x) { return x.id || 0; })) + 1 : 1;
        list.push({ id: nextId, name: name, defaultAmount: preferType === 'amount' ? defaultAmount : 0, defaultRate: preferType === 'rate' ? defaultRate : null, preferType: preferType });
    }
    saveData();
    renderDiscountReasonsList();
    closeAddDiscountReasonModal();
}

function deleteDiscountReason(id) {
    if (!confirm('确定要删除该优惠原因吗？')) return;
    if (!defaultSettings.settlementRules || !defaultSettings.settlementRules.discountReasons) return;
    var list = defaultSettings.settlementRules.discountReasons;
    var idx = list.findIndex(function (x) { return x.id === id; });
    if (idx >= 0) {
        list.splice(idx, 1);
        saveData();
        renderDiscountReasonsList();
    }
}

// 订单备注弹窗：打开
function openOrderRemarkModal(recordId) {
    var el = document.getElementById('orderRemarkText');
    var modal = document.getElementById('orderRemarkModal');
    var smartExtractBtn = document.getElementById('smartExtractBtn');
    var smartExtractHint = document.querySelector('.order-remark-hint');
    
    // 设置当前记录ID
    currentRemarkRecordId = recordId || null;
    
    if (recordId) {
        // 从记录页打开，隐藏智能提取
        var item = history.find(function (h) { return h.id === recordId; });
        if (el) el.value = (item && item.orderRemark != null) ? String(item.orderRemark) : '';
        if (smartExtractBtn) smartExtractBtn.classList.add('d-none');
        if (smartExtractHint) smartExtractHint.classList.add('d-none');
    } else {
        // 从计算页打开，显示智能提取
        if (el) el.value = (defaultSettings.orderRemark != null) ? String(defaultSettings.orderRemark) : '';
        if (smartExtractBtn) smartExtractBtn.classList.remove('d-none');
        if (smartExtractHint) smartExtractHint.classList.remove('d-none');
    }
    
    if (modal) modal.classList.remove('d-none');
}

// 订单备注弹窗：关闭并保存
var currentRemarkRecordId = null;

function closeOrderRemarkModal() {
    var el = document.getElementById('orderRemarkText');
    var modal = document.getElementById('orderRemarkModal');
    
    if (el) {
        if (currentRemarkRecordId) {
            // 保存到记录
            var item = history.find(function (h) { return h.id === currentRemarkRecordId; });
            if (item) {
                item.orderRemark = el.value;
            }
            currentRemarkRecordId = null;
        } else {
            // 保存到默认设置
            defaultSettings.orderRemark = el.value;
            updateOrderRemarkPreview();
        }
    }
    
    if (modal) modal.classList.add('d-none');
    saveData();
}

// 订单备注查看弹窗：打开（只读，查看某条记录的备注）
function openOrderRemarkViewModal(recordId) {
    var item = history.find(function (h) { return h.id === recordId; });
    var contentEl = document.getElementById('orderRemarkViewContent');
    var modal = document.getElementById('orderRemarkViewModal');
    if (!contentEl || !modal) return;
    var remark = (item && item.orderRemark != null) ? String(item.orderRemark) : '';
    contentEl.textContent = remark.trim() || '暂无备注';
    contentEl.style.whiteSpace = 'pre-wrap';
    modal.classList.remove('d-none');
}

// 订单备注查看弹窗：关闭
function closeOrderRemarkViewModal() {
    var modal = document.getElementById('orderRemarkViewModal');
    if (modal) modal.classList.add('d-none');
}

// 更新订单备注预览
function updateOrderRemarkPreview() {
    var preview = document.getElementById('orderRemarkPreview');
    if (!preview) return;
    var remark = defaultSettings.orderRemark || '';
    if (remark.trim()) {
        // 显示前50个字符作为预览
        var previewText = remark.length > 50 ? remark.substring(0, 50) + '...' : remark;
        preview.value = previewText;
    } else {
        preview.value = '';
        preview.placeholder = '点击上方标签添加备注';
    }
}

// 智能解析订单备注：能提取什么提取什么，支持多种顺序和写法
function smartParseOrderRemark() {
    var el = document.getElementById('orderRemarkText');
    if (!el) return;
    
    var text = el.value.trim();
    if (!text) {
        showGlobalToast('请先输入备注');
        return;
    }
    
    // 清空现有制品和赠品容器
    var productsContainer = document.getElementById('productsContainer');
    var giftsContainer = document.getElementById('giftsContainer');
    if (productsContainer) productsContainer.innerHTML = '';
    if (giftsContainer) giftsContainer.innerHTML = '';
    
    // 清空数组
    products = [];
    gifts = [];
    productIdCounter = 0;
    giftIdCounter = 0;
    
    var lines = text.split('\n');
    var isGiftSection = false;
    var parsedProductCount = 0;
    var parsedGiftCount = 0;
    
    // 从一行中解析出一项：先尝试多种固定格式，再尝试“行内含类型名+数字”
    function parseOneLine(ln) {
        var typeName = null;
        var sides = 'single';
        var quantity = 1;
        var hasBackground = false;
        var matchedSetting = null;
        // 中文数字
        var cnNum = ln.match(/([一二两三四五六七八九十百千\d]+)\s*个?\s*张?/);
        var numFromCn = cnNum ? (function(n) {
            var map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };
            if (/^\d+$/.test(n)) return parseInt(n, 10);
            if (n === '两') return 2;
            for (var k in map) { if (n === k) return map[k]; }
            return null;
        })(cnNum[1].replace(/个|张/g, '').trim()) : null;
        var numMatch = ln.match(/\d+/);
        var num = numMatch ? parseInt(numMatch[0], 10) : (numFromCn || 1);
        if (num > 0) quantity = num;
        if (/双面/.test(ln)) sides = 'double';
        if (/带背景/.test(ln)) hasBackground = true;
        // 格式1：类型 单面/双面? 数字 个/张? 带背景?
        var m1 = ln.match(/^([^\s\d]+?)\s*(单面|双面)?\s*(\d+)\s*(个|张)?\s*(带背景)?/i);
        if (m1) {
            typeName = m1[1];
            if (m1[2]) sides = m1[2] === '双面' ? 'double' : 'single';
            quantity = parseInt(m1[3], 10) || quantity;
            hasBackground = !!m1[5];
        }
        // 格式2：数字 个/张? 类型 单面/双面? 带背景?
        if (!typeName) {
            var m2 = ln.match(/^(\d+)\s*(个|张)?\s+([^\s\d]+?)(?:\s*(单面|双面))?(?:\s*(带背景))?/i);
            if (m2) {
                typeName = m2[3];
                quantity = parseInt(m2[1], 10) || quantity;
                if (m2[4]) sides = m2[4] === '双面' ? 'double' : 'single';
                hasBackground = !!m2[5];
            }
        }
        // 格式3：类型 数字 或 类型 中文数 个
        if (!typeName) {
            var m3 = ln.match(/^([^\s\d]+?)\s*(\d+)\s*(个|张)?/);
            if (m3) {
                typeName = m3[1];
                quantity = parseInt(m3[2], 10) || quantity;
            }
        }
        if (!typeName && cnNum) {
            var m3b = ln.match(/^([^\s\d一二三四五六七八九十两]+?)\s*[一二三四五六七八九十两]+\s*个?/);
            if (m3b) {
                typeName = m3b[1];
                if (numFromCn) quantity = numFromCn;
            }
        }
        // 格式4：行内任意位置含“类型名+数字”，用设置名去匹配（按名称长度从长到短，优先长匹配）
        if (!typeName && productSettings.length) {
            var sorted = productSettings.slice().sort(function(a, b) { return (b.name.length - a.name.length); });
            for (var si = 0; si < sorted.length; si++) {
                var s = sorted[si];
                if (ln.indexOf(s.name) !== -1) {
                    typeName = s.name;
                    matchedSetting = s;
                    break;
                }
            }
        }
        // 格式4b：备注里写简称（如“吧唧”）能匹配到设置里包含该词的制品名（如“普通吧唧”），优先长词匹配
        if (!matchedSetting && productSettings.length) {
            var hanParts = ln.match(/[\u4e00-\u9fff]{2,}/g) || [];
            var tokens = ln.split(/\s+/).filter(function(t) { return t.length >= 2 && !/^\d+$/.test(t); });
            var candidates = [];
            hanParts.forEach(function(p) { if (candidates.indexOf(p) === -1) candidates.push(p); });
            tokens.forEach(function(t) { if (candidates.indexOf(t) === -1) candidates.push(t); });
            candidates.sort(function(a, b) { return b.length - a.length; });
            for (var ci = 0; ci < candidates.length; ci++) {
                var cand = candidates[ci];
                var found = productSettings.find(function(s) { return s.name.indexOf(cand) !== -1; });
                if (found) { matchedSetting = found; typeName = cand; break; }
            }
        }
        if (typeName && !matchedSetting) {
            matchedSetting = productSettings.find(function(s) {
                return s.name === typeName || s.name.includes(typeName) || typeName.includes(s.name);
            });
        }
        if (!matchedSetting) return null;
        return { typeId: matchedSetting.id.toString(), sides: sides, quantity: quantity, hasBackground: hasBackground };
    }
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        
        // 检测是否进入赠品区域
        if (line.match(/^赠品[：:]/i)) {
            isGiftSection = true;
            line = line.replace(/^赠品[：:]/i, '').trim();
            if (!line) continue;
        }
        
        var parsed = parseOneLine(line);
        if (parsed) {
            if (isGiftSection) {
                giftIdCounter++;
                var gift = { id: giftIdCounter, type: parsed.typeId, quantity: parsed.quantity };
                gifts.push(gift);
                renderGift(gift);
                parsedGiftCount++;
            } else {
                productIdCounter++;
                var product = {
                    id: productIdCounter,
                    type: parsed.typeId,
                    sides: parsed.sides,
                    quantity: parsed.quantity,
                    sameModel: true,
                    hasBackground: parsed.hasBackground,
                    processes: {}
                };
                products.push(product);
                renderProduct(product);
                parsedProductCount++;
            }
        }
    }
    
    // 重新计算并刷新报价显示（不关闭抽屉、不打开小票）
    if (typeof calculatePrice === 'function') {
        calculatePrice(undefined, undefined, undefined, true);
    }
    
    // 智能提取后提示：制品/赠品分别统计
    if (parsedProductCount > 0 || parsedGiftCount > 0) {
        var parts = [];
        if (parsedProductCount > 0) parts.push('制品 ' + parsedProductCount + ' 项');
        if (parsedGiftCount > 0) parts.push('赠品 ' + parsedGiftCount + ' 项');
        showGlobalToast('已识别 ' + parts.join('、'));
    } else {
        showGlobalToast('未识别到有效内容');
    }
}

// 订单备注：复制到剪贴板
function copyOrderRemark() {
    var el = document.getElementById('orderRemarkText');
    var text = el ? el.value : '';
    if (typeof navigator.clipboard !== 'undefined' && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
            if (typeof showGlobalToast === 'function') showGlobalToast('已复制到剪贴板');
            else alert('已复制到剪贴板');
        }).catch(function () { alert('复制失败'); });
    } else {
        try {
            el.select();
            document.execCommand('copy');
            if (typeof showGlobalToast === 'function') showGlobalToast('已复制到剪贴板');
            else alert('已复制到剪贴板');
        } catch (e) { alert('复制失败'); }
    }
}

// 保存设置
function saveSettings() {
    saveData();
    
    // 所有模式下设置都会自动同步（通过 doSaveData 中的延迟同步）
    // 合并模式下设置会智能合并后再同步
    
    if (typeof showGlobalToast === 'function') showGlobalToast('已保存');
    else alert('设置已保存！');
}

// 管理递增配置项
let additionalConfigsList = [];

// 管理按节点收费的节点列表（添加制品弹窗用）
let nodesList = [];
let nodeIdCounter = 0;

function addNewProductNode() {
    nodeIdCounter++;
    nodesList.push({ id: nodeIdCounter, name: '', percent: 0 });
    renderNewProductNodes();
}

function removeNewProductNode(nodeId) {
    if (!confirm('确定要删除该节点吗？')) return;
    nodesList = nodesList.filter(n => n.id !== nodeId);
    renderNewProductNodes();
}

function updateNewProductNode(nodeId, field, value) {
    const node = nodesList.find(n => n.id === nodeId);
    if (node) {
        if (field === 'percent') {
            node.percent = parseFloat(value) || 0;
        } else {
            node[field] = value;
        }
    }
    renderNewProductNodes();
}

function renderNewProductNodes() {
    const container = document.getElementById('newProductNodesContainer');
    const sumHint = document.getElementById('newProductNodesSumHint');
    if (!container) return;
    let html = '';
    nodesList.forEach((node) => {
        html += `
            <div class="d-flex gap-2 mb-2 items-center p-2 bg-light rounded node-row">
                <input type="text" placeholder="节点名称" value="${(node.name || '').replace(/"/g, '&quot;')}" 
                       onchange="updateNewProductNode(${node.id}, 'name', this.value)" 
                       class="flex-1 p-2">
                <input type="number" placeholder="比例%" value="${node.percent}" min="0" max="100" step="1"
                       onchange="updateNewProductNode(${node.id}, 'percent', this.value)" 
                       class="w-100 p-2" style="width: 80px;">
                <button type="button" class="icon-action-btn delete" onclick="removeNewProductNode(${node.id})" aria-label="删除节点" title="删除">
                    <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                    <span class="sr-only">删除</span>
                </button>
            </div>
        `;
    });
    if (nodesList.length === 0) {
        html = '<p class="text-gray text-sm">暂无节点，点击「添加节点」按钮添加，比例之和须为 100%</p>';
    }
    container.innerHTML = html;
    const sum = nodesList.reduce((s, n) => s + (parseFloat(n.percent) || 0), 0);
    if (sumHint) {
        sumHint.textContent = nodesList.length ? `比例之和：${sum}%${sum !== 100 ? '（请调整为 100%）' : ''}` : '';
    }
}

function addAdditionalConfig() {
    const container = document.getElementById('additionalConfigsContainer');
    const configId = Date.now();
    additionalConfigsList.push({ id: configId, name: '', price: 0, unit: '' });
    renderAdditionalConfigs();
}

function removeAdditionalConfig(configId) {
    if (!confirm('确定要删除该附加配置项吗？')) return;
    additionalConfigsList = additionalConfigsList.filter(c => c.id !== configId);
    renderAdditionalConfigs();
}

function updateAdditionalConfig(configId, field, value) {
    const config = additionalConfigsList.find(c => c.id === configId);
    if (config) {
        if (field === 'price') {
            config[field] = parseFloat(value) || 0;
        } else {
            config[field] = value;
        }
    }
}

function renderAdditionalConfigs() {
    const container = document.getElementById('additionalConfigsContainer');
    if (!container) return;
    
    let html = '';
    additionalConfigsList.forEach((config, index) => {
        html += `
            <div class="d-flex gap-2 mb-2 items-center p-2 bg-light rounded">
                <input type="text" placeholder="配置名称" value="${config.name}" 
                       onchange="updateAdditionalConfig(${config.id}, 'name', this.value)" 
                       class="flex-1 p-2">
                <input type="number" placeholder="价格" value="${config.price}" min="0" step="1"
                       onchange="updateAdditionalConfig(${config.id}, 'price', this.value)" 
                       class="w-100 p-2">
                <input type="text" placeholder="单位" value="${config.unit}" 
                       onchange="updateAdditionalConfig(${config.id}, 'unit', this.value)" 
                       class="w-80 p-2">
                <button type="button" class="icon-action-btn delete" onclick="removeAdditionalConfig(${config.id})" aria-label="删除配置项" title="删除">
                    <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                </button>
            </div>
        `;
    });
    
    if (additionalConfigsList.length === 0) {
        html = '<p class="text-gray text-sm">暂无配置项，点击"添加配置项"按钮添加</p>';
    }
    
    container.innerHTML = html;
    
    // 更新工艺选项，确保赠品工艺可以设置层数
    if (typeof giftId !== 'undefined') {
        updateProcessOptions(giftId, true);
    }
}

// 打开添制品弹窗
function openAddProductModal() {
    // 清空表单
    document.getElementById('newProductName').value = '';
    document.getElementById('newProductPriceType').value = 'fixed';
    document.getElementById('newProductPrice').value = '';
    document.getElementById('newProductPriceSingle').value = '';
    document.getElementById('newProductPriceDouble').value = '';
    document.getElementById('newProductBaseConfig').value = '';
    document.getElementById('newProductBasePrice').value = '';
    const nodePriceInput = document.getElementById('newProductNodePrice');
    if (nodePriceInput) nodePriceInput.value = '';
    additionalConfigsList = [];
    nodesList = [];
    
    // 显示固定价设置，隐藏其他设置
    showPriceSettings('fixed');
    renderNewProductNodes();
    
    // 生成分类选项
    generateCategoryOptions();
    
    // 显示弹窗
    document.getElementById('addProductModal').classList.remove('d-none');
    
    // 添加计价方式变化事件监听
    document.getElementById('newProductPriceType').addEventListener('change', function() {
        showPriceSettings(this.value);
        if (this.value === 'config') {
            // 对于基础+递增价类型，确保至少有一个配置项
            if (additionalConfigsList.length === 0) {
                addAdditionalConfig(); // 添加一个初始配置项
            }
            renderAdditionalConfigs();
        } else if (this.value === 'nodes') {
            if (nodesList.length === 0) {
                nodeIdCounter++;
                nodesList.push({ id: nodeIdCounter, name: '草稿', percent: 30 });
                nodeIdCounter++;
                nodesList.push({ id: nodeIdCounter, name: '色稿', percent: 40 });
                nodeIdCounter++;
                nodesList.push({ id: nodeIdCounter, name: '成图', percent: 30 });
            }
            renderNewProductNodes();
        }
    });
}

// 生成分类建议选项
function generateCategoryOptions() {
    // 获取所有唯一分类
    const categories = new Set();
    productSettings.forEach(setting => {
        categories.add(setting.category);
    });
    
    // 添加默认分类
    DEFAULT_CATEGORIES.forEach(category => {
        categories.add(category);
    });
    
    // 创建选项数组
    const categoryOptions = Array.from(categories).sort();
    
    // 初始化自定义搜索下拉组件
    createSearchableSelect(
        'newProductCategorySelect',
        categoryOptions,
        '输入新增分类 / 选择已有',
        function(value, label) {
            // 分类选择回调（可选）
        },
        ''
    );
}

// 关闭添制品弹窗
function closeAddProductModal() {
    document.getElementById('addProductModal').classList.add('d-none');
}

// 显示对应的价格设置
function showPriceSettings(priceType) {
    // 隐藏所有价格设置
    document.getElementById('fixedPriceSettings').classList.add('d-none');
    document.getElementById('doublePriceSettings').classList.add('d-none');
    document.getElementById('configPriceSettings').classList.add('d-none');
    const nodePriceEl = document.getElementById('nodePriceSettings');
    if (nodePriceEl) nodePriceEl.classList.add('d-none');
    
    // 显示选中的价格设置
    switch(priceType) {
        case 'fixed':
            document.getElementById('fixedPriceSettings').classList.remove('d-none');
            break;
        case 'double':
            document.getElementById('doublePriceSettings').classList.remove('d-none');
            break;
        case 'config':
            document.getElementById('configPriceSettings').classList.remove('d-none');
            break;
        case 'nodes':
            if (nodePriceEl) nodePriceEl.classList.remove('d-none');
            break;
    }
}

// 保存新制品
function saveNewProduct() {
    // 获取表单数据
    const category = (getSearchableSelectValue('newProductCategorySelect') || '').trim() || DEFAULT_CATEGORIES[0];
    const name = document.getElementById('newProductName').value.trim();
    const priceType = document.getElementById('newProductPriceType').value;
    
    // 验证必填项
    if (!name) {
        alert('请输入制品名称！');
        return;
    }
    
    // 创建新制品对象
    const newProduct = {
        id: Date.now(),
        name: name,
        category: category,
        priceType: priceType,
        price: 0,
        priceSingle: 0,
        priceDouble: 0,
        basePrice: 0,
        baseConfig: ''
    };
    
    // 根据价格类型设置相应的价格
    switch(priceType) {
        case 'fixed':
            newProduct.price = parseFloat(document.getElementById('newProductPrice').value) || 0;
            break;
        case 'double':
            newProduct.priceSingle = parseFloat(document.getElementById('newProductPriceSingle').value) || 0;
            newProduct.priceDouble = parseFloat(document.getElementById('newProductPriceDouble').value) || 0;
            break;
        case 'config':
            newProduct.baseConfig = document.getElementById('newProductBaseConfig').value.trim();
            newProduct.basePrice = parseFloat(document.getElementById('newProductBasePrice').value) || 0;
            // 保存多个配置项
            if (additionalConfigsList.length > 0) {
                newProduct.additionalConfigs = additionalConfigsList.map(c => ({
                    name: c.name,
                    price: c.price,
                    unit: c.unit
                }));
            } else {
                // 兼容旧格式：如果没有配置项，使用旧的单配置格式
                newProduct.additionalConfigs = [];
            }
            break;
        case 'nodes':
            newProduct.price = parseFloat(document.getElementById('newProductNodePrice').value) || 0;
            if (nodesList.length === 0) {
                alert('请至少添加一个节点，且比例之和须为 100%！');
                return;
            }
            const nodesSum = nodesList.reduce((s, n) => s + (parseFloat(n.percent) || 0), 0);
            if (Math.abs(nodesSum - 100) > 0.01) {
                alert('节点比例之和须为 100%，当前为 ' + nodesSum + '%！');
                return;
            }
            newProduct.nodes = nodesList.map(n => ({ name: String(n.name || '').trim() || '节点', percent: parseFloat(n.percent) || 0 }));
            break;
    }
    
    // 添加到制品列表
    productSettings.push(newProduct);
    
    // 重新渲染制品设置
    renderProductSettings();
    
    // 关闭弹窗
    closeAddProductModal();
    
    // 提示成功
    alert('制品设置已添加！');
}

// 渲染制品设置
function renderProductSettings() {
    const container = document.getElementById('productSettingsContainer');
    
    // 保存当前展开的分类状态
    const currentlyExpanded = new Set();
    const existingCategoryContainers = document.querySelectorAll('.category-container');
    existingCategoryContainers.forEach(categoryContainer => {
        const content = categoryContainer.querySelector('.category-content');
        const toggle = categoryContainer.querySelector('.category-toggle');
        if (content && !content.classList.contains('d-none') && toggle && toggle.textContent === '▲') {
            // 获取类别名称，直接从标题文本获取，这在当前结构下是可靠的
            const categoryTitle = categoryContainer.querySelector('.category-title');
            if (categoryTitle) {
                currentlyExpanded.add(categoryTitle.textContent);
            }
        }
    });
    
    // 更新全局expandedCategories状态
    expandedCategories.clear();
    currentlyExpanded.forEach(category => {
        expandedCategories.add(category);
    });
    
    // 按类别分组
    const categories = {};
    
    // 将制品按类别分组
    productSettings.forEach(setting => {
        const category = setting.category || DEFAULT_CATEGORIES[0];
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push(setting);
    });
    
    // 将默认分类添加到categories对象中（如果它们不存在）
    DEFAULT_CATEGORIES.forEach(category => {
        if (!categories[category]) {
            categories[category] = [];
        }
    });
    
    // 确保默认分类排在前面
    const sortedCategories = {};
    DEFAULT_CATEGORIES.forEach(category => {
        if (categories[category]) {
            sortedCategories[category] = categories[category];
            delete categories[category];
        }
    });
    
    // 添加剩余分类
    Object.keys(categories).forEach(category => {
        sortedCategories[category] = categories[category];
    });
    
    // 使用排序后的分类
    const categoryKeys = Object.keys(sortedCategories);
    
    let html = '';
    
    // 渲染每个类别
    categoryKeys.forEach(category => {
        const categorySettings = sortedCategories[category];
        if (categorySettings.length === 0) return;
        
        // 检查当前分类是否应该展开
        const isExpanded = currentlyExpanded.has(category);
        const toggleText = isExpanded ? '▲' : '▼';
        const contentClass = isExpanded ? '' : 'd-none';
        
        const escapedCategory = (category || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        html += `
            <div class="category-container">
                <div class="category-header" onclick="toggleCategory('${category.replace(/'/g, "\\'")}')">
                    <div class="category-title">${category}</div>
                    <div class="category-count">(${categorySettings.length}个)</div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <button type="button" class="icon-action-btn delete" data-category="${escapedCategory}" onclick="event.stopPropagation();deleteProductCategory(this.getAttribute('data-category'))" aria-label="删除分类" title="删除分类">
                            <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                            <span class="sr-only">删除分类</span>
                        </button>
                        <div class="category-toggle">${toggleText}</div>
                    </div>
                </div>
                <div class="category-content ${contentClass}" id="${category}-content">
        `;
        
        // 渲染该类别的所有制品设置
        categorySettings.forEach(setting => {
            html += `
                <div class="product-item" data-id="${setting.id}">
                    <div class="product-item-header">
                        <div class="product-item-title">${setting.name}</div>
                        <div class="product-item-actions">
                            <button class="icon-action-btn delete" onclick="deleteProductSetting(${setting.id})" aria-label="删除制品设置" title="删除">
                                <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                            </button>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>制品名称</label>
                            <input type="text" value="${setting.name}" onchange="updateProductSetting(${setting.id}, 'name', this.value)" placeholder="请输入制品名称">
                        </div>
                        <div class="form-group">
                            <label>计价方式</label>
                            <select onchange="updateProductSetting(${setting.id}, 'priceType', this.value)">
                                <option value="fixed" ${setting.priceType === 'fixed' ? 'selected' : ''}>固定价</option>
                                <option value="double" ${setting.priceType === 'double' ? 'selected' : ''}>单双面价</option>
                                <option value="config" ${setting.priceType === 'config' ? 'selected' : ''}>基础+递增价</option>
                                <option value="nodes" ${setting.priceType === 'nodes' ? 'selected' : ''}>按节点收费</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- 固定价设置 -->
                    ${setting.priceType === 'fixed' ? `
                        <div class="form-row">
                            <div class="form-group">
                                <label>固定价格</label>
                                <input type="number" value="${setting.price || 0}" onchange="updateProductSetting(${setting.id}, 'price', parseFloat(this.value))" placeholder="请输入固定价格" min="0" step="1">
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- 单双面价设置 -->
                    ${setting.priceType === 'double' ? `
                        <div class="form-row">
                            <div class="form-group">
                                <label>单面价格</label>
                                <input type="number" value="${setting.priceSingle || 0}" onchange="updateProductSetting(${setting.id}, 'priceSingle', parseFloat(this.value))" placeholder="请输入单面价格" min="0" step="1">
                            </div>
                            <div class="form-group">
                                <label>双面价格</label>
                                <input type="number" value="${setting.priceDouble || 0}" onchange="updateProductSetting(${setting.id}, 'priceDouble', parseFloat(this.value))" placeholder="请输入双面价格" min="0" step="1">
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- 基础+递增价设置 -->
                    ${setting.priceType === 'config' ? `
                        <div class="form-row">
                            <div class="form-group">
                                <label>基础配置</label>
                                <input type="text" value="${setting.baseConfig || ''}" onchange="updateProductSetting(${setting.id}, 'baseConfig', this.value)" placeholder="例如：立牌+底座">
                            </div>
                            <div class="form-group">
                                <label>基础价</label>
                                <input type="number" value="${setting.basePrice || 0}" onchange="updateProductSetting(${setting.id}, 'basePrice', parseFloat(this.value))" placeholder="请输入基础价" min="0" step="1">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>递增配置项</label>
                                <div id="additionalConfigsContainer-${setting.id}">
                                    ${(setting.additionalConfigs || []).map((config, index) => `
                                        <div class="d-flex gap-2 mb-2 items-center p-2 bg-light rounded">
                                            <input type="text" placeholder="配置名称" value="${config.name || ''}" 
                                                   onchange="updateProductAdditionalConfigSetting(${setting.id}, ${index}, 'name', this.value)" 
                                                   class="flex-1 p-2">
                                            <input type="number" placeholder="价格" value="${config.price || 0}" min="0" step="1"
                                                   onchange="updateProductAdditionalConfigSetting(${setting.id}, ${index}, 'price', this.value)" 
                                                   class="w-100 p-2">
                                            <input type="text" placeholder="单位" value="${config.unit || ''}" 
                                                   onchange="updateProductAdditionalConfigSetting(${setting.id}, ${index}, 'unit', this.value)" 
                                                   class="w-80 p-2">
                                            <button type="button" class="icon-action-btn delete" onclick="removeProductAdditionalConfigSetting(${setting.id}, ${index})" aria-label="删除配置项" title="删除">
                                                <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                                            </button>
                                        </div>
                                    `).join('')}
                                    ${setting.additionalConfigs && setting.additionalConfigs.length > 0 ? '' : '<p class="text-gray text-sm">暂无配置项，点击下方按钮添加</p>'}
                                </div>
                                <button type="button" class="btn secondary small mt-2" onclick="addProductAdditionalConfigSetting(${setting.id})">添加配置项</button>
                            </div>
                        </div>
                    ` : ''}
                    <!-- 按节点收费设置 -->
                    ${setting.priceType === 'nodes' ? `
                        <div class="form-row">
                            <div class="form-group">
                                <label>默认总价（元）</label>
                                <input type="number" value="${setting.price || 0}" onchange="updateProductSetting(${setting.id}, 'price', parseFloat(this.value))" placeholder="例如：300" min="0" step="1">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group flex-1">
                                <label>节点列表（比例之和须为 100%）</label>
                                <div id="productNodesContainer-${setting.id}">
                                    ${(setting.nodes || []).map((node, index) => `
                                        <div class="d-flex gap-2 mb-2 items-center p-2 bg-light rounded node-row">
                                            <input type="text" placeholder="节点名称" value="${(node.name || '').replace(/"/g, '&quot;')}" 
                                                   onchange="updateProductNodeSetting(${setting.id}, ${index}, 'name', this.value)" 
                                                   class="flex-1 p-2">
                                            <input type="number" placeholder="比例%" value="${node.percent || 0}" min="0" max="100" step="1"
                                                   onchange="updateProductNodeSetting(${setting.id}, ${index}, 'percent', parseFloat(this.value))" 
                                                   class="w-100 p-2" style="width: 80px;">
                                            <button type="button" class="icon-action-btn delete" onclick="removeProductNodeSetting(${setting.id}, ${index})" aria-label="删除节点" title="删除">
                                                <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                                <span class="sr-only">删除</span>
                                            </button>
                                        </div>
                                    `).join('')}
                                    ${setting.nodes && setting.nodes.length > 0 ? '' : '<p class="text-gray text-sm">暂无节点，点击下方按钮添加</p>'}
                                </div>
                                <button type="button" class="btn secondary small mt-2" onclick="addProductNodeSetting(${setting.id})">添加节点</button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// 切换系数大组折叠状态（加价类、折扣类、其他类）
function toggleCategoryGroup(groupId) {
    const content = document.getElementById(groupId + '-content');
    const toggle = document.getElementById(groupId + '-toggle');
    if (!content || !toggle) return;
    if (content.classList.contains('d-none')) {
        content.classList.remove('d-none');
        toggle.textContent = '▲';
    } else {
        content.classList.add('d-none');
        toggle.textContent = '▼';
    }
}

// 切换类别折叠状态
function toggleCategory(category) {
    const content = document.getElementById(`${category}-content`);
    const toggle = content.parentElement.querySelector('.category-toggle');
    const header = content.parentElement.querySelector('.category-header');
    
    // 使用 d-none 类控制显示/隐藏，而不是内联样式
    if (content.classList.contains('d-none')) {
        // 展开分类
        content.classList.remove('d-none');
        toggle.textContent = '▲';
        
        // 为当前展开的标题添加粘性定位
        header.classList.add('sticky-header');
        
        // 移除其他所有分类的粘性定位
        document.querySelectorAll('.category-header').forEach(h => {
            if (h !== header) {
                h.classList.remove('sticky-header');
            }
        });
    } else {
        // 折叠分类
        content.classList.add('d-none');
        toggle.textContent = '▼';
        
        // 移除粘性定位
        header.classList.remove('sticky-header');
    }
}

// 打开添加系数弹窗（仅支持加价类、折扣类）
function openAddCoefficientModal() {
    document.getElementById('coefficientCategory').value = 'pricingUp';
    updateCoefficientSubType();
    const container = document.getElementById('coefficientItemsContainer');
    if (container) {
        container.innerHTML = '';
        addCoefficientItem();
    }
    document.getElementById('addCoefficientModal').classList.remove('d-none');
}

// 添加一条系数值项（名称 | 系数值 | 删除，默认 无、1）
function addCoefficientItem() {
    const container = document.getElementById('coefficientItemsContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'coefficient-item-row d-flex gap-2 mb-2 items-center';
    div.innerHTML = '<input type="text" placeholder="名称" class="flex-1" value="无"><input type="number" placeholder="系数值" class="w-80" value="1" min="0" step="0.1"><button type="button" class="icon-action-btn delete" onclick="removeCoefficientItem(this)" aria-label="删除" title="删除"><svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg><span class="sr-only">删除</span></button>';
    container.appendChild(div);
}

// 删除一条系数值项
function removeCoefficientItem(btn) {
    if (!confirm('确定要删除该系数项吗？')) return;
    const row = btn && btn.closest ? btn.closest('.coefficient-item-row') : (btn && btn.parentElement);
    if (row && row.parentElement) row.parentElement.removeChild(row);
}

// 系数大类切换时（可清空系数小类等）
function updateCoefficientSubType() {
    const catEl = document.getElementById('coefficientCategory');
    const hintEl = document.getElementById('coefficientTypeHint');
    if (!catEl) return;
    const cat = catEl.value;
    
    let options = [];
    let placeholder = '';
    let hint = '根据上方选择的大类输入系数名称';
    
    if (cat === 'pricingUp') {
        options = ['用途系数', '加急系数'];
        placeholder = '直接输入文字填加小类';
        hint = '加价类系数名称，可参考上述或输入新名称';
    } else if (cat === 'pricingDown') {
        options = ['折扣系数'];
        placeholder = '直接输入文字填加小类';
        hint = '折扣类系数名称，可参考上述或输入新名称';
    }
    
    if (hintEl) hintEl.textContent = hint;
    
    // 初始化自定义搜索下拉组件
    createSearchableSelect(
        'coefficientTypeSelect',
        options,
        placeholder || '请输入系数名称',
        function(value, label) {
            // 系数名称选择回调（可选）
        },
        ''
    );
}

// 关闭添加系数弹窗
function closeAddCoefficientModal() {
    document.getElementById('addCoefficientModal').classList.add('d-none');
}

// 更新系数表单（根据系数类型可能需要不同的表单字段）
function updateCoefficientForm() {
    // 当前实现中，所有系数类型的表单字段都相同，所以这个函数暂时为空
    // 如果未来需要根据系数类型显示不同的表单字段，可以在这里实现
}

// 保存新系数：并入原有用途/加急/折扣，或新建加价/折扣模块
function saveNewCoefficient() {
    const category = document.getElementById('coefficientCategory').value;
    const typeName = (getSearchableSelectValue('coefficientTypeSelect') || '').trim();
    if (!typeName) {
        alert('请输入系数名称！');
        return;
    }
    if (category !== 'pricingUp' && category !== 'pricingDown') return;
    const container = document.getElementById('coefficientItemsContainer');
    const rows = container ? container.querySelectorAll('.coefficient-item-row') : [];
    const items = [];
    for (const row of rows) {
        const inputs = row.querySelectorAll('input');
        const nameInput = inputs[0], valueInput = inputs[1];
        const nm = (nameInput && nameInput.value || '').trim();
        const val = parseFloat(valueInput && valueInput.value) || 1;
        if (nm) items.push({ name: nm, value: val });
    }
    if (items.length === 0) {
        alert('请至少添加一条有效的系数值项（名称必填）。');
        return;
    }
    const existingMap = {
        '用途系数': { target: 'usage', key: 'usageCoefficients' },
        '加急系数': { target: 'urgent', key: 'urgentCoefficients' },
        '折扣系数': { target: 'discount', key: 'discountCoefficients' }
    };
    const existing = existingMap[typeName];
    // 根据类别决定排序方式：加价类升序，折扣类降序
    if (category === 'pricingUp' || (existing && existing.target !== 'discount')) {
        items.sort((a, b) => (a.value - b.value)); // 升序
    } else {
        items.sort((a, b) => (b.value - a.value)); // 降序
    }
    try {
        if (existing) {
            const obj = defaultSettings[existing.key];
            if (!obj) {
                alert('系数配置不存在，无法添加！');
                closeAddCoefficientModal();
                return;
            }
            items.forEach((it, i) => {
                const key = 'opt_' + Date.now() + '_' + i;
                obj[key] = { value: it.value, name: it.name };
            });
        } else {
            const options = {};
            items.forEach((it, i) => { options['opt_' + i] = { value: it.value, name: it.name }; });
            const item = { id: Date.now(), name: typeName, options };
            if (category === 'pricingUp') {
                if (!Array.isArray(defaultSettings.extraPricingUp)) defaultSettings.extraPricingUp = [];
                defaultSettings.extraPricingUp.push(item);
            } else {
                if (!Array.isArray(defaultSettings.extraPricingDown)) defaultSettings.extraPricingDown = [];
                defaultSettings.extraPricingDown.push(item);
            }
        }
        // 先保存数据，确保数据已持久化
        saveData();
        // 然后更新UI，即使UI更新失败也不影响数据保存
        try {
            renderCoefficientSettings();
        } catch (uiError) {
            console.error('更新UI时出错（数据已保存）：', uiError);
            // UI更新失败不影响关闭弹窗
        }
        // 无论UI更新是否成功，都关闭弹窗
        closeAddCoefficientModal();
    } catch (error) {
        console.error('保存系数时出错：', error);
        alert('保存失败：' + error.message);
        closeAddCoefficientModal();
    }
}

// 渲染系数设置
function renderCoefficientSettings() {
    renderUsageCoefficients();
    renderUrgentCoefficients();
    renderSameModelCoefficients();
    renderDiscountCoefficients();
    renderUrgentDiscountPairRow();
    renderPlatformFees();
    renderExtraPricingUp();
    renderExtraPricingDown();
    updateCalculatorBuiltinSelects();
    updateCalculatorCoefficientSelects();
}

// 渲染扩展加价类系数（设置页）
function renderExtraPricingUp() {
    const container = document.getElementById('extraPricingUpContainer');
    if (!container) return;
    const list = defaultSettings.extraPricingUp || [];
    let html = '';
    for (const e of list) {
        // 只对非默认系数（ID不是1）显示删除按钮
        const deleteBtnHtml = e.id !== 1 ? `<button type="button" class="icon-action-btn delete" onclick="event.stopPropagation();deleteExtraCoefficient(${e.id},'up')" aria-label="删除系数" title="删除"><svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg><span class="sr-only">删除</span></button>` : '';
        html += `<div class="category-container"><div class="category-header" onclick="toggleCategory('extraUp-${e.id}')"><span class="category-title">${e.name || '未命名'}</span><div style="display: flex; align-items: center; gap: 0.5rem;">${deleteBtnHtml}<div class="category-toggle">▼</div></div></div>`;
        html += '<div class="category-content d-none" id="extraUp-' + e.id + '-content"><div class="coefficient-settings">';
        // 按系数值升序排序后渲染
        const sortedEntries = Object.entries(e.options || {}).sort((a, b) => {
            const va = getCoefficientValue(a[1]);
            const vb = getCoefficientValue(b[1]);
            return va - vb;
        });
        for (const [k, o] of sortedEntries) {
            const v = getCoefficientValue(o);
            const nm = (o && o.name) || k;
            const escapedName = nm.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
            const escapedKey = k.replace(/'/g, "\\'");
            html += '<div class="mb-2 d-flex items-center gap-2"><input type="text" value="' + escapedName + '" class="flex-1" onchange="updateExtraPricingOption(' + e.id + ',\'up\',\'' + escapedKey + '\',\'name\',this.value)" placeholder="名称"><input type="number" value="' + v + '" min="0" step="0.1" class="w-80" onchange="updateExtraPricingOption(' + e.id + ',\'up\',\'' + escapedKey + '\',\'value\',this.value)"><button class="icon-action-btn delete" onclick="deleteExtraPricingOption(' + e.id + ',\'up\',\'' + escapedKey + '\')" aria-label="删除选项" title="删除"><svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg><span class="sr-only">删除</span></button></div>';
        }
        html += '</div></div></div>';
    }
    container.innerHTML = html;
}

// 渲染扩展折扣类系数（设置页）
function renderExtraPricingDown() {
    const container = document.getElementById('extraPricingDownContainer');
    if (!container) return;
    const list = defaultSettings.extraPricingDown || [];
    let html = '';
    for (const e of list) {
        html += '<div class="category-container"><div class="category-header" onclick="toggleCategory(\'extraDown-' + e.id + '\')"><span class="category-title">' + (e.name || '未命名') + '</span><div style="display: flex; align-items: center; gap: 0.5rem;"><button type="button" class="icon-action-btn delete" onclick="event.stopPropagation();deleteExtraCoefficient(' + e.id + ',\'down\')" aria-label="删除系数" title="删除"><svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg><span class="sr-only">删除</span></button><div class="category-toggle">▼</div></div></div>';
        html += '<div class="category-content d-none" id="extraDown-' + e.id + '-content"><div class="coefficient-settings">';
        // 按系数值降序排序后渲染（折扣类降序）
        const sortedEntries = Object.entries(e.options || {}).sort((a, b) => {
            const va = getCoefficientValue(a[1]);
            const vb = getCoefficientValue(b[1]);
            return vb - va;
        });
        for (const [k, o] of sortedEntries) {
            const v = getCoefficientValue(o);
            const nm = (o && o.name) || k;
            const escapedName = nm.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
            const escapedKey = k.replace(/'/g, "\\'");
            html += '<div class="mb-2 d-flex items-center gap-2"><input type="text" value="' + escapedName + '" class="flex-1" onchange="updateExtraPricingOption(' + e.id + ',\'down\',\'' + escapedKey + '\',\'name\',this.value)" placeholder="名称"><input type="number" value="' + v + '" min="0" step="0.1" class="w-80" onchange="updateExtraPricingOption(' + e.id + ',\'down\',\'' + escapedKey + '\',\'value\',this.value)"><button class="icon-action-btn delete" onclick="deleteExtraPricingOption(' + e.id + ',\'down\',\'' + escapedKey + '\')" aria-label="删除选项" title="删除"><svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg><span class="sr-only">删除</span></button></div>';
        }
        html += '</div></div></div>';
    }
    container.innerHTML = html;
}

// 更新扩展加价/折扣的某一选项的 value 或 name
function updateExtraPricingOption(id, upDown, optKey, field, value) {
    const list = upDown === 'up' ? defaultSettings.extraPricingUp : defaultSettings.extraPricingDown;
    const e = list && list.find(x => x.id === id);
    if (e && e.options && e.options[optKey]) {
        if (field === 'value') {
            e.options[optKey].value = parseFloat(value) || 0;
        } else if (field === 'name') {
            e.options[optKey].name = (value || '').trim();
        }
        saveData();
    }
}

// 删除扩展加价/折扣的某一选项
function deleteExtraPricingOption(id, upDown, optKey) {
    const list = upDown === 'up' ? defaultSettings.extraPricingUp : defaultSettings.extraPricingDown;
    const e = list && list.find(x => x.id === id);
    if (!e || !e.options) return;
    
    const optionKeys = Object.keys(e.options);
    if (optionKeys.length <= 1) {
        alert('至少保留一项系数值！');
        return;
    }
    
    if (!confirm('确定要删除这个系数值吗？')) {
        return;
    }
    
    delete e.options[optKey];
    saveData();
    renderCoefficientSettings();
    updateCalculatorCoefficientSelects();
}

// 删除扩展加价/折扣系数
function deleteExtraCoefficient(id, upDown) {
    // 禁止删除ID为1的"不公开展示系数"
    if (id === 1) {
        alert('该系数不可删除！');
        return;
    }
    
    if (!confirm('确定要删除该系数吗？')) return;
    const list = upDown === 'up' ? defaultSettings.extraPricingUp : defaultSettings.extraPricingDown;
    if (list) {
        const i = list.findIndex(x => x.id === id);
        if (i >= 0) { list.splice(i, 1); saveData(); }
    }
    renderCoefficientSettings();
    updateCalculatorCoefficientSelects();
}

// 更新计算页中“其他加价类”“其他折扣类”选择器；同时更新单主信息中的“接单平台”下拉（与平台手续费选项一致）
function updateCalculatorBuiltinSelects() {
    try {
        const pairs = [
            { id: 'usage', key: 'usageCoefficients', asc: true },
            { id: 'urgent', key: 'urgentCoefficients', asc: true },
            { id: 'sameModel', key: 'sameModelCoefficients', asc: true },
            { id: 'discount', key: 'discountCoefficients', asc: false },
            { id: 'platform', key: 'platformFees', asc: true }
        ];
        pairs.forEach(function (p) {
            try {
                const el = document.getElementById(p.id);
                if (!el) return; // 元素不存在时跳过（可能不在计算页）
                const obj = defaultSettings[p.key];
                if (!obj || typeof obj !== 'object') return;
                const entries = Object.entries(obj);
                if (entries.length === 0) return;
                const sorted = entries.sort(function (a, b) {
                    try {
                        const va = getCoefficientValue(a[1]);
                        const vb = getCoefficientValue(b[1]);
                        return p.asc ? va - vb : vb - va;
                    } catch (e) {
                        return 0; // 排序出错时保持原顺序
                    }
                });
                const prev = el.value;
                let html = '';
                const keys = [];
                sorted.forEach(function (kv) {
                    try {
                        const k = kv[0];
                        const o = kv[1];
                        const v = getCoefficientValue(o);
                        const nm = (o && o.name) ? o.name : k;
                        keys.push(k);
                        const escapedName = (nm || k).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                        if (p.key === 'platformFees') {
                            // 未配置手续费（v 为 0 或无效）时，不显示“*0”
                            if (!isFinite(v) || v === 0) {
                                html += '<option value="' + k + '">' + escapedName + '</option>';
                            } else {
                                html += '<option value="' + k + '">' + escapedName + '*' + v + '%</option>';
                            }
                        } else {
                            html += '<option value="' + k + '">' + escapedName + '*' + (v || 1) + '</option>';
                        }
                    } catch (e) {
                        console.warn('生成选项时出错：', e);
                    }
                });
                if (html) {
                    el.innerHTML = html;
                    if (keys.indexOf(prev) >= 0) el.value = prev;
                    else if (keys.length) el.value = keys[0];
                }
                // 接单平台候选 = QQ/微信/小红书（固定）+ 设置页平台手续费中的平台名称（排除「无」），设置页增平台后此处自动包含新平台
                if (p.key === 'platformFees') {
                    var orderPlatformListEl = document.getElementById('orderPlatformList');
                    if (orderPlatformListEl) {
                        var fixed = ['QQ', '微信', '小红书'];
                        var fromFees = [];
                        sorted.forEach(function (kv) {
                            var nm = (kv[1] && kv[1].name) ? kv[1].name : kv[0];
                            if (nm && nm !== '无') fromFees.push(nm);
                        });
                        var seen = {};
                        var allNames = fixed.slice();
                        fromFees.forEach(function (n) {
                            if (!seen[n]) { seen[n] = true; allNames.push(n); }
                        });
                        var datalistHtml = allNames.map(function (n) {
                            var esc = (n || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                            return '<option value="' + esc + '">';
                        }).join('');
                        orderPlatformListEl.innerHTML = datalistHtml;
                    }
                }
            } catch (e) {
                console.warn('更新 ' + p.id + ' 选择器时出错：', e);
            }
        });
    } catch (e) {
        console.error('updateCalculatorBuiltinSelects 出错：', e);
    }
}

// 更新计算页中"其他加价类""其他折扣类"选择器
function updateCalculatorCoefficientSelects() {
    const upRow = document.getElementById('extraPricingUpSelectsRow');
    const downRow = document.getElementById('extraPricingDownSelectsRow');
    const upList = defaultSettings.extraPricingUp || [];
    const downList = defaultSettings.extraPricingDown || [];
    if (upRow) {
        if (upList.length === 0) {
            upRow.classList.add('d-none');
            upRow.innerHTML = '';
        } else {
            upRow.classList.remove('d-none');
            let h = '';
            upList.forEach(e => {
                const keys = Object.keys(e.options || {});
                const first = keys[0];
                h += '<div class="form-group"><label>' + (e.name || '') + '</label><select id="extraUp_' + e.id + '">';
                keys.forEach(k => { const o = e.options[k]; h += '<option value="' + k + '"' + (k === 'none' ? ' selected' : '') + '>' + ((o&&o.name)||k) + '*' + (getCoefficientValue(o)||1) + '</option>'; });
                h += '</select></div>';
            });
            upRow.innerHTML = h;
        }
    }
    if (downRow) {
        if (downList.length === 0) {
            downRow.classList.add('d-none');
            downRow.innerHTML = '';
        } else {
            downRow.classList.remove('d-none');
            let h = '';
            downList.forEach(e => {
                const keys = Object.keys(e.options || {});
                h += '<div class="form-group"><label>' + (e.name || '') + '</label><select id="extraDown_' + e.id + '">';
                keys.forEach(k => { const o = e.options[k]; h += '<option value="' + k + '">' + ((o&&o.name)||k) + '*' + (getCoefficientValue(o)||1) + '</option>'; });
                h += '</select></div>';
            });
            downRow.innerHTML = h;
        }
    }
}

// 删除系数
function deleteCoefficient(type, key) {
    // 确认删除
    if (!confirm('确定要删除这个系数吗？')) {
        return;
    }
    
    // 对于同模系数和平台手续费，至少保留一项
    if (type === 'sameModel') {
        const keys = Object.keys(defaultSettings.sameModelCoefficients);
        if (keys.length <= 1) {
            alert('至少保留一项同模系数！');
            return;
        }
    } else if (type === 'platform') {
        const keys = Object.keys(defaultSettings.platformFees);
        if (keys.length <= 1) {
            alert('至少保留一项平台手续费！');
            return;
        }
    }
    
    // 根据系数类型删除
    switch(type) {
        case 'usage':
            delete defaultSettings.usageCoefficients[key];
            break;
        case 'urgent':
            delete defaultSettings.urgentCoefficients[key];
            break;
        case 'sameModel':
            delete defaultSettings.sameModelCoefficients[key];
            break;
        case 'discount':
            delete defaultSettings.discountCoefficients[key];
            break;
        case 'platform':
            delete defaultSettings.platformFees[key];
            break;
    }
    
    // 重新渲染系数设置
    renderCoefficientSettings();
    
    // 更新计算页选择器
    updateCalculatorBuiltinSelects();
    
    // 保存设置
    saveData();
}

// 添加同模系数选项
function addSameModelOption() {
    const key = 'opt_' + Date.now();
    defaultSettings.sameModelCoefficients[key] = { value: 0.5, name: '新选项' };
    saveData();
    renderCoefficientSettings();
    updateCalculatorBuiltinSelects();
}

// 添加平台手续费选项
function addPlatformFeeOption() {
    const key = 'opt_' + Date.now();
    defaultSettings.platformFees[key] = { value: 0, name: '新选项' };
    saveData();
    renderCoefficientSettings();
    updateCalculatorBuiltinSelects();
}

// 渲染用途系数
function renderUsageCoefficients() {
    const container = document.getElementById('usageCoefficientSettings');
    if (!container) return;
    
    let html = '';
    // 按系数值升序排序后渲染
    const sortedEntries = Object.entries(defaultSettings.usageCoefficients).sort((a, b) => {
        const va = getCoefficientValue(a[1]);
        const vb = getCoefficientValue(b[1]);
        return va - vb;
    });
    for (const [key, item] of sortedEntries) {
        const value = getCoefficientValue(item);
        const displayName = (item && typeof item === 'object' && item.name) ? item.name : key;
        const escapedName = displayName.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        
        html += `
            <div class="mb-2 d-flex items-center gap-2">
                <input type="text" value="${escapedName}" class="flex-1" 
                       onchange="updateUsageCoefficientName('${key}', this.value)" placeholder="名称">
                <input type="number" value="${value}" min="0" step="0.1" class="w-80" 
                       onchange="updateUsageCoefficient('${key}', this.value)">
                <button class="icon-action-btn delete" onclick="deleteCoefficient('usage', '${key}')" aria-label="删除" title="删除">
                    <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                </button>
            </div>
        `;
    }
        
    container.innerHTML = html;
}

// 渲染加急系数（当加价类、折扣类均为单数时，最后一项移到并排行，此处不渲染）
function renderUrgentCoefficients() {
    const container = document.querySelector('#urgentCoefficient-content .coefficient-settings');
    if (!container) return;
    
    const urgentEntries = Object.entries(defaultSettings.urgentCoefficients).sort((a, b) => {
        const va = getCoefficientValue(a[1]);
        const vb = getCoefficientValue(b[1]);
        return va - vb;
    });
    const discountEntries = Object.entries(defaultSettings.discountCoefficients).sort((a, b) => {
        const va = getCoefficientValue(a[1]);
        const vb = getCoefficientValue(b[1]);
        return vb - va;
    });
    const bothOdd = (urgentEntries.length % 2 === 1) && (discountEntries.length % 2 === 1);
    const entriesToRender = bothOdd && urgentEntries.length >= 1 ? urgentEntries.slice(0, -1) : urgentEntries;
    
    let html = '';
    for (const [key, item] of entriesToRender) {
        const value = getCoefficientValue(item);
        const displayName = (item && typeof item === 'object' && item.name) ? item.name : key;
        const escapedName = displayName.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        html += `
            <div class="mb-2 d-flex items-center gap-2">
                <input type="text" value="${escapedName}" class="flex-1" 
                       onchange="updateUrgentCoefficientName('${key}', this.value)" placeholder="名称">
                <input type="number" value="${value}" min="0" step="0.1" class="w-80" 
                       onchange="updateUrgentCoefficient('${key}', this.value)">
                <button class="icon-action-btn delete" onclick="deleteCoefficient('urgent', '${key}')" aria-label="删除" title="删除">
                    <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                </button>
            </div>
        `;
    }
    container.innerHTML = html;
}

// 渲染同模优惠
function renderSameModelCoefficients() {
    const container = document.querySelector('#sameModelCoefficient-content .coefficient-settings');
    if (!container) return;

    let html = `
        <div class="mb-3">
            <div class="d-flex items-center gap-3 mt-1 flex-wrap">
                <label class="d-flex items-center gap-1" style="cursor:pointer; display: inline-flex; align-items: center; white-space: nowrap; margin-right: 10px;">
                    <input type="radio" name="sameModelMode" value="coefficient" ${defaultSettings.sameModelMode === 'minus' ? '' : 'checked'} onchange="updateSameModelMode('coefficient')" style="margin: 0 4px 0 0; width: 16px; height: 16px; vertical-align: middle;">
                    <span style="font-size: 0.9rem; line-height: 1;">按系数 (×)</span>
                </label>
                <label class="d-flex items-center gap-1" style="cursor:pointer; display: inline-flex; align-items: center; white-space: nowrap;">
                    <input type="radio" name="sameModelMode" value="minus" ${defaultSettings.sameModelMode === 'minus' ? 'checked' : ''} onchange="updateSameModelMode('minus')" style="margin: 0 4px 0 0; width: 16px; height: 16px; vertical-align: middle;">
                    <span style="font-size: 0.9rem; line-height: 1;">按减金额 (−)</span>
                </label>
            </div>
        </div>
    `;

    if (defaultSettings.sameModelMode === 'minus') {
        const val = Number.isFinite(Number(defaultSettings.sameModelMinusAmount)) ? defaultSettings.sameModelMinusAmount : 0;
        html += `
            <div class="mb-2">
                <label class="process-item-label">同模减免金额（元/件）</label>
                <input type="number" value="${val}" min="0" step="0.5" class="w-120" onchange="updateSameModelMinusAmount(this.value)">
                <div class="text-gray" style="font-size:0.85rem; margin-top:0.25rem;">同模制品单价 = 主设单价 − 减免金额（最低为0）</div>
            </div>
        `;
        container.innerHTML = html;
        return;
    }

    // 系数模式：渲染档位
    for (const [key, item] of Object.entries(defaultSettings.sameModelCoefficients)) {
        const value = getCoefficientValue(item);
        const displayName = (item && typeof item === 'object' && item.name) ? item.name : key;
        const escapedName = displayName.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        html += `
            <div class="mb-2 d-flex items-center gap-2">
                <input type="text" value="${escapedName}" class="flex-1" 
                       onchange="updateSameModelCoefficientName('${key}', this.value)" placeholder="名称">
                <input type="number" value="${value}" min="0" step="0.1" class="w-80" 
                       onchange="updateSameModelCoefficient('${key}', this.value)">
                <button class="icon-action-btn delete" onclick="deleteCoefficient('sameModel', '${key}')" aria-label="删除" title="删除">
                    <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                </button>
            </div>
        `;
    }
    html += '<button type="button" class="btn secondary mt-2" onclick="addSameModelOption()">+ 添加</button>';
    container.innerHTML = html;
}

function updateSameModelMode(mode) {
    defaultSettings.sameModelMode = mode;
    saveData();
    renderSameModelCoefficients();
}

function updateSameModelMinusAmount(value) {
    const v = value === '' ? 0 : parseFloat(value);
    defaultSettings.sameModelMinusAmount = Number.isFinite(v) ? Math.max(0, v) : 0;
    saveData();
}

// 渲染折扣系数（当加价类、折扣类均为单数时，第一项移到并排行，此处不渲染）
function renderDiscountCoefficients() {
    const container = document.querySelector('#discountCoefficient-content .coefficient-settings');
    if (!container) return;
    
    const urgentEntries = Object.entries(defaultSettings.urgentCoefficients).sort((a, b) => {
        const va = getCoefficientValue(a[1]);
        const vb = getCoefficientValue(b[1]);
        return va - vb;
    });
    const sortedEntries = Object.entries(defaultSettings.discountCoefficients).sort((a, b) => {
        const va = getCoefficientValue(a[1]);
        const vb = getCoefficientValue(b[1]);
        return vb - va;
    });
    const bothOdd = (urgentEntries.length % 2 === 1) && (sortedEntries.length % 2 === 1);
    const entriesToRender = bothOdd && sortedEntries.length >= 1 ? sortedEntries.slice(1) : sortedEntries;
    
    let html = '';
    for (const [key, item] of entriesToRender) {
        const value = getCoefficientValue(item);
        const displayName = (item && typeof item === 'object' && item.name) ? item.name : key;
        const escapedName = displayName.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        html += `
            <div class="mb-2 d-flex items-center gap-2">
                <input type="text" value="${escapedName}" class="flex-1" 
                       onchange="updateDiscountCoefficientName('${key}', this.value)" placeholder="名称">
                <input type="number" value="${value}" min="0" step="0.1" class="w-80" 
                       onchange="updateDiscountCoefficient('${key}', this.value)">
                <button class="icon-action-btn delete" onclick="deleteCoefficient('discount', '${key}')" aria-label="删除" title="删除">
                    <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                </button>
            </div>
        `;
    }
    container.innerHTML = html;
}

// 当加价类、折扣类系数均为单数时：加价类最后一项与折扣类第一项并排显示
function renderUrgentDiscountPairRow() {
    const pairRowEl = document.getElementById('urgentDiscountPairRow');
    if (!pairRowEl) return;
    const urgentEntries = Object.entries(defaultSettings.urgentCoefficients).sort((a, b) => {
        const va = getCoefficientValue(a[1]);
        const vb = getCoefficientValue(b[1]);
        return va - vb;
    });
    const discountEntries = Object.entries(defaultSettings.discountCoefficients).sort((a, b) => {
        const va = getCoefficientValue(a[1]);
        const vb = getCoefficientValue(b[1]);
        return vb - va;
    });
    const bothOdd = (urgentEntries.length % 2 === 1) && (discountEntries.length % 2 === 1);
    if (!bothOdd || urgentEntries.length === 0 || discountEntries.length === 0) {
        pairRowEl.classList.add('d-none');
        pairRowEl.innerHTML = '';
        return;
    }
    const [lastKey, lastItem] = urgentEntries[urgentEntries.length - 1];
    const [firstKey, firstItem] = discountEntries[0];
    const lastVal = getCoefficientValue(lastItem);
    const firstVal = getCoefficientValue(firstItem);
    const lastDisplay = (lastItem && typeof lastItem === 'object' && lastItem.name) ? lastItem.name : lastKey;
    const firstDisplay = (firstItem && typeof firstItem === 'object' && firstItem.name) ? firstItem.name : firstKey;
    const lastEsc = lastDisplay.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const firstEsc = firstDisplay.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    pairRowEl.innerHTML = `
        <div class="pair-row-half pair-urgent coefficient-settings">
            <div class="mb-2 d-flex items-center gap-2">
                <input type="text" value="${lastEsc}" class="flex-1" 
                       onchange="updateUrgentCoefficientName('${lastKey}', this.value)" placeholder="名称">
                <input type="number" value="${lastVal}" min="0" step="0.1" class="w-80" 
                       onchange="updateUrgentCoefficient('${lastKey}', this.value)">
                <button class="icon-action-btn delete" onclick="deleteCoefficient('urgent', '${lastKey}')" aria-label="删除" title="删除">
                    <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                </button>
            </div>
        </div>
        <div class="pair-row-half pair-discount coefficient-settings">
            <div class="mb-2 d-flex items-center gap-2">
                <input type="text" value="${firstEsc}" class="flex-1" 
                       onchange="updateDiscountCoefficientName('${firstKey}', this.value)" placeholder="名称">
                <input type="number" value="${firstVal}" min="0" step="0.1" class="w-80" 
                       onchange="updateDiscountCoefficient('${firstKey}', this.value)">
                <button class="icon-action-btn delete" onclick="deleteCoefficient('discount', '${firstKey}')" aria-label="删除" title="删除">
                    <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                </button>
            </div>
        </div>
    `;
    pairRowEl.classList.remove('d-none');
}

// 渲染平台手续费
function renderPlatformFees() {
    const container = document.querySelector('#platformFee-content .coefficient-settings');
    if (!container) return;
    
    let html = '';
    // 按系数值升序排序后渲染（与计算页保持一致）
    const sortedEntries = Object.entries(defaultSettings.platformFees).sort((a, b) => {
        const va = getCoefficientValue(a[1]);
        const vb = getCoefficientValue(b[1]);
        return va - vb;
    });
    for (const [key, item] of sortedEntries) {
        const value = getCoefficientValue(item);
        const displayName = (item && typeof item === 'object' && item.name) ? item.name : key;
        const escapedName = displayName.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        
        html += `
            <div class="mb-2 d-flex items-center gap-2">
                <input type="text" value="${escapedName}" class="flex-1" 
                       onchange="updatePlatformFeeName('${key}', this.value)" placeholder="名称">
                <input type="number" value="${value}" min="0" step="0.1" class="w-80" 
                       onchange="updatePlatformFee('${key}', this.value)">
                <button class="icon-action-btn delete" onclick="deleteCoefficient('platform', '${key}')" aria-label="删除" title="删除">
                    <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                </button>
            </div>
        `;
    }
    html += '<button type="button" class="btn secondary mt-2" onclick="addPlatformFeeOption()">+ 添加</button>';
    container.innerHTML = html;
}

// 删除制品大类（将该大类下的制品移至「其他」）
function deleteProductCategory(categoryName) {
    if (!categoryName || !categoryName.trim()) return;
    const category = categoryName.trim();
    const productsInCategory = productSettings.filter(p => (p.category || '').trim() === category);
    const count = productsInCategory.length;
    if (count === 0) return;
    const targetCategory = '其他';
    if (!confirm(`确定要删除分类「${category}」吗？该分类下的 ${count} 个制品将移至「${targetCategory}」。`)) {
        return;
    }
    productsInCategory.forEach(p => { p.category = targetCategory; });
    saveData();
    renderProductSettings();
}

// 添加新分类
function addNewCategory() {
    const newCategory = prompt('请输入新分类名称：');
    if (newCategory && newCategory.trim()) {
        // 检查分类是否已存在
        const categoryExists = productSettings.some(setting => setting.category === newCategory.trim());
        if (categoryExists) {
            alert('该分类已存在！');
            return;
        }
        
        // 添加一个默认制品到新分类
        const productSetting = {
            id: Date.now(),
            name: '新制品',
            category: newCategory.trim(),
            priceType: 'fixed',
            price: 0,
            priceSingle: 0,
            priceDouble: 0,
            basePrice: 0,
            additionalPrice: 0,
            additionalUnit: '',
            baseConfig: ''
        };
        
        productSettings.push(productSetting);
        renderProductSettings();
        alert('新分类已添加！');
    }
}

// 更新制品设置
function updateProductSetting(id, field, value) {
    const setting = productSettings.find(p => p.id === id);
    if (setting) {
        setting[field] = value;
        // 如果计价方式改变，重新渲染
        if (field === 'priceType') {
            renderProductSettings();
        }
    }
}

// 添加递增配置项
function addProductAdditionalConfigSetting(productId) {
    const setting = productSettings.find(p => p.id === productId);
    if (setting) {
        if (!setting.additionalConfigs) {
            setting.additionalConfigs = [];
        }
        setting.additionalConfigs.push({
            name: '',
            price: 0,
            unit: ''
        });
        renderProductSettings();
    }
}

// 更新递增配置项
function updateProductAdditionalConfigSetting(productId, index, field, value) {
    const setting = productSettings.find(p => p.id === productId);
    if (setting && setting.additionalConfigs && setting.additionalConfigs[index]) {
        if (field === 'price') {
            setting.additionalConfigs[index][field] = parseFloat(value) || 0;
        } else {
            setting.additionalConfigs[index][field] = value;
        }
    }
}

// 删除递增配置项
function removeProductAdditionalConfigSetting(productId, index) {
    // 二次确认
    if (!confirm('确定要删除这个递增配置项吗？')) {
        return;
    }
    
    const setting = productSettings.find(p => p.id === productId);
    if (setting && setting.additionalConfigs && setting.additionalConfigs[index]) {
        setting.additionalConfigs.splice(index, 1);
        renderProductSettings();
    }
}

// 按节点收费：添加节点
function addProductNodeSetting(settingId) {
    const setting = productSettings.find(p => p.id === settingId);
    if (setting) {
        if (!setting.nodes) setting.nodes = [];
        setting.nodes.push({ name: '新节点', percent: 0 });
        renderProductSettings();
    }
}

// 按节点收费：更新节点
function updateProductNodeSetting(settingId, index, field, value) {
    const setting = productSettings.find(p => p.id === settingId);
    if (setting && setting.nodes && setting.nodes[index]) {
        if (field === 'percent') {
            setting.nodes[index][field] = parseFloat(value) || 0;
        } else {
            setting.nodes[index][field] = value;
        }
    }
}

// 按节点收费：删除节点
function removeProductNodeSetting(settingId, index) {
    if (!confirm('确定要删除该节点吗？')) return;
    const setting = productSettings.find(p => p.id === settingId);
    if (setting && setting.nodes && setting.nodes[index]) {
        setting.nodes.splice(index, 1);
        renderProductSettings();
    }
}

// 删除制品设置
function deleteProductSetting(id) {
    // 二次确认
    if (!confirm('确定要删除这个制品设置吗？')) {
        return;
    }
    
    productSettings = productSettings.filter(p => p.id !== id);
    renderProductSettings();
}

// 打开添加工艺设置弹窗
function openAddProcessModal() {
    // 清空表单
    document.getElementById('newProcessName').value = '';
    document.getElementById('newProcessPrice').value = '10';
    
    // 显示弹窗
    document.getElementById('addProcessModal').classList.remove('d-none');
}

// 关闭添加工艺设置弹窗
function closeAddProcessModal() {
    document.getElementById('addProcessModal').classList.add('d-none');
}

// 保存新工艺设置
function saveNewProcess() {
    const name = document.getElementById('newProcessName').value.trim();
    const rawPrice = document.getElementById('newProcessPrice').value;
    const parsedPrice = rawPrice === '' ? NaN : parseFloat(rawPrice);
    const price = Number.isFinite(parsedPrice) ? Math.max(0, parsedPrice) : 10;
    
    // 验证必填项
    if (!name) {
        alert('请输入工艺名称！');
        return;
    }
    
    const processSetting = {
        id: Date.now(),
        name: name,
        price: price
    };
    
    processSettings.push(processSetting);
    renderProcessSettings();
    closeAddProcessModal();
    alert('工艺设置已添加！');
}

// 添加工艺设置（保留原函数名以兼容现有代码）
function addProcessSetting() {
    openAddProcessModal();
}

// 渲染工艺设置
function renderProcessSettings() {
    const container = document.getElementById('processSettingsContainer');
    
    let html = '';
    processSettings.forEach(setting => {
        // 兼容旧数据：如果有layers字段但没有price字段，使用默认价格
        if (setting.layers && !setting.price) {
            setting.price = 10;
        }
        const price = (setting.price ?? 10);
        const sid = String(setting.id ?? '');
        const sidEsc = sid.replace(/'/g, "\\'");
        
        html += `
            <div class="process-item" data-id="${sidEsc}">
                <div class="process-item-row">
                    <div class="process-item-group">
                        <label class="process-item-label">工艺名称</label>
                        <input type="text" class="process-item-input" value="${setting.name}" onchange="updateProcessSetting('${sidEsc}', 'name', this.value)" placeholder="请输入工艺名称">
                    </div>
                    <div class="process-item-group">
                        <label class="process-item-label">价格（每层）</label>
                        <input type="number" class="process-item-input process-item-price" value="${price}" onchange="updateProcessSetting('${sidEsc}', 'price', parseFloat(this.value))" placeholder="价格" min="0" step="1">
                    </div>
                    <button class="icon-action-btn delete process-item-delete" onclick="deleteProcessSetting('${sidEsc}')" aria-label="删除工艺" title="删除">
                        <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                                        <span class="sr-only">删除</span>
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// 更新工艺设置
function updateProcessSetting(id, field, value) {
    const idStr = String(id);
    const setting = processSettings.find(p => String(p.id) === idStr);
    if (setting) {
        setting[field] = value;
    }
}

// 删除工艺设置
function deleteProcessSetting(id) {
    if (!confirm('确定要删除这个工艺设置吗？')) return;
    const idStr = String(id);
    processSettings = processSettings.filter(p => String(p.id) !== idStr);
    renderProcessSettings();
}

// 更新显示
function updateDisplay() {
    // 这里可以添加需要定期更新的显示内容
}

// Excel批量导入功能
function importFromExcel(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    
    // 验证文件格式
    const allowedExtensions = ['.xlsx', '.xls'];
    const fileName = file.name;
    const fileExtension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
        alert('请上传.xlsx或.xls格式的Excel文件！');
        event.target.value = ''; // 清空文件输入
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // 读取第一个工作表
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // 转换为JSON格式
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            if (jsonData.length === 0) {
                alert('Excel文件为空！');
                return;
            }
            
            // 解析数据并添加到制品设置
            let importedCount = 0;
            let errorCount = 0;
            
            jsonData.forEach((row, index) => {
                try {
                    // 检查必填字段
                    if (!row['制品名称'] && !row['名称']) {
                        console.warn(`第${index + 2}行：缺少制品名称，跳过`);
                        errorCount++;
                        return;
                    }
                    
                    const name = row['制品名称'] || row['名称'];
                    const category = row['分类'] || row['类别'] || '其他';
                    // 调试：输出所有可能的价格类型字段
                    console.log('价格类型字段检查:', {
                        '计价方式': row['计价方式'],
                        '价格类型': row['价格类型'],
                        'rowKeys': Object.keys(row)
                    });
                    // 正确映射价格类型
                    let rawPriceType = row['计价方式'] || row['价格类型'] || 'fixed';
                    let priceType = 'fixed'; // 默认固定价
                    if (rawPriceType === '单双面价' || rawPriceType === 'double') {
                        priceType = 'double';
                    } else if (rawPriceType === '基础+递增价' || rawPriceType === 'config') {
                        priceType = 'config';
                    } else if (rawPriceType === '按节点收费' || rawPriceType === 'nodes') {
                        priceType = 'nodes';
                    }
                    console.log(`第${index + 2}行：制品名称=${name}，原始价格类型=${rawPriceType}，映射后价格类型=${priceType}`);
                    
                    // 创建新制品对象
                    const newProduct = {
                        id: Date.now() + index, // 确保ID唯一
                        name: name,
                        category: category,
                        priceType: priceType,
                        price: 0,
                        priceSingle: 0,
                        priceDouble: 0,
                        basePrice: 0,
                        additionalPrice: 0,
                        additionalUnit: '',
                        baseConfig: ''
                    };
                    
                    // 根据价格类型设置相应的价格
                    switch(priceType) {
                        case 'fixed':
                        case '固定价':
                            newProduct.price = parseFloat(row['固定价格'] || row['价格'] || 0) || 0;
                            break;
                        case 'double':
                        case '单双面价':
                            newProduct.priceSingle = parseFloat(row['单面价格'] || row['单面'] || 0) || 0;
                            newProduct.priceDouble = parseFloat(row['双面价格'] || row['双面'] || 0) || 0;
                            break;
                        case 'config':
                        case '基础+递增价':
                            newProduct.baseConfig = row['基础配置'] || row['基础'] || '';
                            newProduct.basePrice = parseFloat(row['基础价'] || row['基础价格'] || 0) || 0;
                            
                            // 创建一个空的配置项数组
                            newProduct.additionalConfigs = [];
                            
                            // 检查是否有多配置项，使用简单的编号方式，如：配置1名称、配置1价格、配置1单位
                            let configIndex = 1;
                            while (row[`配置${configIndex}名称`] !== undefined || row[`配置${configIndex}价格`] !== undefined) {
                                const configName = row[`配置${configIndex}名称`] || row[`配置项${configIndex}名称`];
                                const configPrice = parseFloat(row[`配置${configIndex}价格`] || row[`配置项${configIndex}价格`] || 0);
                                const configUnit = row[`配置${configIndex}单位`] || row[`配置项${configIndex}单位`] || '';
                                
                                if (configName || configPrice > 0) {  // 如果有名称或价格，则添加配置项
                                    newProduct.additionalConfigs.push({
                                        name: configName || `配置${configIndex}`,
                                        price: configPrice,
                                        unit: configUnit
                                    });
                                }
                                configIndex++;
                                
                                // 防止无限循环，最多处理10个配置项
                                if (configIndex > 10) break;
                            }
                            
                            break;
                        case 'nodes':
                        case '按节点收费':
                            newProduct.price = parseFloat(row['默认总价'] || row['固定价格'] || row['价格'] || 0) || 0;
                            newProduct.nodes = [];
                            const nodeStr = String(row['节点'] || '').trim();
                            if (nodeStr) {
                                const nodeParts = nodeStr.split(/[、,，]/);
                                nodeParts.forEach(p => {
                                    p = p.trim();
                                    const m = p.match(/^(.+?)(\d+(?:\.\d+)?)\s*%?\s*$/);
                                    if (m) {
                                        newProduct.nodes.push({ name: m[1].trim() || '节点', percent: parseFloat(m[2]) || 0 });
                                    }
                                });
                            }
                            if (newProduct.nodes.length === 0) {
                                newProduct.nodes = [{ name: '草稿', percent: 30 }, { name: '色稿', percent: 40 }, { name: '成图', percent: 30 }];
                            }
                            break;
                    }
                    
                    // 兼容：如果没有找到编号的配置项，尝试使用旧格式（仅 config）
                    if (priceType === 'config' && newProduct.additionalConfigs && newProduct.additionalConfigs.length === 0) {
                        const oldConfigName = row['配置名称'] || '配置';
                        const oldConfigPrice = parseFloat(row['配置价格'] || row['递增价'] || row['递增价格'] || 0) || 0;
                        const oldConfigUnit = row['配置单位'] || row['单位'] || row['递增单位'] || '';
                        if (oldConfigPrice > 0) {
                            newProduct.additionalConfigs.push({
                                name: oldConfigName,
                                price: oldConfigPrice,
                                unit: oldConfigUnit
                            });
                        }
                    }
                    
                    // 检查是否已存在同名同分类制品，如果存在则替换
                    const existingIndex = productSettings.findIndex(p => p.name === name && p.category === category);
                    if (existingIndex !== -1) {
                        // 替换已存在的制品
                        productSettings[existingIndex] = newProduct;
                        console.log(`制品"${name}"已更新`);
                    } else {
                        productSettings.push(newProduct);
                    }
                    importedCount++;
                } catch (error) {
                    console.error(`第${index + 2}行导入失败:`, error);
                    errorCount++;
                }
            });
            
            // 保存数据
            saveData();
            
            // 重新渲染制品设置
            renderProductSettings();
            
            // 清空文件输入
            event.target.value = '';
            
            // 显示导入结果
            let message = `成功导入 ${importedCount} 个制品设置`;
            if (errorCount > 0) {
                message += `，${errorCount} 个失败`;
            }
            alert(message);
            
        } catch (error) {
            console.error('导入Excel失败:', error);
            alert('导入Excel失败，请检查文件格式！\n\nExcel格式要求：\n- 第一行为表头\n- 必填列：制品名称（或名称）\n- 可选列：分类（或类别）、计价方式（或价格类型）\n\n基础+递增价类型特有列：\n- 基础配置、基础价\n- 配置1名称、配置1价格、配置1单位（以此类推可添加配置2、配置3等）\n- 或使用旧格式：配置名称、配置价格、配置单位');
            event.target.value = '';
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// 导出制品设置为Excel
function exportToExcel() {
    if (productSettings.length === 0) {
        alert('没有制品设置可导出！');
        return;
    }
    
    // 准备数据
    const data = productSettings.map(setting => {
        const row = {
            '分类': setting.category || DEFAULT_CATEGORIES[0],
            '制品名称': setting.name || '',
            '计价方式': setting.priceType === 'fixed' ? '固定价' : 
                       setting.priceType === 'double' ? '单双面价' : 
                       setting.priceType === 'config' ? '基础+递增价' : 
                       setting.priceType === 'nodes' ? '按节点收费' : ''
        };
        
        switch(setting.priceType) {
            case 'fixed':
                row['固定价格'] = setting.price || 0;
                break;
            case 'double':
                row['单面价格'] = setting.priceSingle || 0;
                row['双面价格'] = setting.priceDouble || 0;
                break;
            case 'nodes':
                row['默认总价'] = setting.price || 0;
                if (setting.nodes && setting.nodes.length > 0) {
                    row['节点'] = setting.nodes.map(n => (n.name || '节点') + (n.percent != null ? n.percent + '%' : '')).join('、');
                }
                break;
            case 'config':
                row['基础配置'] = setting.baseConfig || '';
                row['基础价'] = setting.basePrice || 0;
                
                // 输出多配置项，使用简单的编号格式
                if (setting.additionalConfigs && setting.additionalConfigs.length > 0) {
                    setting.additionalConfigs.forEach((config, index) => {
                        const configNum = index + 1;
                        row[`配置${configNum}名称`] = config.name || '';
                        row[`配置${configNum}价格`] = config.price || 0;
                        row[`配置${configNum}单位`] = config.unit || '';
                    });
                } else {
                    // 兼容旧格式
                    row['递增价'] = setting.additionalPrice || 0;
                    row['单位'] = setting.additionalUnit || '';
                }
                break;
        }
        
        return row;
    });
    
    // 创建工作表
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '制品设置');
    
    // 导出文件
    XLSX.writeFile(workbook, `制品设置_${new Date().getTime()}.xlsx`);
    alert('导出成功！');
}

// 导出系数设置为 Excel（表头：大类, 小类, 名称, 系数值；大类=加价类|折扣类|其他类）
function exportCoefficientsToExcel() {
    const rows = [];
    function add(daLei, xiaoLei, name, val) {
        rows.push({ '大类': daLei, '小类': xiaoLei, '名称': name, '系数值': val });
    }
    ['usageCoefficients', 'urgentCoefficients'].forEach(function (k) {
        const labels = { usageCoefficients: '用途系数', urgentCoefficients: '加急系数' };
        const obj = defaultSettings[k];
        if (obj && typeof obj === 'object') {
            Object.entries(obj).forEach(function (kv) {
                const v = getCoefficientValue(kv[1]);
                const nm = (kv[1] && kv[1].name) ? kv[1].name : kv[0];
                add('加价类', labels[k], nm, v);
            });
        }
    });
    (defaultSettings.extraPricingUp || []).forEach(function (e) {
        const xiaoLei = e.name || '未命名';
        Object.entries(e.options || {}).forEach(function (kv) {
            const v = getCoefficientValue(kv[1]);
            const nm = (kv[1] && kv[1].name) ? kv[1].name : kv[0];
            add('加价类', xiaoLei, nm, v);
        });
    });
    ['discountCoefficients'].forEach(function (k) {
        const obj = defaultSettings[k];
        if (obj && typeof obj === 'object') {
            Object.entries(obj).forEach(function (kv) {
                const v = getCoefficientValue(kv[1]);
                const nm = (kv[1] && kv[1].name) ? kv[1].name : kv[0];
                add('折扣类', '折扣系数', nm, v);
            });
        }
    });
    (defaultSettings.extraPricingDown || []).forEach(function (e) {
        const xiaoLei = e.name || '未命名';
        Object.entries(e.options || {}).forEach(function (kv) {
            const v = getCoefficientValue(kv[1]);
            const nm = (kv[1] && kv[1].name) ? kv[1].name : kv[0];
            add('折扣类', xiaoLei, nm, v);
        });
    });
    ['sameModelCoefficients', 'platformFees'].forEach(function (k) {
        const labels = { sameModelCoefficients: '同模系数', platformFees: '平台手续费' };
        const obj = defaultSettings[k];
        if (obj && typeof obj === 'object') {
            Object.entries(obj).forEach(function (kv) {
                const v = getCoefficientValue(kv[1]);
                const nm = (kv[1] && kv[1].name) ? kv[1].name : kv[0];
                add('其他类', labels[k], nm, v);
            });
        }
    });
    if (rows.length === 0) {
        alert('没有系数数据可导出！');
        return;
    }
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '系数设置');
    XLSX.writeFile(workbook, '系数设置_' + new Date().getTime() + '.xlsx');
    alert('系数设置导出成功！');
}

// 从 Excel 导入系数设置（表头：大类, 小类, 名称, 系数值）
// 规则：大类、小类、名称三者相同则覆盖该条系数值；不相同则不覆盖。同模系数、平台手续费不清空。
function importCoefficientsFromExcel(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    
    // 验证文件格式
    const allowedExtensions = ['.xlsx', '.xls'];
    const fileName = file.name;
    const fileExtension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
        alert('请上传.xlsx或.xls格式的Excel文件！');
        event.target.value = ''; // 清空文件输入
        return;
    }
    
    event.target.value = '';
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet);
            if (!rows.length) {
                alert('Excel 文件为空或格式不正确！');
                return;
            }
            function findKeyByName(obj, name) {
                if (!obj || typeof obj !== 'object') return null;
                for (const [k, v] of Object.entries(obj)) {
                    const n = (v && v.name) ? v.name : k;
                    if (String(n).trim() === String(name).trim()) return k;
                }
                return null;
            }
            let updated = 0;
            rows.forEach(function (row) {
                const daLei = (row['大类'] || '').toString().trim();
                const xiaoLei = (row['小类'] != null ? row['小类'] : '').toString().trim();
                const name = (row['名称'] != null ? row['名称'] : '').toString().trim();
                const val = parseFloat(row['系数值']);
                if (isNaN(val)) return;
                const nm = name || xiaoLei;
                if (!nm) return;
                let key = null;
                let target = null;
                if (daLei === '加价类') {
                    if (xiaoLei === '用途系数') {
                        target = defaultSettings.usageCoefficients;
                        key = target ? findKeyByName(target, nm) : null;
                    } else if (xiaoLei === '加急系数') {
                        target = defaultSettings.urgentCoefficients;
                        key = target ? findKeyByName(target, nm) : null;
                    } else {
                        const mod = (defaultSettings.extraPricingUp || []).find(function (m) { return (m.name || '').trim() === (xiaoLei || '').trim(); });
                        if (mod && mod.options) {
                            key = findKeyByName(mod.options, nm);
                            if (key !== null) target = mod.options;
                        }
                    }
                } else if (daLei === '折扣类') {
                    if (xiaoLei === '折扣系数') {
                        target = defaultSettings.discountCoefficients;
                        key = target ? findKeyByName(target, nm) : null;
                    } else {
                        const mod = (defaultSettings.extraPricingDown || []).find(function (m) { return (m.name || '').trim() === (xiaoLei || '').trim(); });
                        if (mod && mod.options) {
                            key = findKeyByName(mod.options, nm);
                            if (key !== null) target = mod.options;
                        }
                    }
                } else if (daLei === '其他类') {
                    if (xiaoLei === '同模系数') {
                        target = defaultSettings.sameModelCoefficients;
                        key = target ? findKeyByName(target, nm) : null;
                    } else if (xiaoLei === '平台手续费') {
                        target = defaultSettings.platformFees;
                        key = target ? findKeyByName(target, nm) : null;
                    }
                }
                if (target && key != null) {
                    target[key].value = val;
                    updated++;
                }
            });
            saveData();
            renderCoefficientSettings();
            alert('系数设置导入完成！共更新 ' + updated + ' 条匹配项，未匹配的不覆盖。');
        } catch (err) {
            console.error('导入系数设置失败:', err);
            alert('导入失败，请使用本系统导出的系数设置 Excel 格式。\n表头：大类、小类、名称、系数值\n大类可选：加价类、折扣类、其他类');
        }
    };
    reader.readAsArrayBuffer(file);
}

// 页面加载完成后初始化
window.addEventListener('load', function () {
    init();
    mgInitNetworkGuard();
    
    // 应用启动后，自动同步本地美工ID到云端（如果已设置）
    setTimeout(async function() {
        if (mgIsCloudEnabled() && defaultSettings.artistInfo && defaultSettings.artistInfo.id) {
            await mgSyncArtistDisplayNameToCloud(defaultSettings.artistInfo.id);
        }
    }, 2000); // 延迟2秒执行，确保应用完全初始化
});

// 赠品相关函数
// 更新赠品类型
function updateGiftType(giftId, productName) {
    const gift = gifts.find(g => g.id === giftId);
    if (!gift) return;
    
    // 根据制品名称查找对应的制品ID
    const productSetting = productSettings.find(setting => setting.name === productName);
    if (productSetting) {
        gift.type = productSetting.id.toString();
    } else {
        gift.type = '';
    }
}

// 更新赠品信息
function updateGift(giftId, field, value) {
    const gift = gifts.find(g => g.id === giftId);
    if (gift) {
        gift[field] = value;
    }
}

// 快捷增减赠品数量
function adjustGiftQuantity(giftId, delta) {
    const gift = gifts.find(g => g.id === giftId);
    if (!gift) return;
    const current = gift.quantity || 1;
    const next = Math.max(1, current + delta);
    updateGift(giftId, 'quantity', next);
    const input = document.getElementById('giftQuantity-' + giftId);
    if (input) input.value = next;
}

// 更新赠品表单选项
function updateGiftForm(giftId) {
    const gift = gifts.find(g => g.id === giftId);
    if (!gift) return;
    
    const container = document.getElementById(`giftFormOptions-${giftId}`);
    const productSetting = productSettings.find(p => p.id === parseInt(gift.type));
    
    if (!productSetting) {
        container.innerHTML = '<p>请先选择制品类型</p>';
        return;
    }
    
    let html = '';
    
    switch (productSetting.priceType) {
        case 'fixed':
            html = `<div class="form-row"><div class="form-group"><label>固定价格：¥${productSetting.price}</label></div></div>`;
            break;
            
        case 'double':
            html = `
                <div class="form-row">
                    <div class="form-group">
                        <label for="giftSides-${giftId}">单双面</label>
                        <select id="giftSides-${giftId}" onchange="updateGift(${giftId}, 'sides', this.value)">
                            <option value="single" ${gift.sides === 'single' ? 'selected' : ''}>单面 (¥${productSetting.priceSingle})</option>
                            <option value="double" ${gift.sides === 'double' ? 'selected' : ''}>双面 (¥${productSetting.priceDouble})</option>
                        </select>
                    </div>
                </div>
            `;
            break;
            
        case 'config':
            // 兼容旧格式：如果没有additionalConfigs，使用旧的单配置格式
            const additionalConfigs = productSetting.additionalConfigs || [];
            if (additionalConfigs.length === 0 && productSetting.additionalPrice) {
                // 兼容旧格式
                additionalConfigs.push({
                    name: productSetting.additionalUnit || '配置',
                    price: productSetting.additionalPrice,
                    unit: productSetting.additionalUnit || '个'
                });
            }
            
            html = `
                <div class="form-row">
                    <div class="form-group incremental-config-group">
                        <label>基础+递增价</label>
                        <div class="incremental-config-base">
                            <span>基础价 (${productSetting.baseConfig})：¥${productSetting.basePrice}</span>
                        </div>
                        ${additionalConfigs.map((config, index) => {
                            const configKey = `gift_config_${giftId}_${index}`;
                            const currentValue = gift.additionalConfigs && gift.additionalConfigs[configKey] ? gift.additionalConfigs[configKey] : 0;
                            return `
                                <div class="incremental-config-item">
                                    <span class="incremental-config-label">+${config.name} (+¥${config.price}/${config.unit})</span>
                                    <input type="number" id="${configKey}" value="${currentValue}" min="0" step="1" 
                                           onchange="updateGiftAdditionalConfig(${giftId}, '${configKey}', parseInt(this.value))" 
                                           class="incremental-config-input">
                                    <span class="incremental-config-unit">${config.unit}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
            break;
    }
    
    container.innerHTML = html;
}

// 更新工艺选项
function updateProcessOptions(productId, isGift = false) {
    const containerId = isGift ? `giftProcessOptions-${productId}` : `processOptions-${productId}`;
    const container = document.getElementById(containerId);
    const items = isGift ? gifts : products;
    const item = items.find(p => p.id === productId);
    
    if (!item) return;
    
    let html = '<div style="margin-top: 0.5rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.5rem;">';
    
    // 生成工艺选项，每个工艺可以选择并设置层数
    processSettings.forEach(setting => {
        const isChecked = item.processes && item.processes[setting.id] ? 'checked' : '';
        const layers = item.processes && item.processes[setting.id] ? item.processes[setting.id].layers : 1;
        
        html += `
            <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem;">
                <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
                    <input type="checkbox" id="${isGift ? 'gift' : 'product'}Process-${productId}-${setting.id}" ${isChecked} 
                           onchange="toggleProcess(${productId}, ${setting.id}, this.checked, ${isGift})" 
                           style="cursor: pointer; width: 14px; height: 14px;">
                    <span>${setting.name}</span>
                </label>
                <div id="${isGift ? 'gift' : 'product'}ProcessLayersContainer-${productId}-${setting.id}" 
                     class="process-layers-stepper-wrap" style="display: ${isChecked ? 'flex' : 'none'}; align-items: center; gap: 0.25rem; margin-left: 1rem;">
                    <button type="button" class="process-layers-stepper-btn" aria-label="减一层" 
                            onclick="adjustProcessLayers(${productId}, ${setting.id}, -1, ${isGift})">−</button>
                    <input type="number" id="processLayers-${productId}-${setting.id}" class="process-layers-stepper-input" value="${layers}" min="1" step="1" 
                           onchange="var v = Math.max(1, parseInt(this.value) || 1); this.value = v; updateProcessLayers(${productId}, ${setting.id}, v, ${isGift})">
                    <button type="button" class="process-layers-stepper-btn" aria-label="加一层" 
                            onclick="adjustProcessLayers(${productId}, ${setting.id}, 1, ${isGift})">+</button>
                    <span style="font-size: 0.75rem; color: #666;">层</span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// 更新赠品额外配置
function updateGiftAdditionalConfig(giftId, configKey, value) {
    const gift = gifts.find(g => g.id === giftId);
    if (!gift) return;
    
    if (!gift.additionalConfigs) {
        gift.additionalConfigs = {};
    }
    
    gift.additionalConfigs[configKey] = value;
}

// 切换工艺选择（支持赠品）
function toggleProcess(productId, processId, checked, isGift = false) {
    const items = isGift ? gifts : products;
    const item = items.find(p => p.id === productId);
    if (!item) return;
    
    // 初始化工艺选择对象
    if (!item.processes) {
        item.processes = {};
    }
    
    // 获取工艺设置
    const processSetting = processSettings.find(p => p.id === processId);
    if (!processSetting) return;
    
    if (checked) {
        item.processes[processId] = {
            id: processId,
            layers: 1, // 默认1层
            price: processSetting.price || 10
        };
        
        // 显示层数设置
        const layersContainer = document.getElementById(`${isGift ? 'gift' : 'product'}ProcessLayersContainer-${productId}-${processId}`);
        if (layersContainer) {
            layersContainer.style.display = 'flex';
        }
    } else {
        delete item.processes[processId];
        
        // 隐藏层数设置
        const layersContainer = document.getElementById(`${isGift ? 'gift' : 'product'}ProcessLayersContainer-${productId}-${processId}`);
        if (layersContainer) {
            layersContainer.style.display = 'none';
        }
    }
}

// 更新单个工艺的层数（支持赠品）
function updateProcessLayers(productId, processId, layers, isGift = false) {
    const items = isGift ? gifts : products;
    const item = items.find(p => p.id === productId);
    if (!item || !item.processes || !item.processes[processId]) return;
    
    const clamped = Math.max(1, parseInt(layers, 10) || 1);
    item.processes[processId].layers = clamped;
}

// 快捷增减工艺层数（支持赠品）
function adjustProcessLayers(productId, processId, delta, isGift = false) {
    const items = isGift ? gifts : products;
    const item = items.find(p => p.id === productId);
    if (!item || !item.processes || !item.processes[processId]) return;
    
    const current = item.processes[processId].layers || 1;
    const next = Math.max(1, current + delta);
    updateProcessLayers(productId, processId, next, isGift);
    
    const input = document.getElementById('processLayers-' + productId + '-' + processId);
    if (input) input.value = next;
}

// 删除赠品项
function removeGift(giftId) {
    if (!confirm('确定要删除该赠品吗？')) return;
    gifts = gifts.filter(g => g.id !== giftId);
    const giftElement = document.querySelector(`[data-id="${giftId}"]`);
    if (giftElement) {
        giftElement.remove();
    }
}

// 恢复默认设置
function resetToDefaultSettings() {
    if (!confirm('将恢复为初始模板，当前制品、系数、结算等配置会被覆盖，是否继续？')) return;
    localStorage.removeItem('calculatorSettings');
    localStorage.removeItem('productSettings');
    localStorage.removeItem('processSettings');
    location.reload();
}

// 排单日历功能


// ========== 云端适配层（Supabase 联通） ==========
// 获取 Supabase 客户端（安全获取）
function mgGetSupabaseClient() {
    if (!window.__SUPABASE__ || !window.__SUPABASE__.client) return null;
    return window.__SUPABASE__.client;
}

// ========== 单主直填邀请链接（固定链接） ==========
function mgGenerateInviteToken(byteLen = 16) {
    try {
        const arr = new Uint8Array(byteLen);
        window.crypto.getRandomValues(arr);
        return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        // 兜底：不依赖 crypto 的弱随机（仅用于极端环境）
        return (Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0, 32);
    }
}

function mgBuildClientInviteLink(token) {
    const base = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/');
    return base + 'client.html?t=' + encodeURIComponent(token);
}

async function mgInitInviteLinkUI() {
    const input = document.getElementById('inviteLinkInput');
    if (!input) return;

    const client = mgGetSupabaseClient();
    if (!client) {
        input.value = '未检测到 Supabase 配置';
        return;
    }

    const { data: { session } } = await client.auth.getSession();
    if (!session || !session.user) {
        input.value = '请先登录后生成链接';
        return;
    }

    const artistId = session.user.id;

    // 每个用户固定一条：artist_id + kind='default'
    const { data: rows, error } = await client
        .from('project_links')
        .select('token')
        .eq('artist_id', artistId)
        .eq('kind', 'default')
        .limit(1);

    if (error) {
        console.error('获取邀请链接失败:', error);
        input.value = '获取链接失败（请检查 project_links 表/RLS）';
        return;
    }

    let token = rows && rows[0] ? rows[0].token : null;
    if (!token) {
        token = mgGenerateInviteToken(16);
        const { error: insErr } = await client
            .from('project_links')
            .insert([{ artist_id: artistId, kind: 'default', token }]);
        if (insErr) {
            console.error('创建邀请链接失败:', insErr);
            input.value = '创建链接失败（请检查 project_links 表/RLS）';
            return;
        }
    }

    input.value = mgBuildClientInviteLink(token);
}

async function copyInviteLink() {
    const input = document.getElementById('inviteLinkInput');
    const text = input ? (input.value || '').trim() : '';
    if (!text || text.indexOf('http') !== 0) {
        if (typeof showGlobalToast === 'function') showGlobalToast('暂无可复制的链接');
        return;
    }

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            // 兜底
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        if (typeof showGlobalToast === 'function') showGlobalToast('已复制链接');
    } catch (e) {
        console.error(e);
        if (typeof showGlobalToast === 'function') showGlobalToast('复制失败');
    }
}

async function resetInviteLink() {
    const input = document.getElementById('inviteLinkInput');
    if (!input) return;

    const client = mgGetSupabaseClient();
    if (!client) {
        if (typeof showGlobalToast === 'function') showGlobalToast('未检测到 Supabase 配置');
        return;
    }

    const { data: { session } } = await client.auth.getSession();
    if (!session || !session.user) {
        if (typeof showGlobalToast === 'function') showGlobalToast('请先登录');
        return;
    }

    if (!confirm('重置后旧链接将失效，确定要重置吗？')) return;

    const artistId = session.user.id;
    const newToken = mgGenerateInviteToken(16);

    // 优先 update（如果没有行则 insert）
    const { data: updRows, error: updErr } = await client
        .from('project_links')
        .update({ token: newToken, updated_at: new Date().toISOString() })
        .eq('artist_id', artistId)
        .eq('kind', 'default')
        .select('token')
        .limit(1);

    if (updErr) {
        console.error('重置链接失败:', updErr);
        if (typeof showGlobalToast === 'function') showGlobalToast('重置失败（请检查 project_links 表/RLS）');
        return;
    }

    // 如果 update 没命中（极少数情况），补 insert
    const hasRow = updRows && updRows[0] && updRows[0].token;
    if (!hasRow) {
        const { error: insErr } = await client
            .from('project_links')
            .insert([{ artist_id: artistId, kind: 'default', token: newToken }]);
        if (insErr) {
            console.error('重置链接补写失败:', insErr);
            if (typeof showGlobalToast === 'function') showGlobalToast('重置失败');
            return;
        }
    }

    input.value = mgBuildClientInviteLink(newToken);
    if (typeof showGlobalToast === 'function') showGlobalToast('链接已重置');
}

function openAllClientSubmissions() {
    // 先占位：后续接入“全部直填委托”列表
    alert('功能开发中：这里将展示全部单主直填委托（含取消/拒绝/已完成）。');
}

function openClientTemplateEditorPage() {
    showPage('clientTemplateEditor');
}

function backToSettingsPage() {
    showPage('settings');
}

// ========== 设置页：表单模板编辑器 ==========
const CLIENT_FORM_TEMPLATE_KEY = 'client_form_template_local';
const CLIENT_FORM_TEMPLATE_DEFAULT = {
    version: 1,
    fields: [
        { key: 'clientName', type: 'text', enabled: true, required: true, label: '称呼 / 单主昵称', placeholder: '例如：小明', order: 10, rules: { minLength: 1, maxLength: 30, regex: '' } },
        { key: 'contact', type: 'text', enabled: true, required: true, label: '联系方式（QQ/VX/MHS 等）', placeholder: '例如：QQ 12345', order: 20, rules: { minLength: 2, maxLength: 50, regex: '' } },
        { key: 'deadline', type: 'date', enabled: true, required: false, label: '截稿日', placeholder: '', order: 30, rules: { minLength: '', maxLength: '', regex: '' } },
        { key: 'remark', type: 'textarea', enabled: true, required: false, label: '委托总备注', placeholder: '可填写整体委托要求', order: 40, rules: { minLength: '', maxLength: 1000, regex: '' } }
    ]
};

let clientFormTemplate = JSON.parse(JSON.stringify(CLIENT_FORM_TEMPLATE_DEFAULT));

function getSafeClientFormTemplate(tpl) {
    const base = JSON.parse(JSON.stringify(CLIENT_FORM_TEMPLATE_DEFAULT));
    if (!tpl || !Array.isArray(tpl.fields)) return base;
    base.version = Number(tpl.version) || 1;
    base.fields = tpl.fields.map((f, idx) => ({
        key: f.key || ('field_' + Date.now() + '_' + idx),
        type: ['text', 'textarea', 'date', 'number'].includes(f.type) ? f.type : 'text',
        enabled: f.enabled !== false,
        required: !!f.required,
        label: f.label || '未命名字段',
        placeholder: f.placeholder || '',
        order: Number(f.order) || ((idx + 1) * 10),
        rules: {
            minLength: (f.rules && f.rules.minLength !== undefined) ? f.rules.minLength : '',
            maxLength: (f.rules && f.rules.maxLength !== undefined) ? f.rules.maxLength : '',
            regex: (f.rules && f.rules.regex) ? String(f.rules.regex) : ''
        }
    }));
    return base;
}

function loadClientFormTemplateLocal() {
    try {
        const raw = localStorage.getItem(CLIENT_FORM_TEMPLATE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        clientFormTemplate = getSafeClientFormTemplate(parsed);
    } catch (e) {
        console.warn('读取本地表单模板失败:', e);
    }
}

function saveClientFormTemplateLocal() {
    try {
        localStorage.setItem(CLIENT_FORM_TEMPLATE_KEY, JSON.stringify(clientFormTemplate));
    } catch (e) {
        console.warn('保存本地表单模板失败:', e);
    }
}

function initClientTemplateEditor() {
    const section = document.getElementById('clientTemplateEditorSection');
    if (!section) return;
    loadClientFormTemplateLocal();
    renderClientTemplateEditor();
    renderClientTemplatePreview();
}

function renderClientTemplateEditor() {
    const wrap = document.getElementById('clientTemplateEditorList');
    if (!wrap) return;
    const sorted = [...(clientFormTemplate.fields || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    wrap.innerHTML = sorted.map((f, idx) => {
        const minLength = f.rules && f.rules.minLength !== '' ? f.rules.minLength : '';
        const maxLength = f.rules && f.rules.maxLength !== '' ? f.rules.maxLength : '';
        const regex = f.rules && f.rules.regex ? f.rules.regex : '';
        return `
            <div style="border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                    <strong style="font-size:13px;">${f.label || '未命名字段'}</strong>
                    <div style="display:flex;gap:6px;">
                        <button type="button" class="btn secondary btn-compact" onclick="moveClientTemplateField('${f.key}', -1)" ${idx === 0 ? 'disabled' : ''}>上移</button>
                        <button type="button" class="btn secondary btn-compact" onclick="moveClientTemplateField('${f.key}', 1)" ${idx === sorted.length - 1 ? 'disabled' : ''}>下移</button>
                        <button type="button" class="btn danger-light btn-compact" onclick="removeClientTemplateField('${f.key}')">删除</button>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>字段名</label>
                        <input type="text" value="${(f.label || '').replace(/"/g, '&quot;')}" onchange="updateClientTemplateField('${f.key}','label',this.value)">
                    </div>
                    <div class="form-group">
                        <label>类型</label>
                        <select onchange="updateClientTemplateField('${f.key}','type',this.value)">
                            <option value="text" ${f.type === 'text' ? 'selected' : ''}>文本</option>
                            <option value="textarea" ${f.type === 'textarea' ? 'selected' : ''}>多行文本</option>
                            <option value="date" ${f.type === 'date' ? 'selected' : ''}>日期</option>
                            <option value="number" ${f.type === 'number' ? 'selected' : ''}>数字</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>占位提示</label>
                        <input type="text" value="${(f.placeholder || '').replace(/"/g, '&quot;')}" onchange="updateClientTemplateField('${f.key}','placeholder',this.value)">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>最小长度</label>
                        <input type="number" min="0" value="${minLength}" onchange="updateClientTemplateRule('${f.key}','minLength',this.value)">
                    </div>
                    <div class="form-group">
                        <label>最大长度</label>
                        <input type="number" min="0" value="${maxLength}" onchange="updateClientTemplateRule('${f.key}','maxLength',this.value)">
                    </div>
                    <div class="form-group">
                        <label>正则校验</label>
                        <input type="text" value="${String(regex).replace(/"/g, '&quot;')}" placeholder="如 ^[0-9]{5,}$" onchange="updateClientTemplateRule('${f.key}','regex',this.value)">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group" style="display:flex;gap:12px;align-items:center;">
                        <label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" ${f.enabled ? 'checked' : ''} onchange="updateClientTemplateField('${f.key}','enabled',this.checked)"> 启用</label>
                        <label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" ${f.required ? 'checked' : ''} onchange="updateClientTemplateField('${f.key}','required',this.checked)"> 必填</label>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderClientTemplatePreview() {
    const wrap = document.getElementById('clientTemplatePreview');
    if (!wrap) return;
    const sorted = [...(clientFormTemplate.fields || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    wrap.innerHTML = sorted.filter(f => f.enabled).map(f => {
        return `
            <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:12px;color:#666;">${f.label}${f.required ? ' *' : ''}</label>
                ${f.type === 'textarea' ? '<textarea disabled placeholder="' + (f.placeholder || '') + '" style="min-height:72px;"></textarea>' : '<input disabled type="' + (f.type || 'text') + '" placeholder="' + (f.placeholder || '') + '">'}
            </div>
        `;
    }).join('') || '<div class="text-gray" style="font-size:12px;">暂无启用字段</div>';
}

function updateClientTemplateField(key, field, value) {
    const item = (clientFormTemplate.fields || []).find(f => f.key === key);
    if (!item) return;
    item[field] = value;
    saveClientFormTemplateLocal();
    renderClientTemplateEditor();
    renderClientTemplatePreview();
}

function updateClientTemplateRule(key, ruleKey, value) {
    const item = (clientFormTemplate.fields || []).find(f => f.key === key);
    if (!item) return;
    if (!item.rules) item.rules = { minLength: '', maxLength: '', regex: '' };
    if (ruleKey === 'regex') {
        item.rules[ruleKey] = value || '';
    } else {
        item.rules[ruleKey] = (value === '' || value == null) ? '' : Number(value);
    }
    saveClientFormTemplateLocal();
    renderClientTemplatePreview();
}

function addClientTemplateField() {
    if (!clientFormTemplate.fields) clientFormTemplate.fields = [];
    const nextOrder = (clientFormTemplate.fields.length + 1) * 10;
    clientFormTemplate.fields.push({
        key: 'field_' + Date.now(),
        type: 'text',
        enabled: true,
        required: false,
        label: '新字段',
        placeholder: '',
        order: nextOrder,
        rules: { minLength: '', maxLength: '', regex: '' }
    });
    saveClientFormTemplateLocal();
    renderClientTemplateEditor();
    renderClientTemplatePreview();
}

function removeClientTemplateField(key) {
    if (!confirm('确定删除该字段吗？')) return;
    clientFormTemplate.fields = (clientFormTemplate.fields || []).filter(f => f.key !== key);
    saveClientFormTemplateLocal();
    renderClientTemplateEditor();
    renderClientTemplatePreview();
}

function moveClientTemplateField(key, step) {
    const sorted = [...(clientFormTemplate.fields || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = sorted.findIndex(f => f.key === key);
    if (idx < 0) return;
    const targetIdx = idx + step;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const temp = sorted[idx];
    sorted[idx] = sorted[targetIdx];
    sorted[targetIdx] = temp;
    sorted.forEach((f, i) => { f.order = (i + 1) * 10; });
    clientFormTemplate.fields = sorted;
    saveClientFormTemplateLocal();
    renderClientTemplateEditor();
    renderClientTemplatePreview();
}

function resetClientTemplateToDefault() {
    if (!confirm('确定恢复默认模板吗？')) return;
    clientFormTemplate = JSON.parse(JSON.stringify(CLIENT_FORM_TEMPLATE_DEFAULT));
    saveClientFormTemplateLocal();
    renderClientTemplateEditor();
    renderClientTemplatePreview();
}

async function saveClientFormTemplate() {
    saveClientFormTemplateLocal();

    const client = mgGetSupabaseClient();
    if (!client) {
        if (typeof showGlobalToast === 'function') showGlobalToast('已保存到本地（未连接云端）');
        return;
    }
    const { data: { session } } = await client.auth.getSession();
    if (!session || !session.user) {
        if (typeof showGlobalToast === 'function') showGlobalToast('已保存到本地（请登录后同步云端）');
        return;
    }

    const artistId = session.user.id;
    const payload = {
        artist_id: artistId,
        client_form_template: clientFormTemplate,
        updated_at: new Date().toISOString()
    };

    const { error } = await client
        .from('artist_settings')
        .upsert(payload, { onConflict: 'artist_id' });

    if (error) {
        console.error('保存表单模板到云端失败:', error);
        if (typeof showGlobalToast === 'function') showGlobalToast('本地已保存，云端保存失败');
        return;
    }

    if (typeof showGlobalToast === 'function') showGlobalToast('表单模板已保存');
}

// 检查是否已登录并启用云端
function mgIsCloudEnabled() {
    return !!(window.__APP_AUTH__ && window.__APP_AUTH__.enabled && mgGetSupabaseClient());
}

// 为本地 history item 生成/确保 external_id（用于云端去重）
function mgEnsureExternalId(item) {
    if (!item || !item.id) return null;
    // 如果已有 external_id，直接返回
    if (item.external_id) return item.external_id;
    // 基于本地 id 生成稳定的 external_id（格式：h_本地ID）
    // 使用本地 id 作为基础，确保同一设备上的订单有稳定的标识
    // 注意：如果本地 id 是时间戳，external_id 也会基于时间戳，但这样可以在同一设备上保持稳定
    item.external_id = 'h_' + String(item.id);
    // 保存到本地，确保下次使用时保持一致
    if (typeof saveData === 'function') {
        // 延迟保存，避免频繁写入
        clearTimeout(window._saveExternalIdTimer);
        window._saveExternalIdTimer = setTimeout(() => {
            saveData();
        }, 1000);
    }
    return item.external_id;
}

// 将本地 history item 映射为云端 orders 表结构
function mgMapLocalToCloud(item) {
    if (!item) return null;
    
    const externalId = mgEnsureExternalId(item);
    if (!externalId) return null;
    
    // 提取关键字段用于筛选/分析
    const totalPrice = item.finalTotal || item.agreedAmount || 0;
    const depositPrice = item.depositReceived || 0;
    
    // 提取制品类型（用于筛选）
    const productTypes = [];
    if (Array.isArray(item.productPrices)) {
        item.productPrices.forEach(p => {
            if (p.type && productSettings.find(ps => ps.id == p.type)) {
                const setting = productSettings.find(ps => ps.id == p.type);
                if (setting && setting.name) productTypes.push(setting.name);
            }
        });
    }
    
    // 提取状态（如果有）
    let status = 'pending';
    if (item.settlement) {
        const st = item.settlement.type;
        if (st === 'normal') status = 'completed';
        else if (st === 'full_refund' || st === 'cancel_with_fee') status = 'cancelled';
        else if (st === 'waste_fee') status = 'wasted';
    } else if (item.status) {
        status = item.status;
    }
    
    return {
        external_id: externalId,
        client_name: item.clientId || '未命名客户',
        contact: item.contact || '',
        total_price: totalPrice,
        deposit_price: depositPrice,
        order_type: productTypes.join(',') || null,
        status: status,
        start_date: item.startTime ? item.startTime.split(' ')[0] : null,
        due_date: item.deadline ? item.deadline.split(' ')[0] : null,
        tags: productTypes.length > 0 ? productTypes : null,
        payload: item // 完整原始数据
    };
}

// 首次登录一次性导入本地到云端（选项A：只导入云端没有的）
async function mgCloudMigrateOnce() {
    const client = mgGetSupabaseClient();
    if (!client) return false;
    
    // 检查是否已迁移
    if (localStorage.getItem('mg_cloud_migrated_v1') === '1') {
        console.log('✅ 本地数据已迁移过，跳过');
        return true;
    }
    
    try {
        // 1. 获取当前登录用户的 artist_id（必须先获取，用于过滤）
        const { data: { session } } = await client.auth.getSession();
        if (!session || !session.user) {
            console.error('未找到登录会话');
            return false;
        }
        const artistId = session.user.id;
        
        // 2. 获取云端已有的 external_id 列表（必须过滤 artist_id，防止查询其他用户数据）
        const { data: existingOrders, error: fetchError } = await client
            .from('orders')
            .select('external_id')
            .eq('artist_id', artistId);
        
        if (fetchError) {
            console.error('获取云端订单失败:', fetchError);
            return false;
        }
        
        const existingIds = new Set((existingOrders || []).map(o => o.external_id).filter(Boolean));
        
        // 3. 筛选本地需要上传的记录（云端没有的）
        const toUpload = [];
        const now = new Date().toISOString();
        for (const item of history) {
            const extId = mgEnsureExternalId(item);
            if (extId && !existingIds.has(extId)) {
                const mapped = mgMapLocalToCloud(item);
                if (mapped) {
                    mapped.artist_id = artistId;
                    mapped.created_at = now;
                    mapped.updated_at = now;
                    toUpload.push(mapped);
                }
            }
        }
        
        if (toUpload.length === 0) {
            console.log('✅ 本地数据已全部在云端，无需迁移');
            localStorage.setItem('mg_cloud_migrated_v1', '1');
            return true;
        }
        
        // 4. 批量上传
        const { error: insertError } = await client
            .from('orders')
            .insert(toUpload);
        
        if (insertError) {
            console.error('上传本地数据到云端失败:', insertError);
            return false;
        }
        
        // 5. 标记已迁移
        localStorage.setItem('mg_cloud_migrated_v1', '1');
        console.log(`✅ 成功导入 ${toUpload.length} 条本地排单到云端`);
        return true;
    } catch (err) {
        console.error('迁移过程出错:', err);
        return false;
    }
}

// 从云端拉取订单并合并到本地 history（用于云端筛选/分析）
async function mgCloudFetchOrders(filters = {}) {
    const client = mgGetSupabaseClient();
    if (!client) return [];
    
    try {
        // 获取当前登录用户的 artist_id（必须过滤，防止拉取其他用户数据）
        const { data: { session } } = await client.auth.getSession();
        if (!session || !session.user) {
            console.error('未找到登录会话，无法拉取云端订单');
            return [];
        }
        const artistId = session.user.id;
        
        let query = client.from('orders').select('*');
        
        // 必须添加 artist_id 过滤，防止拉取其他用户的数据
        query = query.eq('artist_id', artistId);
        
        // 应用筛选条件（示例：可按 status/order_type/日期范围等）
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.order_type) query = query.ilike('order_type', `%${filters.order_type}%`);
        if (filters.start_date) query = query.gte('due_date', filters.start_date);
        if (filters.end_date) query = query.lte('due_date', filters.end_date);
        
        query = query.order('created_at', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) {
            console.error('拉取云端订单失败:', error);
            return [];
        }
        
        // 将云端数据还原为本地 history 格式
        return (data || []).map(o => {
            // 直接使用 payload 中的原始数据，不要从 external_id 反推 id
            const item = o.payload ? { ...o.payload } : {};
            
            // 确保 external_id 存在
            if (o.external_id) {
                item.external_id = o.external_id;
            }
            
            // 如果 payload 中没有 id，才使用 external_id 反推（降级处理）
            if (!item.id && o.external_id) {
                const parsedId = parseInt(o.external_id.replace('h_', ''));
                if (!isNaN(parsedId)) {
                    item.id = parsedId;
                } else {
                    item.id = Date.now();
                }
            }
            
            return item;
        });
    } catch (err) {
        console.error('云端查询出错:', err);
        return [];
    }
}

// 跟踪未同步的订单ID
let unsyncedOrderIds = new Set();

// 校准未同步队列：剔除本地 history 中已不存在的订单 ID
function calibrateUnsyncedOrders() {
    if (!Array.isArray(history)) return;
    const localIds = new Set(history.map(item => item.id).filter(id => id !== undefined));
    let changed = false;
    for (const id of unsyncedOrderIds) {
        if (!localIds.has(id)) {
            unsyncedOrderIds.delete(id);
            changed = true;
        }
    }
    if (changed) {
        saveUnsyncedOrders();
    }
}

// 从localStorage加载未同步订单列表
function loadUnsyncedOrders() {
    try {
        const saved = localStorage.getItem('mg_unsynced_orders');
        if (saved) {
            unsyncedOrderIds = new Set(JSON.parse(saved));
            // 加载后立即执行一次校准
            calibrateUnsyncedOrders();
        }
    } catch (e) {
        console.error('加载未同步订单失败:', e);
        unsyncedOrderIds = new Set();
    }
}

// 保存未同步订单列表到localStorage
function saveUnsyncedOrders() {
    try {
        localStorage.setItem('mg_unsynced_orders', JSON.stringify([...unsyncedOrderIds]));
    } catch (e) {
        console.error('保存未同步订单失败:', e);
    }
}

// 标记订单为已同步
function markOrderSynced(orderId) {
    if (orderId) {
        unsyncedOrderIds.delete(orderId);
        saveUnsyncedOrders();
        updateSyncStatus();
    }
}

// 标记订单为未同步
function markOrderUnsynced(orderId) {
    if (orderId) {
        unsyncedOrderIds.add(orderId);
        saveUnsyncedOrders();
        updateSyncStatus();
    }
}

// 更新同步状态显示
function updateSyncStatus() {
    const statusText = document.getElementById('cloudSyncStatusText');
    if (!statusText) return;
    
    const isCloudModeOn = localStorage.getItem('mg_cloud_enabled') === '1';
    if (!isCloudModeOn) {
        statusText.innerHTML = `☁️ 云端同步未启用`;
        return;
    }
    
    // 每次更新 UI 前先校准一次，确保数量准确
    calibrateUnsyncedOrders();
    
    const unsyncedCount = unsyncedOrderIds.size;
    if (unsyncedCount > 0) {
        statusText.innerHTML = `✅ 智能同步模式已启用 <span style="color:#ff6b6b;font-weight:600;">（${unsyncedCount} 条未同步，自动同步中）</span>`;
    } else {
        statusText.innerHTML = `✅ 智能同步模式已启用 <span style="color:#4caf50;">（同步完成）</span>`;
    }
}

// 删除云端订单
async function mgCloudDeleteOrder(item, retryCount = 0) {
    if (!mgIsCloudEnabled()) {
        return;
    }
    
    const client = mgGetSupabaseClient();
    if (!client || !item) {
        return;
    }
    
    try {
        const externalId = mgEnsureExternalId(item);
        if (!externalId) {
            console.log('订单无 external_id，无需同步删除，标记为已同步');
            if (item && item.id) markOrderSynced(item.id);
            return;
        }
        
        // 获取当前登录用户的 artist_id
        const { data: { session } } = await client.auth.getSession();
        if (!session || !session.user) {
            console.warn('删除同步失败：未登录');
            return;
        }
        
        // 删除云端订单（根据 external_id 和 artist_id）
        const { error, count } = await client
            .from('orders')
            .delete()
            .eq('external_id', externalId)
            .eq('artist_id', session.user.id);
        
        if (error) {
            console.error('云端删除订单失败 (attempt ' + (retryCount+1) + '):', error.message || error);
            
            // 如果是权限错误或 404，通常不需要重试，保留在未同步列表中供用户查看
            if (error.code === '42501' || error.status === 404) {
                return;
            }

            // 重试机制（最多重试2次）
            if (retryCount < 2) {
                setTimeout(() => {
                    mgCloudDeleteOrder(item, retryCount + 1);
                }, 3000 * (retryCount + 1)); 
            }
        } else {
            console.log('✅ 云端删除订单成功:', externalId);
            // 无论实际删除了几行（即使云端已不存在），只要没有错误，就视为同步成功
            if (item && item.id) {
                markOrderSynced(item.id);
            }
        }
    } catch (err) {
        console.error('云端删除订单出错:', err);
        if (retryCount < 2 && (err.message?.includes('network') || err.message?.includes('fetch'))) {
            setTimeout(() => {
                mgCloudDeleteOrder(item, retryCount + 1);
            }, 3000 * (retryCount + 1));
        }
    }
}

// 保存/更新订单到云端（在 saveToHistory 后调用）
async function mgCloudUpsertOrder(item, retryCount = 0) {
    if (!mgIsCloudEnabled()) {
        if (item && item.id) markOrderUnsynced(item.id);
        return;
    }
    
    const client = mgGetSupabaseClient();
    if (!client || !item) {
        if (item && item.id) markOrderUnsynced(item.id);
        return;
    }
    
    try {
        const mapped = mgMapLocalToCloud(item);
        if (!mapped) {
            if (item && item.id) markOrderUnsynced(item.id);
            return;
        }
        
        // 获取当前登录用户的 artist_id
        const { data: { session } } = await client.auth.getSession();
        if (!session || !session.user) {
            if (item && item.id) markOrderUnsynced(item.id);
            return;
        }
        
        mapped.artist_id = session.user.id;
        const now = new Date().toISOString();
        mapped.updated_at = now;
        
        // 检查是否已存在（用于判断是插入还是更新）
        const { data: existing } = await client
            .from('orders')
            .select('external_id, created_at')
            .eq('external_id', mapped.external_id)
            .eq('artist_id', session.user.id)
            .single();
        
        // 如果是新记录，设置 created_at
        if (!existing) {
            mapped.created_at = now;
        }
        
        // 使用 upsert（如果 external_id 存在则更新，否则插入）
        const { error } = await client
            .from('orders')
            .upsert(mapped, { onConflict: 'external_id' });
        
        if (error) {
            console.error('云端同步失败:', error);
            if (item && item.id) markOrderUnsynced(item.id);
            
            // 重试机制（最多重试2次）
            if (retryCount < 2) {
                setTimeout(() => {
                    mgCloudUpsertOrder(item, retryCount + 1);
                }, 3000 * (retryCount + 1)); // 3秒、6秒后重试
            }
        } else {
            console.log('✅ 云端同步成功:', mapped.external_id);
            if (item && item.id) markOrderSynced(item.id);
        }
    } catch (err) {
        console.error('云端同步出错:', err);
        if (item && item.id) markOrderUnsynced(item.id);
        
        // 网络错误时重试
        if (retryCount < 2 && (err.message?.includes('network') || err.message?.includes('fetch'))) {
            setTimeout(() => {
                mgCloudUpsertOrder(item, retryCount + 1);
            }, 3000 * (retryCount + 1));
        }
    }
}

// 检测本地和云端的数据差异
async function mgDetectDataConflict() {
    const client = mgGetSupabaseClient();
    if (!client) return { hasConflict: false, localOrders: 0, cloudOrders: 0, localSettings: false, cloudSettings: false };
    
    try {
        // 检测订单数量
        const localOrders = history.length;
        const cloudHistory = await mgCloudFetchOrders();
        const cloudOrders = cloudHistory.length;
        
        // 检测设置是否存在
        const { data: { session } } = await client.auth.getSession();
        if (!session || !session.user) {
            return { hasConflict: false, localOrders, cloudOrders, localSettings: false, cloudSettings: false };
        }
        
        const { data: settingsData } = await client
            .from('artist_settings')
            .select('payload')
            .eq('artist_id', session.user.id)
            .single();
        
        const cloudSettings = !!settingsData?.payload;
        const localSettings = !!(productSettings.length > 0 || processSettings.length > 0 || Object.keys(defaultSettings).length > 0);
        
        // 判断是否有冲突（云端有数据或本地有数据，且两者不同）
        // 更宽松的判断：只要云端有数据或本地有数据，就显示策略选择
        const hasConflict = (cloudOrders > 0 || localOrders > 0) && 
                           (cloudOrders !== localOrders || (cloudSettings && localSettings));
        
        return {
            hasConflict,
            localOrders,
            cloudOrders,
            localSettings,
            cloudSettings,
            cloudHistory
        };
    } catch (err) {
        console.error('检测数据冲突失败:', err);
        return { hasConflict: false, localOrders: 0, cloudOrders: 0, localSettings: false, cloudSettings: false };
    }
}

// 登录后弹窗提示启用云端（优化版：检测数据冲突）
async function mgShowCloudEnableModal() {
    // 检查是否已登录（必须登录才能启用云端）
    if (!mgIsCloudEnabled()) return;
    // 如果已经启用过云端模式，不再弹窗
    if (localStorage.getItem('mg_cloud_enabled') === '1') return;
    
    // 检查是否已迁移
    const isMigrated = localStorage.getItem('mg_cloud_migrated_v1') === '1';
    
    // 检测数据冲突（首次启用时总是检测，让用户选择）
    const conflictInfo = await mgDetectDataConflict();
    // 首次启用时，总是显示策略选择，让用户有控制权
    // 即使本地和云端都没有数据，也显示策略选择（用户可以选择以本地为准，这样后续有数据时会自动同步）
    const hasConflict = !isMigrated; // 首次启用时总是显示策略选择
    
    // 创建弹窗
    const modal = document.createElement('div');
    modal.className = 'mg-cloud-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    
    let modalContent = '';
    if (hasConflict) {
        // 有冲突：显示首次同步策略选择
        modalContent = `
            <div class="mg-cloud-modal-content" style="background:white;padding:1.5rem;border-radius:12px;max-width:500px;width:100%;box-sizing:border-box;max-height:90vh;overflow-y:auto;">
                <h3 style="margin-top:0;margin-bottom:0.75rem;font-size:18px;font-weight:600;line-height:1.4;">🌐 首次启用云端同步</h3>
                <p style="margin-bottom:1rem;font-size:14px;line-height:1.5;color:#333;">请选择首次同步策略：</p>
                ${(conflictInfo.cloudOrders > 0 || conflictInfo.localOrders > 0 || conflictInfo.cloudSettings || conflictInfo.localSettings) ? `
                <div style="background:#fff9e6;padding:12px;border-radius:6px;margin-bottom:1rem;font-size:13px;color:#856404;">
                    <strong>数据统计：</strong><br>
                    本地订单：${conflictInfo.localOrders} 条<br>
                    云端订单：${conflictInfo.cloudOrders} 条<br>
                    ${conflictInfo.localSettings ? '本地有设置' : '本地无设置'}<br>
                    ${conflictInfo.cloudSettings ? '云端有设置' : '云端无设置'}
                </div>
                ` : `
                <div style="background:#e8f5e9;padding:12px;border-radius:6px;margin-bottom:1rem;font-size:13px;color:#2e7d32;">
                    <strong>提示：</strong>当前本地和云端都没有数据。选择策略后，后续数据将按选择的策略自动同步。
                </div>
                `}
                <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:1.25rem;">
                    <label style="display:flex;align-items:flex-start;gap:12px;padding:12px;border:2px solid #4caf50;border-radius:8px;cursor:pointer;background:#f1f8f4;">
                        <input type="radio" name="firstSyncPolicy" value="merge" style="margin-top:3px;cursor:pointer;flex-shrink:0;width:18px;height:18px;" checked>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;margin-bottom:4px;font-size:15px;">智能合并 ⭐ 推荐</div>
                            <div style="font-size:13px;color:#666;">保留所有数据，订单和设置都智能合并，不会丢失任何数据</div>
                        </div>
                    </label>
                    <label style="display:flex;align-items:flex-start;gap:12px;padding:12px;border:2px solid #e0e0e0;border-radius:8px;cursor:pointer;">
                        <input type="radio" name="firstSyncPolicy" value="local" style="margin-top:3px;cursor:pointer;flex-shrink:0;width:18px;height:18px;">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;margin-bottom:4px;font-size:15px;">以本地为准</div>
                            <div style="font-size:13px;color:#666;">本地数据覆盖云端，适合当前设备是主设备的情况</div>
                        </div>
                    </label>
                    <label style="display:flex;align-items:flex-start;gap:12px;padding:12px;border:2px solid #e0e0e0;border-radius:8px;cursor:pointer;">
                        <input type="radio" name="firstSyncPolicy" value="cloud" style="margin-top:3px;cursor:pointer;flex-shrink:0;width:18px;height:18px;">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;margin-bottom:4px;font-size:15px;">以云端为准</div>
                            <div style="font-size:13px;color:#666;">云端数据覆盖本地，适合云端是主版本的情况</div>
                        </div>
                    </label>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <button id="mg-cloud-confirm-btn" style="flex:1;min-width:120px;padding:0.75rem;background:#ff6b6b;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:15px;touch-action:manipulation;">确认</button>
                    <button id="mg-cloud-skip-btn" style="flex:1;min-width:120px;padding:0.75rem;background:#eee;color:#333;border:none;border-radius:6px;cursor:pointer;font-size:15px;touch-action:manipulation;">暂不启用</button>
                </div>
            </div>
        `;
    } else {
        // 无冲突：简单提示
        modalContent = `
            <div class="mg-cloud-modal-content" style="background:white;padding:1.5rem;border-radius:12px;max-width:400px;width:100%;box-sizing:border-box;">
                <h3 style="margin-top:0;margin-bottom:0.75rem;font-size:18px;font-weight:600;line-height:1.4;">🌐 检测到云端账号</h3>
                <p style="margin-bottom:0.75rem;font-size:14px;line-height:1.5;color:#333;">是否启用智能同步？启用后，你的排单数据将自动同步到云端，支持跨设备访问和数据分析。</p>
                ${!isMigrated ? '<p style="color:#666;font-size:13px;line-height:1.5;margin-bottom:0;">首次启用将自动导入本地数据到云端（不会重复）。</p>' : ''}
                <div style="display:flex;gap:10px;margin-top:1.5rem;flex-wrap:wrap;">
                    <button id="mg-cloud-enable-btn" style="flex:1;min-width:120px;padding:0.75rem;background:#ff6b6b;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:15px;touch-action:manipulation;">启用云端</button>
                    <button id="mg-cloud-skip-btn" style="flex:1;min-width:120px;padding:0.75rem;background:#eee;color:#333;border:none;border-radius:6px;cursor:pointer;font-size:15px;touch-action:manipulation;">暂不启用</button>
                </div>
            </div>
        `;
    }
    
    modal.innerHTML = modalContent;
    document.body.appendChild(modal);
    
    // 绑定事件
    if (hasConflict) {
        // 有冲突：需要选择策略
        document.getElementById('mg-cloud-confirm-btn').onclick = async () => {
            const selected = document.querySelector('input[name="firstSyncPolicy"]:checked');
            if (!selected) {
                alert('请选择一个同步策略');
                return;
            }
            
            const policy = selected.value;
            modal.remove();
            localStorage.setItem('mg_cloud_enabled', '1');
            localStorage.setItem('mg_first_sync_policy', policy);
            
            // 更新开关状态
            updateCloudSyncStatus();
            
            // 根据策略执行首次同步
            await mgExecuteFirstSync(policy, conflictInfo);
            
            // 同步完成后再次更新状态
            updateCloudSyncStatus();
        };
    } else {
        // 无冲突：直接启用
        document.getElementById('mg-cloud-enable-btn').onclick = async () => {
            modal.remove();
            localStorage.setItem('mg_cloud_enabled', '1');
            
            // 更新开关状态
            updateCloudSyncStatus();
            
            // 执行首次迁移（如果未迁移）
            if (!isMigrated) {
                const success = await mgCloudMigrateOnce();
                if (success) {
                    if (typeof showGlobalToast === 'function') {
                        showGlobalToast('✅ 本地数据已导入云端');
                    } else {
                        alert('✅ 本地数据已导入云端');
                    }
                }
            }
            
            // 从云端拉取最新数据（智能合并）
            await mgLoadSettingsFromCloud(true);
            const cloudHistory = await mgCloudFetchOrders();
            if (cloudHistory.length > 0) {
                const cloudIds = new Set(cloudHistory.map(h => h.external_id).filter(Boolean));
                const localOnlyOrders = history.filter(item => {
                    const extId = mgEnsureExternalId(item);
                    return extId && !cloudIds.has(extId);
                });
                history = [...cloudHistory, ...localOnlyOrders];
                saveData();
                if (typeof updateDisplay === 'function') updateDisplay();
                if (typeof renderScheduleCalendar === 'function') renderScheduleCalendar();
            }
            
            // 同步完成后再次更新状态
            updateCloudSyncStatus();
        };
    }
    
    document.getElementById('mg-cloud-skip-btn').onclick = () => {
        modal.remove();
        // 如果用户选择暂不启用，确保开关状态正确
        const toggleInput = document.getElementById('cloudSyncToggleInput');
        if (toggleInput) {
            toggleInput.checked = false;
        }
        updateCloudSyncStatus();
    };
}

// 重新选择首次同步策略（用于已启用但想重新选择的用户）
async function mgReselectFirstSyncPolicy() {
    if (!mgIsCloudEnabled()) {
        alert('请先登录');
        return;
    }
    
    if (!confirm('确定要重新选择首次同步策略吗？这将重新执行首次同步，可能会影响现有数据。')) {
        return;
    }
    
    // 清除迁移标记，重新检测
    localStorage.removeItem('mg_cloud_migrated_v1');
    localStorage.removeItem('mg_first_sync_policy');
    
    // 检测数据冲突
    const conflictInfo = await mgDetectDataConflict();
    
    // 显示策略选择弹窗
    const modal = document.createElement('div');
    modal.className = 'mg-cloud-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
        <div class="mg-cloud-modal-content" style="background:white;padding:1.5rem;border-radius:12px;max-width:500px;width:100%;box-sizing:border-box;max-height:90vh;overflow-y:auto;">
            <h3 style="margin-top:0;margin-bottom:0.75rem;font-size:18px;font-weight:600;line-height:1.4;">🌐 重新选择首次同步策略</h3>
            <p style="margin-bottom:1rem;font-size:14px;line-height:1.5;color:#333;">请选择首次同步策略：</p>
            <div style="background:#fff9e6;padding:12px;border-radius:6px;margin-bottom:1rem;font-size:13px;color:#856404;">
                <strong>数据统计：</strong><br>
                本地订单：${conflictInfo.localOrders} 条<br>
                云端订单：${conflictInfo.cloudOrders} 条<br>
                ${conflictInfo.localSettings ? '本地有设置' : '本地无设置'}<br>
                ${conflictInfo.cloudSettings ? '云端有设置' : '云端无设置'}
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:1.25rem;">
                <label style="display:flex;align-items:flex-start;gap:12px;padding:12px;border:2px solid #4caf50;border-radius:8px;cursor:pointer;background:#f1f8f4;">
                    <input type="radio" name="firstSyncPolicy" value="merge" style="margin-top:3px;cursor:pointer;flex-shrink:0;width:18px;height:18px;" checked>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;margin-bottom:4px;font-size:15px;">智能合并 ⭐ 推荐</div>
                        <div style="font-size:13px;color:#666;">保留所有数据，订单和设置都智能合并，不会丢失任何数据</div>
                    </div>
                </label>
                <label style="display:flex;align-items:flex-start;gap:12px;padding:12px;border:2px solid #e0e0e0;border-radius:8px;cursor:pointer;">
                    <input type="radio" name="firstSyncPolicy" value="local" style="margin-top:3px;cursor:pointer;flex-shrink:0;width:18px;height:18px;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;margin-bottom:4px;font-size:15px;">以本地为准</div>
                        <div style="font-size:13px;color:#666;">本地数据覆盖云端，适合当前设备是主设备的情况</div>
                    </div>
                </label>
                <label style="display:flex;align-items:flex-start;gap:12px;padding:12px;border:2px solid #e0e0e0;border-radius:8px;cursor:pointer;">
                    <input type="radio" name="firstSyncPolicy" value="cloud" style="margin-top:3px;cursor:pointer;flex-shrink:0;width:18px;height:18px;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;margin-bottom:4px;font-size:15px;">以云端为准</div>
                        <div style="font-size:13px;color:#666;">云端数据覆盖本地，适合云端是主版本的情况</div>
                    </div>
                </label>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button id="mg-reselect-confirm-btn" style="flex:1;min-width:120px;padding:0.75rem;background:#ff6b6b;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:15px;touch-action:manipulation;">确认</button>
                <button id="mg-reselect-cancel-btn" style="flex:1;min-width:120px;padding:0.75rem;background:#eee;color:#333;border:none;border-radius:6px;cursor:pointer;font-size:15px;touch-action:manipulation;">取消</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('mg-reselect-confirm-btn').onclick = async () => {
        const selected = document.querySelector('input[name="firstSyncPolicy"]:checked');
        if (!selected) {
            alert('请选择一个同步策略');
            return;
        }
        
        const policy = selected.value;
        modal.remove();
        localStorage.setItem('mg_first_sync_policy', policy);
        
        // 执行首次同步
        await mgExecuteFirstSync(policy, conflictInfo);
        updateCloudSyncStatus();
    };
    
    document.getElementById('mg-reselect-cancel-btn').onclick = () => {
        modal.remove();
    };
}

// 执行首次同步（根据选择的策略）
async function mgExecuteFirstSync(policy, conflictInfo) {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast('正在执行首次同步...');
    }
    
    try {
        if (policy === 'merge') {
            // 智能合并
            try {
                await mgLoadSettingsFromCloud(true);
            } catch (err) {
                console.warn('拉取云端设置失败（可能云端无设置）:', err);
                // 继续执行，不影响后续流程
            }
            
            let cloudHistory = [];
            try {
                cloudHistory = conflictInfo.cloudHistory || await mgCloudFetchOrders();
            } catch (err) {
                console.error('拉取云端订单失败:', err);
                throw new Error('拉取云端订单失败: ' + (err.message || '未知错误'));
            }
            
            const cloudIds = new Set(cloudHistory.map(h => h.external_id).filter(Boolean));
            
            // 上传本地独有的订单
            let uploadCount = 0;
            for (const item of history) {
                try {
                    const extId = mgEnsureExternalId(item);
                    if (extId && !cloudIds.has(extId)) {
                        await mgCloudUpsertOrder(item);
                        uploadCount++;
                    }
                } catch (err) {
                    console.error('上传订单失败:', item.id, err);
                    // 继续上传其他订单，不中断流程
                }
            }
            
            // 拉取所有订单并合并
            try {
                const mergedHistory = await mgCloudFetchOrders();
                if (mergedHistory.length > 0) {
                    history = mergedHistory;
                    saveData();
                }
            } catch (err) {
                console.error('拉取合并后的订单失败:', err);
                // 如果拉取失败，至少本地数据已上传，继续执行
            }
            
            // 上传合并后的设置
            try {
                await mgSyncSettingsToCloud();
            } catch (err) {
                console.error('上传设置失败:', err);
                // 设置上传失败不影响整体流程，但需要提示用户
                if (typeof showGlobalToast === 'function') {
                    showGlobalToast('⚠️ 设置上传失败，请稍后手动同步');
                }
            }
            
            if (typeof showGlobalToast === 'function') {
                showGlobalToast(`✅ 首次同步完成：已上传 ${uploadCount} 条订单，数据已智能合并`);
            } else {
                alert(`✅ 首次同步完成：已上传 ${uploadCount} 条订单，数据已智能合并`);
            }
            
        } else if (policy === 'local') {
            // 以本地为准
            try {
                await mgSyncSettingsToCloud();
            } catch (err) {
                console.error('上传设置失败:', err);
                throw new Error('上传设置失败: ' + (err.message || '未知错误'));
            }
            
            let uploadCount = 0;
            for (const item of history) {
                try {
                    await mgCloudUpsertOrder(item);
                    uploadCount++;
                } catch (err) {
                    console.error('上传订单失败:', item.id, err);
                    // 继续上传其他订单
                }
            }
            
            if (typeof showGlobalToast === 'function') {
                showGlobalToast(`✅ 首次同步完成：已上传 ${uploadCount} 条订单，本地数据已覆盖云端`);
            } else {
                alert(`✅ 首次同步完成：已上传 ${uploadCount} 条订单，本地数据已覆盖云端`);
            }
            
        } else if (policy === 'cloud') {
            // 以云端为准
            try {
                await mgLoadSettingsFromCloud(false); // 直接覆盖
            } catch (err) {
                console.error('拉取云端设置失败:', err);
                throw new Error('拉取云端设置失败: ' + (err.message || '未知错误'));
            }
            
            try {
                const cloudHistory = conflictInfo.cloudHistory || await mgCloudFetchOrders();
                if (cloudHistory.length > 0) {
                    history = cloudHistory;
                    saveData();
                }
            } catch (err) {
                console.error('拉取云端订单失败:', err);
                throw new Error('拉取云端订单失败: ' + (err.message || '未知错误'));
            }
            
            if (typeof showGlobalToast === 'function') {
                showGlobalToast('✅ 首次同步完成：云端数据已覆盖本地');
            } else {
                alert('✅ 首次同步完成：云端数据已覆盖本地');
            }
        }
        
        localStorage.setItem('mg_cloud_migrated_v1', '1');
        
        if (typeof updateDisplay === 'function') updateDisplay();
        if (typeof renderScheduleCalendar === 'function') renderScheduleCalendar();
        
    } catch (err) {
        console.error('首次同步失败:', err);
        const errorMsg = err.message || '未知错误';
        if (typeof showGlobalToast === 'function') {
            showGlobalToast('❌ 首次同步失败: ' + errorMsg);
        } else {
            alert('首次同步失败: ' + errorMsg + '，请稍后重试');
        }
        // 不设置迁移标记，允许用户重试
    }
}

// 更新设置页面的云端状态显示
function updateCloudSyncStatus() {
    const statusText = document.getElementById('cloudSyncStatusText');
    const toggleInput = document.getElementById('cloudSyncToggleInput');
    const toggleLabel = document.getElementById('cloudSyncToggle');
    const actionsContainer = document.getElementById('cloudSyncActions');
    const syncBtn = document.getElementById('syncCloudBtn');
    const loadBtn = document.getElementById('loadCloudBtn');
    const debugBtn = document.getElementById('cloudDebugBtn');
    
    if (!statusText) return;
    
    const isEnabled = mgIsCloudEnabled();
    const isCloudModeOn = localStorage.getItem('mg_cloud_enabled') === '1';
    const isMigrated = localStorage.getItem('mg_cloud_migrated_v1') === '1';
    
    // 更新开关状态
    if (toggleInput) {
        toggleInput.checked = isCloudModeOn && isEnabled;
        toggleInput.disabled = !isEnabled;
    }
    
    if (toggleLabel) {
        if (!isEnabled) {
            toggleLabel.style.opacity = '0.5';
            toggleLabel.style.cursor = 'not-allowed';
        } else {
            toggleLabel.style.opacity = '1';
            toggleLabel.style.cursor = 'pointer';
        }
    }
    
    if (!isEnabled) {
        statusText.textContent = '请先登录';
        if (actionsContainer) actionsContainer.style.display = 'none';
        if (debugBtn) debugBtn.style.display = 'inline-block';
    } else if (!isCloudModeOn) {
        statusText.textContent = '开启开关以启用智能同步';
        if (actionsContainer) actionsContainer.style.display = 'none';
        if (debugBtn) debugBtn.style.display = 'inline-block';
    } else {
        // 加载未同步订单列表
        loadUnsyncedOrders();
        const unsyncedCount = unsyncedOrderIds.size;
        
        // 简化状态文本
        let statusMsg = '已启用';
        if (unsyncedCount > 0) {
            statusMsg = `${unsyncedCount} 条未同步`;
        }
        statusText.textContent = statusMsg;
        statusText.style.color = unsyncedCount > 0 ? '#ff6b6b' : '#666';
        
        // 显示操作按钮
        if (actionsContainer) {
            actionsContainer.style.display = 'flex';
        }
        
        if (syncBtn) {
            syncBtn.style.display = 'inline-block';
            // 简化按钮文字
            if (unsyncedCount > 0) {
                syncBtn.textContent = `同步（${unsyncedCount}）`;
            } else {
                syncBtn.textContent = '上传';
            }
        }
        if (loadBtn) loadBtn.style.display = 'inline-block';
        const reselectBtn = document.getElementById('reselectSyncBtn');
        if (reselectBtn) reselectBtn.style.display = 'inline-block';
    }
}

// 处理云端同步开关切换
async function handleCloudSyncToggle(checked) {
    if (!mgIsCloudEnabled()) {
        // 如果未登录，恢复开关状态
        const toggleInput = document.getElementById('cloudSyncToggleInput');
        if (toggleInput) toggleInput.checked = false;
        alert('请先登录');
        return;
    }
    
    if (checked) {
        // 启用云端模式
        const currentStatus = localStorage.getItem('mg_cloud_enabled');
        if (currentStatus === '1') {
            // 已经启用，不需要操作
            return;
        }
        
        // 首次启用时，显示策略选择弹窗（三个选择）
        await mgShowCloudEnableModal();
        // 注意：mgShowCloudEnableModal 内部会设置 mg_cloud_enabled，所以这里不需要再次设置
    } else {
        // 禁用云端模式
        if (!confirm('确定要禁用云端模式吗？禁用后，数据将不再自动同步到云端，但本地数据不会丢失。')) {
            // 用户取消，恢复开关状态
            const toggleInput = document.getElementById('cloudSyncToggleInput');
            if (toggleInput) toggleInput.checked = true;
            return;
        }
        
        localStorage.setItem('mg_cloud_enabled', '0');
        
        if (typeof showGlobalToast === 'function') {
            showGlobalToast('✅ 云端模式已禁用');
        } else {
            alert('✅ 云端模式已禁用');
        }
    }
    
    updateCloudSyncStatus();
}

// 兼容旧函数名（保留以防其他地方调用）
async function handleEnableCloud() {
    const toggleInput = document.getElementById('cloudSyncToggleInput');
    if (toggleInput) {
        toggleInput.checked = true;
        await handleCloudSyncToggle(true);
    }
}

async function handleDisableCloud() {
    const toggleInput = document.getElementById('cloudSyncToggleInput');
    if (toggleInput) {
        toggleInput.checked = false;
        await handleCloudSyncToggle(false);
    }
}

// 手动同步到云端
async function handleSyncCloud() {
    if (!mgIsCloudEnabled()) {
        alert('请先登录');
        return;
    }
    
    if (typeof showGlobalToast === 'function') {
        showGlobalToast('正在同步到云端...');
    }
    
    // 同步所有本地 history 到云端
    const client = mgGetSupabaseClient();
    if (!client) return;
    
    let synced = 0;
    for (const item of history) {
        await mgCloudUpsertOrder(item);
        synced++;
    }
    
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(`✅ 已同步 ${synced} 条排单到云端`);
    } else {
        alert(`✅ 已同步 ${synced} 条排单到云端`);
    }
}

// 从云端加载数据
async function handleLoadCloud() {
    if (!mgIsCloudEnabled()) {
        alert('请先登录');
        return;
    }
    
    if (typeof showGlobalToast === 'function') {
        showGlobalToast('正在从云端加载...');
    }
    
    const cloudHistory = await mgCloudFetchOrders();
    if (cloudHistory.length > 0) {
        history = cloudHistory;
        saveData();
        if (typeof updateDisplay === 'function') updateDisplay();
        if (typeof renderScheduleCalendar === 'function') renderScheduleCalendar();
        
        if (typeof showGlobalToast === 'function') {
            showGlobalToast(`✅ 已从云端加载 ${cloudHistory.length} 条排单`);
        } else {
            alert(`✅ 已从云端加载 ${cloudHistory.length} 条排单`);
        }
    } else {
        if (typeof showGlobalToast === 'function') {
            showGlobalToast('云端暂无数据');
        } else {
            alert('云端暂无数据');
        }
    }
}

// ====== 设置同步 V2（分域分条目 + 软删除） ======
function mgSafeClone(obj, fallback) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (_) { return fallback; }
}

function mgEnsureStableIdForItem(item, prefix) {
    if (!item || typeof item !== 'object') return String(prefix + '_' + Date.now() + '_' + Math.random());
    if (item.id == null || item.id === '') {
        item.id = String(prefix + '_' + Date.now() + '_' + Math.random());
    }
    return String(item.id);
}

function mgObjectToDomainItems(obj) {
    const o = (obj && typeof obj === 'object') ? obj : {};
    return Object.entries(o).map(function (entry) {
        return { item_id: String(entry[0]), payload: mgSafeClone(entry[1], {}) };
    });
}

function mgBuildSettingsV2LocalState() {
    const calc = mgSafeClone(defaultSettings || {}, {});
    const artistInfo = mgSafeClone((defaultSettings && defaultSettings.artistInfo) || {}, {});
    delete calc.otherFees;
    delete calc.artistInfo;
    delete calc.usageCoefficients;
    delete calc.urgentCoefficients;
    delete calc.sameModelCoefficients;
    delete calc.discountCoefficients;
    delete calc.platformFees;

    const processItems = (Array.isArray(processSettings) ? processSettings : []).map(function (p) {
        const stableId = mgEnsureStableIdForItem(p, 'p');
        return { item_id: stableId, payload: mgSafeClone(p, {}) };
    });
    const productItems = (Array.isArray(productSettings) ? productSettings : []).map(function (p) {
        const stableId = mgEnsureStableIdForItem(p, 'prd');
        return { item_id: stableId, payload: mgSafeClone(p, {}) };
    });
    const templateItems = (Array.isArray(templates) ? templates : []).map(function (t) {
        const stableId = mgEnsureStableIdForItem(t, 'tpl');
        return { item_id: stableId, payload: mgSafeClone(t, {}) };
    });

    const feeObj = (defaultSettings && defaultSettings.otherFees && typeof defaultSettings.otherFees === 'object') ? defaultSettings.otherFees : {};
    const feeItems = Object.entries(feeObj).map(function (entry) {
        return { item_id: String(entry[0]), payload: mgSafeClone(entry[1], {}) };
    });

    const usageItems = mgObjectToDomainItems(defaultSettings && defaultSettings.usageCoefficients);
    const urgentItems = mgObjectToDomainItems(defaultSettings && defaultSettings.urgentCoefficients);
    const sameModelItems = mgObjectToDomainItems(defaultSettings && defaultSettings.sameModelCoefficients);
    const discountItems = mgObjectToDomainItems(defaultSettings && defaultSettings.discountCoefficients);
    const platformFeeItems = mgObjectToDomainItems(defaultSettings && defaultSettings.platformFees);

    const extraUpItems = (Array.isArray(defaultSettings && defaultSettings.extraPricingUp) ? defaultSettings.extraPricingUp : []).map(function (e) {
        const stableId = mgEnsureStableIdForItem(e, 'xup');
        return { item_id: stableId, payload: mgSafeClone(e, {}) };
    });

    const extraDownItems = (Array.isArray(defaultSettings && defaultSettings.extraPricingDown) ? defaultSettings.extraPricingDown : []).map(function (e) {
        const stableId = mgEnsureStableIdForItem(e, 'xdn');
        return { item_id: stableId, payload: mgSafeClone(e, {}) };
    });

    return {
        singletons: [
            { domain: 'calculator_settings', payload: calc },
            { domain: 'artist_info', payload: artistInfo }
        ],
        itemsByDomain: {
            process_settings: processItems,
            product_settings: productItems,
            templates: templateItems,
            other_fee_types: feeItems,
            usage_coefficients: usageItems,
            urgent_coefficients: urgentItems,
            same_model_coefficients: sameModelItems,
            discount_coefficients: discountItems,
            platform_fees: platformFeeItems,
            extra_pricing_up: extraUpItems,
            extra_pricing_down: extraDownItems
        }
    };
}

function mgDomainItemsToObject(grouped, domain) {
    const rows = grouped[domain] || [];
    const out = {};
    rows.forEach(function (r) {
        const key = String(r.item_id || '');
        if (!key) return;
        out[key] = mgSafeClone(r.payload || {}, {});
    });
    return out;
}

function mgApplySettingsV2(singletons, items, mergeMode) {
    const singletonMap = new Map();
    (singletons || []).forEach(function (row) {
        if (row && row.domain) singletonMap.set(String(row.domain), row.payload || {});
    });

    const calc = singletonMap.get('calculator_settings');
    if (calc && typeof calc === 'object') {
        if (mergeMode) Object.assign(defaultSettings, mergeObjectSettings(calc, defaultSettings || {}));
        else Object.assign(defaultSettings, mgSafeClone(calc, {}));
    }

    // V2 中支持把 extraPricingUp/Down 拆分为条目域，这里先从单例中剥离，避免被空数组覆盖
    if (defaultSettings && defaultSettings.extraPricingUp == null) defaultSettings.extraPricingUp = [];
    if (defaultSettings && defaultSettings.extraPricingDown == null) defaultSettings.extraPricingDown = [];
    const artistInfo = singletonMap.get('artist_info');
    if (artistInfo && typeof artistInfo === 'object') {
        defaultSettings.artistInfo = mergeMode
            ? mergeObjectSettings(artistInfo, defaultSettings.artistInfo || {})
            : mgSafeClone(artistInfo, {});
    }

    const grouped = {};
    (items || []).forEach(function (row) {
        if (!row || !row.domain || row.deleted_at) return;
        if (!grouped[row.domain]) grouped[row.domain] = [];
        grouped[row.domain].push(row);
    });

    function rowsToPayload(domain) {
        return (grouped[domain] || []).map(function (r) { return mgSafeClone(r.payload || {}, {}); });
    }

    const cloudProducts = rowsToPayload('product_settings');
    if (cloudProducts.length || !mergeMode) {
        const merged = mergeMode ? mergeArraySettings(cloudProducts, productSettings || [], 'id') : cloudProducts;
        productSettings.length = 0;
        productSettings.push(...merged);
    }

    const cloudProcess = rowsToPayload('process_settings');
    if (cloudProcess.length || !mergeMode) {
        const merged = mergeMode ? mergeArraySettings(cloudProcess, processSettings || [], 'id') : cloudProcess;
        processSettings.length = 0;
        processSettings.push(...merged);
    }

    const cloudTemplates = rowsToPayload('templates');
    if (cloudTemplates.length || !mergeMode) {
        const merged = mergeMode ? mergeArraySettings(cloudTemplates, templates || [], 'id') : cloudTemplates;
        templates.length = 0;
        templates.push(...merged);
    }

    const feeRows = grouped['other_fee_types'] || [];
    const feeObj = {};
    feeRows.forEach(function (r) {
        const key = String(r.item_id || '');
        if (!key) return;
        feeObj[key] = mgSafeClone(r.payload || {}, {});
    });
    if (!defaultSettings.otherFees || typeof defaultSettings.otherFees !== 'object') defaultSettings.otherFees = {};
    if (mergeMode) {
        defaultSettings.otherFees = { ...defaultSettings.otherFees, ...feeObj };
    } else {
        defaultSettings.otherFees = feeObj;
    }

    const usageObj = mgDomainItemsToObject(grouped, 'usage_coefficients');
    if (Object.keys(usageObj).length || !mergeMode) {
        defaultSettings.usageCoefficients = mergeMode
            ? mergeObjectSettings(usageObj, defaultSettings.usageCoefficients || {})
            : usageObj;
    }

    const urgentObj = mgDomainItemsToObject(grouped, 'urgent_coefficients');
    if (Object.keys(urgentObj).length || !mergeMode) {
        defaultSettings.urgentCoefficients = mergeMode
            ? mergeObjectSettings(urgentObj, defaultSettings.urgentCoefficients || {})
            : urgentObj;
    }

    const sameModelObj = mgDomainItemsToObject(grouped, 'same_model_coefficients');
    if (Object.keys(sameModelObj).length || !mergeMode) {
        defaultSettings.sameModelCoefficients = mergeMode
            ? mergeObjectSettings(sameModelObj, defaultSettings.sameModelCoefficients || {})
            : sameModelObj;
    }

    const discountObj = mgDomainItemsToObject(grouped, 'discount_coefficients');
    if (Object.keys(discountObj).length || !mergeMode) {
        defaultSettings.discountCoefficients = mergeMode
            ? mergeObjectSettings(discountObj, defaultSettings.discountCoefficients || {})
            : discountObj;
    }

    const platformObj = mgDomainItemsToObject(grouped, 'platform_fees');
    if (Object.keys(platformObj).length || !mergeMode) {
        defaultSettings.platformFees = mergeMode
            ? mergeObjectSettings(platformObj, defaultSettings.platformFees || {})
            : platformObj;
    }

    const upRows = grouped['extra_pricing_up'] || [];
    const cloudUp = upRows.map(function (r) { return mgSafeClone(r.payload || {}, {}); });
    if (cloudUp.length || !mergeMode) {
        const mergedUp = mergeMode ? mergeArraySettings(cloudUp, defaultSettings.extraPricingUp || [], 'id') : cloudUp;
        defaultSettings.extraPricingUp = mergedUp;
    }

    const downRows = grouped['extra_pricing_down'] || [];
    const cloudDown = downRows.map(function (r) { return mgSafeClone(r.payload || {}, {}); });
    if (cloudDown.length || !mergeMode) {
        const mergedDown = mergeMode ? mergeArraySettings(cloudDown, defaultSettings.extraPricingDown || [], 'id') : cloudDown;
        defaultSettings.extraPricingDown = mergedDown;
    }
}

async function mgTryLoadSettingsFromCloudV2(client, artistId, mergeMode) {
    try {
        const [{ data: singletons, error: sErr }, { data: items, error: iErr }] = await Promise.all([
            client.from('artist_settings_singleton').select('domain,payload,updated_at').eq('artist_id', artistId),
            client.from('artist_settings_items').select('domain,item_id,payload,updated_at,deleted_at').eq('artist_id', artistId)
        ]);

        if (sErr || iErr) {
            const code = (sErr && sErr.code) || (iErr && iErr.code) || '';
            const msg = (sErr && sErr.message) || (iErr && iErr.message) || '';
            if (code === 'PGRST205' || String(msg).includes('relation') || String(msg).includes('does not exist')) {
                return { supported: false };
            }
            throw (sErr || iErr);
        }

        mgApplySettingsV2(singletons || [], items || [], mergeMode);
        return { supported: true, hasData: (singletons && singletons.length) || (items && items.length) };
    } catch (err) {
        throw err;
    }
}

async function mgTrySyncSettingsToCloudV2(client, artistId) {
    const state = mgBuildSettingsV2LocalState();
    const now = new Date().toISOString();

    const singletonRows = (state.singletons || []).map(function (row) {
        return { artist_id: artistId, domain: row.domain, payload: row.payload, updated_at: now };
    });

    const activeRows = [];
    Object.entries(state.itemsByDomain || {}).forEach(function (entry) {
        const domain = entry[0];
        const rows = entry[1] || [];
        rows.forEach(function (r) {
            activeRows.push({
                artist_id: artistId,
                domain: domain,
                item_id: String(r.item_id),
                payload: r.payload,
                updated_at: now,
                deleted_at: null
            });
        });
    });

    const { data: existingItems, error: fetchErr } = await client
        .from('artist_settings_items')
        .select('domain,item_id,deleted_at')
        .eq('artist_id', artistId);

    if (fetchErr) {
        const code = fetchErr.code || '';
        const msg = fetchErr.message || '';
        if (code === 'PGRST205' || String(msg).includes('relation') || String(msg).includes('does not exist')) {
            return { supported: false };
        }
        throw fetchErr;
    }

    const activeKeySet = new Set(activeRows.map(function (r) { return r.domain + '::' + r.item_id; }));
    const tombstoneRows = (existingItems || [])
        .filter(function (row) {
            const key = String(row.domain) + '::' + String(row.item_id);
            return !activeKeySet.has(key);
        })
        .map(function (row) {
            return {
                artist_id: artistId,
                domain: row.domain,
                item_id: String(row.item_id),
                payload: null,
                updated_at: now,
                deleted_at: now
            };
        });

    const allItemRows = activeRows.concat(tombstoneRows);

    const [{ error: sUpsertErr }, { error: iUpsertErr }] = await Promise.all([
        singletonRows.length
            ? client.from('artist_settings_singleton').upsert(singletonRows, { onConflict: 'artist_id,domain' })
            : Promise.resolve({ error: null }),
        allItemRows.length
            ? client.from('artist_settings_items').upsert(allItemRows, { onConflict: 'artist_id,domain,item_id' })
            : Promise.resolve({ error: null })
    ]);

    if (sUpsertErr || iUpsertErr) {
        const err = sUpsertErr || iUpsertErr;
        const code = err.code || '';
        const msg = err.message || '';
        if (code === 'PGRST205' || String(msg).includes('relation') || String(msg).includes('does not exist')) {
            return { supported: false };
        }
        throw err;
    }

    return { supported: true };
}

// ====== 设置同步：artist_settings ======
async function mgSyncSettingsToCloud(silent = false) {
    if (!mgIsCloudEnabled()) {
        if (!silent) alert('请先登录');
        return;
    }

    const client = mgGetSupabaseClient();
    if (!client) return;

    const { data: { session } } = await client.auth.getSession();
    if (!session || !session.user) {
        if (!silent) alert('登录状态已失效，请重新登录');
        return;
    }
    
    // 防止重复同步：如果正在同步，直接返回
    if (window._isSyncingSettings) {
        return;
    }
    window._isSyncingSettings = true;

    // 以本地为准：直接上传当前本地设置到云端（包含删除），不从云端先合并
    try {
        const artistId = session.user.id;

        // 优先尝试 V2（分表分条目 + 软删除）
        const v2Result = await mgTrySyncSettingsToCloudV2(client, artistId);
        if (v2Result && v2Result.supported) {
            if (!silent) {
                if (typeof showGlobalToast === 'function') showGlobalToast('✅ 设置已上传到云端（V2）');
                else alert('设置已上传到云端（V2）');
            }
            window._isSyncingSettings = false;
            return;
        }

        // V2 不可用时回退到旧版 artist_settings 整包
        const cleanPayload = {
            calculatorSettings: JSON.parse(JSON.stringify(defaultSettings || {})),
            productSettings: JSON.parse(JSON.stringify(productSettings || [])),
            processSettings: JSON.parse(JSON.stringify(processSettings || [])),
            templates: JSON.parse(JSON.stringify(templates || [])),
            exportDate: new Date().toISOString()
        };

        const now = new Date().toISOString();
        
        // 检查是否已存在设置（不查询 created_at，因为该列可能不存在）
        const { data: existing, error: checkError } = await client
            .from('artist_settings')
            .select('artist_id')
            .eq('artist_id', artistId)
            .maybeSingle(); // 使用 maybeSingle 避免未找到记录时的错误
        
        if (checkError && checkError.code !== 'PGRST116') {
            console.error('检查设置是否存在失败:', checkError);
            throw checkError;
        }
        
        const settingsData = {
            artist_id: artistId,
            payload: cleanPayload,
            updated_at: now
        };
        
        // 使用 upsert，兼容Safari：先尝试更新，如果不存在则插入
        let error;
        if (existing) {
            const { error: updateError } = await client
                .from('artist_settings')
                .update({
                    payload: cleanPayload,
                    updated_at: now
                })
                .eq('artist_id', artistId);
            error = updateError;
        } else {
            const { error: insertError } = await client
                .from('artist_settings')
                .insert(settingsData);
            error = insertError;
        }

        if (error) {
            console.error('上传设置到云端失败:', error);
            console.error('错误代码:', error.code);
            console.error('错误详情:', JSON.stringify(error, null, 2));
            const errorMsg = error.message || error.hint || '未知错误';
            if (!silent) {
                alert('上传设置到云端失败: ' + errorMsg + '，请稍后重试');
            }
            window._isSyncingSettings = false;
            return;
        }

        if (!silent) {
            if (typeof showGlobalToast === 'function') showGlobalToast('✅ 设置已上传到云端');
            else alert('设置已上传到云端');
        }
        window._isSyncingSettings = false;
    } catch (err) {
        console.error('智能合并设置失败:', err);
        console.error('错误堆栈:', err.stack);
        
        // 如果智能合并失败，仍然尝试直接上传（降级处理）
        try {
            // 清理数据，确保可序列化
            const cleanPayload = {
                calculatorSettings: JSON.parse(JSON.stringify(defaultSettings || {})),
                productSettings: JSON.parse(JSON.stringify(productSettings || [])),
                processSettings: JSON.parse(JSON.stringify(processSettings || [])),
                templates: JSON.parse(JSON.stringify(templates || [])),
                exportDate: new Date().toISOString()
            };

            const now = new Date().toISOString();
            const artistId = session.user.id;
            
            // 检查是否已存在设置（不查询 created_at）
            const { data: existing, error: checkError } = await client
                .from('artist_settings')
                .select('artist_id')
                .eq('artist_id', artistId)
                .maybeSingle();
            
            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }
            
            let error;
            if (existing) {
                // 已存在，使用 update
                const { error: updateError } = await client
                    .from('artist_settings')
                    .update({
                        payload: cleanPayload,
                        updated_at: now
                    })
                    .eq('artist_id', artistId);
                error = updateError;
            } else {
                // 不存在，使用 insert（不设置 created_at）
                const { error: insertError } = await client
                    .from('artist_settings')
                    .insert({
                        artist_id: artistId,
                        payload: cleanPayload,
                        updated_at: now
                    });
                error = insertError;
            }

            if (error) {
                console.error('降级上传设置失败:', error);
                console.error('错误代码:', error.code);
                console.error('错误详情:', JSON.stringify(error, null, 2));
                const errorMsg = error.message || error.hint || '未知错误';
                if (!silent) {
                    alert('上传设置到云端失败: ' + errorMsg + '，请稍后重试');
                }
            } else {
                // 只在非静默模式下显示提示
                if (!silent) {
                    if (typeof showGlobalToast === 'function') showGlobalToast('✅ 设置已上传到云端');
                    else alert('设置已上传到云端');
                }
            }
            window._isSyncingSettings = false;
        } catch (fallbackErr) {
            console.error('降级处理也失败:', fallbackErr);
            if (!silent) {
                alert('上传设置失败，请检查网络连接或稍后重试');
            }
            window._isSyncingSettings = false;
        }
    }
}

// 智能合并数组设置（按id去重，保留最新的）
function mergeArraySettings(cloudArray, localArray, key = 'id') {
    if (!Array.isArray(cloudArray)) return localArray || [];
    if (!Array.isArray(localArray)) return cloudArray;
    
    // 创建云端设置的映射（以id为key）
    const cloudMap = new Map();
    cloudArray.forEach(item => {
        const itemKey = item && item[key] != null ? String(item[key]) : null;
        if (itemKey) cloudMap.set(itemKey, item);
    });
    
    // 创建本地设置的映射
    const localMap = new Map();
    localArray.forEach(item => {
        const itemKey = item && item[key] != null ? String(item[key]) : null;
        if (itemKey) localMap.set(itemKey, item);
    });
    
    // 合并：云端优先，但保留本地独有的
    const merged = [...cloudArray]; // 先添加所有云端设置
    
    // 添加本地独有的设置
    localArray.forEach(item => {
        const itemKey = item && item[key] != null ? String(item[key]) : null;
        if (itemKey && !cloudMap.has(itemKey)) {
            merged.push(item);
        }
    });
    
    return merged;
}

// 智能合并对象设置（深度合并，云端优先）
function mergeObjectSettings(cloudObj, localObj) {
    if (!cloudObj || typeof cloudObj !== 'object') return localObj || {};
    if (!localObj || typeof localObj !== 'object') return cloudObj;
    
    const merged = { ...localObj }; // 先复制本地设置
    
    // 用云端设置覆盖（深度合并）
    Object.keys(cloudObj).forEach(key => {
        if (cloudObj[key] && typeof cloudObj[key] === 'object' && !Array.isArray(cloudObj[key]) && 
            localObj[key] && typeof localObj[key] === 'object' && !Array.isArray(localObj[key])) {
            // 递归合并嵌套对象
            merged[key] = mergeObjectSettings(cloudObj[key], localObj[key]);
        } else {
            // 云端优先
            merged[key] = cloudObj[key];
        }
    });
    
    return merged;
}

async function mgLoadSettingsFromCloud(mergeMode = false) {
    if (!mgIsCloudEnabled()) {
        if (!mergeMode) {
            alert('请先登录');
        }
        return;
    }

    const client = mgGetSupabaseClient();
    if (!client) {
        if (!mergeMode) {
            alert('云端客户端初始化失败');
        }
        return;
    }

    const { data: { session } } = await client.auth.getSession();
    if (!session || !session.user) {
        if (!mergeMode) {
            alert('登录状态已失效，请重新登录');
        }
        return;
    }

    // 优先读取 V2（分表分条目 + 软删除）
    try {
        const v2 = await mgTryLoadSettingsFromCloudV2(client, session.user.id, mergeMode);
        if (v2 && v2.supported) {
            clearTimeout(_saveDataTimer);
            if (typeof doSaveData === 'function') doSaveData();

            if (mergeMode) {
                if (typeof updateDisplay === 'function') updateDisplay();
            } else {
                if (typeof showGlobalToast === 'function') showGlobalToast('✅ 已从云端恢复设置（V2），正在刷新');
                else alert('已从云端恢复设置（V2），正在刷新');
                setTimeout(function () { location.reload(); }, 400);
            }
            return;
        }
    } catch (v2Err) {
        console.error('读取 V2 设置失败，回退到旧版:', v2Err);
    }

    const { data, error } = await client
        .from('artist_settings')
        .select('payload')
        .eq('artist_id', session.user.id)
        .single();

    if (error) {
        console.error('从云端获取设置失败:', error);
        if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
            if (!mergeMode) {
                console.log('云端尚无设置，这是正常的（首次使用）');
            }
            return;
        }
        if (!mergeMode) {
            alert('从云端获取设置失败: ' + (error.message || '未知错误'));
        }
        return;
    }

    const p = data && data.payload;
    if (!p) {
        if (!mergeMode) {
            console.log('云端设置数据为空');
        }
        return;
    }

    try {
        // 验证数据格式
        if (!p || typeof p !== 'object') {
            throw new Error('云端设置数据格式错误');
        }
        
        if (mergeMode) {
            // 合并模式：智能合并设置
            if (p.calculatorSettings && typeof p.calculatorSettings === 'object') {
                // 使用 Object.assign 更新 defaultSettings，而不是重新赋值
                Object.assign(defaultSettings, mergeObjectSettings(p.calculatorSettings, defaultSettings || {}));
            }
            if (Array.isArray(p.productSettings)) {
                // 清空数组后添加新元素，而不是重新赋值
                const merged = mergeArraySettings(p.productSettings, productSettings || [], 'id');
                productSettings.length = 0;
                productSettings.push(...merged);
            }
            if (Array.isArray(p.processSettings)) {
                const merged = mergeArraySettings(p.processSettings, processSettings || [], 'id');
                processSettings.length = 0;
                processSettings.push(...merged);
            }
            if (Array.isArray(p.templates)) {
                const merged = mergeArraySettings(p.templates, templates || [], 'id');
                templates.length = 0;
                templates.push(...merged);
            }
        } else {
            // 非合并模式：直接覆盖
            if (p.calculatorSettings && typeof p.calculatorSettings === 'object') {
                Object.assign(defaultSettings, JSON.parse(JSON.stringify(p.calculatorSettings)));
            }
            if (Array.isArray(p.productSettings)) {
                const newSettings = JSON.parse(JSON.stringify(p.productSettings));
                productSettings.length = 0;
                productSettings.push(...newSettings);
            }
            if (Array.isArray(p.processSettings)) {
                const newSettings = JSON.parse(JSON.stringify(p.processSettings));
                processSettings.length = 0;
                processSettings.push(...newSettings);
            }
            if (Array.isArray(p.templates)) {
                const newSettings = JSON.parse(JSON.stringify(p.templates));
                templates.length = 0;
                templates.push(...newSettings);
            }
        }

        // 落盘
        clearTimeout(_saveDataTimer);
        if (typeof doSaveData === 'function') doSaveData();

        if (mergeMode) {
            // 合并模式不刷新页面，只更新显示
            if (typeof updateDisplay === 'function') updateDisplay();
        } else {
            if (typeof showGlobalToast === 'function') showGlobalToast('✅ 已从云端恢复设置，正在刷新');
            else alert('已从云端恢复设置，正在刷新');
            setTimeout(function () { location.reload(); }, 400);
        }
    } catch (e) {
        console.error('应用云端设置失败:', e);
        console.error('错误堆栈:', e.stack);
        console.error('云端数据:', p);
        const errorMsg = e.message || '未知错误';
        if (!mergeMode) {
            alert('应用云端设置失败: ' + errorMsg + '，请重试');
        } else {
            console.warn('合并云端设置时出错（继续使用本地设置）:', errorMsg);
            // 合并模式失败时，不显示错误提示，静默失败
        }
    }
}

// ====== 智能同步模式（唯一选项） ======
/**
 * 确保已初始化智能同步模式
 * @returns {Promise<string>} 始终返回 'smart_sync'
 */
async function mgEnsureSyncPolicy() {
    // 直接使用智能同步模式，无需选择
    const policy = 'smart_sync';
    localStorage.setItem('mg_cloud_sync_policy', policy);
    localStorage.setItem('mg_cloud_sync_initialized', '1');
    return policy;
}

// ====== 智能同步模式：一键上传所有（设置+订单） ======
/**
 * 一键上传所有数据到云端（智能同步模式）
 * 优先同步未同步的数据
 */
async function mgSyncAllToCloud() {
    if (!mgIsCloudEnabled()) {
        alert('请先登录');
        return;
    }
    
    // 确保已初始化智能同步模式
    await mgEnsureSyncPolicy();
    
    // 加载未同步订单列表
    loadUnsyncedOrders();
    const unsyncedCount = unsyncedOrderIds.size;
    
    if (typeof showGlobalToast === 'function') {
        if (unsyncedCount > 0) {
            showGlobalToast(`正在同步 ${unsyncedCount} 条未同步数据...`);
        } else {
            showGlobalToast('正在同步到云端...');
        }
    }
    
    try {
        const client = mgGetSupabaseClient();
        if (!client) return;
        
        const { data: { session } } = await client.auth.getSession();
        if (!session || !session.user) {
            alert('登录状态已失效，请重新登录');
            return;
        }
        
        // 智能同步模式：设置和订单都智能合并
        // 1. 设置：智能合并（云端优先，但保留本地独有的）
        await mgLoadSettingsFromCloud(true); // 智能合并模式
        
        // 2. 优先同步未同步的订单
        let syncedCount = 0;
        if (unsyncedCount > 0) {
            // 只同步未同步的订单
            for (const orderId of unsyncedOrderIds) {
                const item = history.find(h => h.id == orderId);
                if (item) {
                    await mgCloudUpsertOrder(item);
                    syncedCount++;
                }
            }
        } else {
            // 没有未同步数据，执行完整同步
            const cloudHistory = await mgCloudFetchOrders();
            const cloudIds = new Set(cloudHistory.map(h => h.external_id).filter(Boolean));
            
            // 合并逻辑：本地有但云端没有的，上传到云端
            for (const item of history) {
                const extId = mgEnsureExternalId(item);
                if (extId && !cloudIds.has(extId)) {
                    await mgCloudUpsertOrder(item);
                    syncedCount++;
                }
            }
            
            // 拉取云端所有订单（包含合并后的）
            const mergedHistory = await mgCloudFetchOrders();
            if (mergedHistory.length > 0) {
                history = mergedHistory;
                if (typeof saveData === 'function') saveData();
            }
        }
        
        // 3. 上传合并后的设置到云端
        await mgSyncSettingsToCloud();
        
        // 更新同步状态
        updateCloudSyncStatus();
        
        if (typeof showGlobalToast === 'function') {
            if (unsyncedCount > 0) {
                showGlobalToast(`✅ 已同步 ${syncedCount} 条未同步数据`);
            } else {
                showGlobalToast(`✅ 智能同步完成：设置和订单已智能合并`);
            }
        } else {
            if (unsyncedCount > 0) {
                alert(`✅ 已同步 ${syncedCount} 条未同步数据`);
            } else {
                alert(`✅ 智能同步完成`);
            }
        }
        
        // 刷新显示
        setTimeout(() => {
            if (typeof updateDisplay === 'function') updateDisplay();
            if (typeof renderScheduleCalendar === 'function') renderScheduleCalendar();
        }, 500);
        
    } catch (err) {
        console.error('同步到云端失败:', err);
        alert('同步到云端失败，请稍后重试');
    }
}

// ====== 统一恢复入口：一键从云端恢复所有（设置+订单） ======
/**
 * 一键从云端恢复所有数据（无论策略是什么，都以云端为源）
 */
async function mgRestoreAllFromCloud() {
    if (!mgIsCloudEnabled()) {
        alert('请先登录');
        return;
    }
    
    if (!confirm('确定要从云端恢复所有数据吗？这将覆盖本地数据。')) {
        return;
    }
    
    if (typeof showGlobalToast === 'function') {
        showGlobalToast('正在从云端恢复...');
    }
    
    try {
        // 1. 恢复设置
        await mgLoadSettingsFromCloud();
        
        // 2. 恢复订单
        const cloudHistory = await mgCloudFetchOrders();
        if (cloudHistory.length > 0) {
            history = cloudHistory;
            if (typeof saveData === 'function') saveData();
            
            if (typeof showGlobalToast === 'function') {
                showGlobalToast(`✅ 已从云端恢复设置和 ${cloudHistory.length} 条排单，正在刷新`);
            } else {
                alert(`✅ 已从云端恢复设置和 ${cloudHistory.length} 条排单`);
            }
            
            // 刷新页面以应用云端数据
            setTimeout(() => {
                if (typeof updateDisplay === 'function') updateDisplay();
                if (typeof renderScheduleCalendar === 'function') renderScheduleCalendar();
                location.reload();
            }, 400);
        } else {
            if (typeof showGlobalToast === 'function') {
                showGlobalToast('云端暂无订单数据');
            } else {
                alert('云端暂无订单数据');
            }
            // 即使没有订单，设置已恢复，也需要刷新
            setTimeout(() => {
                location.reload();
            }, 400);
        }
        
    } catch (err) {
        console.error('从云端恢复失败:', err);
        alert('从云端恢复失败，请稍后重试');
    }
}

// 在 init() 末尾调用云端检测
const originalInit = init;
init = function() {
    originalInit();
    
    // 立即更新一次状态（显示检测中或未登录状态）
    updateCloudSyncStatus();
    
    // 延迟检测云端（等待 __APP_AUTH__ 初始化完成）
    setTimeout(async () => {
        // 智能同步模式：启动时自动拉取并合并
        const isCloudModeOn = localStorage.getItem('mg_cloud_enabled') === '1';
        if (isCloudModeOn) {
            try {
                // 先合并设置（智能合并）
                try {
                    await mgLoadSettingsFromCloud(true);
                } catch (err) {
                    console.warn('启动时拉取云端设置失败（继续使用本地设置）:', err);
                    // 设置拉取失败不影响后续流程
                }
                
                // 再合并订单
                let cloudHistory = [];
                try {
                    cloudHistory = await mgCloudFetchOrders();
                } catch (err) {
                    console.error('启动时拉取云端订单失败:', err);
                    // 订单拉取失败时，至少尝试上传本地订单
                }
                
                const cloudIds = new Set(cloudHistory.map(h => h.external_id).filter(Boolean));
                
                // 上传本地独有的订单
                let uploadCount = 0;
                for (const item of history) {
                    try {
                        const extId = mgEnsureExternalId(item);
                        if (extId && !cloudIds.has(extId)) {
                            await mgCloudUpsertOrder(item);
                            uploadCount++;
                        }
                    } catch (err) {
                        console.error('启动时上传订单失败:', item.id, err);
                        // 继续上传其他订单
                    }
                }
                
                // 拉取所有订单（包含刚上传的）
                try {
                    const mergedHistory = await mgCloudFetchOrders();
                    if (mergedHistory.length > 0) {
                        history = mergedHistory;
                        if (typeof saveData === 'function') saveData();
                    }
                } catch (err) {
                    console.error('启动时拉取合并后的订单失败:', err);
                    // 如果拉取失败，至少本地数据已上传
                }
                
                if (typeof updateDisplay === 'function') updateDisplay();
                if (typeof renderScheduleCalendar === 'function') renderScheduleCalendar();
                
                if (uploadCount > 0) {
                    console.log(`✅ 启动时同步完成：已上传 ${uploadCount} 条本地订单`);
                }
            } catch (err) {
                console.error('启动时智能同步失败:', err);
                // 不显示错误提示，避免干扰用户
            }
        }
        // 更新设置页面的云端状态
        updateCloudSyncStatus();
    }, 1000);
    
    // 更新设置页状态（延迟确保认证状态已更新）
    function updateSettingsPageStatus() {
        setTimeout(() => {
            if (typeof updateCloudSyncStatus === 'function') updateCloudSyncStatus();
            if (typeof updateLoginUI === 'function') updateLoginUI();
        }, 300); // 增加延迟，确保 __APP_AUTH__ 已更新
    }
    
    // 当切换到设置页时，更新云端状态和登录UI
    const originalShowPage = window.showPage;
    if (originalShowPage) {
        window.showPage = function(page) {
            originalShowPage(page);
            if (page === 'settings') {
                updateSettingsPageStatus();
            }
        };
    }
    
    // 监听 hash 变化（处理从登录页跳转回来的情况）
    window.addEventListener('hashchange', function() {
        if (window.location.hash === '#settings') {
            updateSettingsPageStatus();
        }
    });
    
    // 页面加载时，如果当前在设置页，也更新状态
    if (window.location.hash === '#settings') {
        updateSettingsPageStatus();
    }
};

// 自动初始化应用，确保小票设置与预览可用
if (typeof init === 'function') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // 如果正在跳转到登录页，跳过主页 init，避免页面被脚本抢回
            try {
                if (sessionStorage.getItem('mg_redirecting_to_login') === '1') return;
            } catch (_) {}
            init();
            mgInitNetworkGuard();
        });
    } else {
        try {
            if (sessionStorage.getItem('mg_redirecting_to_login') !== '1') {
                init();
                mgInitNetworkGuard();
            }
        } catch (_) {
            init();
            mgInitNetworkGuard();
        }
    }
}
