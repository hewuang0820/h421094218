// kami-auth.js - Card Key Activation System
(function(){
  const API_URL = 'http://170.106.175.187/api/card-keys/verify';
  const STORAGE_KEY = 'KAMI_VERIFICATION';
  const MACHINE_KEY = 'KAMI_MACHINE_ID';

  // ===== Utils =====
  function sha256(str){return CryptoJS.SHA256(str).toString();}
  function getMachineId(){
    let id = localStorage.getItem(MACHINE_KEY);
    if(!id){
      id = sha256(navigator.userAgent + navigator.platform + navigator.language).substr(0,16).toUpperCase();
      localStorage.setItem(MACHINE_KEY,id);
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
    const overlay=document.getElementById('license-overlay');
    if(!overlay) return;
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
        return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,userIdentifier:getMachineId()})});
      }

      try{
        // ==== 兼容 HTTPS 环境：若当前页面为 https 而 API 是 http，会触发 Mixed-Content 阻止。
        //      这种情况下优先改用 https://corsproxy.io 代理，避免第一步就被浏览器拦截。
        const firstUrl = (location.protocol === 'https:' && API_URL.startsWith('http://'))
            ? 'https://corsproxy.io/?' + encodeURIComponent(API_URL)
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
          const proxyUrl='https://corsproxy.io/?'+encodeURIComponent(API_URL);
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
