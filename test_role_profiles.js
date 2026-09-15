// 角色档案核心逻辑自测：从 script.js 提取纯函数，用桩环境验证
const fs = require('fs');
const src = fs.readFileSync('d:/Users/Desktop/Metton/script.js', 'utf8');

// 用花括号配平提取函数源码
function extractFunc(name) {
    const idx = src.indexOf('function ' + name + '(');
    if (idx < 0) { console.error('NOT FOUND: ' + name); return null; }
    let i = src.indexOf('{', idx);
    if (i < 0) return null;
    let depth = 0, j = i;
    for (; j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(idx, j + 1);
}

const FNS = [
    'findRoleProfileByName', 'upsertRoleProfile', 'removeRoleProfile', 'saveRoleProfiles',
    'getRoleMatchList', 'getUnarchivedRoleSummaries',
    'buildScheduleTodoRoleChipHtml', 'buildScheduleTodoCharacterHtml',
    'roleCardHtml', 'getRoleBaseInfo', 'getRoleQuotes', 'getRoleAliases',
    'isCjkName', 'isLatinName', 'parseSingleRoleName', 'parseHistoryRoleNames', 'parseHistoryIpPair',
    'tokenizeRoleRuns', 'expandRoleSegment',
    'canonicalRoleName', 'countRoleFilledFields', 'mergeRoleAliasText',
    'getRoleProfileCleanupPlan', 'applyRoleProfileCleanup',
    'roleHasContent', 'buildRoleCardViewHtml',
    'backfillRoleProfileFromQuote',
    'ignoreAllRolesFromHistory', 'restoreIgnoredRoles', 'renderRoleIgnoredBar',
    'openRoleArchiveModal', 'openRoleEditModal', 'setRoleEditValue', 'setRoleEditMode',
    'closeRoleEditModal', 'saveRoleEdit', 'collectRoleCustomFields',
    'mgMergeCloudItems', 'getConstellationFromBirthday',
    'getConstellationPair', 'formatConstellation'
];
let code = '';
FNS.forEach(f => { const s = extractFunc(f); if (!s) process.exit(1); code += s + '\n'; });

// 字段字典是 const 声明，用正则截取整段注入
function extractBlock(startMarker, endMarker) {
    const i = src.indexOf(startMarker);
    if (i < 0) { console.error('BLOCK NOT FOUND: ' + startMarker); process.exit(1); }
    const j = src.indexOf(endMarker, i);
    return src.slice(i, j + endMarker.length);
}
code += extractBlock('const ROLE_BASE_FIELDS = [', '];\n') + '\n';
code += extractBlock('const CONSTELLATION_ZH_EN = [', '];\n') + '\n';
code += extractBlock('var ROLE_MERGE_TEXT_FIELDS = [', '];\n') + '\n';
// 注意：不能按第一个 ';' 截断，map 回调体内也有分号，须取到行尾
(function () {
    const bk = src.indexOf('const ROLE_BASE_FIELD_KEYS =');
    const lineEnd = src.indexOf('\n', bk);
    code += src.slice(bk, lineEnd) + '\n';
})();

// 桩环境（与函数共享模块作用域，避免 eval 遮蔽）
let roleProfiles = [];
let history = [];
let roleIgnoredNames = [];
// 分组键桩：字母/数字按真实规则，其余一律 #（本套 getRoleMatchList 测试的 IP 均为字母，够用）
function getCustomerGroupKey(name) {
    var s = String(name || '').trim();
    if (!s) return '#';
    var ch = s.charAt(0);
    var code = ch.charCodeAt(0);
    if (code >= 0x41 && code <= 0x5A) return ch;
    if (code >= 0x61 && code <= 0x7A) return ch.toUpperCase();
    return '#';
}
function escapeHtml(str){ return String(str == null ? '' : str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

// 内存版 localStorage 桩，避免保存函数抛 ReferenceError 干扰测试结果
var __lsStore = {};
global.localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(__lsStore, k) ? __lsStore[k] : null; },
    setItem: function (k, v) { __lsStore[k] = String(v); },
    removeItem: function (k) { delete __lsStore[k]; }
};

// 云端推送调度桩：测试环境不加载完整云同步模块，saveRoleProfiles/saveCustomers 会调用它们，这里给空实现避免 ReferenceError
function mgScheduleCloudPushRoles(){}
function mgScheduleCloudPushCustomers(){}

eval(code);

let pass = 0, fail = 0;
function assert(name, cond) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } }

// 1. upsertRoleProfile 新建
roleProfiles = [];
const r1 = upsertRoleProfile({ name: '钟离', ip: '原神', description: '岩王帝君', note: '' });
assert('新建角色返回带 id', r1 && !!r1.id && r1.name === '钟离' && r1.ip === '原神');
assert('档案已加入列表', roleProfiles.length === 1);

// 2. 同名合并且不覆盖已填（upsert 是「仅填空值」语义，用户主动编辑走 saveRoleEdit）
upsertRoleProfile({ name: '钟离', ip: '原神2', description: '已有设定', note: '新备注' });
assert('同名不覆盖已有 description', roleProfiles[0].description === '岩王帝君');
assert('同名仅填空值 ip（已填则保留）', roleProfiles[0].ip === '原神');
assert('同名补空 note', roleProfiles[0].note === '新备注');
assert('档案数量不变', roleProfiles.length === 1);

// 3. 回写建档：仅填空值
roleProfiles = [];
upsertRoleProfile({ name: '胡桃', ip: '原神' });
backfillRoleProfileFromQuote({ characterName: '胡桃', projectOrigin: '原神2' });
assert('回写不覆盖已填 ip', roleProfiles[0].ip === '原神');
backfillRoleProfileFromQuote({ characterName: '宵宫', projectOrigin: '原神' });
assert('未建档角色自动建档', roleProfiles.length === 2 && roleProfiles[1].name === '宵宫' && roleProfiles[1].ip === '原神');
backfillRoleProfileFromQuote({ characterName: '  ' });
assert('空角色名不回写', roleProfiles.length === 2);

// 4. findRoleProfileByName 精确匹配
assert('按名查找', findRoleProfileByName('胡桃') && findRoleProfileByName('胡桃').name === '胡桃');
assert('大小写/空格容错', findRoleProfileByName(' 胡桃 ') !== null);

// 5. getRoleMatchList 过滤 + 排序（默认按 IP 分组首字母 A-Z，无 IP 沉底；同 IP 内按名称）
roleProfiles = [
    { name: 'Banana', ip: 'A' }, { name: 'apple', ip: 'B' }, { name: '苹果', ip: 'C' },
    { name: '无IP角色' }
];
let ml = getRoleMatchList('');
assert('空关键字返回全部', ml.length === 4);
assert('按 IP 排序且无 IP 沉底', ml[0].name === 'Banana' && ml[1].name === 'apple' && ml[2].name === '苹果' && ml[3].name === '无IP角色');
ml = getRoleMatchList('app');
assert('关键字过滤 name', ml.length === 1 && ml[0].name === 'apple');
ml = getRoleMatchList('C');
assert('关键字过滤 ip', ml.length === 1 && ml[0].name === '苹果');
assert('关键字大小写不敏感', getRoleMatchList('BANANA').length === 1);
assert('无匹配返回空', getRoleMatchList('zzz').length === 0);

// 同 IP 内按名称排序
roleProfiles = [{ name: '张三', ip: 'B' }, { name: '李四', ip: 'B' }, { name: '王五', ip: 'A' }];
ml = getRoleMatchList('');
assert('同 IP 内按名称排序', ml[0].name === '王五' && ml[1].name === '李四' && ml[2].name === '张三');

// 6. getUnarchivedRoleSummaries 从历史聚合
roleProfiles = [];
history = [
    { characterName: '钟离', projectOrigin: '原神', timestamp: '2026-09-01T00:00:00.000Z' },
    { characterName: '钟离', projectOrigin: '原神2', timestamp: '2026-09-05T00:00:00.000Z' },
    { characterName: ' 胡桃 ', projectOrigin: '原神', timestamp: '2026-09-03T00:00:00.000Z' },
    { characterName: '', projectOrigin: '原神' },
    { characterName: '甘雨', projectOrigin: '原神', timestamp: '2026-09-02T00:00:00.000Z' }
];
let us = getUnarchivedRoleSummaries();
assert('按角色聚合（剔除空名）', us.length === 3);
const zl = us.find(u => u.name === '钟离');
assert('取最近一笔 ip', zl && zl.ip === '原神2' && zl.count === 2);
assert('去重空白', us.find(u => u.name === '胡桃') !== undefined);

// 7. 已建档角色被剔除
roleProfiles = [{ name: '甘雨', ip: '原神' }];
us = getUnarchivedRoleSummaries();
assert('已建档角色剔除', us.length === 2 && !us.find(u => u.name === '甘雨'));

// 7b. 已忽略角色被剔除（不再提示建档）
roleIgnoredNames = ['钟离'];
us = getUnarchivedRoleSummaries();
assert('已忽略角色剔除', us.length === 1 && !us.find(u => u.name === '钟离'));
assert('忽略不影响已建档判定', us.find(u => u.name === '胡桃') !== undefined);
roleIgnoredNames = [];

// ===== 7b-2. 「全部忽略」与「恢复忽略」=====
// 这两个入口只依赖「汇总 / 忽略名单 / 渲染 / 轻提示」，用桩验证行为
let selectedRoleNames = new Set();
let savedIgnoredNames = [];
function saveRoleIgnored() { savedIgnoredNames = roleIgnoredNames.slice(); }
let confirmCalls = [], toastCalls = [], toastTypes = [], renderCalls = 0;
let confirmAnswer = true;
function confirm(msg) { confirmCalls.push(String(msg)); return confirmAnswer; }
function showToast(msg, type) { toastCalls.push(String(msg)); toastTypes.push(type || ''); }
function renderRoleSettings() { renderCalls++; }
// 弹窗相关状态（脚本里是模块级 var，提取函数时外部声明即可）
let roleEditingId = null, roleEditViewMode = 'edit', roleArchiveSourceName = null;
// DOM 桩：按 id 复用同一个假元素，足够跑「编辑弹窗 → 建档」这类表单流程
const els = {};
function makeEl(id) {
    return { id: id || '', value: '', innerHTML: '', textContent: '', className: '', disabled: false,
        style: {}, dataset: {},
        classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
        addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
        appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; },
        focus() {}, removeChild() {}, insertBefore() {} };
}
const document = {
    getElementById(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
    createElement(tag) { return makeEl(tag); },
    querySelector() { return null; },
    querySelectorAll() { return []; }
};

roleProfiles = [];
history = [
    { characterName: '钟离', projectOrigin: '原神', timestamp: '2026-09-01T00:00:00.000Z' },
    { characterName: '胡桃', projectOrigin: '原神', timestamp: '2026-09-03T00:00:00.000Z' }
];
roleIgnoredNames = [];
ignoreAllRolesFromHistory();
assert('全部忽略后待建档清空', getUnarchivedRoleSummaries().length === 0);
assert('全部忽略写入忽略名单', roleIgnoredNames.length === 2 && savedIgnoredNames.length === 2);
assert('全部忽略先确认且带条数', confirmCalls.length === 1 && confirmCalls[0].indexOf('2 个') > 0);
assert('全部忽略只回轻提示（不弹窗）', toastCalls.length === 1 && toastTypes[0] === 'ok' && toastCalls[0].indexOf('已忽略') === 0);
assert('全部忽略后重渲染', renderCalls === 1);

// 取消确认：不写入、不重渲染
confirmAnswer = false;
roleIgnoredNames = [];
savedIgnoredNames = [];
renderCalls = 0;
ignoreAllRolesFromHistory();
assert('取消确认不忽略', roleIgnoredNames.length === 0 && savedIgnoredNames.length === 0 && renderCalls === 0);

// 恢复忽略
confirmAnswer = true;
roleIgnoredNames = ['钟离', '胡桃'];
toastCalls = [];
restoreIgnoredRoles();
assert('恢复忽略清空名单', roleIgnoredNames.length === 0 && savedIgnoredNames.length === 0);
assert('恢复忽略后回到待建档列表', getUnarchivedRoleSummaries().length === 2);
assert('恢复忽略回轻提示', toastCalls.length === 1 && toastCalls[0].indexOf('已恢复') === 0);

// 恢复后提示条隐藏；有忽略记录时提示条带恢复入口
renderRoleIgnoredBar();
assert('无忽略记录时提示条为空', els['roleIgnoredBar'].innerHTML === '');
roleIgnoredNames = ['钟离'];
renderRoleIgnoredBar();
assert('有忽略记录时提示条显示条数', els['roleIgnoredBar'].innerHTML.indexOf('1 个') > 0);
assert('提示条带恢复入口', els['roleIgnoredBar'].innerHTML.indexOf('restoreIgnoredRoles()') > 0);
roleIgnoredNames = [];

// ===== 7c. 智能解析：拆分多角色 + 中外文配对 =====
let pr = parseHistoryRoleNames('钟离、胡桃');
assert('顿号拆两个角色', pr.length === 2 && pr[0].name === '钟离' && pr[1].name === '胡桃');
pr = parseHistoryRoleNames('克莱恩/Klein Moretti');
assert('斜杠中外文配对', pr.length === 1 && pr[0].name === '克莱恩' && pr[0].nameEn === 'Klein Moretti');
pr = parseHistoryRoleNames('奥黛丽Audrey Hall');
assert('紧邻中外文配对', pr.length === 1 && pr[0].name === '奥黛丽' && pr[0].nameEn === 'Audrey Hall');
pr = parseHistoryRoleNames('Fischl菲谢尔');
assert('外文在前也配对', pr.length === 1 && pr[0].name === '菲谢尔' && pr[0].nameEn === 'Fischl');
pr = parseHistoryRoleNames('钟离（Zhongli）');
assert('全角括号外文名配对', pr.length === 1 && pr[0].name === '钟离' && pr[0].nameEn === 'Zhongli');
pr = parseHistoryRoleNames('钟离/Zhongli、胡桃/Hu Tao');
assert('多角色各带外文名', pr.length === 2 && pr[0].nameEn === 'Zhongli' && pr[1].nameEn === 'Hu Tao');
pr = parseHistoryRoleNames('阿尔托莉雅·潘德拉贡');
assert('中圆点不误拆', pr.length === 1 && pr[0].name === '阿尔托莉雅·潘德拉贡');
pr = parseHistoryRoleNames('JJL职业战队AWG屠夫选手');
assert('混合长串不误拆', pr.length === 1 && pr[0].name === 'JJL职业战队AWG屠夫选手');
pr = parseHistoryRoleNames('国家战队全员');
assert('纯中文名单角色', pr.length === 1 && pr[0].name === '国家战队全员' && !pr[0].nameEn);
pr = parseHistoryRoleNames('钟离(岩王帝君)');
assert('括号内非外文不配对', pr.length === 1 && pr[0].name === '钟离(岩王帝君)' && !pr[0].nameEn);

// ===== 7c-2. 多人拼接无显式分隔符的拆分（真实历史数据样例）=====
pr = parseHistoryRoleNames('伦纳德·米切尔Leonard Mitchell克莱恩·莫雷蒂Klein Moretti');
assert('中英交替块拆 2 角色', pr.length === 2
    && pr[0].name === '伦纳德·米切尔' && pr[0].nameEn === 'Leonard Mitchell'
    && pr[1].name === '克莱恩·莫雷蒂' && pr[1].nameEn === 'Klein Moretti');
pr = parseHistoryRoleNames('真理医生（Dr.Ratio）x砂金（Aventurine）');
assert('x 连接 + 括号对拆 2 角色', pr.length === 2
    && pr[0].name === '真理医生' && pr[0].nameEn === 'Dr.Ratio'
    && pr[1].name === '砂金' && pr[1].nameEn === 'Aventurine');
pr = parseHistoryRoleNames('吴邪x张起灵');
assert('小写 x 连接拆 2 角色', pr.length === 2 && pr[0].name === '吴邪' && pr[1].name === '张起灵');
pr = parseHistoryRoleNames('西木子 池年 哪吒');
assert('空格分隔中文名拆 3 角色', pr.length === 3 && pr[2].name === '哪吒');
pr = parseHistoryRoleNames('威震天Megatron 擎天柱Optimus Prime');
assert('中英块 + 多词外文拆 2 角色', pr.length === 2
    && pr[0].name === '威震天' && pr[0].nameEn === 'Megatron'
    && pr[1].name === '擎天柱' && pr[1].nameEn === 'Optimus Prime');
pr = parseHistoryRoleNames('钟离×胡桃');
assert('乘号连接拆分', pr.length === 2);
pr = parseHistoryRoleNames('钟离xiao');
assert('拼音小写不误拆成多角色', pr.length === 1 && pr[0].name === '钟离');
pr = parseHistoryRoleNames('钟离VS胡桃');
assert('VS 连接拆分', pr.length === 2);

let pp = parseHistoryIpPair('诡秘之主/Lord of the Mysteries');
assert('IP 中外文配对', pp.ip === '诡秘之主' && pp.ipEn === 'Lord of the Mysteries');
pp = parseHistoryIpPair('Fate/Grand Order');
assert('纯外文 IP 不拆', pp.ip === 'Fate/Grand Order' && !pp.ipEn);
pp = parseHistoryIpPair('原神');
assert('纯中文 IP 原样', pp.ip === '原神' && !pp.ipEn);
pp = parseHistoryIpPair('原神/Genshin Impact');
assert('IP 斜杠配对', pp.ip === '原神' && pp.ipEn === 'Genshin Impact');

// 7d. 历史聚合：复合角色名拆分后按解析名聚合
history = [
    { characterName: '钟离、胡桃', projectOrigin: '原神/Genshin Impact', timestamp: '2026-09-01T00:00:00.000Z' },
    { characterName: '钟离/Zhongli', projectOrigin: '原神', timestamp: '2026-09-03T00:00:00.000Z' }
];
roleProfiles = [];
us = getUnarchivedRoleSummaries();
assert('复合名拆分聚合为 2 角色', us.length === 2);
const zl2 = us.find(u => u.name === '钟离');
assert('同名合并计数并带外文名', zl2 && zl2.count === 2 && zl2.nameEn === 'Zhongli');
const ht2 = us.find(u => u.name === '胡桃');
assert('拆分角色带中外文 IP', ht2 && ht2.ip === '原神' && ht2.ipEn === 'Genshin Impact');

// 7e. 回写建档：自动拆分配对
roleProfiles = [];
backfillRoleProfileFromQuote({ characterName: '克莱恩/Klein Moretti', projectOrigin: '诡秘之主/Lord of the Mysteries' });
assert('回写配对外文名/外文IP', roleProfiles.length === 1 && roleProfiles[0].name === '克莱恩'
    && roleProfiles[0].nameEn === 'Klein Moretti' && roleProfiles[0].ip === '诡秘之主' && roleProfiles[0].ipEn === 'Lord of the Mysteries');
backfillRoleProfileFromQuote({ characterName: '钟离、胡桃', projectOrigin: '原神' });
assert('回写多角色各自建档', roleProfiles.length === 3 && !!findRoleProfileByName('钟离') && !!findRoleProfileByName('胡桃'));

// 7f. 档案整理：复合名规范化 + 重复合并
assert('规范名取中文部分', canonicalRoleName('克莱恩/Klein Moretti') === '克莱恩');
assert('规范名单名原样', canonicalRoleName('钟离') === '钟离');

roleProfiles = [
    { id: 'a', name: '钟离', ip: '原神', note: '主C', aliases: '岩王帝君' },
    { id: 'b', name: '钟离/Zhongli', ip: '', ipEn: 'Genshin Impact', description: '岩王帝君', aliases: '摩拉克斯' }
];
let plan = getRoleProfileCleanupPlan();
assert('重复档案识别为 1 组', plan.length === 1 && plan[0].canonical === '钟离');
assert('重复项被列入 dups', plan[0].dups.length === 1 && plan[0].dups[0].id === 'b');
let applied = applyRoleProfileCleanup();
assert('合并后仅剩 1 条档案', roleProfiles.length === 1 && applied === 1);
assert('保留项补充外文IP', roleProfiles[0].ipEn === 'Genshin Impact');
assert('保留项补充设定', roleProfiles[0].description === '岩王帝君');
assert('已填字段不被覆盖', roleProfiles[0].ip === '原神' && roleProfiles[0].note === '主C');
assert('重复项别名并入保留项', String(roleProfiles[0].aliases || '').indexOf('摩拉克斯') >= 0
    && String(roleProfiles[0].aliases || '').indexOf('岩王帝君') >= 0);
assert('复合名不沉淀为噪音别名', String(roleProfiles[0].aliases || '').indexOf('Zhongli') < 0);

// 单个复合名档案：仅规范化，不合并
roleProfiles = [{ id: 'c', name: '奥黛丽Audrey Hall', ip: '诡秘之主' }];
plan = getRoleProfileCleanupPlan();
assert('复合名单条也需整理', plan.length === 1 && plan[0].rename && plan[0].dups.length === 0);
applyRoleProfileCleanup();
assert('规范化拆出中文名', roleProfiles.length === 1 && roleProfiles[0].name === '奥黛丽');
assert('规范化带出外文名', roleProfiles[0].nameEn === 'Audrey Hall');
assert('规范化保留 IP', roleProfiles[0].ip === '诡秘之主');

// 无重复无复合名时不生成方案
roleProfiles = [{ id: 'd', name: '胡桃', ip: '原神' }, { id: 'e', name: '甘雨', ip: '原神' }];
assert('干净档案无整理方案', getRoleProfileCleanupPlan().length === 0);
assert('干净档案执行无副作用', applyRoleProfileCleanup() === 0 && roleProfiles.length === 2);

// 8. 角色名渲染：已建档→高亮 chip，未建档→纯文本
roleProfiles = [{ name: '钟离', ip: '原神', description: '岩王帝君，尘世闲游的仙人', note: '' }];
let html = buildScheduleTodoCharacterHtml('钟离');
assert('已建档输出 chip', html.indexOf('schedule-todo-role-chip') > 0);
assert('chip 带角色名', html.indexOf('钟离') > 0);
assert('chip 可点击直接进编辑弹窗', html.indexOf('openRoleEditModal') > 0);
assert('chip 无只读查看入口', html.indexOf('openRoleViewModal') < 0);
assert('chip 不再带悬浮气泡', html.indexOf('data-role-tip=') < 0);
assert('chip 提示点击查看档案', html.indexOf('title="点击查看角色档案"') > 0);

html = buildScheduleTodoCharacterHtml('未建档角色');
assert('未建档保持纯文本', html === '未建档角色');
assert('未建档不输出 chip', html.indexOf('schedule-todo-role-chip') < 0);
assert('空角色名返回空', buildScheduleTodoCharacterHtml('') === '' && buildScheduleTodoCharacterHtml('  ') === '');

// 9. chip HTML 转义安全
roleProfiles = [{ id: 'id"1', name: '<img src=x>', ip: '', description: '"onmouseover="alert(1)', note: '' }];
html = buildScheduleTodoRoleChipHtml(findRoleProfileByName('<img src=x>'));
assert('角色名已转义', html.indexOf('<img src=x>') < 0 && html.indexOf('&lt;img') > 0);
assert('危险字符不出现在属性里', html.indexOf('"onmouseover="alert(1)') < 0);

// ===== 10. 中/外文名 + 中/外文IP + 基础资料 =====
const full = {
    id: 'r1', name: '钟离', nameEn: 'Zhongli', fullName: '摩拉克斯',
    aliases: '岩王帝君，尘世七执政', ip: '原神', ipEn: 'Genshin Impact',
    gender: '男', birthday: '12月31日', height: '182cm', weight: '65kg',
    customFields: { '武器': '长枪', '神之眼': '岩' },
    description: '岩王帝君，尘世闲游的仙人。', note: '注意服饰细节',
    quotes: ['天动万象。', '这是必须的礼节。']
};

// getRoleAliases
let al = getRoleAliases(full);
assert('别名按顿号/逗号拆分', al.length === 2 && al[0] === '岩王帝君' && al[1] === '尘世七执政');

// getRoleQuotes
let qs = getRoleQuotes(full);
assert('语录数组读取', qs.length === 2 && qs[0] === '天动万象。');
assert('语录字符串按行拆', getRoleQuotes({ quotes: '甲\n乙\n\n丙' }).length === 3);
assert('无语录返回空数组', getRoleQuotes({}).length === 0);

// getRoleBaseInfo：固定项在前，自定义项在后，空值剔除
let bi = getRoleBaseInfo(full);
assert('基础资料含固定项', bi.some(x => x.label === '身高' && x.value === '182cm'));
assert('基础资料含自定义项', bi.some(x => x.label === '武器' && x.value === '长枪'));
assert('基础资料不含声优项', !bi.some(x => x.label === '声优'));
assert('旧数据的声优不再渲染', !getRoleBaseInfo({ name: '钟离', cv: '前野智昭' }).some(x => x.label === '声优'));
assert('阵营/身份仍正常', getRoleBaseInfo({ name: '钟离', affiliation: '璃月', identity: '岩神' }).length === 2);
assert('空值字段被剔除', getRoleBaseInfo({ name: 'X', height: '  ' }).length === 0);

// 生日→星座推导
assert('生日→星座 中文', getConstellationFromBirthday('12月31日') === '摩羯座');
assert('生日→星座 含年', getConstellationFromBirthday('1998-12-31') === '摩羯座');
assert('生日→星座 1月1日', getConstellationFromBirthday('1月1日') === '摩羯座');
assert('生日→星座 3月15日', getConstellationFromBirthday('3月15日') === '双鱼座');
assert('生日→星座 7月23日', getConstellationFromBirthday('7月23日') === '狮子座');
assert('生日→星座 英文 Dec 31', getConstellationFromBirthday('Dec 31') === '摩羯座');
assert('生日→星座 英文 31 Dec', getConstellationFromBirthday('31 Dec') === '摩羯座');
assert('生日→星座 解析失败返回空', getConstellationFromBirthday('未知') === '');
assert('卡片按生日自动显示星座（中英对照）', getRoleBaseInfo({ name: 'X', birthday: '3月15日' }).some(function (x) { return x.key === 'constellation' && x.value === '双鱼座 Pisces'; }));
assert('已存星座优先于生日推导（中英对照）', getRoleBaseInfo({ name: 'X', birthday: '3月15日', constellation: '白羊座' }).some(function (x) { return x.value === '白羊座 Aries'; }));
assert('无生日且无星座时不出该项', getRoleBaseInfo({ name: 'X' }).every(function (x) { return x.key !== 'constellation'; }));
// 星座中英文对照
assert('纯中文补英文', formatConstellation('摩羯座') === '摩羯座 Capricorn');
assert('纯英文补中文', formatConstellation('capricorn') === '摩羯座 Capricorn');
assert('省略「座」也能识别', formatConstellation('双鱼') === '双鱼座 Pisces');
assert('已是双语保持幂等', formatConstellation('摩羯座 Capricorn') === '摩羯座 Capricorn');
assert('双语顺序不同时统一', formatConstellation('Capricorn 摩羯座') === '摩羯座 Capricorn');
var CONSTELLATION_ZH_LIST = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'];
var CONSTELLATION_EN_LIST = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
assert('十二星座中英互转全覆盖', CONSTELLATION_ZH_LIST.every(function (zh, i) {
    return formatConstellation(zh) === zh + ' ' + CONSTELLATION_EN_LIST[i]
        && formatConstellation(CONSTELLATION_EN_LIST[i]) === zh + ' ' + CONSTELLATION_EN_LIST[i];
}));
assert('非星座原样返回', formatConstellation('未知') === '未知');
assert('空值返回空', formatConstellation('') === '' && formatConstellation(null) === '');

// roleCardHtml（列表卡片：只显示名字/IP/别名三行，资料/设定/语录进编辑弹窗）
let card = roleCardHtml(full);
assert('列表卡含中文名', card.indexOf('钟离') > 0);
assert('列表卡含外文名', card.indexOf('Zhongli') > 0);
assert('列表卡含中文IP', card.indexOf('原神') > 0);
assert('列表卡含外文IP', card.indexOf('Genshin Impact') > 0);
assert('列表卡含别名', card.indexOf('岩王帝君') > 0);
assert('列表卡不含基础资料', card.indexOf('182cm') < 0 && card.indexOf('role-card-base-line') < 0);
assert('列表卡不含设定', card.indexOf('尘世闲游') < 0 && card.indexOf('role-card-desc') < 0);
assert('列表卡不含语录', card.indexOf('天动万象') < 0 && card.indexOf('role-card-quote-line') < 0);
assert('点名字直接进编辑弹窗', card.indexOf('openRoleEditModal') > 0);
assert('列表卡不再有只读查看入口', card.indexOf('openRoleViewModal') < 0);
// 无内容时不留空块
const bare = roleCardHtml({ id: 'z', name: 'Z' });
assert('裸档案无 IP 行', bare.indexOf('role-card-ip-line') < 0);
assert('裸档案无资料行', bare.indexOf('role-card-base-line') < 0);

// 卡片转义安全
const xssCard = roleCardHtml({ id: 'x', name: '<script>', ipEn: '"onload="x' });
assert('卡片名已转义', xssCard.indexOf('<script>') < 0 && xssCard.indexOf('&lt;script') > 0);
assert('外文IP已转义', xssCard.indexOf('"onload="x') < 0);

// ===== 12. 合并导入/upsert 通用补空值（新字段不丢）=====
roleProfiles = [{ id: 'm1', name: '胡桃', ip: '原神', height: '', customFields: { '武器': '长枪' } }];
upsertRoleProfile({ name: '胡桃', ip: '覆盖失败', height: '155cm', birthday: '7月13日', customFields: { '武器': '法杖', '神之眼': '火' } });
const hp = roleProfiles[0];
assert('upsert 不覆盖已填 ip', hp.ip === '原神');
assert('upsert 补空 height', hp.height === '155cm');
assert('upsert 补新字段 birthday', hp.birthday === '7月13日');
assert('upsert 自定义字段逐键补空不覆盖', hp.customFields['武器'] === '长枪' && hp.customFields['神之眼'] === '火');

// ===== 13. 角色卡片视图（Todo 点击弹出，同弹窗可切编辑）=====
const cardRec = {
    id: 'cv1', name: '钟离', nameEn: 'Zhongli', fullName: '摩拉克斯', aliases: '岩王帝君、契约之神',
    ip: '原神', ipEn: 'Genshin Impact', height: '182cm', birthday: '12月31日',
    customFields: { '武器': '长枪' }, description: '尘世闲游的仙人',
    quotes: '天动万象。\n这是必须的礼节。', note: '注意服饰细节'
};
let cv = buildRoleCardViewHtml(cardRec);
assert('卡片含中文名', cv.indexOf('钟离') > 0);
assert('卡片含外文名', cv.indexOf('Zhongli') > 0);
assert('卡片含全名', cv.indexOf('全名：摩拉克斯') > 0);
assert('卡片含别名', cv.indexOf('岩王帝君') > 0);
assert('卡片含中/外文 IP', cv.indexOf('原神') > 0 && cv.indexOf('Genshin Impact') > 0);
assert('卡片含基础资料', cv.indexOf('182cm') > 0 && cv.indexOf('role-card-view-grid') > 0);
assert('卡片含自定义资料', cv.indexOf('长枪') > 0);
assert('卡片含设定', cv.indexOf('尘世闲游') > 0);
assert('卡片含语录', cv.indexOf('天动万象') > 0);
assert('卡片不再渲染备注', cv.indexOf('注意服饰细节') < 0);
assert('有资料时不显示空态', cv.indexOf('role-card-view-empty') < 0);

const bareCard = buildRoleCardViewHtml({ id: 'x', name: '未补充角色' });
assert('空档案显示引导文案', bareCard.indexOf('role-card-view-empty') > 0);
assert('空档案无资料网格', bareCard.indexOf('role-card-view-grid') < 0);
assert('roleHasContent 判定', roleHasContent(cardRec) === true && roleHasContent({ name: 'X' }) === false);

const xssCv = buildRoleCardViewHtml({ name: '<script>', nameEn: '"onload="x', customFields: { 'X': '<img src=x>' }, quotes: ['<u>'] });
assert('卡片视图名已转义', xssCv.indexOf('<script>') < 0 && xssCv.indexOf('&lt;script') > 0);
assert('卡片视图外文名已转义', xssCv.indexOf('"onload="x') < 0);
assert('卡片视图自定义值已转义', xssCv.indexOf('<img src=x>') < 0);
assert('卡片视图语录已转义', xssCv.indexOf('<u>') < 0);

// ===== 9. 历史建档「编辑后建档」=====
// 直接调真实弹窗逻辑：打开时预填解析结果，保存即建档；改名建档需把旧名记为已处理
roleProfiles = [];
roleIgnoredNames = [];
history = [{ characterName: '克莱恩/Klein Moretti', projectOrigin: '诡秘之主/Lord of the Mysteries', timestamp: '2026-09-01T00:00:00.000Z' }];
const archiveList = getUnarchivedRoleSummaries();
assert('复合名历史解析为 1 个待建档角色', archiveList.length === 1 && archiveList[0].name === '克莱恩');

toastCalls = [];
openRoleArchiveModal(encodeURIComponent('克莱恩'));
assert('编辑弹窗预填角色名', els['roleEditName'].value === '克莱恩');
assert('编辑弹窗预填外文名', els['roleEditNameEn'].value === 'Klein Moretti');
assert('编辑弹窗预填原作', els['roleEditIp'].value === '诡秘之主');
assert('编辑弹窗预填外文原作', els['roleEditIpEn'].value === 'Lord of the Mysteries');
assert('弹窗标题提示编辑后建档', els['roleEditModalTitle'].textContent === '编辑后建档');
assert('保存按钮改为保存并建档', els['roleEditSaveBtn'].textContent === '保存并建档');
assert('记录原始历史角色名', roleArchiveSourceName === '克莱恩');

// 用户在弹窗里改名 + 补全资料后保存
els['roleEditName'].value = '克莱恩·莫雷蒂';
els['roleEditFullName'].value = '克莱恩·莫雷蒂';
els['roleEdit_height'].value = '180cm';
els['roleEditDescription'].value = '占卜家途径';
saveRoleEdit();
assert('保存后建档成功', roleProfiles.length === 1 && roleProfiles[0].name === '克莱恩·莫雷蒂');
assert('建档带上补充的资料', roleProfiles[0].height === '180cm' && roleProfiles[0].description === '占卜家途径');
assert('建档保留原作与外文名', roleProfiles[0].ip === '诡秘之主' && roleProfiles[0].nameEn === 'Klein Moretti');
assert('改名后旧历史名记为已处理', roleIgnoredNames.indexOf('克莱恩') >= 0);
assert('建档后待建档列表清空', getUnarchivedRoleSummaries().length === 0);
assert('建档走轻提示', toastCalls.length === 1 && toastTypes[0] === 'ok' && toastCalls[0].indexOf('创建角色档案') > 0);
assert('建档后清空原始名状态', roleArchiveSourceName === null);

// 不改名直接保存：无需记入忽略名单
roleProfiles = [];
roleIgnoredNames = [];
els['roleEditId'].value = '';
openRoleArchiveModal(encodeURIComponent('克莱恩'));
saveRoleEdit();
assert('不改名也能直接建档', roleProfiles.length === 1 && roleProfiles[0].name === '克莱恩');
assert('同名建档不产生忽略记录', roleIgnoredNames.length === 0);
assert('同名建档后待建档列表清空', getUnarchivedRoleSummaries().length === 0);

// 取消编辑：不建档、不忽略
roleProfiles = [];
roleIgnoredNames = [];
els['roleEditId'].value = '';
openRoleArchiveModal(encodeURIComponent('克莱恩'));
closeRoleEditModal();
assert('取消后不建档', roleProfiles.length === 0);
assert('取消后不忽略', roleIgnoredNames.length === 0);
assert('取消后待建档项还在', getUnarchivedRoleSummaries().length === 1);
assert('取消后清空原始名状态', roleArchiveSourceName === null);
assert('取消后恢复保存按钮文案', els['roleEditSaveBtn'].textContent === '保存');

// 普通「添加角色」不受历史建档状态影响
openRoleEditModal();
assert('普通添加不联动历史建档', roleArchiveSourceName === null);
assert('普通添加标题为添加角色', els['roleEditModalTitle'].textContent === '添加角色');

// ===== 10. 云端拉取合并逻辑（mgMergeCloudItems 纯函数） =====
// 本地：A(新)、B(旧)；云端：B(更新)、C(仅云端)、D(墓碑)
const localArr = [
    { id: 'A', name: 'A', updatedAt: '2026-09-10T00:00:00Z' },
    { id: 'B', name: 'B-local', updatedAt: '2026-09-01T00:00:00Z' }
];
const cloudRows = [
    { item_id: 'B', payload: { id: 'B', name: 'B-cloud', updatedAt: '2026-09-05T00:00:00Z' }, deleted_at: null, updated_at: '2026-09-05T00:00:00Z' },
    { item_id: 'C', payload: { id: 'C', name: 'C', updatedAt: '2026-09-08T00:00:00Z' }, deleted_at: null, updated_at: '2026-09-08T00:00:00Z' },
    { item_id: 'D', payload: null, deleted_at: '2026-09-09T00:00:00Z', updated_at: '2026-09-09T00:00:00Z' }
];
const merged = mgMergeCloudItems(localArr, cloudRows);
assert('合并后本地独有项保留', merged.some(x => x.id === 'A'));
assert('云端更新的项覆盖本地（B）', (merged.find(x => x.id === 'B') || {}).name === 'B-cloud');
assert('云端独有项被加入（C）', merged.some(x => x.id === 'C'));
assert('墓碑项不进入结果（D）', !merged.some(x => x.id === 'D'));
assert('合并总数正确', merged.length === 3);

// 本地更新更晚时不该被云端旧数据覆盖
const localNew = [{ id: 'X', name: 'X-new', updatedAt: '2026-09-20T00:00:00Z' }];
const cloudOld = [{ item_id: 'X', payload: { id: 'X', name: 'X-old', updatedAt: '2026-09-01T00:00:00Z' }, deleted_at: null, updated_at: '2026-09-01T00:00:00Z' }];
const merged2 = mgMergeCloudItems(localNew, cloudOld);
assert('本地更新更晚时保留本地', (merged2.find(x => x.id === 'X') || {}).name === 'X-new');

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
