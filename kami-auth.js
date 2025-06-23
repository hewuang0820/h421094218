// kami-auth.js - Card Key Activation System
(function(){
  const API_URL = 'https://api.h421094218.com/api/card-keys/verify';
  const STORAGE_KEY = 'KAMI_VERIFICATION';
  const MACHINE_KEY = 'KAMI_MACHINE_ID';
  const PROXY_BASE = 'https://corsproxy.io/?';

  // ===== Utils =====
  function sha256(str){return CryptoJS.SHA256(str).toString();}
  function getMachineId(){
    let id = localStorage.getItem(MACHINE_KEY);
    if (!id) {
      const raw =
        navigator.platform +                       // Windows NT 10.0 x64
        screen.width + 'x' + screen.height +       // 1920x1080
        screen.colorDepth +                        // 24
        Intl.DateTimeFormat().resolvedOptions().timeZone + // Asia/Shanghai
        navigator.language;                        // zh-CN
      id = CryptoJS.SHA256(raw).toString().substr(0, 16).toUpperCase();
      localStorage.setItem(MACHINE_KEY, id);
    }
    return id;
  }
  function encrypt(obj){return CryptoJS.AES.encrypt(JSON.stringify(obj), getMachineId()).toString();}
  function decrypt(cipher){try{return JSON.parse(CryptoJS.AES.decrypt(cipher,getMachineId()).toString(CryptoJS.enc.Utf8));}catch(e){return null;}}
  function saveVerify(d){localStorage.setItem(STORAGE_KEY,encrypt(d));}
  function loadVerify(){const c=localStorage.getItem(STORAGE_KEY);return c?decrypt(c):null;}
  function isVerified(){const d=loadVerify();return d && new Date(d.expiryTime).getTime()>Date.now();}

  // ===== Overlay =====
  function initOverlay(){
    let overlay=document.getElementById('license-overlay');
    if(!overlay){
      // 若页面中没有预置验证层，动态创建一份，避免因 HTML 缺失导致无法验证
      overlay=document.createElement('div');
      overlay.id='license-overlay';
      overlay.style.display='none';
      overlay.innerHTML=`<div class="panel">\n        <h2>HeWuAng&nbsp;Studio</h2>\n        <p>本工具采用一机一码验证机制，请将以下机器码发送给管理员获取<strong>卡密</strong></p>\n        <div id="machine-id" style="background:rgba(0,0,0,.45);padding:12px 14px;border-radius:8px;margin-bottom:24px;user-select:all">XXXX</div>\n        <input id="activation-input" placeholder="在此输入卡密" />\n        <button id="activate-btn">立即激活</button>\n        <div class="footer">管理员微信: h421094218<br><span id="tips">温馨提醒区域，请用常用浏览器打开保存网站！联系管理员获取激活码！</span><br>© 2024 何武昂工作室 出品</div>\n      </div>`;
      document.body.appendChild(overlay);
    }
    const machineSpan=document.getElementById('machine-id');
    const input=document.getElementById('activation-input');
    const btn=document.getElementById('activate-btn');

    machineSpan.textContent=getMachineId();

    btn.addEventListener('click',async()=>{
      const key=input.value.trim();
      if(!key){alert('请输入卡密');return;}
      btn.disabled=true;const oldText=btn.textContent;btn.textContent='验证中...';

      // 将请求逻辑封装，支持 CORS 代理回退
      async function requestVerify(url){
        return fetch(url,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ key, machineId: getMachineId() })
        });
      }

      try{
        // ==== 兼容 HTTPS 环境：若当前页面为 https 而 API 是 http，会触发 Mixed-Content 阻止。
        //      这种情况下优先改用 https://corsproxy.io 代理，避免第一步就被浏览器拦截。
        const firstUrl = (location.protocol === 'https:' && API_URL.startsWith('http://'))
            ? PROXY_BASE + API_URL
            : API_URL;

        // 第一次请求（已根据环境决定是否使用代理）
        let res = await requestVerify(firstUrl);
        // 若跨域被阻止或服务器返回 4xx/5xx，则尝试使用 CORS 代理重新请求
        if(!res.ok){throw new Error('status '+res.status);}  
        let json=await res.json();
        if(!json.success) throw new Error(json.message||'验证失败');

        // success path
        saveVerify(json.data||json);
        overlay.style.display='none';
        showRemain();
      }catch(firstErr){
        console.warn('第一次请求验证接口失败:',firstErr);
        try{
          const proxyUrl = PROXY_BASE + API_URL;
          const res=await requestVerify(proxyUrl);
          if(!res.ok){throw new Error('status '+res.status);}  
          const json=await res.json();
          if(!json.success) throw new Error(json.message||'验证失败');
          saveVerify(json.data||json);
          overlay.style.display='none';
          showRemain();
        }catch(secondErr){
          console.error('验证接口请求失败:',secondErr);
          alert('❌ 无法连接验证服务器，请检查网络或稍后再试');
        }
      }finally{
        btn.disabled=false;
        btn.textContent=oldText;
      }
    });

    if(isVerified()){overlay.style.display='none';showRemain();}else overlay.style.display='flex';

    /* ===== 自动验证（无需手动输入） ===== */
    (async function autoVerify () {
      const body = JSON.stringify({ key: '', machineId: getMachineId() });

      // 如果页面是 https 而 API 是 http，用 CORS 代理避免 Mixed-Content
      const url =
        location.protocol === 'https:' && API_URL.startsWith('http://')
          ? PROXY_BASE + API_URL
          : API_URL;

      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        });
        const j = await r.json();
        if (j.success) {
          // 自动验证成功，保存并直接退出，不显示输入框
          saveVerify(j.data || j);
          showRemain();
          return;
        }
      } catch (e) {
        console.warn('autoVerify fail:', e);
      }
      // 若失败，后面的代码会显示输入框
    })();
  }

  // ===== Remain Bar =====
  function showRemain(){
    let bar=document.getElementById('license-info');
    if(!bar){bar=document.createElement('div');bar.id='license-info';bar.style.cssText='position:fixed;bottom:15px;right:15px;padding:8px 14px;background:rgba(17,24,39,.85);color:#f1f5f9;font-size:13px;border-radius:8px;z-index:9999;user-select:none;';document.body.appendChild(bar);}  
    function update(){
      const data=loadVerify();
      if(!data){bar.textContent='未验证';document.getElementById('license-overlay').style.display='flex';return;}
      const remain=new Date(data.expiryTime).getTime()-Date.now();
      if(remain<=0){localStorage.removeItem(STORAGE_KEY);bar.textContent='已到期';document.getElementById('license-overlay').style.display='flex';return;}
      const d=Math.floor(remain/86400000);const h=Math.floor((remain%86400000)/3600000);
      bar.textContent=`剩余: ${d}天 ${h}小时`;
    }
    update();
    setInterval(update,60000);
  }

  document.addEventListener('DOMContentLoaded',initOverlay);
})(); 
