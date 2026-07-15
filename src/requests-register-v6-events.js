const R=window.RQ6
const {state,blank,canEdit,localDate,PAGE_SIZE}=R

async function onClick(event){
  const root=event.target.closest(`#${R.ROOT}`)
  if(!root)return
  const node=event.target.closest('[data-action]')
  if(!node)return
  event.preventDefault()
  event.stopPropagation()
  const action=node.dataset.action
  if(action==='new'&&canEdit()){
    state.drawer=blank()
    state.error=''
    document.body.classList.add('rq6-drawer-open')
    R.render()
  }else if(action==='close'){
    state.drawer=null
    state.error=''
    document.body.classList.remove('rq6-drawer-open')
    R.render()
  }else if(action==='edit'&&canEdit()){
    const row=state.rows.find(item=>item.id===node.dataset.id)
    if(row){
      state.drawer={...row}
      state.error=''
      document.body.classList.add('rq6-drawer-open')
      R.render()
    }
  }else if(action==='save')await R.save()
  else if(action==='delete')await R.remove(node.dataset.id)
  else if(action==='export')await R.exportExcel()
  else if(action==='reset'){
    state.query=''
    state.stage='all'
    state.supplier='all'
    state.category='all'
    state.page=1
    R.render()
  }else if(action==='prev'&&state.page>1){
    state.page-=1
    R.render()
  }else if(action==='next'){
    const pages=Math.ceil(R.filteredRows().length/PAGE_SIZE)
    if(state.page<pages){state.page+=1;R.render()}
  }
}

let inputTimer=0
function onInput(event){
  if(!event.target.closest(`#${R.ROOT}`)||event.target.dataset.filter!=='query')return
  window.clearTimeout(inputTimer)
  const value=event.target.value
  inputTimer=window.setTimeout(()=>{
    state.query=value
    state.page=1
    R.render()
    const input=document.querySelector(`#${R.ROOT} [data-filter="query"]`)
    input?.focus()
    input?.setSelectionRange(value.length,value.length)
  },100)
}

function onChange(event){
  if(!event.target.closest(`#${R.ROOT}`))return
  const filter=event.target.dataset.filter
  if(filter){
    state[filter]=event.target.value
    state.page=1
    R.render()
    return
  }
  const editor=event.target.closest('#rq6-editor')
  if(!editor)return
  if(event.target.name==='included_calculation'&&event.target.checked){
    const offer=editor.querySelector('[name="offer_received"]')
    const date=editor.querySelector('[name="offer_received_at"]')
    if(offer)offer.checked=true
    if(date&&!date.value)date.value=localDate()
  }
  if(event.target.name==='offer_received'&&event.target.checked){
    const date=editor.querySelector('[name="offer_received_at"]')
    if(date&&!date.value)date.value=localDate()
  }
}

function mountRoot(){
  const existed=Boolean(document.getElementById(R.ROOT))
  const root=R.ensureRoot()
  return {root,created:Boolean(root&&!existed)}
}

function activate(){
  if(state.active){
    const {created}=mountRoot()
    if(created)R.render()
    return
  }
  state.active=true
  document.body.classList.add('requests-register-v6-active')
  mountRoot()
  R.render()
  R.load()
  if(!state.channel)state.channel=R.supabase.channel('requests-register-v6').on('postgres_changes',{event:'*',schema:'public',table:'requests'},()=>{if(!state.saving)R.load()}).subscribe()
}

function deactivate(){
  if(!state.active)return
  state.active=false
  state.drawer=null
  document.body.classList.remove('requests-register-v6-active','rq6-drawer-open')
  document.getElementById(R.ROOT)?.remove()
  if(state.channel){R.supabase.removeChannel(state.channel);state.channel=null}
}

function sync(){
  state.frame=0
  const active=[...document.querySelectorAll('aside nav button, .mobile-bottom-nav button')].find(button=>button.classList.contains('active'))
  if(active?.textContent?.includes('Запросы'))activate()
  else deactivate()
}

function schedule(){if(!state.frame)state.frame=requestAnimationFrame(sync)}

function start(){
  document.addEventListener('click',onClick,true)
  document.addEventListener('input',onInput,true)
  document.addEventListener('change',onChange,true)
  document.addEventListener('click',event=>{
    if(event.target.closest('aside nav button, .mobile-bottom-nav button'))requestAnimationFrame(schedule)
  },true)
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&state.drawer){
      state.drawer=null
      state.error=''
      document.body.classList.remove('rq6-drawer-open')
      R.render()
    }
  })
  schedule()
  new MutationObserver(schedule).observe(document.getElementById('root')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})
}

Object.assign(R,{onClick,onInput,onChange,activate,deactivate,start})
