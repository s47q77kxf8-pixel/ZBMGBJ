// ========== 文件版本标识 ==========
console.log('🔧🔧🔧 script.js 文件版本: 2025-01-27-fix-preview-update-v18 🔧🔧🔧');
console.log('🔧 如果看不到这条日志，说明浏览器加载的是旧版本！');
// ========== 文件版本标识结束 ==========

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



// 默认设置
const defaultSettings = {
    // 基础详细信息
    artistInfo: {
        id: '',           // 美工ID
        contact: '',      // 联系方式
        defaultDuration: 10               // 默认工期（天）
    },
    // 用途系数（存储格式：{value: 数值, name: 显示名称}）
    usageCoefficients: {
        personal: { value: 1, name: '自用/无盈利/同人商用' },
        buyout: { value: 2, name: '买断（可要求不公开）' },
        enterprise: { value: 3, name: '企业/书店/出版社等' }
    },
    // 加急系数
    urgentCoefficients: {
        normal: { value: 1, name: '无' },
        oneWeek: { value: 1.5, name: '一周加急' },
        seventyTwoHours: { value: 2, name: '72H加急' },
        fortyEightHours: { value: 2.5, name: '48H加急' },
        twentyFourHours: { value: 3, name: '24H加急' }
    },
    // 同模系数
    sameModelCoefficients: {
        basic: { value: 0.5, name: '改字、色、柄图' },
        advanced: { value: 0.8, name: '改字、色、柄图、元素' }
    },
    // 折扣系数
    discountCoefficients: {
        none: { value: 1, name: '无' },
        sample: { value: 0.9, name: '上次合作寄样' }
    },
    // 平台手续费
    platformFees: {
        none: { value: 0, name: '无' },
        mihua: { value: 5, name: '米画师' },
        painter: { value: 5, name: '画加' }
    },
    // 其他费用
    otherFees: {
        // 其他费用类别，可动态添加
    },
    // 可扩展的加价类系数（用途、加急为内置；此处为后期添加的，如 VIP系数）
    extraPricingUp: [
        {
            id: 1,
            name: "不公开展示系数",
            options: {
                none: { value: 1, name: '无' },
                private: { value: 1.5, name: '不公开展示' }
            }
        }
    ],
    // 背景费设置
    backgroundFee: 10,
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

// 初始化应用
function init() {
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
    
    // 更新显示
    updateDisplay();
    
    // 总是渲染制品设置和工艺设置，确保数据被渲染到页面上
    renderProductSettings();
    renderProcessSettings();
    renderCoefficientSettings();
    
    // 更新计算页中的系数选择器
    updateCalculatorCoefficientSelects();
    
    // 添加开始时间事件监听器，实现自动计算截稿时间
    document.addEventListener('DOMContentLoaded', function() {
        const startTime = document.getElementById('startTime');
        if (startTime) {
            // 设置开始时间为今天
            const today = new Date();
            const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            startTime.value = formattedDate;
            
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
                
                // 其他情况直接赋值
                defaultSettings[key] = loadedSettings[key];
            });
            if (!Array.isArray(defaultSettings.extraPricingUp)) defaultSettings.extraPricingUp = [];
            if (!Array.isArray(defaultSettings.extraPricingDown)) defaultSettings.extraPricingDown = [];
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

// 保存数据到本地存储
function saveData() {
    try {
        localStorage.setItem('quoteHistory', JSON.stringify(history));
        localStorage.setItem('calculatorSettings', JSON.stringify(defaultSettings));
        localStorage.setItem('productSettings', JSON.stringify(productSettings));
        localStorage.setItem('processSettings', JSON.stringify(processSettings));
    } catch (error) {
        console.error('保存数据失败:', error);
    }
    // 单独保存 templates，避免因其他键失败或 templates 序列化问题导致模板丢失
    try {
        const data = Array.isArray(templates) ? templates : [];
        localStorage.setItem('templates', JSON.stringify(data));
    } catch (e) {
        console.error('保存模板失败:', e);
    }
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
        
        alert('设置导出成功！');
    } catch (e) {
        console.error('导出设置失败:', e);
        alert('导出设置失败，请重试');
    }
}

// 添加默认制品设置
function addDefaultProductSettings() {
    if (productSettings.length === 0) {
        productSettings = [
            { id: 1, name: '普通吧唧', category: '吧唧类', priceType: 'fixed', price: 70 },
            { id: 2, name: '异形吧唧', category: '吧唧类', priceType: 'fixed', price: 80 },
            { id: 3, name: '背卡', category: '纸片类', priceType: 'double', priceSingle: 50, priceDouble: 70 },
            { id: 4, name: '卡头', category: '纸片类', priceType: 'double', priceSingle: 50, priceDouble: 70 },
            { id: 5, name: '方卡', category: '纸片类', priceType: 'double', priceSingle: 70, priceDouble: 110 },
            { id: 6, name: '小卡', category: '纸片类', priceType: 'double', priceSingle: 70, priceDouble: 110 },
            { id: 7, name: '透卡', category: '纸片类', priceType: 'double', priceSingle: 70, priceDouble: 110 },
            { id: 8, name: '邮票', category: '纸片类', priceType: 'double', priceSingle: 70, priceDouble: 110 },
            { id: 9, name: '色纸', category: '纸片类', priceType: 'double', priceSingle: 70, priceDouble: 110 },
            { id: 10, name: '拍立得', category: '纸片类', priceType: 'double', priceSingle: 80, priceDouble: 120 },
            { id: 11, name: '明信片', category: '纸片类', priceType: 'double', priceSingle: 80, priceDouble: 120 },
            { id: 12, name: '票根', category: '纸片类', priceType: 'double', priceSingle: 80, priceDouble: 120 },
            { id: 13, name: '纸夹相卡', category: '纸片类', priceType: 'double', priceSingle: 80, priceDouble: 120 },
            { id: 14, name: '立牌', category: '亚克力类', priceType: 'config', basePrice: 110, baseConfig: '立牌+底座', additionalConfigs: [
                { name: '底座', price: 20, unit: '个' },
                { name: '插件', price: 40, unit: '个' }
            ]},
            { id: 15, name: '麻将', category: '亚克力类', priceType: 'config', basePrice: 110, baseConfig: '1面', additionalConfigs: [
                { name: '面', price: 30, unit: '面' }
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
let activeTab = 'quote';              // 'quote' | 'settings'
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
    
    // 更新导航按钮状态（只高亮左右主 Tab）
    document.querySelectorAll('.nav-btn-main').forEach(btn => {
        btn.classList.remove('active');
    });

    if (pageId === 'quote' || pageId === 'record' || pageId === 'stats') {
        activeTab = 'quote';
        const quoteBtn = document.querySelector('.nav-btn-quote');
        if (quoteBtn) quoteBtn.classList.add('active');
    } else if (pageId === 'settings') {
        activeTab = 'settings';
        const settingsBtn = document.querySelector('.nav-btn-settings');
        if (settingsBtn) settingsBtn.classList.add('active');
    }
    
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
        renderProductSettings();
        renderProcessSettings();
        renderCoefficientSettings();
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
    applyRecordFilters();
}

function getRecordProgressStatus(item) {
    if (!item) return { text: '未开始', className: 'record-status--not-started', pending: false, overdue: false };
    ensureProductDoneStates(item);
    const states = Array.isArray(item.productDoneStates) ? item.productDoneStates : [];
    const total = states.length;
    let doneCount = 0;
    for (let i = 0; i < total; i++) if (states[i]) doneCount++;
    const pending = !item.startTime && !item.deadline;
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    
    // 1. 待排单：未设置排单时间
    if (pending) {
        const overdue = false;
        return { text: '待排单', className: 'record-status--pending', pending, overdue };
    }
    
    // 判断时间
    const startTime = item.startTime ? new Date(item.startTime).getTime() : null;
    const deadline = item.deadline ? new Date(item.deadline).getTime() : null;
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
    
    // 4. 已逾期：结束时间已到未完成
    if (deadline && nowTime >= deadline && (total === 0 || doneCount < total)) {
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
    let count = 0;
    const timeFilter = document.getElementById('recordTimeFilter');
    const minPrice = document.getElementById('recordMinPrice');
    const maxPrice = document.getElementById('recordMaxPrice');
    const sortBy = document.getElementById('recordSortBy');
    const groupBy = document.getElementById('recordGroupBy');
    if (timeFilter && timeFilter.value && timeFilter.value !== 'all') count++;
    if (minPrice && minPrice.value) count++;
    if (maxPrice && maxPrice.value) count++;
    if (sortBy && sortBy.value && sortBy.value !== 'time-desc') count++;
    if (groupBy && groupBy.value && groupBy.value !== 'none') count++;
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('d-none');
    } else {
        badge.classList.add('d-none');
    }
}

function resetRecordFilters() {
    const timeFilter = document.getElementById('recordTimeFilter');
    const startDate = document.getElementById('recordStartDate');
    const endDate = document.getElementById('recordEndDate');
    const minPrice = document.getElementById('recordMinPrice');
    const maxPrice = document.getElementById('recordMaxPrice');
    const sortBy = document.getElementById('recordSortBy');
    const groupBy = document.getElementById('recordGroupBy');
    const customDateRange = document.getElementById('recordCustomDateRange');
    if (timeFilter) timeFilter.value = 'all';
    if (startDate) startDate.value = '';
    if (endDate) endDate.value = '';
    if (minPrice) minPrice.value = '';
    if (maxPrice) maxPrice.value = '';
    if (sortBy) sortBy.value = 'time-desc';
    if (groupBy) groupBy.value = 'none';
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
    const minPriceEl = document.getElementById('recordMinPrice');
    const maxPriceEl = document.getElementById('recordMaxPrice');
    const sortByEl = document.getElementById('recordSortBy');
    const groupByEl = document.getElementById('recordGroupBy');

    const searchKeyword = searchInput ? searchInput.value.trim() : '';
    const filters = {
        timeRange: timeFilterEl ? timeFilterEl.value : 'all',
        startDate: startDateEl ? startDateEl.value : '',
        endDate: endDateEl ? endDateEl.value : '',
        minPrice: minPriceEl ? minPriceEl.value : '',
        maxPrice: maxPriceEl ? maxPriceEl.value : '',
        sortBy: sortByEl ? sortByEl.value : 'time-desc',
        groupBy: groupByEl ? groupByEl.value : 'none'
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

    if (filters.minPrice !== undefined && filters.minPrice !== '') {
        filteredHistory = filteredHistory.filter(item => (item.finalTotal || 0) >= parseFloat(filters.minPrice));
    }
    if (filters.maxPrice !== undefined && filters.maxPrice !== '') {
        filteredHistory = filteredHistory.filter(item => (item.finalTotal || 0) <= parseFloat(filters.maxPrice));
    }

    filteredHistory = filteredHistory.slice().sort((a, b) => {
        switch (filters.sortBy) {
            case 'time-asc':
                return new Date(a.timestamp) - new Date(b.timestamp);
            case 'price-desc':
                return (b.finalTotal || 0) - (a.finalTotal || 0);
            case 'price-asc':
                return (a.finalTotal || 0) - (b.finalTotal || 0);
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
    const container = document.getElementById('recordContainer');
    if (!container) return;

    const { list, groupBy } = getFilteredHistoryForRecord();
    if (!Array.isArray(list) || list.length === 0) {
        container.innerHTML = '<p class="record-empty">未找到匹配的记录</p>';
        updateBatchDeleteButton();
        return;
    }

    const renderItem = (item) => {
        const clientId = (item && item.clientId) ? String(item.clientId) : '—';
        const amount = formatMoney(item && item.finalTotal);
        const status = getRecordProgressStatus(item);
        const isSelected = selectedHistoryIds.has(item.id);
        return `
            <div class="record-item history-item${isSelected ? ' selected' : ''}" data-id="${item.id}">
                <input type="checkbox" class="history-item-checkbox record-item-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''} onchange="toggleHistorySelection(${item.id})">
                <span class="record-item-client">${clientId}</span>
                <div class="record-item-right">
                    <span class="record-item-amount">${amount}</span>
                    <span class="record-status ${status.className}">${status.text}</span>
                    <button class="icon-action-btn view" onclick="setReceiptFromRecord(); loadQuoteFromHistory(${item.id})" aria-label="查看小票" title="小票">
                        <svg class="icon sm" aria-hidden="true"><use href="#i-receipt"></use></svg>
                        <span class="sr-only">小票</span>
                    </button>
                    <button class="icon-action-btn edit" onclick="editHistoryItem(${item.id})" aria-label="编辑" title="编辑">
                        <svg class="icon sm" aria-hidden="true"><use href="#i-edit"></use></svg>
                        <span class="sr-only">改</span>
                    </button>
                    <button class="icon-action-btn delete" onclick="deleteHistoryItem(${item.id})" aria-label="删除" title="删除">
                        <svg class="icon sm" aria-hidden="true"><use href="#i-trash-simple"></use></svg>
                        <span class="sr-only">删</span>
                    </button>
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
    if (minPrice !== '') exportData = exportData.filter(item => (item.finalTotal || 0) >= parseFloat(minPrice));
    if (maxPrice !== '') exportData = exportData.filter(item => (item.finalTotal || 0) <= parseFloat(maxPrice));

    exportData = exportData.slice().sort((a, b) => {
        switch (sortBy) {
            case 'time-asc': return new Date(a.timestamp) - new Date(b.timestamp);
            case 'price-desc': return (b.finalTotal || 0) - (a.finalTotal || 0);
            case 'price-asc': return (a.finalTotal || 0) - (b.finalTotal || 0);
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

function getStatsOrderStatus(item) {
    if (!item) return 'notStarted';
    ensureProductDoneStates(item);
    const states = Array.isArray(item.productDoneStates) ? item.productDoneStates : [];
    const total = states.length;
    if (total === 0) return 'notStarted';
    let doneCount = 0;
    for (let i = 0; i < total; i++) if (states[i]) doneCount++;
    if (doneCount === 0) return 'notStarted';
    if (doneCount === total) return 'completed';
    return 'inProgress';
}

function isStatsOrderOverdue(item) {
    if (!item || !item.deadline) return false;
    const status = getStatsOrderStatus(item);
    if (status === 'completed') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(item.deadline);
    d.setHours(0, 0, 0, 0);
    return d < today;
}

function getStatsFiltersFromUI() {
    const timeEl = document.getElementById('statsTimeFilter');
    const customStart = document.getElementById('statsCustomStart');
    const customEnd = document.getElementById('statsCustomEnd');
    const amountBasis = document.getElementById('statsAmountBasis');
    const giftMode = document.getElementById('statsGiftMode');
    const statusFilter = document.getElementById('statsStatusFilter');
    const quickStart = document.getElementById('statsStartDate');
    const quickEnd = document.getElementById('statsEndDate');
    return {
        timeRange: timeEl ? timeEl.value : 'month',
        startDate: (customStart && customStart.value) || (quickStart && quickStart.value) || '',
        endDate: (customEnd && customEnd.value) || (quickEnd && quickEnd.value) || '',
        amountBasis: amountBasis ? amountBasis.value : 'finalTotal',
        giftMode: giftMode ? giftMode.value : 'exclude',
        statusFilter: statusFilter ? statusFilter.value : 'all'
    };
}

function getStatsDateRange(filters) {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let start = new Date(now);
    let end = new Date(now);
    start.setHours(0, 0, 0, 0);
    switch (filters.timeRange) {
        case 'today':
            break;
        case 'week':
            start.setDate(start.getDate() - 6);
            break;
        case 'month':
            start.setDate(start.getDate() - 29);
            break;
        case 'thisMonth':
            start.setDate(1);
            break;
        case 'lastMonth':
            start.setMonth(start.getMonth() - 1);
            start.setDate(1);
            end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
            break;
        case 'custom':
            if (filters.startDate) start = new Date(filters.startDate);
            if (filters.endDate) end = new Date(filters.endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
        default:
            start.setDate(start.getDate() - 29);
    }
    if (filters.timeRange !== 'lastMonth' && filters.timeRange !== 'custom') {
        end.setHours(23, 59, 59, 999);
    }
    return { start, end };
}

function getStatsDataset(historySource, filters) {
    if (!Array.isArray(historySource) || historySource.length === 0) {
        return {
            filteredRecords: [],
            totals: { orderCount: 0, revenueTotal: 0, aov: 0, itemTotal: 0, itemDone: 0, itemDoneRate: 0, orderDoneCount: 0, orderDoneRate: 0, overdueOrderCount: 0 },
            dailyAgg: [],
            byClient: [],
            byProduct: []
        };
    }
    const { start, end } = getStatsDateRange(filters);
    let list = historySource.filter(item => {
        const t = item.timestamp ? new Date(item.timestamp) : null;
        if (!t || isNaN(t.getTime())) return false;
        return t >= start && t <= end;
    });
    if (filters.statusFilter !== 'all') {
        list = list.filter(item => {
            const status = getStatsOrderStatus(item);
            if (filters.statusFilter === 'overdue') return isStatsOrderOverdue(item);
            return status === filters.statusFilter;
        });
    }
    const amountKey = filters.amountBasis === 'totalProductsPrice' ? 'totalProductsPrice' : 'finalTotal';
    const includeGifts = filters.giftMode !== 'exclude';
    const giftRevenueAsZero = filters.giftMode === 'zero';

    let revenueTotal = 0;
    let itemTotal = 0;
    let itemDone = 0;
    let orderDoneCount = 0;
    let overdueOrderCount = 0;
    const dailyMap = {};
    const clientMap = {};
    const productMap = {};

    list.forEach(item => {
        ensureProductDoneStates(item);
        const revenue = Number(item[amountKey]) || 0;
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
        if (orderStatus === 'completed') orderDoneCount++;
        if (isStatsOrderOverdue(item)) overdueOrderCount++;

        const dateStr = item.timestamp ? new Date(item.timestamp).toISOString().slice(0, 10) : '';
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
    });

    const orderCount = list.length;
    const aov = orderCount > 0 ? revenueTotal / orderCount : 0;
    const itemDoneRate = itemTotal > 0 ? (itemDone / itemTotal) * 100 : 0;
    const orderDoneRate = orderCount > 0 ? (orderDoneCount / orderCount) * 100 : 0;

    const dailyAgg = Object.keys(dailyMap).sort().map(k => dailyMap[k]);
    const byClient = Object.values(clientMap).sort((a, b) => b.revenueTotal - a.revenueTotal);
    const byProduct = Object.values(productMap).sort((a, b) => b.revenueTotal - a.revenueTotal);

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
            overdueOrderCount
        },
        dailyAgg,
        byClient,
        byProduct
    };
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
    grid.innerHTML = `
        <div class="kpi-card"><div class="kpi-label">订单数</div><div class="kpi-value" id="kpiOrderCount">${totals.orderCount}</div></div>
        <div class="kpi-card"><div class="kpi-label">总收入</div><div class="kpi-value" id="kpiRevenueTotal">${fmt(totals.revenueTotal, true)}</div></div>
        <div class="kpi-card"><div class="kpi-label">客单价</div><div class="kpi-value" id="kpiAov">${fmt(totals.aov, true)}</div></div>
        <div class="kpi-card"><div class="kpi-label">制品项总数</div><div class="kpi-value" id="kpiItemTotal">${totals.itemTotal}</div></div>
        <div class="kpi-card"><div class="kpi-label">制品项完成率</div><div class="kpi-value" id="kpiItemDoneRate">${fmt(totals.itemDoneRate)}%</div></div>
        <div class="kpi-card"><div class="kpi-label">逾期订单数</div><div class="kpi-value" id="kpiOverdueOrders">${totals.overdueOrderCount}</div></div>
    `;
    let orderRateEl = document.getElementById('kpiOrderDoneRate');
    if (!orderRateEl) {
        orderRateEl = document.createElement('div');
        orderRateEl.className = 'stats-order-done-rate text-gray';
        orderRateEl.id = 'kpiOrderDoneRate';
        grid.parentNode.insertBefore(orderRateEl, grid.nextSibling);
    }
    orderRateEl.textContent = '订单完成率：' + fmt(totals.orderDoneRate) + '%（已完成 ' + totals.orderDoneCount + ' / ' + totals.orderCount + '）';
}

function renderStatsTrends(dailyAgg) {
    const container = document.getElementById('statsTrends');
    if (!container) return;
    if (!dailyAgg || dailyAgg.length === 0) {
        container.innerHTML = '<p class="text-gray">暂无趋势数据</p>';
        return;
    }
    const maxRev = Math.max(1, ...dailyAgg.map(d => d.revenue));
    const maxOrd = Math.max(1, ...dailyAgg.map(d => d.orders));
    const maxRate = 100;
    let html = '<h3 class="stats-block-title">趋势（按日）</h3>';
    html += '<div class="stats-mini-bars">';
    dailyAgg.forEach(d => {
        const rate = d.itemTotal > 0 ? (d.itemDone / d.itemTotal) * 100 : 0;
        html += '<div class="stats-bar-row">';
        html += '<span class="stats-bar-label">' + d.date + '</span>';
        html += '<div class="stats-bar-wrap"><div class="stats-bar stats-bar-rev" style="width:' + (d.revenue / maxRev * 100) + '%"></div></div><span class="stats-bar-legend">¥' + (d.revenue || 0).toFixed(0) + '</span>';
        html += '<div class="stats-bar-wrap"><div class="stats-bar stats-bar-ord" style="width:' + (d.orders / maxOrd * 100) + '%"></div></div><span class="stats-bar-legend">' + d.orders + '单</span>';
        html += '<div class="stats-bar-wrap"><div class="stats-bar stats-bar-rate" style="width:' + (rate / maxRate * 100) + '%"></div></div><span class="stats-bar-legend">' + rate.toFixed(0) + '%</span>';
        html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderStatsTopLists(byClient, byProduct) {
    const container = document.getElementById('statsTopLists');
    if (!container) return;
    const topN = 10;
    let html = '<h3 class="stats-block-title">Top 单主</h3>';
    html += '<div class="stats-top-tabs"><button type="button" class="btn secondary small active" data-tab="clientOrders">按订单数</button><button type="button" class="btn secondary small" data-tab="clientRevenue">按金额</button></div>';
    const clientByOrders = [...byClient].sort((a, b) => b.orderCount - a.orderCount).slice(0, topN);
    const clientByRevenue = byClient.slice(0, topN);
    html += '<div id="statsTopClientOrders" class="stats-top-list">';
    clientByOrders.forEach((c, i) => { html += '<div class="stats-top-item"><span class="stats-top-rank">' + (i + 1) + '</span><span class="stats-top-name">' + (c.clientId || '—') + '</span><span class="stats-top-val">' + c.orderCount + ' 单</span></div>'; });
    html += '</div>';
    html += '<div id="statsTopClientRevenue" class="stats-top-list d-none">';
    clientByRevenue.forEach((c, i) => { html += '<div class="stats-top-item"><span class="stats-top-rank">' + (i + 1) + '</span><span class="stats-top-name">' + (c.clientId || '—') + '</span><span class="stats-top-val">¥' + (c.revenueTotal || 0).toFixed(2) + '</span></div>'; });
    html += '</div>';

    html += '<h3 class="stats-block-title">Top 制品</h3>';
    html += '<div class="stats-top-tabs"><button type="button" class="btn secondary small active" data-tab="productCount">按次数</button><button type="button" class="btn secondary small" data-tab="productRevenue">按金额</button></div>';
    const productByCount = [...byProduct].sort((a, b) => b.count - a.count).slice(0, topN);
    const productByRevenue = byProduct.slice(0, topN);
    html += '<div id="statsTopProductCount" class="stats-top-list">';
    productByCount.forEach((p, i) => { html += '<div class="stats-top-item"><span class="stats-top-rank">' + (i + 1) + '</span><span class="stats-top-name">' + (p.productName || '—') + '</span><span class="stats-top-val">' + p.count + ' 次</span></div>'; });
    html += '</div>';
    html += '<div id="statsTopProductRevenue" class="stats-top-list d-none">';
    productByRevenue.forEach((p, i) => { html += '<div class="stats-top-item"><span class="stats-top-rank">' + (i + 1) + '</span><span class="stats-top-name">' + (p.productName || '—') + '</span><span class="stats-top-val">¥' + (p.revenueTotal || 0).toFixed(2) + '</span></div>'; });
    html += '</div>';

    container.innerHTML = html;
    container.querySelectorAll('.stats-top-tabs button').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            container.querySelectorAll('.stats-top-tabs button').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            if (tab === 'clientOrders') { document.getElementById('statsTopClientOrders').classList.remove('d-none'); document.getElementById('statsTopClientRevenue').classList.add('d-none'); }
            else if (tab === 'clientRevenue') { document.getElementById('statsTopClientOrders').classList.add('d-none'); document.getElementById('statsTopClientRevenue').classList.remove('d-none'); }
            else if (tab === 'productCount') { document.getElementById('statsTopProductCount').classList.remove('d-none'); document.getElementById('statsTopProductRevenue').classList.add('d-none'); }
            else if (tab === 'productRevenue') { document.getElementById('statsTopProductCount').classList.add('d-none'); document.getElementById('statsTopProductRevenue').classList.remove('d-none'); }
        });
    });
}

function updateStatsFilterBadge() {
    const badge = document.getElementById('statsFilterBadge');
    if (!badge) return;
    const f = getStatsFiltersFromUI();
    let n = 0;
    if (f.timeRange !== 'month') n++;
    if (f.amountBasis !== 'finalTotal') n++;
    if (f.giftMode !== 'exclude') n++;
    if (f.statusFilter !== 'all') n++;
    if (f.startDate || f.endDate) n++;
    if (n > 0) { badge.textContent = n; badge.classList.remove('d-none'); } else { badge.classList.add('d-none'); }
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
    const timeEl = document.getElementById('statsTimeFilter');
    const customRange = document.getElementById('statsCustomDateRange');
    if (timeEl && timeEl.value === 'custom' && customRange) customRange.classList.remove('d-none');
    else if (customRange) customRange.classList.add('d-none');
    updateStatsFilterBadge();
}

function resetStatsFilters() {
    const timeEl = document.getElementById('statsTimeFilter');
    const amountEl = document.getElementById('statsAmountBasis');
    const giftEl = document.getElementById('statsGiftMode');
    const statusEl = document.getElementById('statsStatusFilter');
    const customStart = document.getElementById('statsCustomStart');
    const customEnd = document.getElementById('statsCustomEnd');
    const quickStart = document.getElementById('statsStartDate');
    const quickEnd = document.getElementById('statsEndDate');
    if (timeEl) timeEl.value = 'month';
    if (amountEl) amountEl.value = 'finalTotal';
    if (giftEl) giftEl.value = 'exclude';
    if (statusEl) statusEl.value = 'all';
    if (customStart) customStart.value = '';
    if (customEnd) customEnd.value = '';
    if (quickStart) quickStart.value = '';
    if (quickEnd) quickEnd.value = '';
    document.getElementById('statsCustomDateRange').classList.add('d-none');
    updateStatsFilterBadge();
    applyStatsFilters();
}

function setStatsQuickRange(range) {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (range === 'today') { }
    else if (range === 'week') { start.setDate(start.getDate() - 6); }
    else if (range === 'month') { start.setDate(start.getDate() - 29); }
    else if (range === 'thisMonth') { start.setDate(1); }
    else if (range === 'lastMonth') { start.setMonth(start.getMonth() - 1); start.setDate(1); end = new Date(start.getFullYear(), start.getMonth() + 1, 0); end.setHours(23, 59, 59, 999); }
    const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    document.getElementById('statsStartDate').value = ymd(start);
    document.getElementById('statsEndDate').value = ymd(end);
    const timeEl = document.getElementById('statsTimeFilter');
    if (timeEl) timeEl.value = range === 'today' ? 'today' : range === 'week' ? 'week' : range === 'month' ? 'month' : range === 'thisMonth' ? 'thisMonth' : range === 'lastMonth' ? 'lastMonth' : 'custom';
    onStatsFilterChange();
    applyStatsFilters();
}

function applyStatsFilters() {
    const f = getStatsFiltersFromUI();
    if (f.timeRange === 'custom' && f.startDate) {
        const customStart = document.getElementById('statsCustomStart');
        const customEnd = document.getElementById('statsCustomEnd');
        if (customStart) customStart.value = f.startDate;
        if (customEnd) customEnd.value = f.endDate;
    }
    document.querySelectorAll('.stats-quick-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.range === f.timeRange);
    });
    const dataset = getStatsDataset(history, f);
    renderStatsKpis(dataset.totals);
    renderStatsTrends(dataset.dailyAgg);
    renderStatsTopLists(dataset.byClient, dataset.byProduct);
}

function renderStatsPage() {
    updateStatsFilterBadge();
    applyStatsFilters();
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
            ['订单数', dataset.totals.orderCount],
            ['总收入', dataset.totals.revenueTotal],
            ['客单价', dataset.totals.aov],
            ['制品项总数', dataset.totals.itemTotal],
            ['制品项完成率(%)', dataset.totals.itemDoneRate],
            ['订单完成数', dataset.totals.orderDoneCount],
            ['订单完成率(%)', dataset.totals.orderDoneRate],
            ['逾期订单数', dataset.totals.overdueOrderCount]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), '汇总');
        const clientData = [['单主ID', '订单数', '总金额']];
        dataset.byClient.forEach(c => { clientData.push([c.clientId, c.orderCount, c.revenueTotal]); });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(clientData), 'Top单主');
        const productData = [['制品名', '次数', '金额贡献']];
        dataset.byProduct.forEach(p => { productData.push([p.productName, p.count, p.revenueTotal]); });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(productData), 'Top制品');
        const date = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, '统计_' + date + '.xlsx');
    } catch (e) {
        console.error(e);
        alert('导出失败：' + (e.message || e));
    }
}

// 打开计算抽屉
function openCalculatorDrawer() {
    const drawer = document.getElementById('calculatorDrawer');
    if (!drawer) return;

    // 每次打开时刷新计算页的选择器与系数
    updateCalculatorBuiltinSelects();
    updateCalculatorCoefficientSelects();

    drawer.classList.add('open');
    isCalculatorOpen = true;
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
                <input type="number" id="giftQuantity-${gift.id}" value="${gift.quantity}" min="1" onchange="updateGift(${gift.id}, 'quantity', parseInt(this.value))">
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
                <input type="number" id="productQuantity-${product.id}" value="${product.quantity}" min="1" onchange="updateProduct(${product.id}, 'quantity', parseInt(this.value))">
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
                                    <input type="number" id="${configKey}" value="${currentValue}" min="0" step="1" 
                                           onchange="updateProductAdditionalConfig(${productId}, '${configKey}', parseInt(this.value))" 
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
    products = products.filter(p => p.id !== id);
    document.querySelector(`[data-id="${id}"]`).remove();
}

// 计算价格
function calculatePrice() {
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
    const contactType = document.getElementById('contactType').value;
    const contact = document.getElementById('contact').value || '未知';
    const deadline = document.getElementById('deadline').value;
    
    // 获取设置选项的类型
    const usageType = document.getElementById('usage').value;
    const urgentType = document.getElementById('urgent').value;
    const sameModelType = document.getElementById('sameModel').value;
    const discountType = document.getElementById('discount').value;
    const platformType = document.getElementById('platform').value;
    
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
        
        // 计算同模相关数据
        const sameModelCount = product.sameModel ? product.quantity - 1 : 0;
        const sameModelUnitPrice = basePrice * sameModelCoefficient;
        const sameModelTotal = sameModelCount * sameModelUnitPrice;
        
        // 计算背景费
        let backgroundFee = 0;
        if (product.hasBackground) {
            const backgroundFeePerProduct = defaultSettings.backgroundFee || 0;
            // 主制品全额背景费，同模制品应用同模系数
            const mainBackgroundFee = backgroundFeePerProduct;
            const sameModelBackgroundUnitPrice = backgroundFeePerProduct * sameModelCoefficient;
            const sameModelBackgroundTotal = sameModelCount * sameModelBackgroundUnitPrice;
            backgroundFee = mainBackgroundFee + sameModelBackgroundTotal;
        }
        
        // 计算工艺费用
        let totalProcessFee = 0;
        let processDetails = [];
        
        // 处理多选工艺
        if (product.processes) {
            Object.values(product.processes).forEach(processChoice => {
                const processSetting = processSettings.find(p => p.id === processChoice.id);
                if (processSetting) {
                    // 工艺价格（每层）
                    const processPricePerLayer = processSetting.price || 10;
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
        
        // 计算制品总价
        const baseProductTotal = basePrice + sameModelTotal;
        const productTotal = baseProductTotal + totalProcessFee + backgroundFee;
        
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
        const sameModelUnitPrice = basePrice * sameModelCoefficient;
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
                    const processPricePerLayer = processSetting.price || 10;
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
        
        giftPrices.push(giftPriceInfo);
        totalGiftsOriginalPrice += giftOriginalPrice;
    }
    
    // 计算总价：总价 = (制品1+…+制品N) * 加价类1*…*加价类n * 折扣类1*…*折扣类n + 其他费用合计 + 平台手续费
    const productsTotal = totalProductsPrice;
    const totalWithCoefficients = productsTotal * pricingUpProduct * pricingDownProduct;
    // 3. 加上其他费用
    const totalBeforePlatformFee = totalWithCoefficients + totalOtherFees;
    // 4. 计算平台手续费，四舍五入到元
    const platformFeeAmount = Math.round(totalBeforePlatformFee * (platformFee / 100));
    // 5. 计算最终总价
    const finalTotal = totalBeforePlatformFee + platformFeeAmount;
    
    // 获取开始时间
    const startTimeValue = document.getElementById('startTime')?.value;
    
    // 生成报价数据
    quoteData = {
        clientId: clientId,
        contact: `${contactType}: ${contact}`,
        startTime: startTimeValue,
        deadline: deadline,
        usage: usage,
        urgent: urgent,
        sameModelCoefficient: sameModelCoefficient,
        discount: discount,
        usageType: usageType,
        urgentType: urgentType,
        discountType: discountType,
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
        timestamp: new Date().toISOString()
    };
    
    // 生成报价单（主小票区域）
    generateQuote();
    
    // 如果小票抽屉当前是打开状态，同步抽屉里的小票内容
    if (typeof isReceiptDrawerOpen !== 'undefined' && isReceiptDrawerOpen) {
        syncReceiptDrawerContent();
    }
    
    // 关闭计算抽屉（从计算页返回排单页）
    if (typeof closeCalculatorDrawer === 'function') {
        closeCalculatorDrawer();
    }
    
    // 切换到报价/排单页
    showPage('quote');

    // 自动打开小票抽屉，直接展示最新小票
    openReceiptDrawer();
    
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
        receiptInfoHtml += `<p class="receipt-text-sm">${orderNotification}</p>`;
    }
        
    // 开始时间
    if (receiptInfo.showStartTime !== false && quoteData.startTime) {  // 默认为true
        receiptInfoHtml += `<p class="receipt-text-sm">START TIME: ${quoteData.startTime}</p>`;
    }
        
    // 截稿时间
    if (receiptInfo.showDeadline !== false && quoteData.deadline) {  // 默认为true
        receiptInfoHtml += `<p class="receipt-text-sm">DEADLINE: ${quoteData.deadline}</p>`;
    }
        
    // 设计师
    if (receiptInfo.showDesigner !== false && defaultSettings.artistInfo.id) {  // 默认为true
        receiptInfoHtml += `<p class="receipt-text-sm">DESIGNER: ${defaultSettings.artistInfo.id}</p>`;
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
        const canMerge = !hasSameModel && !hasProcess && item.productType !== 'config' && (item.productType === 'fixed' || (item.productType === 'double' && !hasAdditionalConfig));
        
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
        
        // 处理制品名（double需要加单/双面）
        let productName = item.product;
        if (item.productType === 'double') {
            if (item.sides === 'single') {
                productName = `${item.product}(单面)`;
            } else if (item.sides === 'double') {
                productName = `${item.product}(双面)`;
            }
        }
        
        // 总览行
        if (canMerge) {
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
                html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent"></div><div class="receipt-col-2"><span class="receipt-bullet">•</span> 同模制品(${sameModelRate}x)</div><div class="receipt-col-1">¥${item.sameModelUnitPrice.toFixed(2)}</div><div class="receipt-col-1">${item.sameModelCount}</div><div class="receipt-col-1">¥${item.sameModelTotal.toFixed(2)}</div></div>`;
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
                    html += `<div class="receipt-sub-row"><div class="receipt-sub-row-indent"></div><div class="receipt-col-2"><span class="receipt-bullet">•</span> 同模制品(${sameModelRateGift}x)</div><div class="receipt-col-1">¥${item.sameModelUnitPrice.toFixed(2)}</div><div class="receipt-col-1">${item.sameModelCount}</div><div class="receipt-col-1">¥${item.sameModelTotal.toFixed(2)}</div></div>`;
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
    
    html += `<div class="receipt-summary"><div class="receipt-summary-row" style="font-weight: bold;"><div class="receipt-summary-label">制品小计</div><div class="receipt-summary-value">¥${base.toFixed(2)}</div></div>`;
    
    // 区块1：加价类系数
    if (addAmount !== 0 && up !== 1) {
        html += `<div class="receipt-summary-section">`;
        // 合计行
        const upDisplay = parseFloat(up.toFixed(4)).toString();
        html += `<div class="receipt-summary-section-total receipt-summary-row"><div class="receipt-summary-label">加价合计：${upDisplay}×</div><div class="receipt-summary-value">¥${(base * up).toFixed(2)}</div></div>`;
        // 详细系数
        const upCoefficients = [];
        // 用途系数
        let usageValue = quoteData.usage || 1;
        let usageName = '用途系数';
        if (quoteData.usageType && defaultSettings.usageCoefficients[quoteData.usageType]) {
            const usageOption = defaultSettings.usageCoefficients[quoteData.usageType];
            usageValue = getCoefficientValue(usageOption);
            usageName = (usageOption && usageOption.name) ? usageOption.name : '用途系数';
        } else if (quoteData.usage !== undefined && quoteData.usage !== 1) {
            // 向后兼容：从usage值查找匹配的系数选项
            usageValue = quoteData.usage;
            for (const [key, option] of Object.entries(defaultSettings.usageCoefficients)) {
                if (Math.abs(getCoefficientValue(option) - quoteData.usage) < 0.001) {
                    usageName = (option && option.name) ? option.name : '用途系数';
                    break;
                }
            }
        }
        if (usageValue !== 1) {
            upCoefficients.push({
                name: usageName,
                value: usageValue
            });
        }
        // 加急系数
        let urgentValue = quoteData.urgent || 1;
        let urgentName = '加急系数';
        if (quoteData.urgentType && defaultSettings.urgentCoefficients[quoteData.urgentType]) {
            const urgentOption = defaultSettings.urgentCoefficients[quoteData.urgentType];
            urgentValue = getCoefficientValue(urgentOption);
            urgentName = (urgentOption && urgentOption.name) ? urgentOption.name : '加急系数';
        } else if (quoteData.urgent !== undefined && quoteData.urgent !== 1) {
            // 向后兼容：从urgent值查找匹配的系数选项
            urgentValue = quoteData.urgent;
            for (const [key, option] of Object.entries(defaultSettings.urgentCoefficients)) {
                if (Math.abs(getCoefficientValue(option) - quoteData.urgent) < 0.001) {
                    urgentName = (option && option.name) ? option.name : '加急系数';
                    break;
                }
            }
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
                if (sel.value !== 1) {
                    upCoefficients.push({
                        name: sel.optionName || '扩展加价系数',
                        value: sel.value
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
        let discountValue = quoteData.discount || 1;
        let discountName = '折扣系数';
        if (quoteData.discountType && defaultSettings.discountCoefficients[quoteData.discountType]) {
            const discountOption = defaultSettings.discountCoefficients[quoteData.discountType];
            discountValue = getCoefficientValue(discountOption);
            discountName = (discountOption && discountOption.name) ? discountOption.name : '折扣系数';
        } else if (quoteData.discount !== undefined && quoteData.discount !== 1) {
            // 向后兼容：从discount值查找匹配的系数选项
            discountValue = quoteData.discount;
            for (const [key, option] of Object.entries(defaultSettings.discountCoefficients)) {
                if (Math.abs(getCoefficientValue(option) - quoteData.discount) < 0.001) {
                    discountName = (option && option.name) ? option.name : '折扣系数';
                    break;
                }
            }
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
                if (sel.value !== 1) {
                    downCoefficients.push({
                        name: sel.optionName || '扩展折扣系数',
                        value: sel.value
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
    
    // 总金额（显示在平台费之前，折扣后金额+其他费用）
    // 总金额应该总是显示，无论是否有折扣或其他费用
    html += `<div class="receipt-summary-row" style="font-weight: bold; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dotted #ccc;"><div class="receipt-summary-label">总金额</div><div class="receipt-summary-value">¥${totalBeforePlat.toFixed(2)}</div></div>`;
    
    // 平台费
    if (quoteData.platformFeeAmount > 0) {
        const platformFeeRate = quoteData.platformFee || 0;
        html += `<div class="receipt-summary-row"><div class="receipt-summary-label">平台费 ${platformFeeRate}%</div><div class="receipt-summary-value">+¥${quoteData.platformFeeAmount.toFixed(2)}</div></div>`;
    }
    
    // 实付金额（只有在有平台费时才显示）
    if (quoteData.platformFeeAmount > 0) {
        html += `<div class="receipt-total"><div class="receipt-summary-label">实付金额</div><div class="receipt-summary-value">¥${quoteData.finalTotal.toFixed(2)}</div></div>`;
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

    // 打开抽屉后再次根据当前屏幕尺寸调整小票缩放
    adjustReceiptScale();

    // 移动端防止背景滚动，PC 端仍允许排单区滚动
    if (window.innerWidth <= 768) {
        document.body.style.overflow = 'hidden';
    }

    // #region agent log
    try {
        const receiptBody = document.querySelector('.receipt-drawer-body');
        const receiptBodyStyle = receiptBody ? window.getComputedStyle(receiptBody) : null;
        fetch('http://127.0.0.1:7243/ingest/aacd2503-de7b-44b4-90a0-639adcc9f233', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'debug-session',
                runId: 'pre-fix',
                hypothesisId: 'H2',
                location: 'script.js:4422',
                message: 'open receipt drawer',
                data: {
                    innerWidth: window.innerWidth,
                    bodyOverflow: document.body.style.overflow || null,
                    receiptBodyPresent: !!receiptBody,
                    receiptBodyOverflow: receiptBodyStyle ? receiptBodyStyle.overflow : null,
                    receiptBodyScrollHeight: receiptBody ? receiptBody.scrollHeight : null,
                    receiptBodyClientHeight: receiptBody ? receiptBody.clientHeight : null
                },
                timestamp: Date.now()
            })
        }).catch(() => {});
    } catch (e) {}
    // #endregion
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
    saveToHistory();
    maybeReturnToRecordAndCloseReceipt();
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
                    } catch (err) {
                        // 用户取消分享，不做任何提示
                        if (err.name !== 'AbortError') {
                            // 其他错误，尝试直接下载
                            triggerDownload(canvas.toDataURL('image/png'), filename);
                        }
                    }
                } else {
                    // 不支持分享，直接下载（图片会存到"下载"文件夹）
                    triggerDownload(canvas.toDataURL('image/png'), filename);
                }
            }, 'image/png');
        } else {
            // 桌面端：直接下载
            triggerDownload(canvas.toDataURL('image/png'), filename);
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
    link.click();
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

// 保存到历史记录
function saveToHistory() {
    if (!quoteData) {
        alert('请先生成报价单！');
        return;
    }
    
    // 检查是否在编辑模式下
    if (window.editingHistoryId) {
        // 更新现有排单
        const index = history.findIndex(item => item.id === window.editingHistoryId);
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
                id: window.editingHistoryId,
                timestamp: existing.timestamp,
                productDoneStates: doneStates
            };
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
        history.unshift({
            id: Date.now(),
            ...quoteData,
            productDoneStates
        });
        if (history.length > 20) {
            history = history.slice(0, 20);
        }
        showGlobalToast('报价单已加入排单！');
    }
    
    saveData();
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

// 排单制品完成状态：取单条排单时补全 productDoneStates（供日历/todo 等使用，含制品+赠品）
function ensureProductDoneStates(item) {
    if (!item) return item;
    const productLen = Array.isArray(item.productPrices) ? item.productPrices.length : 0;
    const giftLen = Array.isArray(item.giftPrices) ? item.giftPrices.length : 0;
    const needLen = productLen + giftLen;
    if (item.productDoneStates == null) {
        item.productDoneStates = Array(needLen).fill(false);
    } else if (item.productDoneStates.length < needLen) {
        while (item.productDoneStates.length < needLen) item.productDoneStates.push(false);
    } else if (item.productDoneStates.length > needLen) {
        item.productDoneStates = item.productDoneStates.slice(0, needLen);
    }
    return item;
}

// 更新某条排单的制品完成状态并持久化
function setScheduleProductDone(scheduleId, productIndex, done) {
    const item = history.find(h => h.id === scheduleId);
    if (!item) return;
    ensureProductDoneStates(item);
    if (!Array.isArray(item.productDoneStates) || productIndex < 0 || productIndex >= item.productDoneStates.length) return;
    item.productDoneStates[productIndex] = !!done;
    saveData();
}

// 按选中日期获取所有排单：返回该日期在时间范围内的所有排单
function getScheduleItemsForDate(selectedDate) {
    if (!selectedDate) return [];
    const normalizeYmd = (d) => {
        if (!d) return null;
        const x = typeof d === 'string' ? new Date(d) : d;
        if (isNaN(x.getTime())) return null;
        return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    };
    const target = normalizeYmd(selectedDate);
    if (!target) return [];
    return history.filter(h => {
        ensureProductDoneStates(h);
        const start = h.startTime ? normalizeYmd(h.startTime) : normalizeYmd(h.timestamp);
        const end = h.deadline ? normalizeYmd(h.deadline) : start;
        if (!start || !end) return false;
        return target >= start && target <= end;
    });
}

// 有排单时间的全部（startTime 或 deadline 至少一个）
function getScheduleItemsAll() {
    return history.filter(h => {
        ensureProductDoneStates(h);
        return !!(h.startTime || h.deadline);
    });
}

// 待排单：未设置排单时间（无 startTime 且无 deadline）
function getScheduleItemsPending() {
    return history.filter(h => {
        ensureProductDoneStates(h);
        return !h.startTime && !h.deadline;
    });
}

window.scheduleTodoFilter = 'today';
function setScheduleTodoFilter(f) {
    window.scheduleTodoFilter = f;
    document.querySelectorAll('.schedule-todo-filter-btn').forEach(btn => {
        btn.classList.toggle('active', (btn.dataset.filter || '') === f);
    });
    renderScheduleTodoSection();
}

function getScheduleItemsByFilter() {
    const f = window.scheduleTodoFilter || 'today';
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    if (f === 'all') return getScheduleItemsAll();
    if (f === 'month') return getScheduleItemsForMonth(y, m);
    if (f === 'pending') return getScheduleItemsPending();
    const today = y + '-' + String(m).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    if (!window.scheduleSelectedDate) window.scheduleSelectedDate = today;
    return getScheduleItemsForDate(window.scheduleSelectedDate);
}

// 默认 todo：返回当前月内（与该月有交集）的所有排单
function getScheduleItemsForMonth(year, month) {
    const monthStart = new Date(year, month - 1, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0);
    monthEnd.setHours(23, 59, 59, 999);
    return history.filter(h => {
        ensureProductDoneStates(h);
        const start = h.startTime ? new Date(h.startTime) : new Date(h.timestamp);
        const end = h.deadline ? new Date(h.deadline) : start;
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return !(end < monthStart || start > monthEnd);
    });
}

function formatYmdCn(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr || '—';
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

function computeMonthProductStats(items) {
    let total = 0;
    let done = 0;
    items.forEach(item => {
        ensureProductDoneStates(item);
        const productLen = Array.isArray(item.productPrices) ? item.productPrices.length : 0;
        const giftLen = Array.isArray(item.giftPrices) ? item.giftPrices.length : 0;
        const n = productLen + giftLen;
        const states = Array.isArray(item.productDoneStates) ? item.productDoneStates : [];
        total += n;
        for (let i = 0; i < n && i < states.length; i++) {
            if (states[i] === true) done++;
        }
    });
    return { done, undone: Math.max(0, total - done), total };
}

function renderScheduleMonthTitleStats(year, month) {
    // 标题区月份（简洁格式：2025.1）
    const monthEl = document.querySelector('.schedule-title-month');
    if (monthEl) monthEl.textContent = year + '.' + month;

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
    const toYmd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const todayYmd = toYmd(now);
    const dateInput = document.getElementById('scheduleTitleDateInput');
    if (dateInput) dateInput.value = window.scheduleSelectedDate || todayYmd;

    // Today 按钮：只在选中日期不是今天时显示
    const isOtherDay = !!window.scheduleSelectedDate && window.scheduleSelectedDate !== todayYmd;
    const todayBtn = document.querySelector('.schedule-title-today-pill');
    if (todayBtn) todayBtn.classList.toggle('d-none', !isOtherDay);
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
    renderScheduleCalendar();
    renderScheduleTodoSection();
}

// 点击 Today 按钮：跳回今天
function scheduleTodoBackToToday() {
    const now = new Date();
    const toYmd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    window.scheduleSelectedDate = toYmd(now);
    window.scheduleCalendarYear = now.getFullYear();
    window.scheduleCalendarMonth = now.getMonth() + 1;
    renderScheduleCalendar();
    renderScheduleTodoSection();
}

// 当前批次：返回「最近截稿日」或「选中日所在截稿日」的那批排单。返回 { deadline: 'YYYY-MM-DD', items: schedule[] }
function getScheduleBatchForDisplay(selectedDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalizeYmd = (d) => {
        if (!d) return null;
        const x = typeof d === 'string' ? new Date(d) : d;
        if (isNaN(x.getTime())) return null;
        return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    };
    const items = history.filter(h => h.deadline).map(ensureProductDoneStates);
    if (items.length === 0) return { deadline: null, items: [] };
    if (selectedDate) {
        const target = normalizeYmd(selectedDate);
        if (!target) return { deadline: null, items: [] };
        const batch = items.filter(h => normalizeYmd(h.deadline) === target);
        return { deadline: target, items: batch };
    }
    const deadlines = [...new Set(items.map(h => normalizeYmd(h.deadline)))].filter(Boolean).sort();
    const todayStr = normalizeYmd(today);
    const nearest = deadlines.find(d => d >= todayStr) || deadlines[deadlines.length - 1];
    const batch = items.filter(h => normalizeYmd(h.deadline) === nearest);
    return { deadline: nearest, items: batch };
}

// 日历条带数据：指定年月，返回该月内可见的排单条带 { id, clientId, productCount, startDate, endDate }[]
function getScheduleBarsForCalendar(year, month) {
    const bars = [];
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const toYmd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    history.forEach(item => {
        if (!item.startTime && !item.deadline) return;
        // 如果该排单所有制品都已完成，则不再渲染彩条
        ensureProductDoneStates(item);
        const states = Array.isArray(item.productDoneStates) ? item.productDoneStates : [];
        const totalLen =
            (Array.isArray(item.productPrices) ? item.productPrices.length : 0) +
            (Array.isArray(item.giftPrices) ? item.giftPrices.length : 0);
        const doneCount = states.filter(Boolean).length;
        if (totalLen > 0 && doneCount >= totalLen) return;

        const start = item.startTime ? new Date(item.startTime) : new Date(item.timestamp);
        const end = item.deadline ? new Date(item.deadline) : start;
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        if (end < monthStart || start > monthEnd) return;
        const startDate = toYmd(start);
        const endDate = toYmd(end);
        const productCount = (Array.isArray(item.productPrices) ? item.productPrices.length : 0) + (Array.isArray(item.giftPrices) ? item.giftPrices.length : 0);
        bars.push({ id: item.id, clientId: item.clientId || '', productCount, startDate, endDate });
    });
    return bars;
}

// 排单日历条带色板（与彩条颜色预览.html 一致，整体偏亮）
var SCHEDULE_BAR_COLORS = [
    'rgba(190, 215, 250, 0.38)',
    'rgba(175, 225, 240, 0.38)',
    'rgba(248, 232, 195, 0.38)',
    'rgba(250, 200, 220, 0.38)',
    'rgba(218, 200, 245, 0.38)',
    'rgba(185, 235, 248, 0.38)',
    'rgba(245, 195, 195, 0.38)',
    'rgba(225, 200, 250, 0.38)',
    'rgba(245, 215, 185, 0.38)',
    'rgba(195, 245, 225, 0.38)'
];
var SCHEDULE_BAR_TEXT_COLORS = ['#2d4a6b', '#2d5c5c', '#5c4d28', '#5c3048', '#3d2d5c', '#2d5c68', '#5c2828', '#4a3d68', '#5c4430', '#2d6850'];

// 按星期视图：同周内条带轨道分配，最多 3 条（一行一天最多显示 3 个）
function assignWeekBarsToTracks(segments) {
    var tracks = [];
    var maxTracks = 3;
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
    const bars = getScheduleBarsForCalendar(y, m);
    const toYmd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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
        html += '<div class="schedule-week-block">';
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
        const weekTracks = assignWeekBarsToTracks(segments);
        if (weekTracks.length > 0) {
            html += '<div class="schedule-week-bars">';
            weekTracks.forEach(function (track, ti) {
                track.forEach(function (s) {
                    const b = s.bar;
                    const color = SCHEDULE_BAR_COLORS[Math.abs(b.id) % SCHEDULE_BAR_COLORS.length];
                    const label = (b.clientId || '—') + '  ' + b.productCount + '制品';
                    var textColor = SCHEDULE_BAR_TEXT_COLORS[Math.abs(b.id) % SCHEDULE_BAR_TEXT_COLORS.length];
                    var singleDay = s.startCol === s.endCol ? ' data-single-day="1"' : '';
                    html += '<div class="schedule-bar-strip" style="grid-column: ' + (s.startCol + 1) + ' / ' + (s.endCol + 2) + '; grid-row: ' + (ti + 1) + '; background:' + color + '; color:' + textColor + ';" title="' + label + '" data-week-first-day="' + weekFirstDay + '" data-start-col="' + s.startCol + '" data-end-col="' + s.endCol + '"' + singleDay + '>' + label + '</div>';
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
            renderScheduleCalendar();
            renderScheduleTodoSection();
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
                renderScheduleCalendar();
                renderScheduleTodoSection();
            }
        });
    });
}

function scheduleCalendarPrevMonth() {
    if (window.scheduleCalendarMonth <= 1) {
        window.scheduleCalendarMonth = 12;
        window.scheduleCalendarYear--;
    } else {
        window.scheduleCalendarMonth--;
    }
    renderScheduleCalendar();
    renderScheduleTodoSection();
}

function scheduleCalendarNextMonth() {
    if (window.scheduleCalendarMonth >= 12) {
        window.scheduleCalendarMonth = 1;
        window.scheduleCalendarYear++;
    } else {
        window.scheduleCalendarMonth++;
    }
    renderScheduleCalendar();
    renderScheduleTodoSection();
}

// 渲染当前批次制品 todo 区（按快捷筛选或选中日期显示排单制品）
function renderScheduleTodoSection() {
    const titleEl = document.getElementById('scheduleTodoTitle');
    const modulesEl = document.getElementById('scheduleTodoModules');
    if (!titleEl || !modulesEl) return;
    const f = window.scheduleTodoFilter || 'today';
    if (f === 'today' && !window.scheduleSelectedDate) {
        const now = new Date();
        const y0 = now.getFullYear();
        const m0 = String(now.getMonth() + 1).padStart(2, '0');
        const d0 = String(now.getDate()).padStart(2, '0');
        window.scheduleSelectedDate = y0 + '-' + m0 + '-' + d0;
    }
    const items = getScheduleItemsByFilter();
    const titles = { all: '所有', month: '当月', pending: '待排', today: '当日' };
    const sub = f === 'today' && window.scheduleSelectedDate ? '：' + formatYmdCn(window.scheduleSelectedDate) : '';
    titleEl.textContent = (titles[f] || '当日') + sub;
    if (items.length === 0) {
        modulesEl.innerHTML = '<p class="schedule-todo-empty">该日期暂无排单</p>';
        return;
    }
    // 排序：已全部完成的卡片移到最后
    const sortedItems = items.slice().sort((a, b) => {
        ensureProductDoneStates(a);
        ensureProductDoneStates(b);
        const aTotal = (Array.isArray(a.productPrices) ? a.productPrices.length : 0) + (Array.isArray(a.giftPrices) ? a.giftPrices.length : 0);
        const bTotal = (Array.isArray(b.productPrices) ? b.productPrices.length : 0) + (Array.isArray(b.giftPrices) ? b.giftPrices.length : 0);
        const aDone = aTotal > 0 && (a.productDoneStates || []).filter(Boolean).length === aTotal;
        const bDone = bTotal > 0 && (b.productDoneStates || []).filter(Boolean).length === bTotal;
        return Number(aDone) - Number(bDone);
    });
    var toMd = function(str) {
        if (!str) return '—';
        var d = new Date(str);
        return isNaN(d.getTime()) ? '—' : (d.getMonth() + 1) + '.' + d.getDate();
    };
    modulesEl.innerHTML = '';
    sortedItems.forEach(item => {
        ensureProductDoneStates(item);
        const doneStates = item.productDoneStates || [];
        const products = Array.isArray(item.productPrices) ? item.productPrices : [];
        const gifts = Array.isArray(item.giftPrices) ? item.giftPrices : [];
        const total = products.length + gifts.length;
        let doneCount = 0;
        for (let i = 0; i < doneStates.length; i++) { if (doneStates[i]) doneCount++; }
        const dateStr = item.deadline || item.startTime || item.timestamp;
        const d = dateStr ? new Date(dateStr) : null;
        const hasDate = d && !isNaN(d.getTime());
        const monthText = hasDate ? (d.getMonth() + 1) + '月' : '—';
        const dayText = hasDate ? String(d.getDate()).padStart(2, '0') : '—';
        let rangeText = '—';
        if (item.startTime && item.deadline) rangeText = toMd(item.startTime) + ' → ' + toMd(item.deadline);
        else if (item.deadline) rangeText = '截稿 ' + toMd(item.deadline);
        else if (item.startTime) rangeText = '开始 ' + toMd(item.startTime);
        const client = item.clientId || '单主';
        const progress = doneCount + '/' + total;
        const status = getRecordProgressStatus(item);
        const productItems = products.map((p, i) => ({ label: (p.product || '制品') + (p.quantity > 1 ? ' x ' + p.quantity : ''), idx: i, done: !!doneStates[i] }));
        const giftItems = gifts.map((p, i) => ({ label: '[赠品] ' + (p.product || '赠品') + (p.quantity > 1 ? ' x ' + p.quantity : ''), idx: products.length + i, done: !!doneStates[products.length + i] }));
        const allItems = productItems.concat(giftItems).sort((a, b) => Number(a.done) - Number(b.done));
        const chipHtml = allItems.map(({ label, idx, done }) =>
            '<div class="schedule-todo-row schedule-todo-chip' + (done ? ' schedule-todo-done' : '') + '">' +
            '<input type="checkbox" class="schedule-todo-checkbox" ' + (done ? 'checked' : '') + ' data-id="' + item.id + '" data-idx="' + idx + '" onchange="toggleScheduleTodoDone(this)">' +
            '<span class="schedule-todo-label">' + label + '</span></div>'
        ).join('');
        modulesEl.innerHTML += ''
            + '<div class="schedule-todo-card" onclick="handleScheduleTodoCardClick(' + item.id + ', event)">'
            + '  <div class="schedule-todo-card-main">'
            + '    <span class="schedule-todo-card-month">' + monthText + '</span>'
            + '    <span class="schedule-todo-card-day">' + dayText + '</span>'
            + '    <span class="schedule-todo-card-sep"></span>'
            + '    <div class="schedule-todo-card-head">'
            + '      <span class="schedule-todo-card-range">' + rangeText + '</span>'
            + '      <span class="schedule-todo-card-sep-inline"></span>'
            + '      <span class="schedule-todo-card-client">' + client + '</span>'
            + '      <span class="schedule-todo-card-progress">' + progress + '</span>'
            + '      <span class="record-status ' + status.className + ' schedule-todo-card-status">' + status.text + '</span>'
            + '    </div>'
            + '    <div class="schedule-todo-card-products">' + chipHtml + '</div>'
            + '  </div>'
            + '</div>';
    });
}

function toggleScheduleTodoDone(checkbox) {
    const id = parseInt(checkbox.dataset.id, 10);
    const idx = parseInt(checkbox.dataset.idx, 10);
    
    // 验证数据有效性
    if (isNaN(id) || isNaN(idx)) {
        console.error('Invalid data attributes:', checkbox.dataset);
        return;
    }
    
    setScheduleProductDone(id, idx, checkbox.checked);
    const row = checkbox.closest('.schedule-todo-row');
    if (row) {
        row.classList.toggle('schedule-todo-done', checkbox.checked);
        // 勾选后重新渲染 todo 与 日历彩条，保持排序与状态实时同步
        setTimeout(() => {
            renderScheduleTodoSection();
            renderScheduleCalendar();
        }, 0);
    }
}

// 点击 todo 卡片：跳转到计算页编辑对应记录（避免点击复选框时误触）
function handleScheduleTodoCardClick(id, event) {
    if (event) {
        const target = event.target;
        if (target && (target.closest('.schedule-todo-checkbox') || target.tagName === 'INPUT')) {
            return;
        }
    }
    editHistoryItem(id);
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
            item.finalTotal >= parseFloat(filters.minPrice)
        );
    }
    if (filters.maxPrice !== undefined && filters.maxPrice !== '') {
        filteredHistory = filteredHistory.filter(item => 
            item.finalTotal <= parseFloat(filters.maxPrice)
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
                    return (b.finalTotal || 0) - (a.finalTotal || 0);
                case 'price-asc':
                    return (a.finalTotal || 0) - (b.finalTotal || 0);
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
                联系方式: ${item.contact}\n
                截稿日: ${item.deadline}\n
                最终总价: ¥${item.finalTotal.toFixed(2)}
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
                <button class="icon-action-btn delete" onclick="deleteHistoryItem(${item.id})" aria-label="删除" title="删除">
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
    
    let count = 0;
    const timeFilter = document.getElementById('historyTimeFilter');
    const minPrice = document.getElementById('historyMinPrice');
    const maxPrice = document.getElementById('historyMaxPrice');
    const sortBy = document.getElementById('historySortBy');
    const groupBy = document.getElementById('historyGroupBy');
    
    if (timeFilter && timeFilter.value && timeFilter.value !== 'all') count++;
    if (minPrice && minPrice.value) count++;
    if (maxPrice && maxPrice.value) count++;
    if (sortBy && sortBy.value && sortBy.value !== 'time-desc') count++;
    if (groupBy && groupBy.value && groupBy.value !== 'none') count++;
    
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('d-none');
    } else {
        badge.classList.add('d-none');
    }
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
    
    history = history.filter(item => !selectedHistoryIds.has(item.id));
    selectedHistoryIds.clear();
    saveData();
    
    // 重新应用当前筛选条件
    applyHistoryFilters();
    if (document.getElementById('recordContainer')) {
        applyRecordFilters();
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
    
    // 打开计算抽屉，将历史记录加载到计算表单
    openCalculatorDrawer();

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
    if (quote.contact) {
        const contactParts = quote.contact.split(':');
        if (contactParts.length >= 2) {
            const contactType = contactParts[0].trim();
            const contactValue = contactParts.slice(1).join(':').trim();
            document.getElementById('contactType').value = contactType;
            document.getElementById('contact').value = contactValue;
        } else {
            document.getElementById('contact').value = quote.contact;
        }
    }
    if (quote.startTime) {
        document.getElementById('startTime').value = quote.startTime;
    }
    if (quote.deadline) {
        document.getElementById('deadline').value = quote.deadline;
    }
    
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
        
        // 恢复平台费
        if (quote.platformType) {
            const platformSelect = document.getElementById('platform');
            if (platformSelect) {
                platformSelect.value = quote.platformType;
                if (platformSelect.onchange) platformSelect.onchange();
            }
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
                
                // 恢复工艺信息
                if (productPrice.processDetails && Array.isArray(productPrice.processDetails)) {
                    productPrice.processDetails.forEach(process => {
                        if (process.name && process.layers) {
                            product.processes[process.name] = process.layers;
                        }
                    });
                }
                
                // 恢复基础+递增价的配置
                if (productPrice.productType === 'config' && productPrice.additionalConfigDetails) {
                    // 对于基础+递增价，需要根据配置恢复sides值
                    // 这里简化处理，如果有additionalConfigDetails，使用配置数量+1作为sides
                    const totalConfig = productPrice.additionalConfigDetails.reduce((sum, c) => sum + (c.count || 0), 0);
                    if (totalConfig > 0) {
                        product.sides = (totalConfig + 1).toString();
                    }
                } else if (productPrice.productType === 'config' && productPrice.totalAdditionalCount !== undefined) {
                    product.sides = (productPrice.totalAdditionalCount + 1).toString();
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
                
                // 恢复工艺信息
                if (giftPrice.processDetails && Array.isArray(giftPrice.processDetails)) {
                    giftPrice.processDetails.forEach(process => {
                        if (process.name && process.layers) {
                            gift.processes[process.name] = process.layers;
                        }
                    });
                }
                
                // 恢复基础+递增价的配置
                if (giftPrice.productType === 'config' && giftPrice.additionalConfigDetails) {
                    const totalConfig = giftPrice.additionalConfigDetails.reduce((sum, c) => sum + (c.count || 0), 0);
                    if (totalConfig > 0) {
                        gift.sides = (totalConfig + 1).toString();
                    }
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
    
    alert('历史记录已加载到计算页，可以修改后重新计算！');
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
            giftPrices: quote.giftPrices || []
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
    history = history.filter(item => item.id !== id);
    selectedHistoryIds.delete(id);
    saveData();
    applyHistoryFilters();
    // 同步刷新记录页
    if (document.getElementById('recordContainer')) {
        applyRecordFilters();
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
        exportData = exportData.filter(item => item.finalTotal >= parseFloat(minPrice));
    }
    if (maxPrice) {
        exportData = exportData.filter(item => item.finalTotal <= parseFloat(maxPrice));
    }
    
    if (exportData.length === 0) {
        alert('当前筛选条件下没有可导出的历史记录！');
        return;
    }
    
    // 准备汇总表数据
    const summaryData = exportData.map(item => ({
        '时间': new Date(item.timestamp).toLocaleString('zh-CN'),
        '单主ID': item.clientId || '',
        '联系方式': item.contact || '',
        '开始时间': item.startTime || '',
        '截稿时间': item.deadline || '',
        '制品总价': item.totalProductsPrice || 0,
        '其他费用': item.totalOtherFees || 0,
        '平台费': item.platformFeeAmount || 0,
        '最终总价': item.finalTotal || 0,
        '用途系数': item.usage || 1,
        '加急系数': item.urgent || 1,
        '折扣系数': item.discount || 1,
        '制品数量': item.productPrices ? item.productPrices.length : 0,
        '赠品数量': item.giftPrices ? item.giftPrices.length : 0
    }));
    
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
        { wch: 20 }, // 联系方式
        { wch: 12 }, // 开始时间
        { wch: 12 }, // 截稿时间
        { wch: 12 }, // 制品总价
        { wch: 12 }, // 其他费用
        { wch: 12 }, // 平台费
        { wch: 12 }, // 最终总价
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
function updateArtistInfo(field, value) {
    defaultSettings.artistInfo[field] = value;
    
    // 如果修改的是默认工期，重新计算截稿时间
    if (field === 'defaultDuration') {
        calculateDeadline();
    }
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
    
    // 清除现有选项（保留前4个默认选项）
    while (select.options.length > 4) {
        select.remove(4);
    }
    
    // 添加其他费用类别选项
    for (const [key, fee] of Object.entries(defaultSettings.otherFees)) {
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
            }
            break;
    }
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
    
    // 重置输入框
    document.getElementById('otherFeeType').value = 'none';
    document.getElementById('otherFeeAmount').value = '';
    document.getElementById('customOtherFeeName').value = '';
    document.getElementById('customOtherFeeName').style.display = 'none';
}

// 移除动态其他费用
function removeDynamicOtherFee(id) {
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



// 加载设置（基础信息 + 其他费用；系数由 renderCoefficientSettings 从 defaultSettings 渲染，无需在此回填）
function loadSettings() {
    document.getElementById('artistId').value = defaultSettings.artistInfo.id;
    document.getElementById('artistContact').value = defaultSettings.artistInfo.contact;
    document.getElementById('defaultDuration').value = defaultSettings.artistInfo.defaultDuration;
    renderOtherFees();
}

// 保存设置
function saveSettings() {
    // 无需手动保存，因为每个输入框的onchange事件已经更新了defaultSettings
    saveData();
    alert('设置已保存！');
}

// 管理递增配置项
let additionalConfigsList = [];

function addAdditionalConfig() {
    const container = document.getElementById('additionalConfigsContainer');
    const configId = Date.now();
    additionalConfigsList.push({ id: configId, name: '', price: 0, unit: '' });
    renderAdditionalConfigs();
}

function removeAdditionalConfig(configId) {
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
    additionalConfigsList = [];
    
    // 显示固定价设置，隐藏其他设置
    showPriceSettings('fixed');
    
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
        '选择或输入分类名称',
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
        
        html += `
            <div class="category-container">
                <div class="category-header" onclick="toggleCategory('${category}')">
                    <div class="category-title">${category}</div>
                    <div class="category-count">(${categorySettings.length}个)</div>
                    <div class="category-toggle">${toggleText}</div>
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

// 更新计算页中“其他加价类”“其他折扣类”选择器
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
                            if (v === 0) {
                                html += '<option value="' + k + '">' + escapedName + '*0</option>';
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

// 渲染同模系数
function renderSameModelCoefficients() {
    const container = document.querySelector('#sameModelCoefficient-content .coefficient-settings');
    if (!container) return;
    
    let html = '';
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
    const price = parseFloat(document.getElementById('newProcessPrice').value) || 10;
    
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
        const price = setting.price || 10;
        
        html += `
            <div class="process-item" data-id="${setting.id}">
                <div class="process-item-row">
                    <div class="process-item-group">
                        <label class="process-item-label">工艺名称</label>
                        <input type="text" class="process-item-input" value="${setting.name}" onchange="updateProcessSetting(${setting.id}, 'name', this.value)" placeholder="请输入工艺名称">
                    </div>
                    <div class="process-item-group">
                        <label class="process-item-label">价格（每层）</label>
                        <input type="number" class="process-item-input process-item-price" value="${price}" onchange="updateProcessSetting(${setting.id}, 'price', parseFloat(this.value))" placeholder="价格" min="0" step="1">
                    </div>
                    <button class="icon-action-btn delete process-item-delete" onclick="deleteProcessSetting(${setting.id})" aria-label="删除工艺" title="删除">
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
    const setting = processSettings.find(p => p.id === id);
    if (setting) {
        setting[field] = value;
    }
}

// 删除工艺设置
function deleteProcessSetting(id) {
    processSettings = processSettings.filter(p => p.id !== id);
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
                            
                            // 如果没有找到编号的配置项，尝试使用旧格式
                            if (newProduct.additionalConfigs.length === 0) {
                                const oldConfigName = row['配置名称'] || '配置';
                                const oldConfigPrice = parseFloat(row['配置价格'] || row['递增价'] || row['递增价格'] || 0) || 0;
                                const oldConfigUnit = row['配置单位'] || row['单位'] || row['递增单位'] || '';
                                
                                if (oldConfigPrice > 0) {  // 如果有价格，则添加配置项
                                    newProduct.additionalConfigs.push({
                                        name: oldConfigName,
                                        price: oldConfigPrice,
                                        unit: oldConfigUnit
                                    });
                                }
                            }
                            break;
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
                       setting.priceType === 'config' ? '基础+递增价' : ''
        };
        
        switch(setting.priceType) {
            case 'fixed':
                row['固定价格'] = setting.price || 0;
                break;
            case 'double':
                row['单面价格'] = setting.priceSingle || 0;
                row['双面价格'] = setting.priceDouble || 0;
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
window.addEventListener('load', init);

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
                     style="display: ${isChecked ? 'flex' : 'none'}; align-items: center; gap: 0.25rem; margin-left: 1rem;">
                    <input type="number" id="processLayers-${productId}-${setting.id}" value="${layers}" min="1" step="1" 
                           onchange="updateProcessLayers(${productId}, ${setting.id}, parseInt(this.value), ${isGift})" 
                           style="width: 40px; padding: 0.15rem; font-size: 0.75rem; border: 1px solid #e0e0e0; border-radius: 3px;">
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
    
    item.processes[processId].layers = layers;
}

// 删除赠品项
function removeGift(giftId) {
    gifts = gifts.filter(g => g.id !== giftId);
    const giftElement = document.querySelector(`[data-id="${giftId}"]`);
    if (giftElement) {
        giftElement.remove();
    }
}

// 恢复默认设置
function resetToDefaultSettings() {
    if (confirm('确定要恢复默认设置吗？此操作将清除所有自定义设置！')) {
        // 恢复默认设置
        localStorage.removeItem('calculatorSettings');
        localStorage.removeItem('productSettings');
        localStorage.removeItem('processSettings');
        
        // 重新初始化应用
        location.reload(); // 刷新页面以应用默认设置
    }
}

// 排单日历功能


// 自动初始化应用，确保小票设置与预览可用
if (typeof init === 'function') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
