/**
 * BOSS 直聘导入书签：在 zhipin.com 页面上下文调用内部 API 获取明文 salaryDesc，
 * 绕过页面字体反爬（手动复制/DOM 无法得到真实薪资）。
 */
const BOSS_BOOKMARKLET_SOURCE = `(function(){
  function domBody(){
    var sel='.job-detail-section,.job-detail-wrapper,.job-detail,.job-box,.job-detail-body,.position-content';
    var s=document.querySelector(sel);var t=s?s.innerText:'';
    if(t){var cut=['更多职位','看过该职位的人还看了','精选职位'];
      for(var i=0;i<cut.length;i++){var x=t.indexOf(cut[i]);if(x>0)t=t.slice(0,x)}}
    if(!t||t.length<50){var p=document.querySelector('[class*="job-detail"],[class*="JobDetail"]');t=p?p.innerText:''}
    return (t||'').trim();
  }
  function copyOut(out,hasSalary){
    navigator.clipboard.writeText(out).then(function(){
      alert(hasSalary?'✅ 已复制（含薪资）\\n请回到 JobAgent 粘贴，点「智能识别」':'✅ 已复制\\n⚠️ 未获取薪资，请确认在 BOSS 岗位详情页点击书签');
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
    if(job.postDescription)b.push('职位描述\\n'+job.postDescription);
    if(brand.brandName){
      b.push('公司基本信息\\n'+brand.brandName);
      if(brand.stageName)b.push(brand.stageName);
      if(brand.scaleName)b.push(brand.scaleName);
      if(brand.industryName)b.push(brand.industryName);
    }
    if(job.address)b.push('工作地址\\n'+job.address);
    return b.join('\\n\\n');
  }
  function fallback(){
    var body=domBody();
    if(!body||body.length<20)body=(window.getSelection&&window.getSelection().toString())||'';
    if(!body||body.length<20){alert('请先打开 BOSS 岗位详情页，再点击书签');return;}
    copyOut(header({})+'\\n\\n'+body,false);
  }
  try{
    var sid=new URLSearchParams(location.search).get('securityId');
    if(!sid){fallback();return;}
    fetch('/wapi/zpgeek/job/detail.json?securityId='+encodeURIComponent(sid),{credentials:'include'})
      .then(function(r){return r.json();})
      .then(function(d){
        if(d&&d.code===0&&d.zpData&&d.zpData.jobInfo){
          var job=d.zpData.jobInfo,brand=d.zpData.brandComInfo||{};
          var meta={title:job.jobName,salary:job.salaryDesc,location:job.locationName,
            experience:job.experienceName,degree:job.degreeName,company:brand.brandName,
            workAddress:job.address||''};
          var body=bodyFromApi(job,brand)||domBody();
          copyOut(header(meta)+'\\n\\n'+body,!!meta.salary);
        }else{fallback();}
      }).catch(fallback);
  }catch(e){alert('提取失败，请刷新页面后重试');}
})();`;

export const BOSS_BOOKMARKLET = `javascript:${BOSS_BOOKMARKLET_SOURCE}`;
