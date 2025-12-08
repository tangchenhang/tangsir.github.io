// 等待 DOM 加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
  /************** 初始化 LeanCloud **************/
  AV.init({
    appId: "awjrq2pnF6yDBX2QT7Sq1dHQ-gzGzoHsz",
    appKey: "WY6uq9q4hPthkwKX5JIHrlYk",
    serverURL: "https://awjrq2pn.lc-cn-n1-shared.com"
  });

  const ROOM_ID = "global-room";
  const NameList = AV.Object.extend("NameList");
  const DrawResult = AV.Object.extend("DrawResult"); // 抽签结果类

  let isOwner = false;
  let mySubmittedName = JSON.parse(localStorage.getItem('mySubmittedName')) || null; // 存储当前用户提交的名字信息

  // DOM 元素
  const namesListContainer = document.getElementById("namesListContainer");
  const addMyNameBtn = document.getElementById("addMyNameBtn");
  const clearNamesBtn = document.getElementById("clearNamesBtn");
  const drawBtn = document.getElementById("drawBtn");
  const countInput = document.getElementById("count");
  const slots = document.getElementById("slots");
  const winnersDiv = document.getElementById("winners");
  const logBox = document.getElementById("log");
  const identityBadge = document.getElementById("identityBadge");
  const identityText = document.getElementById("identityText");
  const nameCount = document.getElementById("nameCount");
  const 公示Container = document.getElementById("公示Container"); // 公示容器

  // 日志函数
  function log(t) {
    const s = new Date().toLocaleTimeString() + "  " + t + "\n";
    logBox.textContent = s + logBox.textContent;
  }

  /************** 房主验证 **************/
  (function() {
    const pw = prompt("请输入房主口令（访客点取消即可使用）");
    if (pw === "666888") {
      isOwner = true;
      drawBtn.disabled = false;
      clearNamesBtn.disabled = false;
      // 更新身份展示
      identityBadge.className = "mt-3 inline-flex items-center px-3 py-1 rounded-full text-sm bg-secondary/10 text-secondary";
      identityText.textContent = "当前身份：房主（拥有全部权限）";
      log("✅ 你已进入房主模式，拥有抽签/清空/编辑所有人名字的权限");
    } else {
      isOwner = false;
      // 更新身份展示
      identityBadge.className = "mt-3 inline-flex items-center px-3 py-1 rounded-full text-sm bg-dark-700 text-muted";
      identityText.textContent = "当前身份：访客（仅可添加/修改/删除自己的名字）";
      log("👥 访客模式：可以添加/修改/删除自己的名字，不能操作他人信息");
    }
  })();

  /************** 渲染名单列表 **************/
  function renderNameList(records) {
    namesListContainer.innerHTML = "";
    
    if (records.length === 0) {
      namesListContainer.innerHTML = '<div class="flex items-center justify-center text-muted py-8">名单为空，点击「提交我的名字」添加</div>';
      nameCount.textContent = "0 人";
      return;
    }

    // 生成每个名字项
    records.forEach(record => {
      const name = record.get("name");
      const objectId = record.id;
      const isMyName = mySubmittedName && mySubmittedName.objectId === objectId; // 是否是当前用户提交的名字

      // 创建名字项容器
      const nameItem = document.createElement("div");
      nameItem.className = "flex items-center justify-between py-2 px-3 border-b border-dark-700 last:border-0 hover:bg-dark-700/50 rounded-md transition-colors";
      nameItem.dataset.objectId = objectId;

      // 名字文本
      const nameText = document.createElement("span");
      nameText.className = "text-white";
      nameText.textContent = name;
      if (isMyName) {
        nameText.className += " text-primary font-medium"; // 高亮自己的名字
      }

      // 操作按钮容器
      const btnContainer = document.createElement("div");
      btnContainer.className = "flex gap-2";

      // 编辑按钮
      const editBtn = document.createElement("button");
      editBtn.className = "px-2 py-1 bg-dark-700 text-sm rounded hover:bg-dark-700/90 transition-colors";
      editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"></path><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"></polygon></svg>';
      editBtn.title = "编辑名字";
      editBtn.disabled = !isOwner && !isMyName; // 普通用户只能编辑自己的
      if (editBtn.disabled) {
        editBtn.className += " opacity-50 cursor-not-allowed";
      }
      editBtn.addEventListener("click", () => editName(record));

      // 删除按钮
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "px-2 py-1 bg-danger/20 text-danger text-sm rounded hover:bg-danger/30 transition-colors";
      deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      deleteBtn.title = "删除名字";
      deleteBtn.disabled = !isOwner && !isMyName; // 普通用户只能删除自己的
      if (deleteBtn.disabled) {
        deleteBtn.className += " opacity-50 cursor-not-allowed";
      }
      deleteBtn.addEventListener("click", () => deleteName(record));

      // 组装元素
      btnContainer.appendChild(editBtn);
      btnContainer.appendChild(deleteBtn);
      nameItem.appendChild(nameText);
      nameItem.appendChild(btnContainer);
      namesListContainer.appendChild(nameItem);
    });

    // 更新人数计数
    nameCount.textContent = `${records.length} 人`;
  }

  /************** 加载名单 **************/
  async function loadNames() {
    const query = new AV.Query("NameList");
    query.equalTo("room", ROOM_ID);
    query.ascending("createdAt");
    const records = await query.find();
    
    renderNameList(records);
    log(`📋 名单已同步，共 ${records.length} 个名字`);
  }
  loadNames();

  /************** 渲染抽签结果公示 **************/
  function renderDrawResults(records) {
    公示Container.innerHTML = "";
    
    if (records.length === 0) {
      公示Container.innerHTML = '<div class="flex items-center justify-center text-muted py-4">暂无抽签记录</div>';
      return;
    }

    // 按时间倒序渲染（最新的在最上面）
    records.reverse().forEach(record => {
      const winners = record.get("winners");
      const count = record.get("count");
      const createdAt = new Date(record.createdAt);
      const timeStr = `${createdAt.toLocaleDateString()} ${createdAt.toLocaleTimeString().slice(0, 8)}`;

      // 创建公示项
      const resultItem = document.createElement("div");
      resultItem.className = "py-2 px-2 border-b border-dark-700 last:border-0 hover:bg-dark-700/30 rounded-md";
      
      // 公示项内容
      resultItem.innerHTML = `
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs text-muted">${timeStr} · 抽取${count}人</span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">公示</span>
        </div>
        <div class="flex flex-wrap gap-1">
          ${winners.map(name => `<span class="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">${name}</span>`).join("")}
        </div>
      `;

      公示Container.appendChild(resultItem);
    });
  }

  /************** 加载抽签结果公示 **************/
  async function loadDrawResults() {
    const query = new AV.Query("DrawResult");
    query.equalTo("room", ROOM_ID);
    query.ascending("createdAt");
    const records = await query.find();
    
    renderDrawResults(records);
    log(`📢 已加载 ${records.length} 条抽签公示记录`);
  }
  loadDrawResults(); // 页面加载时加载公示记录

  /************** 实时同步 **************/
  async function enableRealtime() {
    // 同步名单
    const nameQuery = new AV.Query("NameList");
    nameQuery.equalTo("room", ROOM_ID);
    const nameLive = await nameQuery.subscribe();
    nameLive.on("create", loadNames);
    nameLive.on("delete", loadNames);
    nameLive.on("update", loadNames);

    // 同步抽签结果
    const drawQuery = new AV.Query("DrawResult");
    drawQuery.equalTo("room", ROOM_ID);
    const drawLive = await drawQuery.subscribe();
    drawLive.on("create", loadDrawResults);
    drawLive.on("delete", loadDrawResults);

    log("🔄 已开启实时同步，名单和抽签结果将自动更新");
  }
  enableRealtime();

  /************** 添加名字 **************/
  addMyNameBtn.addEventListener("click", async () => {
    // 检查是否已提交过名字
    if (mySubmittedName) {
      alert(`⚠️ 你已提交过名字：${mySubmittedName.name}，如需修改请点击名字旁的编辑按钮`);
      return;
    }

    const name = prompt("请输入你的名字：");
    if (!name || !name.trim()) {
      alert("名字不能为空！");
      return;
    }

    const trimmedName = name.trim();
    
    // 检查是否已存在同名
    const query = new AV.Query("NameList");
    query.equalTo("room", ROOM_ID);
    query.equalTo("name", trimmedName);
    const existing = await query.find();
    if (existing.length > 0) {
      alert("❌ 该名字已存在，请勿重复添加！");
      return;
    }

    // 保存到LeanCloud
    const obj = new NameList();
    obj.set("room", ROOM_ID);
    obj.set("name", trimmedName);
    const savedObj = await obj.save();

    // 存储到本地，标记为当前用户提交的名字
    mySubmittedName = {
      name: trimmedName,
      objectId: savedObj.id
    };
    localStorage.setItem('mySubmittedName', JSON.stringify(mySubmittedName));

    log(`➕ 你添加了名字：${trimmedName}`);
    loadNames(); // 重新加载名单
  });

  /************** 编辑名字 **************/
  async function editName(record) {
    const oldName = record.get("name");
    const newName = prompt(`请输入新的名字（原名字：${oldName}）：`, oldName);
    
    if (!newName || !newName.trim()) {
      alert("名字不能为空！");
      return;
    }

    const trimmedNewName = newName.trim();
    
    // 检查新名字是否已存在
    const query = new AV.Query("NameList");
    query.equalTo("room", ROOM_ID);
    query.equalTo("name", trimmedNewName);
    const existing = await query.find();
    // 排除自己的记录
    const isDuplicate = existing.some(item => item.id !== record.id);
    if (isDuplicate) {
      alert("❌ 该名字已存在，请勿重复！");
      return;
    }

    // 更新记录
    record.set("name", trimmedNewName);
    await record.save();

    // 如果是当前用户自己的名字，更新本地存储
    if (mySubmittedName && mySubmittedName.objectId === record.id) {
      mySubmittedName.name = trimmedNewName;
      localStorage.setItem('mySubmittedName', JSON.stringify(mySubmittedName));
    }

    log(`✏️ ${isOwner ? "房主编辑" : "你编辑"}了名字：${oldName} → ${trimmedNewName}`);
    loadNames(); // 重新加载名单
  }

  /************** 删除名字 **************/
  async function deleteName(record) {
    const name = record.get("name");
    if (!confirm(`⚠️ 确定要删除名字「${name}」吗？此操作不可恢复！`)) {
      return;
    }

    // 删除LeanCloud记录
    await record.destroy();

    // 如果是当前用户自己的名字，清空本地存储
    if (mySubmittedName && mySubmittedName.objectId === record.id) {
      mySubmittedName = null;
      localStorage.removeItem('mySubmittedName');
    }

    log(`🗑️ ${isOwner ? "房主删除" : "你删除"}了名字：${name}`);
    loadNames(); // 重新加载名单
  }

  /************** 房主清空（含清空抽签结果） **************/
  clearNamesBtn.addEventListener("click", async () => {
    if (!isOwner) return;

    // 增强确认提示，告知会同时清空抽签结果
    if (!confirm("⚠️ 确定要清空所有名字和历史抽签结果吗？此操作将重置系统，可开启新轮抽签！")) return;

    try {
      // 1. 清空名字列表
      const nameQuery = new AV.Query("NameList");
      nameQuery.equalTo("room", ROOM_ID);
      const nameRes = await nameQuery.find();
      await AV.Object.destroyAll(nameRes);

      // 2. 清空抽签结果记录
      const drawQuery = new AV.Query("DrawResult");
      drawQuery.equalTo("room", ROOM_ID);
      const drawRes = await drawQuery.find();
      await AV.Object.destroyAll(drawRes);

      // 3. 重置本地状态
      mySubmittedName = null;
      localStorage.removeItem('mySubmittedName');

      // 4. 重置UI：清空本次抽签结果和公示区域
      slots.innerHTML = "";
      winnersDiv.innerHTML = "";

      // 5. 重新加载数据，刷新页面展示
      loadNames();
      loadDrawResults();

      // 6. 日志记录
      log("🗑️ 房主已清空所有名单和历史抽签结果，系统已重置，可开启新轮抽签");
    } catch (error) {
      log(`❌ 清空失败：${error.message}`);
      alert("清空失败，请重试！");
    }
  });

  /************** 抽签动画 **************/
  function displaySlots(n) {
    slots.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const div = document.createElement("div");
      div.className = "h-14 flex items-center justify-center rounded-lg bg-dark-900 border border-dark-700 text-lg font-medium";
      div.textContent = "等待抽签...";
      slots.appendChild(div);
    }
  }

  function shuffle(arr) {
    let a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function getCurrentNameList() {
    // 获取最新的名字列表
    const query = new AV.Query("NameList");
    query.equalTo("room", ROOM_ID);
    const records = await query.find();
    return records.map(r => r.get("name"));
  }

  /************** 保存抽签结果到数据库 **************/
  async function saveDrawResult(winners, count) {
    const resultObj = new DrawResult();
    resultObj.set("room", ROOM_ID);
    resultObj.set("winners", winners);
    resultObj.set("count", count);
    await resultObj.save();
    log(`📢 抽签结果已保存并公示：${winners.join(", ")}`);
  }

  function animateReveal(names, count) {
    const slotEls = Array.from(slots.children);
    winnersDiv.innerHTML = "";

    slotEls.forEach((el, idx) => {
      let rounds = 25, r = 0;
      // 添加动画类
      el.classList.add("animate-slot");
      
      getCurrentNameList().then(pool => {
        const timer = setInterval(() => {
          el.textContent = pool[Math.floor(Math.random() * pool.length)] || "—";
          if (++r >= rounds) {
            clearInterval(timer);
            // 移除动画类
            el.classList.remove("animate-slot");
            el.textContent = names[idx];
            el.classList.add("bg-primary/10", "border-primary/30", "text-primary");

            // 创建中奖标签
            const pill = document.createElement("span");
            pill.className = "px-3 py-1 rounded-full bg-secondary/10 border border-secondary/30 text-secondary text-sm";
            pill.textContent = `${idx + 1}. ${names[idx]}`;
            winnersDiv.appendChild(pill);

            // 所有动画完成后保存结果（仅第一次完成时保存）
            if (idx === slotEls.length - 1) {
              saveDrawResult(names, count); // 保存结果到数据库
            }
          }
        }, 50);
      });
    });
  }

  /************** 房主抽签 **************/
  drawBtn.addEventListener("click", async () => {
    if (!isOwner) {
      alert("❌ 只有房主可以执行抽签操作！");
      return;
    }

    const pool = await getCurrentNameList();
    if (pool.length === 0) {
      alert("❌ 名单为空，无法抽签！");
      return;
    }

    const n = Math.max(1, parseInt(countInput.value));
    if (n > pool.length) {
      alert(`❌ 抽取人数不能超过名单总数（${pool.length}人）！`);
      return;
    }

    displaySlots(n);
    const winners = shuffle(pool).slice(0, n);
    animateReveal(winners, n); // 传入抽取人数

    log(`🎯 房主抽取了 ${n} 人，结果：${winners.join(", ")}`);
  });
});
