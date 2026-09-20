// 价目表「按制品设置生成」回归测试
// 覆盖：mcProductPriceDisplay 五种 priceType 价格映射（含此前缺失的按字数）
//       mcMergeSamePriceRows 同价合并（保持价格首现顺序 / 分类行作为合并边界）
//       generatePriceListFromProducts 生成链路（覆盖确认、选项读取、写入 _mcData）
// 期望：全部通过 / 0 失败

const fs = require('fs');
const src = fs.readFileSync(__dirname + '/script.js', 'utf8');

let pass = 0, fail = 0;
function t(name, cond) {
    if (cond) { pass++; console.log('  通过: ' + name); }
    else { fail++; console.log('  失败: ' + name); }
}

// —— 花括号配平抽函数（跳过字符串/注释，与 .gift_config_key_test.js 同款）——
function extractFn(code, name) {
    const idx = code.indexOf('function ' + name + '(');
    if (idx < 0) throw new Error('找不到函数 ' + name);
    const start = code.indexOf('{', idx);
    let depth = 0, inStr = null, line = false, block = false;
    for (let i = start; i < code.length; i++) {
        const c = code[i], n = code[i + 1];
        if (line) { if (c === '\n') line = false; continue; }
        if (block) { if (c === '*' && n === '/') { block = false; i++; } continue; }
        if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
        if (c === '/' && n === '/') { line = true; i++; continue; }
        if (c === '/' && n === '*') { block = true; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (!depth) return code.slice(idx, i + 1); }
    }
    throw new Error('函数 ' + name + ' 未闭合');
}

function run(name, sandbox) {
    const body = extractFn(src, name);
    const keys = Object.keys(sandbox);
    return new Function(keys.join(','), 'return (' + body + ')')(...keys.map(k => sandbox[k]));
}

// —— 用例 1：mcProductPriceDisplay 五种 priceType（含货币符号开关）——
const priceDisplay = run('mcProductPriceDisplay', {});
const priceDisplayCur = run('mcProductPriceDisplay', { getCurrencySymbol: () => '¥' });
t('fixed → 价格', priceDisplay({ priceType: 'fixed', price: 50 }) === '50');
t('fixed + 货币 → ¥50', priceDisplayCur({ priceType: 'fixed', price: 50 }, true) === '¥50');
t('double → 单价格 双价格', priceDisplay({ priceType: 'double', priceSingle: 50, priceDouble: 80 }) === '单50 双80');
t('double + 货币 → 单¥50 双¥80', priceDisplayCur({ priceType: 'double', priceSingle: 50, priceDouble: 80 }, true) === '单¥50 双¥80');
t('double 缺双面价 → 只显示单面', priceDisplay({ priceType: 'double', priceSingle: 50 }) === '单50');
t('config + 基础配置说明 → 50起（立牌+底座）', priceDisplay({ priceType: 'config', basePrice: 50, baseConfig: '立牌+底座' }).text === '50起（立牌+底座）');
t('config + 递增项带单位体现按数量加价 → 50起（立牌+底座·底座+30/个·插件+30/个）',
    priceDisplay({ priceType: 'config', basePrice: 50, baseConfig: '立牌+底座', additionalConfigs: [
        { name: '底座', price: 30, unit: '个' }, { name: '插件', price: 30, unit: '个' }
    ] }).text === '50起（立牌+底座·底座+30/个·插件+30/个）');
t('config + 递增项货币带单位 → ¥50起（立牌+底座·底座+¥30/个·插件+¥30/个）',
    priceDisplayCur({ priceType: 'config', basePrice: 50, baseConfig: '立牌+底座', additionalConfigs: [
        { name: '底座', price: 30, unit: '个' }, { name: '插件', price: 30, unit: '个' }
    ] }, true).text === '¥50起（立牌+底座·底座+¥30/个·插件+¥30/个）');
t('config + 递增项未填单位 → 只显示加价', priceDisplay({ priceType: 'config', basePrice: 50, additionalConfigs: [
        { name: '双面/折', price: 20 }
    ] }).text === '50起（双面/折+20）');
t('nodes → 总价', priceDisplay({ priceType: 'nodes', price: 140 }).text === '140');
t('nodes + 货币 → ¥140', priceDisplayCur({ priceType: 'nodes', price: 140 }, true).text === '¥140');
t('nodes + 节点百分比明细 → 140（草稿30%·色稿40%·成图30%）',
    priceDisplay({ priceType: 'nodes', price: 140, nodes: [
        { name: '草稿', percent: 30 }, { name: '色稿', percent: 40 }, { name: '成图', percent: 30 }
    ] }).text === '140（草稿30%·色稿40%·成图30%）');
t('nodes + 节点百分比货币 → ¥140（草稿30%·色稿40%·成图30%）',
    priceDisplayCur({ priceType: 'nodes', price: 140, nodes: [
        { name: '草稿', percent: 30 }, { name: '色稿', percent: 40 }, { name: '成图', percent: 30 }
    ] }, true).text === '¥140（草稿30%·色稿40%·成图30%）');
t('byChar → 字价/字（修复此前导不出价格）', priceDisplay({ priceType: 'byChar', charPrice: 30, charUnit: '字' }) === '30/字');
t('byChar + 货币 → ¥30/字', priceDisplayCur({ priceType: 'byChar', charPrice: 30, charUnit: '字' }, true) === '¥30/字');
t('byChar 无单位 → 默认「字」', priceDisplay({ priceType: 'byChar', charPrice: 30 }) === '30/字');
t('无有效价格 → 空串（预览显示询价）', priceDisplay({ priceType: 'fixed', price: NaN }) === '');

// —— 用例 2：同价合并（无分类）——
const merge = run('mcMergeSamePriceRows', { mcMergeRowsSegment: run('mcMergeRowsSegment', {}) });
const r1 = merge([
    { name: '普通吧唧', price: '50' },
    { name: '异形吧唧', price: '50' },
    { name: '背卡', price: '单50 双80' }
]);
t('同价合并为一行，名称用「 / 」拼接', r1.length === 2 && r1[0].name === '普通吧唧 / 异形吧唧' && r1[0].price === '50');
t('不同价保持独立行', r1[1].name === '背卡' && r1[1].price === '单50 双80');

const r2 = merge([
    { name: 'A', price: '50' },
    { name: 'B', price: '80' },
    { name: 'C', price: '50' }
]);
t('非相邻同价也合并，按价格首现顺序', r2.length === 2 && r2[0].name === 'A / C' && r2[1].name === 'B');

const r3 = merge([
    { name: 'A', price: '' },
    { name: 'B', price: '' }
]);
t('空价格（询价）同样合并', r3.length === 1 && r3[0].name === 'A / B' && r3[0].price === '');

// —— 用例 3：分类行作为合并边界 ——
const r4 = merge([
    { name: '吧唧类', price: '', isCategory: true },
    { name: '普通吧唧', price: '50' },
    { name: '纸片类', price: '', isCategory: true },
    { name: '背卡', price: '50' }
]);
t('分类行保留原位', r4.filter(r => r.isCategory).length === 2 && r4[0].isCategory && r4[2].isCategory);
t('合并不跨分类（普通吧唧与背卡分属分类不合并）', r4[1].name === '普通吧唧' && r4[3].name === '背卡');

// —— 用例 4：generatePriceListFromProducts 生成链路 ——
const productSettings = [
    { id: 1, name: '普通吧唧', category: '吧唧类', priceType: 'fixed', price: 50 },
    { id: 2, name: '异形吧唧', category: '吧唧类', priceType: 'fixed', price: 50 },
    { id: 3, name: '背卡', category: '纸片类', priceType: 'double', priceSingle: 50, priceDouble: 80 },
    { id: 4, name: '立牌', category: '亚克力类', priceType: 'config', basePrice: 50 },
    { id: 5, name: '头像', category: '绘制类', priceType: 'nodes', price: 140 },
    { id: 6, name: '手写', category: '绘制类', priceType: 'byChar', charPrice: 30, charUnit: '字' }
];
const _mcData = {
    priceList: { title: '价目表', note: '', items: [{ name: '旧行', price: '1' }], mergeSame: true, groupCategory: false, appearance: {} },
    businessCard: {}, orderInfo: {}
};
let toastMsg = '';
function makeSandboxGen(mcData, products) {
    return {
        _mcData: mcData,
        productSettings: products,
        mcCollectProductRows: run('mcCollectProductRows', {
            productSettings: products,
            mcProductPriceDisplay: run('mcProductPriceDisplay', {})
        }),
        mcMergeSamePriceRows: run('mcMergeSamePriceRows', { mcMergeRowsSegment: run('mcMergeRowsSegment', {}) }),
        mcProductSignature: run('mcProductSignature', { productSettings: products }),
        document: { getElementById: () => null },   // 不在表单上下文 → 沿用已存选项
        confirm: () => true,                        // 允许覆盖
        alert: () => {},
        saveMarketingCards: () => {},
        renderMarketingCardForm: () => {},
        renderMarketingCardPreview: () => {},
        showGlobalToast: (m) => { toastMsg = m; }
    };
}
run('generatePriceListFromProducts', makeSandboxGen(_mcData, productSettings))();
const items = _mcData.priceList.items;
t('生成 9 行（同价合并+按分类分组为默认行为）', items.length === 9);
t('分类标题行：吧唧类', items[0].isCategory && items[0].name === '吧唧类');
t('同价合并行：普通吧唧 / 异形吧唧 50', items[1].name === '普通吧唧 / 异形吧唧' && items[1].price === '50');
t('双面价行：背卡 单50 双80', items[2].isCategory && items[3].name === '背卡' && items[3].price === '单50 双80');
t('基础+递增行：立牌 50起', items[4].isCategory && items[5].name === '立牌' && items[5].price === '50起');
t('节点行：头像 140', items[6].isCategory && items[7].name === '头像' && items[7].price === '140');
t('按字数行：手写 30/字', items[8].name === '手写' && items[8].price === '30/字');
t('提示生成行数', toastMsg.includes('9'));

// —— 用例 5：按分类分组生成 ——
const _mcData2 = {
    priceList: { title: '价目表', note: '', items: [{ name: '', price: '' }], mergeSame: true, groupCategory: true, appearance: {} },
    businessCard: {}, orderInfo: {}
};
run('generatePriceListFromProducts', makeSandboxGen(_mcData2, productSettings))();
const items2 = _mcData2.priceList.items;
const cats = items2.filter(it => it.isCategory).map(it => it.name);
t('分类标题行按首现顺序生成（吧唧类/纸片类/亚克力类/绘制类）',
    JSON.stringify(cats) === JSON.stringify(['吧唧类', '纸片类', '亚克力类', '绘制类']));
const bizIdx = items2.findIndex(it => it.isCategory && it.name === '吧唧类');
t('分类内合并：吧唧类下为合并行', items2[bizIdx + 1].name === '普通吧唧 / 异形吧唧' && items2[bizIdx + 1].price === '50');
t('分类行无价格', items2.every(it => !it.isCategory || (it.price === '')));

// —— 用例 6：无制品时提示且不写入 ——
let alerted = false;
const _mcData3 = {
    priceList: { title: '价目表', note: '', items: [{ name: '', price: '' }], mergeSame: true, groupCategory: false, appearance: {} },
    businessCard: {}, orderInfo: {}
};
const sb6 = makeSandboxGen(_mcData3, []);
sb6.alert = () => { alerted = true; };
run('generatePriceListFromProducts', sb6)();
t('无制品时 alert 提示', alerted);
t('无制品时不改写条目', _mcData3.priceList.items.length === 1 && _mcData3.priceList.items[0].name === '');

// —— 用例 7：同分类交叉排列也归到一组（不拆散）——
const collectRows = run('mcCollectProductRows', {
    productSettings: [
        { id: 1, name: '封口贴', category: '包装类', priceType: 'fixed', price: 70 },
        { id: 2, name: '信纸', category: '纸片类', priceType: 'double', priceSingle: 80, priceDouble: 120 },
        { id: 3, name: '档案袋', category: '包装类', priceType: 'double', priceSingle: 80, priceDouble: 120 }
    ],
    mcProductPriceDisplay: run('mcProductPriceDisplay', {})
}, );
const grouped = collectRows(true, false);
t('交叉排列的同分类归组：包装类(封口贴+档案袋)→纸片类(信纸)',
    grouped.length === 5 && grouped[0].name === '包装类' && grouped[0].isCategory &&
    grouped[1].name === '封口贴' && grouped[2].name === '档案袋' &&
    grouped[3].name === '纸片类' && grouped[3].isCategory);

// —— 用例 8：分类行排序带动整个模块（块移动）——
const getRange = run('mcGetBlockRange', {});
const moveBlock = run('mcMoveBlock', { mcGetBlockRange: getRange, mcGetModuleRange: run('mcGetModuleRange', { mcGetBlockRange: getRange }) });

const arr1 = [
    { name: '吧唧类', price: '', isCategory: true },
    { name: '吧唧A', price: '50' },
    { name: '纸片类', price: '', isCategory: true },
    { name: '背卡', price: '50/80' },
    { name: '卡头', price: '50/80' },
    { name: '绘制类', price: '', isCategory: true },
    { name: '头像', price: '140' }
];
const r5 = getRange(arr1, 2);   // 纸片类（背卡+卡头 2 个下属）
t('块范围：分类行包含下属条目（2→5）', r5.start === 2 && r5.end === 5);
t('块范围：普通行即自身', getRange(arr1, 1).start === 1 && getRange(arr1, 1).end === 2);

moveBlock(arr1, 2, 5, true);    // 纸片类拖到「绘制类」下方 → 带动背卡/卡头整体到绘制类模块之后
t('分类拖动带动整个模块（吧唧类→绘制类→头像→纸片组）',
    arr1[0].name === '吧唧类' && arr1[1].name === '吧唧A' && arr1[2].name === '绘制类' &&
    arr1[3].name === '头像' && arr1[4].name === '纸片类' && arr1[5].name === '背卡' && arr1[6].name === '卡头');

const arr2 = [
    { name: '甲类', price: '', isCategory: true },
    { name: '甲1', price: '10' },
    { name: '乙类', price: '', isCategory: true },
    { name: '乙1', price: '20' }
];
moveBlock(arr2, 0, 2, true);    // 甲类下移到乙类下方
t('分类 ↑↓ 下移带动模块', arr2[0].name === '乙类' && arr2[1].name === '乙1' && arr2[2].name === '甲类' && arr2[3].name === '甲1');

const arr4 = [
    { name: '吧唧类', price: '', isCategory: true },
    { name: '吧唧A', price: '50' },
    { name: '纸片类', price: '', isCategory: true },
    { name: '背卡', price: '50/80' }
];
moveBlock(arr4, 2, 1, false);   // 纸片类上移越过 吧唧A → 应对齐模块边界，不插在吧唧类与吧唧A之间
t('分类上移对齐模块边界（不拆散上一模块）',
    arr4[0].name === '纸片类' && arr4[1].name === '背卡' && arr4[2].name === '吧唧类' && arr4[3].name === '吧唧A');

const arr3 = [
    { name: '普通行', price: '5' },
    { name: '类', price: '', isCategory: true },
    { name: '成员', price: '6' }
];
moveBlock(arr3, 0, 1, true);    // 普通行放到「类」下方 → 落到该模块末尾
t('普通行下移跨过分类落到模块后', arr3[0].name === '类' && arr3[1].name === '成员' && arr3[2].name === '普通行');

console.log('\n' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
