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
  function pickSalary(job){
    var s=job.salaryDesc||job.salary||job.salaryName||job.salaryMonthText||job.payTypeDesc||'';
    if(s)return s;
    var low=job.lowSalary||job.lowSalaryDesc;
    var high=job.highSalary||job.highSalaryDesc;
    if(low&&high){
      var l=Number(low),h=Number(high);
      if(l>1000)l=Math.round(l/1000);
      if(h>1000)h=Math.round(h/1000);
      s=l+'-'+h+'K';
      if(job.salaryMonth)s+='·'+job.salaryMonth+'薪';
      return s;
    }
    return '';
  }
  function salaryFromHtml(){
    var html=document.documentElement.innerHTML;
    var m=html.match(/"salaryDesc"\\s*:\\s*"([^"]+)"/);
    if(m&&m[1])return m[1];
    m=html.match(/"salaryDesc"\\s*:\\s*'([^']+)'/);
    if(m&&m[1])return m[1];
    var low=html.match(/"lowSalary"\\s*:\\s*(\\d+)/);
    var high=html.match(/"highSalary"\\s*:\\s*(\\d+)/);
    if(low&&high){
      var l=Math.round(Number(low[1])/1000),h=Math.round(Number(high[1])/1000);
      if(l>0&&h>0)return l+'-'+h+'K';
    }
    return '';
  }
  function metaFromPage(){
    var titleEl=document.querySelector('.job-name,.job-title,[class*="job-title"],h1.name');
    var title=titleEl?(titleEl.textContent||'').trim():'';
    var salary=salaryFromHtml();
    return {title:title,salary:salary};
  }
  function findCachedDetailUrl(){
    var entries=performance.getEntriesByType('resource');
    for(var i=entries.length-1;i>=0;i--){
      var u=entries[i].name;
      if(u.indexOf('/job/detail.json')>=0&&u.indexOf('securityId')>=0)return u;
    }
    return '';
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
    var btn=document.querySelector('.btn-startchat,[class*="startchat"],.btn-chat,.job-detail-operate .btn');
    if(btn){
      out.securityId=btn.getAttribute('data-securityid')||btn.getAttribute('data-security-id')||btn.dataset.securityid||btn.dataset.securityId||'';
      var href=btn.getAttribute('href')||'';
      var hm=href.match(/securityId=([^&]+)/i);if(hm&&!out.securityId)out.securityId=decodeURIComponent(hm[1]);
      var dp=btn.getAttribute('data-params');
      if(dp&&!out.securityId){try{var p=JSON.parse(dp);out.securityId=p.securityId||'';out.lid=p.lid||out.lid;}catch(e){}}
    }
    if(!out.securityId){
      var el=document.querySelector('[data-securityid],[data-security-id]');
      if(el)out.securityId=el.getAttribute('data-securityid')||el.getAttribute('data-security-id')||'';
    }
    return out;
  }
  function idsFromPerformance(){
    var out={securityId:'',lid:'',encryptJobId:''};
    var entries=performance.getEntriesByType('resource');
    for(var i=entries.length-1;i>=0;i--){
      var u=entries[i].name;
      if(u.indexOf('/job/detail.json')<0)continue;
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
    ids=mergeIds(ids,idsFromPerformance());
    ids=mergeIds(ids,idsFromHtml());
    return ids;
  }
  function buildDetailUrl(ids){
    if(!ids.securityId)return '';
    var q='securityId='+encodeURIComponent(ids.securityId);
    if(ids.lid)q+='&lid='+encodeURIComponent(ids.lid);
    if(ids.encryptJobId)q+='&encryptJobId='+encodeURIComponent(ids.encryptJobId);
    return '/wapi/zpgeek/job/detail.json?'+q;
  }
  function normalizeDetailUrl(url){
    if(!url)return '';
    if(url.indexOf('http')===0)return url;
    if(url.charAt(0)==='/')return location.origin+url;
    return location.origin+'/'+url;
  }
  function handleDetail(d,bodyFallback){
    if(!(d&&d.code===0&&d.zpData&&d.zpData.jobInfo))return false;
    var job=d.zpData.jobInfo,brand=d.zpData.brandComInfo||{};
    var salary=pickSalary(job)||salaryFromHtml();
    var meta={title:job.jobName,salary:salary,location:job.locationName,
      experience:job.experienceName,degree:job.degreeName,company:brand.brandName,
      workAddress:job.address||''};
    var body=bodyFromApi(job,brand)||bodyFallback||domBody();
    copyOut(header(meta)+'\\n\\n'+body,!!meta.salary);
    return true;
  }
  function fallback(){
    var pageMeta=metaFromPage();
    var body=domBody();
    if(!body||body.length<20)body=(window.getSelection&&window.getSelection().toString())||'';
    if(!body||body.length<20){alert('请先打开 BOSS 岗位详情页，等页面加载完成后再点书签');return;}
    copyOut(header(pageMeta)+'\\n\\n'+body,!!pageMeta.salary);
  }
  function fetchDetail(url,bodyFallback){
    fetch(normalizeDetailUrl(url),{credentials:'include',headers:{'X-Requested-With':'XMLHttpRequest'}})
      .then(function(r){return r.json();})
      .then(function(d){
        if(handleDetail(d,bodyFallback))return;
        fallback();
      }).catch(function(){fallback();});
  }
  function attempt(retry){
    var cached=findCachedDetailUrl();
    if(cached){fetchDetail(cached,domBody());return;}
    var ids=resolveIds();
    var built=buildDetailUrl(ids);
    if(built){fetchDetail(built,domBody());return;}
    if(retry<12){setTimeout(function(){attempt(retry+1);},500);return;}
    fallback();
  }
  try{attempt(0);}catch(e){alert('提取失败，请刷新页面后重试');}
})();`;

export const BOSS_BOOKMARKLET = `javascript:${BOSS_BOOKMARKLET_SOURCE}`;
