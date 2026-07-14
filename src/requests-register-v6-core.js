import { createClient } from '@supabase/supabase-js'
import { LOGISTICS_SUPABASE_URL, LOGISTICS_SUPABASE_KEY } from './manual-logistics-config.js'

const supabase=createClient(LOGISTICS_SUPABASE_URL,LOGISTICS_SUPABASE_KEY)
const state={active:false,rows:[],profile:null,session:null,loading:false,query:'',stage:'all',supplier:'all',category:'all',page:1,drawer:null,error:'',saving:false,exporting:false,channel:null,frame:0}
const ROOT='requests-register-v6-root',PAGE_SIZE=12
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')
const localDate=()=>{const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10)}
const fmt=value=>value?new Intl.DateTimeFormat('ru-RU').format(new Date(`${value}T00:00:00`)):'—'
const fmtDateTime=value=>value?new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'—'
const canEdit=()=>state.profile?.role==='admin'
const blank=()=>({id:'',request_number:'',request_sent_at:localDate(),category:'',product_name:'',article_numbers:'',agent_name:'',offer_received:false,offer_received_at:'',included_calculation:false,notes:''})
const stageKey=row=>row.included_calculation?'calculation':row.offer_received?'offer':'request'
const stageMeta={request:['Запрос отправлен','request'],offer:['Предложение получено','offer'],calculation:['Внесено в расчёт','calculation']}
function friendly(error){const message=String(error?.message||error||'');if(/duplicate key|23505/i.test(message))return 'Запрос с таким номером уже существует.';if(/row-level security|permission denied|42501/i.test(message))return 'Недостаточно прав. Изменения доступны только администратору.';if(/failed to fetch|networkerror|load failed/i.test(message))return 'Нет связи с Supabase. Введённые значения сохранены в панели.';return message||'Не удалось выполнить действие.'}
function ensureRoot(){const main=document.querySelector('main.content');if(!main)return null;let root=document.getElementById(ROOT);if(!root){root=document.createElement('div');root.id=ROOT;main.append(root)}return root}
function filteredRows(){const query=state.query.trim().toLowerCase();return state.rows.filter(row=>(!query||[row.request_number,row.product_name,row.category,row.article_numbers,row.agent_name].join(' ').toLowerCase().includes(query))&&(state.stage==='all'||stageKey(row)===state.stage)&&(state.supplier==='all'||row.agent_name===state.supplier)&&(state.category==='all'||row.category===state.category))}
function summary(){return state.rows.reduce((result,row)=>{result[stageKey(row)]+=1;return result},{total:state.rows.length,request:0,offer:0,calculation:0})}
async function load(){if(!state.active)return;state.loading=true;state.error='';window.RQ6.render?.();try{const {data:auth,error:authError}=await supabase.auth.getSession();if(authError)throw authError;state.session=auth.session;if(!state.session)throw new Error('Войдите в систему снова.');const {data:profile,error:profileError}=await supabase.from('profiles').select('*').eq('id',state.session.user.id).single();if(profileError)throw profileError;state.profile=profile;const {data,error}=await supabase.from('requests').select('id,request_number,category,product_name,agent_name,article_numbers,request_sent_at,offer_received,offer_received_at,included_calculation,notes,created_at,updated_at').order('updated_at',{ascending:false});if(error)throw error;state.rows=data||[]}catch(error){state.error=friendly(error)}finally{state.loading=false;window.RQ6.render?.()}}
window.RQ6={supabase,state,ROOT,PAGE_SIZE,esc,localDate,fmt,fmtDateTime,icon:window.RQ6_ICON,canEdit,blank,stageKey,stageMeta,friendly,ensureRoot,filteredRows,summary,load}
