// 回归测试：修复"历史订单企划备注莫名消失"
// 根因：closeOrderRemarkModal 编辑备注既不 bump mg_updated_at 也不上云，
//       叠加 smartMergeHistory 在 localTs<=cloudTs 时整条用云端覆盖本地 → 备注被冲掉。
// 本测试只验证 smartMergeHistory 的平手（相等时间戳）保留本地行为。
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'script.js');
const code = fs.readFileSync(SRC, 'utf8');

// 花括号配平抽取函数（与 test_role_profiles.js 同思路）
function extractBlock(src, name) {
    const idx = src.indexOf('function ' + name);
    if (idx < 0) throw new Error('未找到函数 ' + name);
    let i = src.indexOf('{', idx);
    let depth = 0;
    for (let j = i; j < src.length; j++) {
        const c = src[j];
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return src.slice(idx, j + 1); }
    }
    throw new Error('括号未闭合: ' + name);
}

const fnSrc = extractBlock(code, 'smartMergeHistory');
const smartMergeHistory = new Function(fnSrc + '\n; return smartMergeHistory;')();

let pass = 0, fail = 0;
function assert(name, cond) {
    if (cond) { pass++; console.log('  PASS ' + name); }
    else { fail++; console.log('  FAIL ' + name); }
}

// 场景1：平手（localTs == cloudTs），本地有备注，云端为空 → 必须保留本地
const local = [{ id: 'A', orderRemark: '本地备注', mg_updated_at: 100 }];
const cloud = [{ id: 'A', orderRemark: '', mg_updated_at: 100 }];
const r1 = smartMergeHistory(local, cloud);
assert('平手时保留本地备注', r1.length === 1 && r1[0].orderRemark === '本地备注');

// 场景2：本地更新 → 保留本地
const r2 = smartMergeHistory(
    [{ id: 'B', orderRemark: '新备注', mg_updated_at: 200 }],
    [{ id: 'B', orderRemark: '旧备注', mg_updated_at: 150 }]
);
assert('本地更新保留本地', r2[0].orderRemark === '新备注');

// 场景3：云端更新 → 用云端
const r3 = smartMergeHistory(
    [{ id: 'C', orderRemark: '旧备注', mg_updated_at: 150 }],
    [{ id: 'C', orderRemark: '云新备注', mg_updated_at: 200 }]
);
assert('云端更新用云端', r3[0].orderRemark === '云新备注');

// 场景4：仅本地存在 → 保留
assert('仅本地保留', smartMergeHistory([{ id: 'D', orderRemark: 'x', mg_updated_at: 1 }], []).length === 1);

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail === 0 ? 0 : 1);
