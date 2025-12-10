document.addEventListener("DOMContentLoaded", function () {
  /************** LeanCloud 初始化 **************/
  AV.init({
    appId: "awjrq2pnF6yDBX2QT7Sq1dHQ-gzGzoHsz",
    appKey: "WY6uq9q4hPthkwKX5JIHrlYk",
    serverURL: "https://awjrq2pn.lc-cn-n1-shared.com"
  });

  const NameList = AV.Object.extend("NameList");
  const DrawResult = AV.Object.extend("DrawResult");
  const ROOM_ID = "default_room";

  /************** 核心状态变量 **************/
  let isOwner = false;
  let myUUID = localStorage.getItem("myUUID");
  let mySubmittedName = JSON.parse(localStorage.getItem("mySubmittedName") || "null");

  /************** DOM 元素（匹配 HTML ID） **************/
  const namesListContainer = document.getElementById("namesListContainer"); // 匹配 HTML
  const addMyNameBtn = document.getElementById("addMyNameBtn");
  const drawBtn = document.getElementById("drawBtn");
  const clearNamesBtn = document.getElementById("clearNamesBtn");
  const winnersDiv = document.getElementById("winners");
  const slots = document.getElementById("slots");
  const countInput = document.getElementById("count"); // 匹配 HTML 的 count ID
  const 公示Container = document.getElementById("公示Container"); // 匹配 HTML
  const logBox = document.getElementById("log"); // 匹配 HTML 的 log ID
  const identityBadge = document.getElementById("identityBadge"); // 新增：匹配身份徽章
  const identityText = document.getElementById("identityText");
  const nameCount = document.getElementById("nameCount"); // 新增：匹配人数统计

  /************** 日志函数（适配 HTML 的 pre 标签） **************/
  function log(msg) {
    if (logBox) {
      const time = new Date().toLocaleTimeString();
      const logMsg = `[${time}] ${msg}\n`;
      logBox.textContent = logMsg + logBox.textContent; // pre 标签用 textContent 而非 innerHTML
    }
  }

  /************** 房主密码验证 **************/
  (function initOwnerAuth() {
    const pw = prompt("请输入房主口令（访客点取消即可使用）", "");
    if (pw === "953191") {
      isOwner = true;
      drawBtn.disabled = false;
      clearNamesBtn.disabled = false;
      // 更新身份徽章样式（匹配 HTML 设计）
      identityBadge.className = "mt-3 inline-flex items-center px-3 py-1 rounded-full text-sm bg-secondary/10 text-secondary";
      identityText.textContent = "当前身份：房主（拥有全部权限）";
      log("✅ 你已进入房主模式，拥有抽签/清空/编辑所有人名字的权限");
    } else {
      isOwner = false;
      drawBtn.disabled = true;
      clearNamesBtn.disabled = true;
      // 更新身份徽章样式
      identityBadge.className = "mt-3 inline-flex items-center px-3 py-1 rounded-full text-sm bg-dark-700 text-muted";
      identityText.textContent = "当前身份：访客（仅可添加/修改/删除自己的名字）";
      log("👥 你已进入访客模式，仅可管理自己的名字");
    }
  })();

  /************** UUID 初始化 **************/
  if (!myUUID) {
    myUUID = "u_" + crypto.randomUUID();
    localStorage.setItem("myUUID", myUUID);
    log("🔑 已生成你的专属设备标识");
  }

  /************** 渲染名单（适配 HTML 样式） **************/
  function renderNameList(records) {
    namesListContainer.innerHTML = "";

    // 更新人数统计
    if (nameCount) {
      nameCount.textContent = `${records.length} 人`;
    }

    if (records.length === 0) {
      namesListContainer.innerHTML = '<div class="flex items-center justify-center text-muted py-8">名单为空，点击「提交我的名字」添加</div>';
      return;
    }

    records.forEach(record => {
      const name = record.get("name");
      const uuid = record.get("uuid");
      const objectId = record.id;
      const isMine = uuid === myUUID;

      const nameItem = document.createElement("div");
      nameItem.className = "flex items-center justify-between py-2 px-3 border-b border-dark-700 last:border-0 hover:bg-dark-700/50 rounded-md transition-colors";
      nameItem.dataset.objectId = objectId;

      // 名字文本
      const nameText = document.createElement("span");
      nameText.className = "text-white";
      nameText.textContent = name;
      if (isMine) {
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
      editBtn.disabled = !isOwner && !isMine;
      if (editBtn.disabled) {
        editBtn.className += " opacity-50 cursor-not-allowed";
      }
      editBtn.addEventListener("click", () => editName(record));

      // 删除按钮
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "px-2 py-1 bg-danger/20 text-danger text-sm rounded hover:bg-danger/30 transition-colors";
      deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      deleteBtn.title = "删除名字";
      deleteBtn.disabled = !isOwner && !isMine;
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

    log(`📋 名单已更新，共 ${records.length} 人`);
  }

  /************** 加载名单 **************/
  async function loadNames() {
    try {
      const query = new AV.Query("NameList");
      query.equalTo("room", ROOM_ID);
      query.ascending("createdAt");
      const records = await query.find();

      if (mySubmittedName && !records.some(r => r.id === mySubmittedName.objectId)) {
        mySubmittedName = null;
        localStorage.removeItem("mySubmittedName");
        log("ℹ️ 你的名字已被删除，可重新添加");
      }

      renderNameList(records);
    } catch (error) {
      log(`❌ 加载名单失败：${error.message}`);
      alert("加载名单失败，请刷新页面重试");
    }
  }

  /************** 渲染抽签历史 **************/
  function renderDrawResults(records) {
    公示Container.innerHTML = "";

    if (records.length === 0) {
      公示Container.innerHTML = '<div class="flex items-center justify-center text-muted py-4">暂无抽签记录</div>';
      return;
    }

    records.reverse().forEach(record => {
      const winners = record.get("winners");
      const count = record.get("count");
      const t = new Date(record.createdAt);
      const tStr = `${t.toLocaleDateString()} ${t.toLocaleTimeString().slice(0, 8)}`;

      const resultItem = document.createElement("div");
      resultItem.className = "py-2 px-2 border-b border-dark-700 last:border-0 hover:bg-dark-700/30 rounded-md";
      
      resultItem.innerHTML = `
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs text-muted">${tStr} · 抽取${count}人</span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">公示</span>
        </div>
        <div class="flex flex-wrap gap-1">
          ${winners.map(name => `<span class="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">${name}</span>`).join("")}
        </div>
      `;

      公示Container.appendChild(resultItem);
    });
  }

  async function loadDrawResults() {
    try {
      const query = new AV.Query("DrawResult");
      query.equalTo("room", ROOM_ID);
      query.ascending("createdAt");
      const records = await query.find();
      renderDrawResults(records);
      log(`📢 已加载 ${records.length} 条抽签公示记录`);
    } catch (error) {
      log(`❌ 加载抽签记录失败：${error.message}`);
    }
  }

  /************** 实时同步 **************/
  async function enableRealtime() {
    try {
      const q1 = new AV.Query("NameList").equalTo("room", ROOM_ID);
      const live1 = await q1.subscribe();
      live1.on("create", loadNames);
      live1.on("delete", loadNames);
      live1.on("update", loadNames);

      const q2 = new AV.Query("DrawResult").equalTo("room", ROOM_ID);
      const live2 = await q2.subscribe();
      live2.on("create", loadDrawResults);
      live2.on("delete", loadDrawResults);

      log("🔄 已开启实时同步，名单和抽签结果将自动更新");
    } catch (error) {
      log(`❌ 实时同步开启失败：${error.message}`);
    }
  }

  /************** 添加名字 **************/
  addMyNameBtn.addEventListener("click", async () => {
    if (mySubmittedName) {
      alert(`⚠️ 你已提交过名字：${mySubmittedName.name}，如需修改请点击名字旁的编辑按钮`);
      return;
    }

    const name = prompt("请输入你的名字：", "");
    if (!name || !name.trim()) {
      alert("名字不能为空！");
      return;
    }
    const trimmedName = name.trim();

    const query = new AV.Query("NameList");
    query.equalTo("room", ROOM_ID);
    query.equalTo("name", trimmedName);
    const exists = await query.find();
    if (exists.length > 0) {
      alert("❌ 该名字已存在，请勿重复添加！");
      return;
    }

    try {
      const obj = new NameList();
      obj.set("room", ROOM_ID);
      obj.set("name", trimmedName);
      obj.set("uuid", myUUID);
      const savedObj = await obj.save();

      mySubmittedName = {
        name: trimmedName,
        objectId: savedObj.id
      };
      localStorage.setItem("mySubmittedName", JSON.stringify(mySubmittedName));

      log(`➕ 成功添加名字：${trimmedName}`);
      loadNames();
    } catch (error) {
      log(`❌ 添加名字失败：${error.message}`);
      alert("添加失败，请重试");
    }
  });

  /************** 编辑名字 **************/
  async function editName(record) {
    const oldName = record.get("name");
    const newName = prompt(`请输入新的名字（原名字：${oldName}）：`, oldName);
    if (!newName || !newName.trim()) return;

    const trimmedNewName = newName.trim();

    const q = new AV.Query("NameList");
    q.equalTo("room", ROOM_ID);
    q.equalTo("name", trimmedNewName);
    const sameNameRecords = await q.find();
    const isDuplicate = sameNameRecords.some(r => r.id !== record.id);

    if (isDuplicate) {
      alert("❌ 该名字已存在，无法修改");
      return;
    }

    try {
      record.set("name", trimmedNewName);
      await record.save();

      if (mySubmittedName && mySubmittedName.objectId === record.id) {
        mySubmittedName.name = trimmedNewName;
        localStorage.setItem("mySubmittedName", JSON.stringify(mySubmittedName));
      }

      log(`✏️ ${isOwner ? "房主编辑" : "你编辑"}了名字：${oldName} → ${trimmedNewName}`);
      loadNames();
    } catch (error) {
      log(`❌ 编辑名字失败：${error.message}`);
      alert("修改失败，请重试");
    }
  }

  /************** 删除名字 **************/
  async function deleteName(record) {
    const name = record.get("name");
    if (!confirm(`⚠️ 确定要删除名字「${name}」吗？此操作不可恢复！`)) return;

    try {
      await record.destroy();

      if (mySubmittedName && mySubmittedName.objectId === record.id) {
        mySubmittedName = null;
        localStorage.removeItem("mySubmittedName");
      }

      log(`🗑️ ${isOwner ? "房主删除" : "你删除"}了名字：${name}`);
      loadNames();
    } catch (error) {
      log(`❌ 删除名字失败：${error.message}`);
      alert("删除失败，请重试");
    }
  }

  /************** 房主清空 **************/
  clearNamesBtn.addEventListener("click", async () => {
    if (!isOwner) {
      alert("❌ 只有房主可执行清空操作！");
      return;
    }

    if (!confirm("⚠️ 确定要清空所有名字和历史抽签结果吗？此操作将重置系统，可开启新轮抽签！")) return;

    try {
      // 清空名字列表
      const nameQuery = new AV.Query("NameList").equalTo("room", ROOM_ID);
      const nameRecords = await nameQuery.find();
      await AV.Object.destroyAll(nameRecords);

      // 清空抽签结果
      const drawQuery = new AV.Query("DrawResult").equalTo("room", ROOM_ID);
      const drawRecords = await drawQuery.find();
      await AV.Object.destroyAll(drawRecords);

      // 重置本地状态
      mySubmittedName = null;
      localStorage.removeItem("mySubmittedName");

      // 重置UI
      slots.innerHTML = "";
      winnersDiv.innerHTML = "";

      // 刷新数据
      loadNames();
      loadDrawResults();

      log("🗑️ 房主已清空所有名单和历史抽签结果，系统已重置");
    } catch (error) {
      log(`❌ 清空失败：${error.message}`);
      alert("清空失败，请重试！");
    }
  });

  /************** 抽签辅助函数 **************/
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
    const q = new AV.Query("NameList");
    q.equalTo("room", ROOM_ID);
    const rec = await q.find();
    return rec.map(r => r.get("name"));
  }

  /************** 保存抽签结果 **************/
  async function saveDrawResult(winners, count) {
    try {
      const obj = new DrawResult();
      obj.set("room", ROOM_ID);
      obj.set("winners", winners);
      obj.set("count", count);
      await obj.save();
      log(`📢 抽签结果已保存并公示：${winners.join(", ")}`);
    } catch (error) {
      log(`❌ 保存抽签结果失败：${error.message}`);
    }
  }

  /************** 抽签动画 **************/
  function animateReveal(names, count) {
    const slotEls = Array.from(slots.children);
    winnersDiv.innerHTML = "";

    slotEls.forEach((el, idx) => {
      let rounds = 25, r = 0;
      el.classList.add("animate-slot");

      getCurrentNameList().then(pool => {
        const timer = setInterval(() => {
          el.textContent = pool[Math.floor(Math.random() * pool.length)] || "—";
          if (++r >= rounds) {
            clearInterval(timer);
            el.classList.remove("animate-slot");
            el.textContent = names[idx];
            el.classList.add("bg-primary/10", "border-primary/30", "text-primary");

            const pill = document.createElement("span");
            pill.className = "px-3 py-1 rounded-full bg-secondary/10 border border-secondary/30 text-secondary text-sm";
            pill.textContent = `${idx + 1}. ${names[idx]}`;
            winnersDiv.appendChild(pill);

            if (idx === slotEls.length - 1) {
              saveDrawResult(names, count);
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

    const n = Math.max(1, parseInt(countInput.value) || 1);
    if (n > pool.length) {
      alert(`❌ 抽取人数不能超过名单总数（${pool.length}人）！`);
      return;
    }

    displaySlots(n);
    const winners = shuffle(pool).slice(0, n);
    animateReveal(winners, n);

    log(`🎯 房主抽取了 ${n} 人，结果：${winners.join(", ")}`);
  });

  /************** 初始化加载 **************/
  loadNames();
  loadDrawResults();
  enableRealtime();
});
