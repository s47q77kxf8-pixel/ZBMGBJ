// 全局变量
let products = [];
let gifts = [];
let productSettings = [];
let processSettings = [];
let quoteData = null;
let history = [];
let productIdCounter = 0;
let giftIdCounter = 0;



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
        private: { value: 1.5, name: '不公开展示' },
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
    extraPricingUp: [],
    // 可扩展的折扣类系数（折扣为内置；此处为后期添加的）
    extraPricingDown: [],
    // 小票自定义设置
    receiptCustomization: {
        headerImage: null,  // 头部图片的base64数据
        titleText: 'LIST',  // 标题文本
        receiptInfo: {  // 小票信息行
            orderNotification: '',  // 订单通知
            showStartTime: true,  // 是否显示开始时间
            showDeadline: true,  // 是否显示截稿时间
            showDesigner: true,  // 是否显示设计师
            showContactInfo: true,  // 是否显示联系方式
            customText: ''  // 自定义文本
        },
        footerText1: '温馨提示',  // 尾部文本1
        footerText2: '感谢惠顾',  // 尾部文本2
        footerImage: null  // 尾部图片的base64数据
    }
};

// 默认制品分类（单一定义，避免多处硬编码）
const DEFAULT_CATEGORIES = ['吧唧类', '纸片类', '亚克力类'];

// 初始化应用
function init() {
    // 加载本地存储的数据
    loadData();
    
    // 初始化动态其他费用数组
    if (!Array.isArray(dynamicOtherFees)) {
        window.dynamicOtherFees = [];
    }
    
    // 确保默认设置不为空
    addDefaultProductSettings();
    addDefaultProcessSettings();
    
    // 添加第一个制品项
    addProduct();
    
    // 初始化其他费用类型选项
    initOtherFeeTypeOptions();
    
    // 更新显示
    updateDisplay();
    
    // 总是渲染制品设置和工艺设置，确保数据被渲染到页面上
    renderProductSettings();
    renderProcessSettings();
    renderCoefficientSettings();
    
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
    });
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
    try {
        const savedHistory = localStorage.getItem('quoteHistory');
        const savedSettings = localStorage.getItem('calculatorSettings');
        const savedProductSettings = localStorage.getItem('productSettings');
        const savedProcessSettings = localStorage.getItem('processSettings');
        
        if (savedHistory) {
            history = JSON.parse(savedHistory);
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
            };
            reader.readAsDataURL(value);
        }
    } else {
        // 如果是文本内容，直接更新
        defaultSettings.receiptCustomization[field] = value;
        saveData();
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
    const panel = document.getElementById('receiptCustomizationPanel');
    
    if (panel.classList.contains('d-none')) {
        // 显示面板
        panel.classList.remove('d-none');
        // 加载当前的自定义设置到表单中
        loadReceiptCustomizationToForm();
    } else {
        // 隐藏面板
        panel.classList.add('d-none');
    }
}

// 关闭小票自定义设置面板
function closeReceiptCustomizationPanel() {
    document.getElementById('receiptCustomizationPanel').classList.add('d-none');
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
            // 检查图片尺寸
            const img = new Image();
            img.onload = function() {
                // 检查图片尺寸 (最大限制为2000x2000)
                if (img.width > 2000 || img.height > 2000) {
                    alert('图片尺寸过大，请选择尺寸不超过2000x2000的图片');
                    return;
                }
                
                defaultSettings.receiptCustomization[field] = e.target.result;
                saveData();
                
                // 更新预览
                if (field === 'headerImage' && document.getElementById('headerImagePreview')) {
                    document.getElementById('headerImagePreview').innerHTML = `<img src="${e.target.result}" alt="头部图片预览" style="max-width: 200px; max-height: 100px;">`;
                } else if (field === 'footerImage' && document.getElementById('footerImagePreview')) {
                    document.getElementById('footerImagePreview').innerHTML = `<img src="${e.target.result}" alt="尾部图片预览" style="max-width: 200px; max-height: 100px;">`;
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// 更新小票信息设置
function updateReceiptInfo(field, value) {
    if (!defaultSettings.receiptCustomization.receiptInfo) {
        defaultSettings.receiptCustomization.receiptInfo = {
            orderNotification: '',
            showStartTime: true,
            showDeadline: true,
            showDesigner: true,
            customText: ''
        };
    }
    
    defaultSettings.receiptCustomization.receiptInfo[field] = value;
    saveData();
}

// 加载小票自定义设置到表单
function loadReceiptCustomizationToForm() {
    const settings = defaultSettings.receiptCustomization;
    
    if (settings) {
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
        }
        
        // 设置图片预览
        if (settings.headerImage && document.getElementById('headerImagePreview')) {
            document.getElementById('headerImagePreview').innerHTML = `<img src="${settings.headerImage}" alt="头部图片预览" style="max-width: 200px; max-height: 100px;">`;
        }
        if (settings.footerImage && document.getElementById('footerImagePreview')) {
            document.getElementById('footerImagePreview').innerHTML = `<img src="${settings.footerImage}" alt="尾部图片预览" style="max-width: 200px; max-height: 100px;">`;
        }
    }
}

// 清除小票自定义设置
function clearReceiptCustomization() {
    if (confirm('确定要清除所有小票自定义设置吗？此操作不可撤销。')) {
        // 重置小票自定义设置为默认值
        defaultSettings.receiptCustomization = {
            headerImage: null,
            titleText: 'LIST',
            footerText1: '温馨提示',
            footerText2: '感谢惠顾',
            footerImage: null,
            receiptInfo: {
                orderNotification: '',
                showStartTime: true,
                showDeadline: true,
                showDesigner: true,
                showContactInfo: true,
                customText: ''
            },
        };
        
        // 保存设置
        saveData();
        
        // 重新加载表单以反映更改
        loadReceiptCustomizationToForm();
        
        alert('小票自定义设置已清除！');
    }
}

// 页面切换功能
function showPage(pageId) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // 显示目标页面
    document.getElementById(pageId).classList.add('active');
    
    // 更新导航按钮状态
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 激活对应的导航按钮
    // 检查当前活动的按钮并激活它（通过查找含有对应onclick调用的按钮）
    const targetBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => {
        const onclickStr = btn.getAttribute('onclick') || '';
        return onclickStr.includes(`showPage('${pageId}')`);
    });
    
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
    
    // 如果是报价页，只在quoteData为空时加载历史记录
    if (pageId === 'quote' && !quoteData) {
        loadHistory();
    }
    
    // 如果是设置页，加载设置
    if (pageId === 'settings') {
        loadSettings();
        renderProductSettings();
        renderProcessSettings();
        renderCoefficientSettings();
    }
    // 切换到计算页时刷新所有系数选择器
    if (pageId === 'calculator') {
        updateCalculatorBuiltinSelects();
        updateCalculatorCoefficientSelects();
    }
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
    
    // 生成制品类型选项和datalist
    let productTypeOptions = '';
    productSettings.forEach(setting => {
        productTypeOptions += `<option value="${setting.name}" data-id="${setting.id}">${setting.name}</option>`;
    });
    
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
            <button class="btn danger" onclick="removeGift(${gift.id})">删除</button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="giftType-${gift.id}">制品类型</label>
                <div style="position: relative;">
                    <input type="text" id="giftType-${gift.id}" list="giftTypeSuggestions-${gift.id}" value="${selectedProductName}" placeholder="输入制品类型名称" 
                           onchange="updateGiftType(${gift.id}, this.value); updateGiftForm(${gift.id})">
                    <datalist id="giftTypeSuggestions-${gift.id}">
                        ${productTypeOptions}
                    </datalist>
                </div>
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
    
    // 生成制品类型选项和datalist
    let productTypeOptions = '';
    productSettings.forEach(setting => {
        productTypeOptions += `<option value="${setting.name}" data-id="${setting.id}">${setting.name}</option>`;
    });
    
    // 查找当前选中的制品类型名称
    let selectedProductName = '';
    if (product.type) {
        const selectedSetting = productSettings.find(setting => setting.id.toString() === product.type);
        if (selectedSetting) {
            selectedProductName = selectedSetting.name;
        }
    }
    
    productElement.innerHTML = `
        <div class="product-item-header">
            <div class="product-item-title">制品 ${product.id}</div>
            <button class="btn danger" onclick="removeProduct(${product.id})">删除</button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="productType-${product.id}">制品类型</label>
                <div style="position: relative;">
                    <input type="text" id="productType-${product.id}" list="productTypeSuggestions-${product.id}" value="${selectedProductName}" placeholder="输入制品类型名称" 
                           onchange="updateProductType(${product.id}, this.value); updateProductForm(${product.id})">
                    <datalist id="productTypeSuggestions-${product.id}">
                        ${productTypeOptions}
                    </datalist>
                </div>
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
                    <div class="form-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <label>基础+递增价</label>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-left: 100px;">
                            <span>基础价 (${productSetting.baseConfig})：¥${productSetting.basePrice}</span>
                        </div>
                        ${additionalConfigs.map((config, index) => {
                            const configKey = `config_${productId}_${index}`;
                            const currentValue = product.additionalConfigs && product.additionalConfigs[configKey] ? product.additionalConfigs[configKey] : 0;
                            return `
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-left: 100px;">
                                    <span>+${config.name} (¥${config.price})</span>
                                    <input type="number" id="${configKey}" value="${currentValue}" min="0" step="1" 
                                           onchange="updateProductAdditionalConfig(${productId}, '${configKey}', parseInt(this.value))" 
                                           style="width: 60px;">
                                    <span>${config.unit}</span>
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
    // 获取单主信息
    const clientId = document.getElementById('clientId').value || '未知';
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
        const productTotal = baseProductTotal + totalProcessFee;
        
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
        
        // 计算赠品原价
        const baseGiftTotal = basePrice + sameModelTotal;
        const giftOriginalPrice = baseGiftTotal + totalProcessFee;
        
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
    
    // 生成报价单
    generateQuote();
    
    // 切换到报价页
    showPage('quote');
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
    
    // 生成HTML结构 - 使用购物小票样式
    let html = `
        <div class="receipt">`;
    
    // 添加头部图片（如果设置了）
    if (defaultSettings.receiptCustomization.headerImage) {
        html += `<div class="receipt-header-image"><img src="${defaultSettings.receiptCustomization.headerImage}" alt="头部图片" style="max-width: 300px; height: auto;" /></div>`;
    }
    
    // 添加自定义标题（如果设置了）
    if (defaultSettings.receiptCustomization.titleText) {
        html += `<h2 class="receipt-title">${defaultSettings.receiptCustomization.titleText}</h2>`;
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
        const _arr = Object.values(defaultSettings.sameModelCoefficients || {});
        const _found = _arr.find(c => c && c.name === '改字、色、柄图');
        const sameModelRate = getCoefficientValue(_found || _arr[0]) || 0.5;
        
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
            
            // 获取同模系数值
            const _arrG = Object.values(defaultSettings.sameModelCoefficients || {});
            const _foundG = _arrG.find(c => c && c.name === '改字、色、柄图');
            const sameModelRateGift = getCoefficientValue(_foundG || _arrG[0]) || 0.5;
            
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
                html += `<div class="receipt-row" style="display: flex; align-items: flex-end;"><div class="receipt-col-2">[赠品] ${giftProductName}</div><div class="receipt-col-1">¥${fullPriceUnitPriceGift.toFixed(2)}</div><div class="receipt-col-1">${item.quantity}</div><div class="receipt-col-1" style="display: flex; flex-direction: column; align-items: flex-end;"><span style="color: green; font-weight: bold; font-size: 1.1em;">¥0.00</span><span style="text-decoration: line-through; font-size: 0.9em;">¥${productTotalGift.toFixed(2)}</span></div></div>`;
            } else {
                // 需要拆明细
                if (item.productType === 'config') {
                    html += `<div class="receipt-row" style="display: flex; align-items: flex-end;"><div class="receipt-col-2">[赠品] ${giftProductName}</div><div class="receipt-col-1">¥${item.basePrice.toFixed(2)}</div><div class="receipt-col-1">${item.quantity}</div><div class="receipt-col-1" style="display: flex; flex-direction: column; align-items: flex-end;"><span style="color: green; font-weight: bold; font-size: 1.1em;">¥0.00</span><span style="text-decoration: line-through; font-size: 0.9em;">¥${productTotalGift.toFixed(2)}</span></div></div>`;
                } else {
                    html += `<div class="receipt-row" style="display: flex; align-items: flex-end;"><div class="receipt-col-2">[赠品] ${giftProductName}</div><div class="receipt-col-1" style="color:#999;">—</div><div class="receipt-col-1">${item.quantity}件</div><div class="receipt-col-1" style="display: flex; flex-direction: column; align-items: flex-end;"><span style="color: green; font-weight: bold; font-size: 1.1em;">¥0.00</span><span style="text-decoration: line-through; font-size: 0.9em;">¥${productTotalGift.toFixed(2)}</span></div></div>`;
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
    const discountAmount = Math.round(quoteData.totalProductsPrice * up * (down - 1));
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
    // 只有在有折扣、其他费用或两者都有时才显示总金额行
    if (down !== 1 || quoteData.totalOtherFees > 0) {
        html += `<div class="receipt-summary-row" style="font-weight: bold; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dotted #ccc;"><div class="receipt-summary-label">总金额</div><div class="receipt-summary-value">¥${totalBeforePlat.toFixed(2)}</div></div>`;
    }
    
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
                html += `<div class="receipt-footer-image"><img src="${defaultSettings.receiptCustomization.footerImage}" alt="尾部图片" style="max-width: 200px; height: auto; margin-top: 0.5rem;" /></div>`;
            }
                        
            // 添加自定义底部文本2（如果设置了）
            if (defaultSettings.receiptCustomization.footerText2) {
                html += `<p class="receipt-footer-text2">${defaultSettings.receiptCustomization.footerText2}</p>`;
            }
                        
            html += `</div>`;
            html += `</div>`;
    
    container.innerHTML = html;
}

// 保存报价为图片
async function saveQuoteAsImage() {
    if (!quoteData) {
        alert('请先生成报价单！');
        return;
    }
    
    const receipt = document.querySelector('.receipt');
    if (!receipt) {
        alert('找不到报价单元素！');
        return;
    }
    
    try {
        // 使用html2canvas生成图片
        const canvas = await html2canvas(receipt, {
            scale: 2, // 提高分辨率
            useCORS: true,
            logging: false
        });
        
        // 转换为图片并下载
        const link = document.createElement('a');
        link.download = `报价单_${quoteData.clientId}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    } catch (error) {
        console.error('保存图片失败:', error);
        alert('保存图片失败，请重试！');
    }
}

// 保存到历史记录
function saveToHistory() {
    if (!quoteData) {
        alert('请先生成报价单！');
        return;
    }
    
    // 添加到历史记录
    history.unshift({
        id: Date.now(),
        ...quoteData
    });
    
    // 限制历史记录数量
    if (history.length > 20) {
        history = history.slice(0, 20);
    }
    
    // 保存到本地存储
    saveData();
    
    // 刷新历史记录显示
    loadHistory();
    
    alert('报价单已保存到历史记录！');
}

// 加载历史记录
function loadHistory(searchKeyword = '') {
    const container = document.getElementById('historyContainer');
    
    if (history.length === 0) {
        container.innerHTML = '<p>暂无历史记录</p>';
        return;
    }
    
    // 过滤历史记录
    let filteredHistory = history;
    if (searchKeyword) {
        filteredHistory = history.filter(item => {
            // 检查关键词是否在客户端ID、联系方式、截稿日或总价中
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
    
    let html = '';
    if (filteredHistory.length === 0) {
        html = '<p>未找到匹配的历史记录</p>';
    } else {
        filteredHistory.forEach(item => {
            html += `
                <div class="history-item">
                    <div class="history-item-header">
                        <div class="history-item-title">报价单 - ${item.clientId}</div>
                        <div class="history-item-date">${new Date(item.timestamp).toLocaleString()}</div>
                    </div>
                    <div class="history-item-content">
                        联系方式: ${item.contact}\n
                        截稿日: ${item.deadline}\n
                        最终总价: ¥${item.finalTotal.toFixed(2)}
                    </div>
                    <button class="btn secondary" onclick="loadQuoteFromHistory(${item.id})">查看详情</button>
                    <button class="btn danger" onclick="deleteHistoryItem(${item.id})">删除</button>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
}

// 搜索历史记录
function searchHistory() {
    const searchInput = document.getElementById('historySearchInput');
    const keyword = searchInput.value.trim();
    loadHistory(keyword);
}

// 清空搜索
function clearHistorySearch() {
    const searchInput = document.getElementById('historySearchInput');
    searchInput.value = '';
    loadHistory();
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
            }
        }, 50);  // 稍微增加延迟，确保页面完全切换
    }
}

// 删除历史记录项
function deleteHistoryItem(id) {
    history = history.filter(item => item.id !== id);
    saveData();
    loadHistory();
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
                <div class="other-fee-item d-flex items-center gap-2 mb-2 ml-4">
                    <input type="text" value="${fee.name}" onchange="updateOtherFee('${key}', 'name', this.value)" class="flex-1">
                    <input type="number" value="${fee.amount}" onchange="updateOtherFee('${key}', 'amount', this.value)" min="0" step="1" class="w-120">
                    <button class="btn danger xs" onclick="deleteOtherFee('${key}')">删除</button>
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
            <div class="dynamic-fee-item d-flex items-center gap-2 p-2 bg-light rounded">
                <span class="flex-1">${fee.name}</span>
                <span class="w-80 text-right">¥${fee.amount}</span>
                <button class="btn danger xs" onclick="removeDynamicOtherFee(${fee.id})">删除</button>
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
                <button type="button" class="btn danger small" onclick="removeAdditionalConfig(${config.id})">删除</button>
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
    const datalist = document.getElementById('categorySuggestions');
    const input = document.getElementById('newProductCategory');
    
    // 清空现有选项
    datalist.innerHTML = '';
    
    // 获取所有唯一分类
    const categories = new Set();
    productSettings.forEach(setting => {
        categories.add(setting.category);
    });
    
    // 添加默认分类
    DEFAULT_CATEGORIES.forEach(category => {
        categories.add(category);
    });
    
    // 添加分类建议选项
    Array.from(categories).sort().forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        datalist.appendChild(option);
    });
    
    // 移除可能存在的自定义分类输入框
    const customInput = document.getElementById('customCategoryInput');
    if (customInput) {
        customInput.remove();
    }
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
    const category = document.getElementById('newProductCategory').value.trim() || DEFAULT_CATEGORIES[0];
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
        
        html += `
            <div class="category-container">
                <div class="category-header" onclick="toggleCategory('${category}')">
                    <div class="category-title">${category}</div>
                    <div class="category-count">(${categorySettings.length}个)</div>
                    <div class="category-toggle">▼</div>
                </div>
                <div class="category-content d-none" id="${category}-content">
        `;
        
        // 渲染该类别的所有制品设置
        categorySettings.forEach(setting => {
            html += `
                <div class="product-item" data-id="${setting.id}">
                    <div class="product-item-header">
                        <div class="product-item-title">${setting.name}</div>
                        <div class="product-item-actions">
                            <button class="btn danger" onclick="deleteProductSetting(${setting.id})">删除</button>
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
                                <input type="number" value="${setting.price}" onchange="updateProductSetting(${setting.id}, 'price', parseFloat(this.value))" placeholder="请输入固定价格" min="0" step="1">
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- 单双面价设置 -->
                    ${setting.priceType === 'double' ? `
                        <div class="form-row">
                            <div class="form-group">
                                <label>单面价格</label>
                                <input type="number" value="${setting.priceSingle}" onchange="updateProductSetting(${setting.id}, 'priceSingle', parseFloat(this.value))" placeholder="请输入单面价格" min="0" step="1">
                            </div>
                            <div class="form-group">
                                <label>双面价格</label>
                                <input type="number" value="${setting.priceDouble}" onchange="updateProductSetting(${setting.id}, 'priceDouble', parseFloat(this.value))" placeholder="请输入双面价格" min="0" step="1">
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- 基础+递增价设置 -->
                    ${setting.priceType === 'config' ? `
                        <div class="form-row">
                            <div class="form-group">
                                <label>基础配置</label>
                                <input type="text" value="${setting.baseConfig}" onchange="updateProductSetting(${setting.id}, 'baseConfig', this.value)" placeholder="例如：1插+1底座">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>基础价</label>
                                <input type="number" value="${setting.basePrice}" onchange="updateProductSetting(${setting.id}, 'basePrice', parseFloat(this.value))" placeholder="请输入基础价" min="0" step="1">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>递增配置项</label>
                                <div id="additionalConfigsContainer-${setting.id}">
                                    ${(setting.additionalConfigs || []).map((config, index) => `
                                        <div class="d-flex gap-2 mb-2 items-center p-2 bg-light rounded">
                                            <input type="text" placeholder="配置名称" value="${config.name}" 
                                                   onchange="updateProductAdditionalConfigSetting(${setting.id}, ${index}, 'name', this.value)" 
                                                   class="flex-1 p-2">
                                            <input type="number" placeholder="价格" value="${config.price}" min="0" step="1"
                                                   onchange="updateProductAdditionalConfigSetting(${setting.id}, ${index}, 'price', this.value)" 
                                                   class="w-100 p-2">
                                            <input type="text" placeholder="单位" value="${config.unit}" 
                                                   onchange="updateProductAdditionalConfigSetting(${setting.id}, ${index}, 'unit', this.value)" 
                                                   class="w-80 p-2">
                                            <button type="button" class="btn danger small" onclick="removeProductAdditionalConfigSetting(${setting.id}, ${index})">删除</button>
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
    
    // 使用 d-none 类控制显示/隐藏，而不是内联样式
    if (content.classList.contains('d-none')) {
        content.classList.remove('d-none');
        toggle.textContent = '▲';
    } else {
        content.classList.add('d-none');
        toggle.textContent = '▼';
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
    div.innerHTML = '<input type="text" placeholder="名称" class="flex-1" value="无"><input type="number" placeholder="系数值" class="w-80" value="1" min="0" step="0.1"><button type="button" class="btn danger xs" onclick="removeCoefficientItem(this)">删除</button>';
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
    const listEl = document.getElementById('coefficientTypeSuggestions');
    const inputEl = document.getElementById('coefficientType');
    const hintEl = document.getElementById('coefficientTypeHint');
    if (!catEl || !listEl || !inputEl) return;
    const cat = catEl.value;
    inputEl.value = '';
    if (cat === 'pricingUp') {
        listEl.innerHTML = '<option value="用途系数"><option value="加急系数">';
        inputEl.placeholder = '例如：用途系数、加急系数';
        if (hintEl) hintEl.textContent = '加价类系数名称，可参考上述或输入新名称';
    } else if (cat === 'pricingDown') {
        listEl.innerHTML = '<option value="折扣系数">';
        inputEl.placeholder = '例如：折扣系数';
        if (hintEl) hintEl.textContent = '折扣类系数名称，可参考上述或输入新名称';
    } else {
        listEl.innerHTML = '';
        inputEl.placeholder = '';
        if (hintEl) hintEl.textContent = '根据上方选择的大类输入系数名称';
    }
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
    const typeName = (document.getElementById('coefficientType').value || '').trim();
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
        html += '<div class="category-container"><div class="category-header" onclick="toggleCategory(\'extraUp-' + e.id + '\')"><span class="category-title">' + (e.name || '未命名') + '</span><div style="display: flex; align-items: center; gap: 0.5rem;"><button type="button" class="btn danger xs" onclick="event.stopPropagation();deleteExtraCoefficient(' + e.id + ',\'up\')">删除系数</button><div class="category-toggle">▼</div></div></div>';
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
            html += '<div class="mb-2 d-flex items-center gap-2"><input type="text" value="' + escapedName + '" class="flex-1" onchange="updateExtraPricingOption(' + e.id + ',\'up\',\'' + escapedKey + '\',\'name\',this.value)" placeholder="名称"><input type="number" value="' + v + '" min="0" step="0.1" class="w-80" onchange="updateExtraPricingOption(' + e.id + ',\'up\',\'' + escapedKey + '\',\'value\',this.value)"><button class="btn danger xs" onclick="deleteExtraPricingOption(' + e.id + ',\'up\',\'' + escapedKey + '\')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">删除</button></div>';
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
        html += '<div class="category-container"><div class="category-header" onclick="toggleCategory(\'extraDown-' + e.id + '\')"><span class="category-title">' + (e.name || '未命名') + '</span><div style="display: flex; align-items: center; gap: 0.5rem;"><button type="button" class="btn danger xs" onclick="event.stopPropagation();deleteExtraCoefficient(' + e.id + ',\'down\')">删除系数</button><div class="category-toggle">▼</div></div></div>';
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
            html += '<div class="mb-2 d-flex items-center gap-2"><input type="text" value="' + escapedName + '" class="flex-1" onchange="updateExtraPricingOption(' + e.id + ',\'down\',\'' + escapedKey + '\',\'name\',this.value)" placeholder="名称"><input type="number" value="' + v + '" min="0" step="0.1" class="w-80" onchange="updateExtraPricingOption(' + e.id + ',\'down\',\'' + escapedKey + '\',\'value\',this.value)"><button class="btn danger xs" onclick="deleteExtraPricingOption(' + e.id + ',\'down\',\'' + escapedKey + '\')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">删除</button></div>';
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
                keys.forEach(k => { const o = e.options[k]; h += '<option value="' + k + '">' + ((o&&o.name)||k) + '*' + (getCoefficientValue(o)||1) + '</option>'; });
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
                <button class="btn danger small" onclick="deleteCoefficient('usage', '${key}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">删除</button>
            </div>
        `;
    }
        
    container.innerHTML = html;
}

// 渲染加急系数
function renderUrgentCoefficients() {
    const container = document.querySelector('#urgentCoefficient-content .coefficient-settings');
    if (!container) return;
    
    let html = '';
    // 按系数值升序排序后渲染
    const sortedEntries = Object.entries(defaultSettings.urgentCoefficients).sort((a, b) => {
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
                       onchange="updateUrgentCoefficientName('${key}', this.value)" placeholder="名称">
                <input type="number" value="${value}" min="0" step="0.1" class="w-80" 
                       onchange="updateUrgentCoefficient('${key}', this.value)">
                <button class="btn danger small" onclick="deleteCoefficient('urgent', '${key}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">删除</button>
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
                <button class="btn danger small" onclick="deleteCoefficient('sameModel', '${key}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">删除</button>
            </div>
        `;
    }
    html += '<button type="button" class="btn secondary mt-2" onclick="addSameModelOption()">+ 添加系数值</button>';
    container.innerHTML = html;
}

// 渲染折扣系数
function renderDiscountCoefficients() {
    const container = document.querySelector('#discountCoefficient-content .coefficient-settings');
    if (!container) return;
    
    let html = '';
    // 按系数值降序排序后渲染（折扣类降序）
    const sortedEntries = Object.entries(defaultSettings.discountCoefficients).sort((a, b) => {
        const va = getCoefficientValue(a[1]);
        const vb = getCoefficientValue(b[1]);
        return vb - va;
    });
    for (const [key, item] of sortedEntries) {
        const value = getCoefficientValue(item);
        const displayName = (item && typeof item === 'object' && item.name) ? item.name : key;
        const escapedName = displayName.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        
        html += `
            <div class="mb-2 d-flex items-center gap-2">
                <input type="text" value="${escapedName}" class="flex-1" 
                       onchange="updateDiscountCoefficientName('${key}', this.value)" placeholder="名称">
                <input type="number" value="${value}" min="0" step="0.1" class="w-80" 
                       onchange="updateDiscountCoefficient('${key}', this.value)">
                <button class="btn danger small" onclick="deleteCoefficient('discount', '${key}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">删除</button>
            </div>
        `;
    }
        
    container.innerHTML = html;
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
                <button class="btn danger small" onclick="deleteCoefficient('platform', '${key}')" 
                        style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">删除</button>
            </div>
        `;
    }
    html += '<button type="button" class="btn secondary mt-2" onclick="addPlatformFeeOption()">+ 添加系数值</button>';
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
    const setting = productSettings.find(p => p.id === productId);
    if (setting && setting.additionalConfigs && setting.additionalConfigs[index]) {
        setting.additionalConfigs.splice(index, 1);
        renderProductSettings();
    }
}



// 删除制品设置
function deleteProductSetting(id) {
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
                <div class="process-item-header">
                    <div class="process-item-title">${setting.name}</div>
                    <button class="btn danger small" onclick="deleteProcessSetting(${setting.id})" 
                            style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">删除</button>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>工艺名称</label>
                        <input type="text" value="${setting.name}" onchange="updateProcessSetting(${setting.id}, 'name', this.value)" placeholder="请输入工艺名称">
                    </div>
                    <div class="form-group">
                        <label>价格（每层）</label>
                        <input type="number" value="${price}" onchange="updateProcessSetting(${setting.id}, 'price', parseFloat(this.value))" placeholder="请输入价格" min="0" step="1">
                    </div>
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
                    const priceType = row['计价方式'] || row['价格类型'] || 'fixed';
                    
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
                            while (row[`配置${configIndex}名称`] !== undefined || row[`配置${configIndex}名称`] !== undefined) {
                                const configName = row[`配置${configIndex}名称`] || row[`配置${configIndex}名称`] || row[`配置项${configIndex}名称`];
                                const configPrice = parseFloat(row[`配置${configIndex}价格`] || row[`配置${configIndex}价格`] || row[`配置项${configIndex}价格`] || 0);
                                const configUnit = row[`配置${configIndex}单位`] || row[`配置${configIndex}单位`] || row[`配置项${configIndex}单位`] || '';
                                
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
                    <div class="form-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <label>基础+递增价</label>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-left: 100px;">
                            <span>基础价 (${productSetting.baseConfig})：¥${productSetting.basePrice}</span>
                        </div>
                        ${additionalConfigs.map((config, index) => {
                            const configKey = `gift_config_${giftId}_${index}`;
                            const currentValue = gift.additionalConfigs && gift.additionalConfigs[configKey] ? gift.additionalConfigs[configKey] : 0;
                            return `
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-left: 100px;">
                                    <span>+${config.name} (+¥${config.price}/${config.unit})</span>
                                    <input type="number" id="${configKey}" value="${currentValue}" min="0" step="1" 
                                           onchange="updateGiftAdditionalConfig(${giftId}, '${configKey}', parseInt(this.value))" 
                                           style="width: 60px;">
                                    <span>${config.unit}</span>
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
    
    let html = '<div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 1rem;">';
    
    // 生成工艺选项，每个工艺可以选择并设置层数
    processSettings.forEach(setting => {
        const isChecked = item.processes && item.processes[setting.id] ? 'checked' : '';
        const layers = item.processes && item.processes[setting.id] ? item.processes[setting.id].layers : 1;
        
        html += `
            <div style="display: flex; align-items: center; gap: 0.5rem; min-width: 150px;">
                <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer; font-size: 0.9rem;">
                    <input type="checkbox" id="${isGift ? 'gift' : 'product'}Process-${productId}-${setting.id}" ${isChecked} 
                           onchange="toggleProcess(${productId}, ${setting.id}, this.checked, ${isGift})" 
                           style="cursor: pointer; width: 16px; height: 16px;">
                    <span>${setting.name}</span>
                </label>
                <div id="${isGift ? 'gift' : 'product'}ProcessLayersContainer-${productId}-${setting.id}" 
                     style="display: ${isChecked ? 'flex' : 'none'}; align-items: center; gap: 0.25rem;">
                    <input type="number" id="processLayers-${productId}-${setting.id}" value="${layers}" min="1" step="1" 
                           onchange="updateProcessLayers(${productId}, ${setting.id}, parseInt(this.value), ${isGift})" 
                           style="width: 50px; padding: 0.15rem 0.25rem; font-size: 0.8rem; border: 1px solid #e0e0e0; border-radius: 4px;">
                    <span style="font-size: 0.8rem; color: #666;">层</span>
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



