import {readFileSync} from 'node:fs';
import {catalogs,validate} from './i18n/validator.mjs';
try {
  const critical=process.argv.includes('--critical');
  const config=JSON.parse(readFileSync('docs/i18n/validation-config.json','utf8'));
  const data={es:{},en:{}};const allowEmpty=[];
  for(const entry of config.catalogs){
    const parsed=catalogs(readFileSync(entry.path,'utf8'),entry.path,entry.variable);
    for(const locale of ['es','en'])for(const [key,value]of Object.entries(parsed[locale]))data[locale][entry.id+':'+key]=value;
    for(const exception of entry.allowEmpty??[])allowEmpty.push(exception.locale+':'+entry.id+':'+exception.key);
  }
  const manifest=critical?JSON.parse(readFileSync('docs/i18n/critical-translations.json','utf8')):undefined;
  const result=validate(data,manifest,critical,allowEmpty);console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:1;
} catch(error) {console.error(JSON.stringify({status:'FAIL',code:String(error.message).split('\n')[0]}));process.exitCode=1;}
