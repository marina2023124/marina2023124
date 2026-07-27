/**
 * BOSS 直聘导入书签：在 zhipin.com 页面上下文调用内部 API 获取明文 salaryDesc，
 * 绕过页面字体反爬（手动复制/DOM 无法得到真实薪资）。
 */
const BOSS_BOOKMARKLET_SOURCE = `(function(){
  function domBody(){
    var sel='.job-detail-section,.job-detail-wrapper,.job-detail,.job-box,.job-detail-body,.position-content,.job-detail-box';
    var s=document.querySelector(sel);var t=s?s.innerText:'';
    if(t){var cut=['更多职位','看过该职位的人还看了','精选职位'];
      for(var i=0;i<cut.length;i++){var x=t.indexOf(cut[i]);if(x>0)t=t.slice(0,x)}}
    if(!t||t.length<50){var p=document.querySelector('[class*="job-detail"],[class*="JobDetail"]');t=p?p.innerText:''}
    return (t||'').trim();
  }
  function copyOut(out,hasSalary){
    navigator.clipboard.writeText(out).then(function(){
      alert(hasSalary?'✅ 已复制（含薪资）\\n请回到 JobAgent 粘贴，点「智能识别」':'✅ 已复制\\n⚠️ 未获取薪资，请等页面加载完成后再点书签，或从列表页进入详情后重试');
    }).catch(function(){prompt('请手动复制：',out)});
  }
  function header(meta){
    var h=['来源：'+location.href,''];
    if(meta.title)h.push('岗位：'+meta.title);
    if(meta.salary)h.push('薪资：'+meta.salary);
    if(meta.location)h.push('地点：'+meta.location);
    if(meta.experience)h.push('经验：'+meta.experience);
    if(meta.degree)h.push('学历：'+meta.degree);
    if(meta.workAddress)h.push('工作地址：'+meta.workAddress);
    if(meta.company)h.push('公司：'+meta.company);
    if(meta.title&&meta.salary){
      h.push('');
      h.push(meta.title);
      var parts=[meta.salary,meta.location,meta.experience,meta.degree].filter(Boolean);
      if(parts.length)h.push(parts.join('·'));
    }
    return h.join('\\n');
  }
  function bodyFromApi(job,brand){
    var b=[];
    var tagParts=[];
    if(job.showSkills&&job.showSkills.length)tagParts=tagParts.concat(job.showSkills);
    if(job.jobLabels&&job.jobLabels.length)tagParts=tagParts.concat(job.jobLabels);
    var tagLine=tagParts.filter(Boolean).join(' ');
    if(job.postDescription){
      var intro=tagLine?tagLine+'\\n\\n'+job.postDescription:job.postDescription;
      b.push('职位描述\\n'+intro);
    }else if(tagLine){
      b.push('职位描述\\n'+tagLine);
    }
    if(brand.brandName){
      b.push('公司基本信息\\n'+brand.brandName);
      if(brand.stageName)b.push(brand.stageName);
      if(brand.scaleName)b.push(brand.scaleName);
      if(brand.industryName)b.push(brand.industryName);
    }
    if(job.address)b.push('工作地址\\n'+job.address);
    return b.join('\\n\\n');
  }
  function decodeJsonStr(raw){
    var decoded=raw;
    try{decoded=JSON.parse('"'+raw.replace(/\\\\/g,'\\\\\\\\').replace(/"/g,'\\\\"')+'"');}catch(e){decoded=raw;}
    return decoded.replace(/\\\\u([0-9a-fA-F]{4})/g,function(_,h){return String.fromCharCode(parseInt(h,16));});
  }
  function pickSalary(job){
    if(!job)return '';
    var fields=['salaryDesc','salary','salaryName','salaryMonthText','payTypeDesc','salaryRangeDesc','jobSalaryDesc','performance'];
    for(var i=0;i<fields.length;i++){
      var v=job[fields[i]];
      if(typeof v==='string'&&v.trim())return v.trim();
    }
    var low=job.lowSalary||job.lowSalaryDesc;
    var high=job.highSalary||job.highSalaryDesc;
    if(low&&high){
      var l=Number(low),h=Number(high);
      if(l>1000)l=Math.round(l/1000);
      if(h>1000)h=Math.round(h/1000);
      var s=l+'-'+h+'K';
      if(job.salaryMonth&&Number(job.salaryMonth)>12)s+='·'+job.salaryMonth+'薪';
      return s;
    }
    return '';
  }
  function salaryFromHtml(){
    var html=document.documentElement.innerHTML;
    var patterns=[/"salaryDesc"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"/,/"salaryDesc"\\s*:\\s*'([^']+)'/,/\\\\"salaryDesc\\\\"\\s*:\\s*\\\\"((?:[^"\\\\]|\\\\.)*)\\\\"/];
    for(var i=0;i<patterns.length;i++){
      var m=html.match(patterns[i]);
      if(m&&m[1]){
        var val=decodeJsonStr(m[1]).trim();
        if(/\\d/.test(val)&&/[Kk]|薪|万/.test(val))return val;
      }
    }
    var low=html.match(/"lowSalary"\\s*:\\s*(\\d+)/);
    var high=html.match(/"highSalary"\\s*:\\s*(\\d+)/);
    var month=html.match(/"salaryMonth"\\s*:\\s*(\\d+)/);
    if(low&&high){
      var l=Math.round(Number(low[1])/1000),h=Math.round(Number(high[1])/1000);
      if(l>0&&h>0){
        var s=l+'-'+h+'K';
        if(month&&Number(month[1])>12)s+='·'+month[1]+'薪';
        return s;
      }
    }
    var near=html.match(/"jobName"\\s*:\\s*"[^"]*"[\s\\S]{0,500}?"salaryDesc"\\s*:\\s*"([^"]+)"/);
    if(near&&near[1]&&/\\d/.test(near[1]))return near[1];
    var scripts=document.querySelectorAll('script');
    for(var j=0;j<scripts.length;j++){
      var txt=scripts[j].textContent||'';
      if(txt.indexOf('salaryDesc')<0&&txt.indexOf('lowSalary')<0)continue;
      var sm=txt.match(/"salaryDesc"\\s*:\\s*"([^"]+)"/);
      if(sm&&sm[1]&&/\\d/.test(sm[1]))return sm[1];
    }
    var roots=[window.__INITIAL_STATE__,window.__zpData,window._PAGE];
    for(var k=0;k<roots.length;k++){
      if(!roots[k])continue;
      try{
        var blob=JSON.stringify(roots[k]);
        var bm=blob.match(/"salaryDesc"\\s*:\\s*"([^"]+)"/);
        if(bm&&bm[1])return bm[1];
      }catch(e){}
    }
    return '';
  }
  function salaryFromApiPayload(d,encryptJobId){
    if(!(d&&d.code===0&&d.zpData))return '';
    var z=d.zpData,job=z.jobInfo||z.job||z.detail;
    if(job){var s1=pickSalary(job);if(s1)return s1;}
    var lists=[z.jobList,z.jobs,z.list,z.recommendJobList];
    for(var li=0;li<lists.length;li++){
      var list=lists[li];
      if(!list||!list.length)continue;
      if(encryptJobId){
        for(var i=0;i<list.length;i++){
          var item=list[i];
          if(item.encryptJobId===encryptJobId||item.jobId===encryptJobId||item.encryptId===encryptJobId){
            var s2=pickSalary(item);if(s2)return s2;
          }
        }
      }
      for(var j=0;j<list.length;j++){var s3=pickSalary(list[j]);if(s3)return s3;}
    }
    try{return salaryFromHtml()||pickSalary(JSON.parse(JSON.stringify(z)));}catch(e){return '';}
  }
  function metaFromPage(){
    var titleEl=document.querySelector('.job-name,.job-title,[class*="job-title"],h1.name');
    var title=titleEl?(titleEl.textContent||'').trim():'';
    var salary=salaryFromHtml();
    var salEl=document.querySelector('.salary,[class*="salary"],.info-primary .red,.job-primary .salary');
    if(salEl){
      var ds=salEl.getAttribute('data-salary')||salEl.getAttribute('data-value');
      if(ds&&/\\d/.test(ds))salary=salary||ds;
    }
    return {title:title,salary:salary};
  }
  function findCachedApiUrls(){
    var urls=[],seen={};
    var entries=performance.getEntriesByType('resource');
    for(var i=entries.length-1;i>=0;i--){
      var u=entries[i].name;
      if(u.indexOf('/wapi/zpgeek/')<0)continue;
      if(!/job\\/(detail|card|preview)\\.json|search\\/joblist\\.json/i.test(u))continue;
      if(!seen[u]){seen[u]=1;urls.push(u);}
    }
    return urls;
  }
  function mergeIds(a,b){
    return {securityId:a.securityId||b.securityId||'',lid:a.lid||b.lid||'',encryptJobId:a.encryptJobId||b.encryptJobId||''};
  }
  function idsFromSearch(){
    var sp=new URLSearchParams(location.search);
    return {securityId:sp.get('securityId')||sp.get('securityid')||sp.get('secId')||'',
      lid:sp.get('lid')||'',encryptJobId:sp.get('encryptJobId')||sp.get('jobId')||sp.get('jobid')||''};
  }
  function idsFromPath(){
    var m=location.pathname.match(/\\/job_detail\\/([^.?#/]+)\\.html/i);
    return {securityId:'',lid:'',encryptJobId:m?m[1]:''};
  }
  function idsFromDom(){
    var out={securityId:'',lid:'',encryptJobId:''};
    var nodes=document.querySelectorAll('[data-securityid],[data-security-id],[data-secid]');
    for(var n=0;n<nodes.length;n++){
      var sid=nodes[n].getAttribute('data-securityid')||nodes[n].getAttribute('data-security-id')||nodes[n].getAttribute('data-secid')||'';
      if(sid){out.securityId=sid;break;}
    }
    var btn=document.querySelector('.btn-startchat,[class*="startchat"],.btn-chat,.job-detail-operate .btn');
    if(btn){
      out.securityId=out.securityId||btn.getAttribute('data-securityid')||btn.getAttribute('data-security-id')||btn.dataset.securityid||btn.dataset.securityId||'';
      var href=btn.getAttribute('href')||'';
      var hm=href.match(/securityId=([^&]+)/i);if(hm&&!out.securityId)out.securityId=decodeURIComponent(hm[1]);
      var dp=btn.getAttribute('data-params');
      if(dp&&!out.securityId){try{var p=JSON.parse(dp);out.securityId=p.securityId||'';out.lid=p.lid||out.lid;}catch(e){}}
    }
    return out;
  }
  function idsFromLinks(){
    var links=document.querySelectorAll('a[href*="securityId"]');
    for(var i=0;i<links.length;i++){
      var h=links[i].getAttribute('href')||'';
      var sm=h.match(/securityId=([^&]+)/i);
      if(sm)return {securityId:decodeURIComponent(sm[1]),lid:'',encryptJobId:''};
    }
    return {securityId:'',lid:'',encryptJobId:''};
  }
  function idsFromPerformance(){
    var out={securityId:'',lid:'',encryptJobId:''};
    var entries=performance.getEntriesByType('resource');
    for(var i=entries.length-1;i>=0;i--){
      var u=entries[i].name;
      if(u.indexOf('/job/detail.json')<0&&u.indexOf('/job/card.json')<0)continue;
      var sm=u.match(/[?&]securityId=([^&]+)/i);if(sm)out.securityId=decodeURIComponent(sm[1]);
      var lm=u.match(/[?&]lid=([^&]+)/i);if(lm)out.lid=decodeURIComponent(lm[1]);
      var jm=u.match(/[?&]encryptJobId=([^&]+)/i);if(jm)out.encryptJobId=decodeURIComponent(jm[1]);
      if(out.securityId)break;
    }
    return out;
  }
  function idsFromHtml(){
    var out={securityId:'',lid:'',encryptJobId:''};
    var html=document.documentElement.innerHTML;
    var sm=html.match(/"securityId"\\s*:\\s*"([^"]{8,})"/);if(sm)out.securityId=sm[1];
    var lm=html.match(/"lid"\\s*:\\s*"([^"]+)"/);if(lm)out.lid=lm[1];
    var jm=html.match(/"encryptJobId"\\s*:\\s*"([^"]+)"/);if(jm)out.encryptJobId=jm[1];
    return out;
  }
  function resolveIds(){
    var ids={securityId:'',lid:'',encryptJobId:''};
    ids=mergeIds(ids,idsFromSearch());
    ids=mergeIds(ids,idsFromPath());
    ids=mergeIds(ids,idsFromDom());
    ids=mergeIds(ids,idsFromLinks());
    ids=mergeIds(ids,idsFromPerformance());
    ids=mergeIds(ids,idsFromHtml());
    return ids;
  }
  function buildDetailUrls(ids){
    var urls=[],seen={};
    function add(u){if(u&&!seen[u]){seen[u]=1;urls.push(u);}}
    if(ids.securityId){
      var q='securityId='+encodeURIComponent(ids.securityId);
      if(ids.lid)q+='&lid='+encodeURIComponent(ids.lid);
      if(ids.encryptJobId)q+='&encryptJobId='+encodeURIComponent(ids.encryptJobId);
      add('/wapi/zpgeek/job/detail.json?'+q);
    }
    if(ids.encryptJobId){
      add('/wapi/zpgeek/job/detail.json?encryptJobId='+encodeURIComponent(ids.encryptJobId));
      add('/wapi/zpgeek/job/detail.json?jobId='+encodeURIComponent(ids.encryptJobId));
    }
    return urls;
  }
  function normalizeDetailUrl(url){
    if(!url)return '';
    if(url.indexOf('http')===0)return url;
    if(url.charAt(0)==='/')return location.origin+url;
    return location.origin+'/'+url;
  }
  function collectFetchUrls(ids){
    var urls=[],seen={};
    function add(u){var n=normalizeDetailUrl(u);if(n&&!seen[n]){seen[n]=1;urls.push(n);}}
    findCachedApiUrls().forEach(add);
    buildDetailUrls(ids).forEach(add);
    return urls;
  }
  function handleDetail(d,bodyFallback,encryptJobId){
    if(!(d&&d.code===0&&d.zpData))return false;
    var job=d.zpData.jobInfo||d.zpData.job||d.zpData.detail;
    var brand=d.zpData.brandComInfo||{};
    var salary=pickSalary(job)||salaryFromHtml()||salaryFromApiPayload(d,encryptJobId);
    if(job&&job.jobName){
      var meta={title:job.jobName,salary:salary,location:job.locationName,
        experience:job.experienceName,degree:job.degreeName,company:brand.brandName,
        workAddress:job.address||''};
      var body=bodyFromApi(job,brand)||bodyFallback||domBody();
      copyOut(header(meta)+'\\n\\n'+body,!!meta.salary);
      return true;
    }
    if(salary){
      var pageMeta=metaFromPage();pageMeta.salary=salary;
      copyOut(header(pageMeta)+'\\n\\n'+(bodyFallback||domBody()),true);
      return true;
    }
    return false;
  }
  function fallback(){
    var pageMeta=metaFromPage();
    var body=domBody();
    if(!body||body.length<20)body=(window.getSelection&&window.getSelection().toString())||'';
    if(!body||body.length<20){alert('请先打开 BOSS 岗位详情页，等页面加载完成后再点书签');return;}
    copyOut(header(pageMeta)+'\\n\\n'+body,!!pageMeta.salary);
  }
  function tryFetch(urls,idx,bodyFallback,encryptJobId){
    if(idx>=urls.length){fallback();return;}
    fetch(urls[idx],{credentials:'include',headers:{'X-Requested-With':'XMLHttpRequest'}})
      .then(function(r){return r.json();})
      .then(function(d){
        if(handleDetail(d,bodyFallback,encryptJobId))return;
        tryFetch(urls,idx+1,bodyFallback,encryptJobId);
      }).catch(function(){tryFetch(urls,idx+1,bodyFallback,encryptJobId);});
  }
  function attempt(retry){
    var ids=resolveIds();
    var urls=collectFetchUrls(ids);
    var body=domBody();
    if(urls.length){tryFetch(urls,0,body,ids.encryptJobId);return;}
    if(retry<16){setTimeout(function(){attempt(retry+1);},450);return;}
    fallback();
  }
  try{attempt(0);}catch(e){alert('提取失败，请刷新页面后重试');}
})();`;

export const BOSS_BOOKMARKLET = `javascript:${BOSS_BOOKMARKLET_SOURCE}`;
