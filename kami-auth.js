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
      try{
        const res=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,userIdentifier:getMachineId()})});
        const json=await res.json();
        if(json.success){saveVerify(json.data);overlay.style.display='none';showRemain();}
        else alert('验证失败:'+json.message);
      }catch(e){alert('网络错误');}
      finally{btn.disabled=false;btn.textContent=oldText;}
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