export function bindUndoShortcut(undo){
 document.addEventListener('keydown',e=>{
  if(e.isComposing||e.repeat||!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey||e.key.toLowerCase()!=='z')return;
  const el=e.target,tag=el?.tagName?.toLowerCase();
  if(el?.isContentEditable||tag==='textarea'||(tag==='input'&&!['range','checkbox','radio','button','submit','color','file'].includes(el.type)))return;
  e.preventDefault();undo();
 });
}
