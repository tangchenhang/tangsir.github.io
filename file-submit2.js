// ========== 配置区（保持你原来的 LeanCloud 配置） ==========
AV.init({
    appId: "awjrq2pnF6yDBX2QT7Sq1dHQ-gzGzoHsz",
    appKey: "WY6uq9q4hPthkwKX5JIHrlYk",
    serverURL: "https://awjrq2pn.lc-cn-n1-shared.com"
});

const ROOM_ID = "file_submit_system_room_001";
const DEFAULT_OWNER_PASSWORD = "953191";
const Submitter = AV.Object.extend('NewSubmitter');
const SystemStatus = AV.Object.extend('NewSystemStatus');

// ========== 帮助：显示/切换页面 ==========
function showElement(id) {
    ['role-selection','house-owner-login','house-owner-dashboard','visitor-verify','visitor-submit']
        .forEach(i => document.getElementById(i) && (document.getElementById(i).style.display = 'none'));
    const el = document.getElementById(id);
    if (el) el.style.display = '';
    if (id === 'house-owner-dashboard') updateHouseOwnerDashboard();
    if (id === 'visitor-verify') checkVisitorSystemStatus();
}
function enterHouseOwnerMode(){ showElement('house-owner-login'); }
function enterVisitorMode(){ showElement('visitor-verify'); }
function backToRoleSelection(){ showElement('role-selection'); }
function backToVisitorVerify(){ showElement('visitor-verify'); }

// ========== 系统状态（只拉小字段） ==========
async function getSystemStatusObj() {
    const q = new AV.Query('SystemStatus');
    q.equalTo('roomId', ROOM_ID);
    const obj = await q.first();
    if (!obj) {
        const s = new SystemStatus();
        s.set('roomId', ROOM_ID);
        s.set('status', 'not_started');
        await s.save();
        return s;
    }
    return obj;
}
async function getSystemStatus() {
    const obj = await getSystemStatusObj();
    return obj.get('status');
}
async function updateSystemStatusDisplay() {
    const status = await getSystemStatus();
    const map = {
        not_started: ['未开始','background:#f3f4f6;color:#374151'],
        running: ['运行中','background:#10B981;color:#ffffff'],
        paused: ['已暂停','background:#F59E0B;color:#ffffff'],
        ended: ['已结束','background:#EF4444;color:#ffffff']
    };
    const badge = document.getElementById('system-status-badge');
    if (badge) {
        badge.textContent = map[status][0];
        badge.style.cssText = map[status][1] + ';padding:6px 10px;border-radius:999px;font-weight:700';
    }
    // 控制按钮
    ['btn-start-system','btn-pause-system','btn-resume-system','btn-end-system'].forEach(id=>{
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    if (status === 'not_started') document.getElementById('btn-start-system').style.display = '';
    if (status === 'running') {
        document.getElementById('btn-pause-system').style.display = '';
        document.getElementById('btn-end-system').style.display = '';
    }
    if (status === 'paused') {
        document.getElementById('btn-resume-system').style.display = '';
        document.getElementById('btn-end-system').style.display = '';
    }

    // 同步访客侧 badge（如果存在）
    const vBadge = document.getElementById('visitor-name-display');
    // don't overwrite visitor name; instead we don't need extra visitor badge here
}
async function updateSystemStatus(newStatus) {
    const q = new AV.Query('SystemStatus');
    q.equalTo('roomId', ROOM_ID);
    let obj = await q.first();
    if (!obj) { obj = new SystemStatus(); obj.set('roomId', ROOM_ID); }
    obj.set('status', newStatus);
    await obj.save();
    await updateSystemStatusDisplay();
}
function startSystem(){ if (confirm('确定开始？')) updateSystemStatus('running'); }
function pauseSystem(){ if (confirm('确定暂停？')) updateSystemStatus('paused'); }
function resumeSystem(){ if (confirm('确定恢复？')) updateSystemStatus('running'); }
function endSystem(){ if (confirm('确定结束？结束不可恢复')) updateSystemStatus('ended'); }
async function checkVisitorSystemStatus(){
    const status = await getSystemStatus();
    if (status !== 'running') {
        alert('系统当前未开放提交');
    }
}

// ========== 房主登录 ==========
function verifyHouseOwnerPassword(){
    const pwd = document.getElementById('owner-password').value;
    if (pwd === DEFAULT_OWNER_PASSWORD) showElement('house-owner-dashboard');
    else document.getElementById('password-error').style.display = '';
}

// ========== 名单管理（优化：查询时不拉 files 字段） ==========
async function addSubmitter(){
    const name = document.getElementById('add-name').value.trim();
    if (!name) return;
    // check exists
    const q = new AV.Query('Submitter');
    q.equalTo('roomId', ROOM_ID);
    q.equalTo('name', name);
    const ex = await q.first();
    if (ex) return alert('该姓名已存在');
    const s = new Submitter();
    s.set('roomId', ROOM_ID);
    s.set('name', name);
    s.set('submitted', false);
    s.set('files', []);
    s.set('maxCount', 1);
    await s.save();
    document.getElementById('add-name').value = '';
    updateHouseOwnerDashboard();
}

async function importSubmitterList(){
    const input = document.getElementById('import-list');
    const file = input.files[0];
    if (!file) return;
    const fname = file.name.toLowerCase();
    const reader = new FileReader();
    reader.onload = async (e) => {
        let names = [];
        if (fname.endsWith('.txt')) {
            names = e.target.result.split('\n').map(r=>r.trim()).filter(r=>r);
        } else if (fname.endsWith('.csv')) {
            names = e.target.result.split('\n').map(line=>line.split(',')[0].trim()).filter(r=>r);
        } else if (fname.endsWith('.xlsx')||fname.endsWith('.xls')) {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, {type:'array'});
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet, {header:1});
            names = json.map(r=> (r[0]||'').toString().trim()).filter(r=>r);
        }
        if (!names.length) { alert('未识别到有效姓名'); input.value=''; return; }
        // check duplicates and create
        const q = new AV.Query('Submitter');
        q.equalTo('roomId', ROOM_ID);
        q.containedIn('name', names);
        const exists = await q.find();
        const existNames = exists.map(i=>i.get('name'));
        const newNames = names.filter(n=> !existNames.includes(n));
        const arr = newNames.map(n=>{
            const s = new Submitter();
            s.set('roomId', ROOM_ID);
            s.set('name', n);
            s.set('submitted', false);
            s.set('files', []);
            s.set('maxCount', 1);
            return s;
        });
        if (arr.length) await AV.Object.saveAll(arr);
        alert(`导入完成：新增 ${arr.length} 条`);
        input.value='';
        updateHouseOwnerDashboard();
    };
    if (fname.endsWith('.xlsx')||fname.endsWith('.xls')) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
}

async function deleteSubmitter(id){
    if (!confirm('确定删除？')) return;
    const obj = AV.Object.createWithoutData('Submitter', id);
    await obj.destroy({ useMasterKey: true });
    updateHouseOwnerDashboard();
}

// ========== 设置上传限制（会逐条更新现有记录的 maxCount 字段） ==========
async function updateUploadLimit(){
    const limit = Number(document.getElementById('max-upload-count').value) || 1;
    if (limit < 1) { alert('数量不能小于1'); return; }
    // fetch all submitters (only ids and name) -  but we'll update each object to set maxCount
    const q = new AV.Query('Submitter');
    q.equalTo('roomId', ROOM_ID);
    q.limit(1000);
    const list = await q.find();
    for (const item of list) {
        item.set('maxCount', limit);
        await item.save();
    }
    alert('上传限制已更新（已应用到现有用户）');
}

// ========== 更新房主仪表盘（关键优化：不拉 files 字段） ==========
async function updateHouseOwnerDashboard(){
    try {
        // 只请求小字段，避免拉出 files（base64）造成卡顿
        const q = new AV.Query('Submitter');
        q.equalTo('roomId', ROOM_ID);
        q.select('name','submitted','submitTime','maxCount'); // 关键：限定字段
        q.limit(500); // 上限，避免一次性请求过多
        const list = await q.find();

        // 统计
        const total = list.length;
        const submitted = list.filter(i=>i.get('submitted')).length;
        const unsubmitted = total - submitted;
        document.getElementById('total-count').textContent = total;
        document.getElementById('submitted-count').textContent = submitted;
        document.getElementById('unsubmitted-count').textContent = unsubmitted;

        // 名单渲染（轻量，仅渲染必要信息）
        const container = document.getElementById('submitter-list-container');
        container.innerHTML = '';
        if (!list.length) {
            container.innerHTML = `<div style="padding:16px;color:#6b7280">暂无名单</div>`;
        } else {
            for (const item of list) {
                const id = item.id;
                const name = item.get('name');
                const submittedFlag = item.get('submitted');
                const statusText = submittedFlag ? '已提交' : '未提交';
                const statusClass = submittedFlag ? 'text-success' : 'text-warning';
                // row
                const row = document.createElement('div');
                row.className = 'grid-cols-12';
                row.style.padding = '10px';
                row.style.display = 'grid';
                row.style.gridTemplateColumns = 'repeat(12,1fr)';
                row.style.borderBottom = '1px solid #f1f5f9';
                row.innerHTML = `
                    <div style="grid-column:span 6">${escapeHtml(name)}</div>
                    <div style="grid-column:span 3;color:${submittedFlag ? '#10B981' : '#F59E0B'}">${statusText}</div>
                    <div style="grid-column:span 3;text-align:center">
                        <button class="btn" onclick="deleteSubmitter('${id}')">删除</button>
                    </div>
                `;
                container.appendChild(row);
            }
        }

        // 提交记录 — 只显示已提交人员（但不拉 files）
        const rec = document.getElementById('submission-records-container');
        rec.innerHTML = '';
        const submittedList = list.filter(i=>i.get('submitted'));
        if (!submittedList.length) {
            rec.innerHTML = `<div style="padding:12px;color:#6b7280">暂无提交记录</div>`;
        } else {
            for (const item of submittedList) {
                const id = item.id;
                const name = item.get('name');
                const time = item.get('submitTime') || '';
                // 文件数量未知（因为没拉 files），显示“已提交（点击查看）”
                const row = document.createElement('div');
                row.style.display = 'grid';
                row.style.gridTemplateColumns = 'repeat(12,1fr)';
                row.style.padding = '10px';
                row.style.borderBottom = '1px solid #f1f5f9';
                row.innerHTML = `
                    <div style="grid-column:span 4">${escapeHtml(name)}</div>
                    <div style="grid-column:span 5">已提交（点击查看）</div>
                    <div style="grid-column:span 3;font-size:12px;color:#6b7280">${escapeHtml(time)}</div>
                    <div style="grid-column:span 12;text-align:right;margin-top:8px">
                        <button class="btn btn-primary" onclick="viewSubmitterFiles('${id}')">查看 / 导出</button>
                    </div>
                `;
                rec.appendChild(row);
            }
        }

    } catch (err) {
        console.error('更新仪表盘失败：', err);
        alert('更新仪表盘失败，请检查控制台错误信息');
    }
}

// ========== 访客验证 & 提交（保持现有功能） ==========
async function verifyVisitorName(){
    const name = document.getElementById('visitor-name').value.trim();
    if (!name) return;
    const q = new AV.Query('Submitter');
    q.equalTo('roomId', ROOM_ID);
    q.equalTo('name', name);
    // 仅拉小字段
    q.select('name','submitted','maxCount');
    const obj = await q.first();
    if (!obj) {
        document.getElementById('name-error').style.display = '';
        return;
    }
    document.getElementById('name-error').style.display = 'none';
    // 存缓存
    localStorage.setItem('currentVisitor', JSON.stringify({ name, objectId: obj.id }));
    localStorage.setItem('maxCount', obj.get('maxCount') || 1);
    document.getElementById('visitor-name-display').textContent = name;
    showElement('visitor-submit');
}

function handleFileSelect(){
    const input = document.getElementById('file-upload');
    const files = Array.from(input.files || []);
    const maxCount = Number(localStorage.getItem('maxCount')) || 1;
    if (files.length === 0) return;
    if (files.length > maxCount) {
        alert(`最多只能上传 ${maxCount} 个文件`);
        input.value = '';
        return;
    }
    const preview = document.getElementById('preview-list');
    preview.innerHTML = '';
    for (const f of files) {
        const item = document.createElement('div');
        item.style.padding = '8px';
        item.style.border = '1px solid #eef2ff';
        item.style.borderRadius = '8px';
        item.innerHTML = `<div style="font-weight:600">${escapeHtml(f.name)}</div><div style="color:#6b7280;font-size:13px">${(f.size/1024).toFixed(1)} KB</div>`;
        preview.appendChild(item);
    }
    document.getElementById('file-preview').style.display = '';
    document.getElementById('submit-file-btn').disabled = false;
}

async function submitFile(){
    const input = document.getElementById('file-upload');
    const files = Array.from(input.files || []);
    if (!files.length) { alert('请选择文件'); return; }
    const visitor = JSON.parse(localStorage.getItem('currentVisitor') || '{}');
    if (!visitor || !visitor.objectId) { alert('访客未识别'); backToVisitorVerify(); return; }

    // 读取 base64 并保存到 submitter.files（和你原 DB 保持一致）
    const uploaded = [];
    for (const file of files) {
        const base64 = await new Promise(res=>{
            const r = new FileReader();
            r.onload = e => res(e.target.result);
            r.readAsDataURL(file);
        });
        uploaded.push({ url: base64, name: file.name, type: file.type, size: file.size });
    }

    const obj = AV.Object.createWithoutData('Submitter', visitor.objectId);
    obj.set('submitted', true);
    obj.set('files', uploaded);
    obj.set('submitTime', new Date().toLocaleString());
    await obj.save();
    alert('提交成功');
    backToVisitorVerify();
}

// ========== 单人查看（按需拉 files） ==========
async function viewSubmitterFiles(id){
    try {
        // 展示加载状态
        const modal = document.getElementById('file-viewer-modal');
        const content = document.getElementById('file-viewer-content');
        const progress = document.getElementById('file-viewer-progress');
        content.innerHTML = '';
        progress.innerHTML = '<div class="spinner"></div><div style="color:#6b7280">正在加载...</div>';
        modal.style.display = '';

        // 只在此处 fetch 完整对象（包含 files）
        const q = new AV.Query('Submitter');
        const obj = await q.get(id);

        progress.innerHTML = '';
        const files = obj.get('files') || [];
        if (!files.length) {
            content.innerHTML = '<div style="color:#6b7280">该用户未提交任何文件</div>';
        } else {
            for (const f of files) {
                const box = document.createElement('div');
                box.style.border = '1px solid #eef2ff';
                box.style.padding = '8px';
                box.style.borderRadius = '8px';
                let inner = `<div style="font-weight:700">${escapeHtml(f.name)}</div>`;
                inner += `<div style="color:#6b7280;font-size:13px">${(f.size/1024).toFixed(1)} KB</div>`;
                if ((f.type||'').startsWith('image/')) {
                    inner += `<div style="margin-top:6px"><img src="${f.url}" style="max-width:100%;max-height:220px;border-radius:6px" alt="${escapeHtml(f.name)}" /></div>`;
                } else {
                    inner += `<div style="margin-top:6px;color:#6b7280">非图片类型，无法预览</div>`;
                }
                box.innerHTML = inner;
                content.appendChild(box);
            }
        }

        // 绑定导出事件（保存当前对象）
        document.getElementById('export-single-btn').onclick = () => exportSingleUserFiles(obj);

    } catch (err) {
        console.error('查看单人失败', err);
        alert('加载该用户提交内容失败，请稍后重试');
        closeFileViewer();
    }
}

function closeFileViewer(){
    document.getElementById('file-viewer-modal').style.display = 'none';
}

// ========== 导出单人所有文件（顺序处理） ==========
async function exportSingleUserFiles(userObj) {
    const files = userObj.get('files') || [];
    if (!files.length) return alert('无可导出文件');

    // 使用 JSZip 顺序打包（避免并发导致内存占用暴涨）
    try {
        const zip = new JSZip();
        let idx = 0;
        for (const f of files) {
            idx++;
            // small UI hint
            document.getElementById('file-viewer-progress').innerText = `正在处理 ${idx}/${files.length} ...`;
            const blob = dataURLToBlob(f.url);
            zip.file(f.name, blob);
            await sleep(50); // 稍微让出一点主线程，避免页面无响应（小延迟）
        }
        const dateStr = new Date().toLocaleDateString().replace(/\//g,'-');
        const filename = `${userObj.get('name')}_${dateStr}.zip`;
        const content = await zip.generateAsync({type:'blob',compression:'DEFLATE'});
        saveAs(content, filename);
        document.getElementById('file-viewer-progress').innerText = '导出完成';
    } catch (err) {
        console.error('导出单人文件失败', err);
        alert('导出失败，请检查控制台');
    }
}

// ========== 导出全部已提交（按需顺序拉取每个对象的 files） ==========
async function exportAllSubmittedFiles(){
    if (!confirm('导出全部已提交的文件可能需要一些时间，确定继续？')) return;

    // show progress in a modal-like alert area
    const progressEl = document.createElement('div');
    progressEl.style.position='fixed';
    progressEl.style.right='16px';
    progressEl.style.bottom='16px';
    progressEl.style.background='white';
    progressEl.style.padding='10px';
    progressEl.style.border='1px solid #eef2ff';
    progressEl.style.borderRadius='10px';
    progressEl.style.boxShadow='0 6px 20px rgba(8,15,25,0.06)';
    progressEl.innerHTML = `<div style="font-weight:700;margin-bottom:6px">导出进度</div><div id="export-all-status">初始化...</div>`;
    document.body.appendChild(progressEl);

    try {
        // 先查询所有已提交者的 id（不拉 files）
        const q = new AV.Query('Submitter');
        q.equalTo('roomId', ROOM_ID);
        q.equalTo('submitted', true);
        q.select(); // 保证不拉大量字段
        q.limit(1000);
        const list = await q.find();
        if (!list.length) { alert('暂无提交文件'); document.body.removeChild(progressEl); return; }

        const zip = new JSZip();
        let countUsers = list.length;
        let processedUsers = 0;
        for (const userMeta of list) {
            processedUsers++;
            document.getElementById('export-all-status').innerText = `正在处理 ${processedUsers}/${countUsers} (${escapeHtml(userMeta.id)})`;
            // 单独拉取该用户完整对象（包含 files）
            const q2 = new AV.Query('Submitter');
            const userObj = await q2.get(userMeta.id);
            const files = userObj.get('files') || [];
            for (const f of files) {
                // add to zip (f.url is base64)
                try {
                    const blob = dataURLToBlob(f.url);
                    // prefix with username to avoid name collision
                    zip.file(`${userObj.get('name')}_${f.name}`, blob);
                } catch (err) {
                    console.warn('跳过处理失败的文件', f.name, err);
                }
            }
            await sleep(40); // 小间隔，避免锁住 UI
        }
        document.getElementById('export-all-status').innerText = '打包中...';
        const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE'});
        const dateStr = new Date().toLocaleDateString().replace(/\//g,'-');
        saveAs(blob, `全部提交_${dateStr}.zip`);
        document.getElementById('export-all-status').innerText = '导出完成';
        setTimeout(()=>document.body.removeChild(progressEl), 2000);
    } catch (err) {
        console.error('导出全部失败', err);
        alert('导出失败，请查看控制台');
        if (document.body.contains(progressEl)) document.body.removeChild(progressEl);
    }
}

// ========== utils ==========
function dataURLToBlob(dataURL) {
    // same as before — synchronous conversion (base64 -> Blob)
    const arr = dataURL.split(',');
    const mime = (arr[0].match(/:(.*?);/) || [])[1] || '';
    const bstr = atob(arr[1] || '');
    let n = bstr.length;
    const u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new Blob([u8], {type: mime});
}

function escapeHtml(s) {
    if (!s && s!==0) return '';
    return String(s).replace(/[&<>"']/g, function(m){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
}
function sleep(ms){ return new Promise(res=>setTimeout(res,ms)); }

// ========== 页面初始化 ==========
window.addEventListener('load', async ()=>{
    await updateSystemStatusDisplay();
});
