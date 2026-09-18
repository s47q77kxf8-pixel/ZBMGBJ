// 小票模板：按阶段自动套用解析逻辑回归测试
// 抽取 script.js 中的 resolveReceiptCustomizationForCurrentPhase，在隔离环境验证
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

// 花括号配平抽取函数源码
function extractFn(src, name) {
    const idx = src.indexOf('function ' + name + '(');
    if (idx < 0) throw new Error('未找到函数 ' + name);
    const start = src.indexOf('{', idx);
    let depth = 0, inStr = null, line = false, block = false;
    for (let i = start; i < src.length; i++) {
        const c = src[i], n = src[i + 1];
        if (line) { if (c === '\n') line = false; continue; }
        if (block) { if (c === '*' && n === '/') { block = false; i++; } continue; }
        if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
        if (c === '/' && n === '/') { line = true; i++; continue; }
        if (c === '/' && n === '*') { block = true; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (!depth) return src.slice(idx, i + 1); }
    }
    throw new Error('未能配平 ' + name);
}

const fnSrc = extractFn(code, 'resolveReceiptCustomizationForCurrentPhase');

// 构造隔离环境：注入 receiptTemplates / defaultSettings（active 用引用传入，保证身份可比）
function buildFn(templates, activeCust) {
    const arrLiteral = JSON.stringify(templates);
    const body = `
      let receiptTemplates = ${arrLiteral};
      let defaultSettings = { receiptCustomization: ACTIVE };
      ${fnSrc}
      return { fn: resolveReceiptCustomizationForCurrentPhase, active: defaultSettings.receiptCustomization };
    `;
    return new Function('ACTIVE', body)(activeCust);
}

let pass = 0, fail = 0;
function assert(name, cond) {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; console.log('  ✗ ' + name); }
}

const active = { titleText: 'LIST', footerText1: '温馨提示', footerText2: '感谢惠顾' };
const quoteTpl = { id: 1, name: '核对稿费', defaultFor: 'quote', customization: { titleText: '报价单', footerText1: '请确认稿费', footerText2: '期待合作' } };
const settleTpl = { id: 2, name: '结稿互动', defaultFor: 'settle', customization: { titleText: '结算单', footerText1: '结算完成', footerText2: '期待下次合作' } };

console.log('小票模板-阶段解析:');

// 1. 无默认模板：返回当前 active（同一引用）
let built = buildFn([], active);
let fn = built.fn, act = built.active;
let r1 = fn(false);
assert('无模板时返回 active（同引用）', r1 === act);
r1 = fn(true);
assert('无模板时（结单）也返回 active（同引用）', r1 === act);

// 2. 仅报价默认，未结单 → 返回报价模板（深拷贝，非同引用）
built = buildFn([quoteTpl], active);
fn = built.fn; act = built.active;
let rq = fn(false);
assert('报价默认+未结单 → 返回报价模板', rq && rq.titleText === '报价单' && rq.footerText2 === '期待合作');
assert('返回的是深拷贝（非同引用）', rq !== quoteTpl.customization);
assert('active 未被污染', act.titleText === 'LIST');

// 3. 仅报价默认，已结单 → 无结单默认，回退 active
let rs = fn(true);
assert('报价默认+已结单 → 回退 active', rs === act);

// 4. 仅结单默认，已结单 → 返回结单模板
built = buildFn([settleTpl], active);
fn = built.fn; act = built.active;
let rset = fn(true);
assert('结单默认+已结单 → 返回结单模板', rset && rset.titleText === '结算单' && rset.footerText2 === '期待下次合作');
assert('结单模板也是深拷贝', rset !== settleTpl.customization);

// 5. 仅结单默认，未结单 → 回退 active
assert('结单默认+未结单 → 回退 active', fn(false) === act);

// 6. 两个默认都在：分别正确路由
built = buildFn([quoteTpl, settleTpl], active);
fn = built.fn; act = built.active;
assert('双默认+未结单 → 报价模板', fn(false).titleText === '报价单');
assert('双默认+已结单 → 结单模板', fn(true).titleText === '结算单');

// 7. 深拷贝独立性：改返回值不影响已存模板
built = buildFn([quoteTpl], active);
fn = built.fn;
let clone = fn(false);
clone.titleText = '被篡改';
assert('改克隆不影响模板源', quoteTpl.customization.titleText === '报价单');

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
