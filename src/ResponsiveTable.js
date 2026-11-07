import React from 'react';
function flatten(children){return React.Children.toArray(children).flatMap(child=>React.isValidElement(child)&&child.type===React.Fragment?flatten(child.props.children):[child]);}
function contentText(node){if(typeof node==='string'||typeof node==='number')return String(node);if(React.isValidElement(node))return contentText(node.props.children);if(Array.isArray(node))return node.map(contentText).join('');return '';}
export default function ResponsiveTable({children,...props}){
 const sections=flatten(children),head=sections.find(s=>React.isValidElement(s)&&s.type==='thead');
 const headerRow=head&&flatten(head.props.children).find(r=>React.isValidElement(r)&&r.type==='tr');
 const labels=headerRow?flatten(headerRow.props.children).map(c=>contentText(c)||'Aksi'):[];
 const body=sections.map(section=>{if(!React.isValidElement(section)||section.type!=='tbody')return section;return React.cloneElement(section,{},flatten(section.props.children).map(row=>{if(!React.isValidElement(row)||row.type!=='tr')return row;return React.cloneElement(row,{},flatten(row.props.children).map((cell,i)=>React.isValidElement(cell)&&cell.type==='td'?React.cloneElement(cell,{key:i,'data-label':labels[i]||'Aksi','data-empty':flatten(cell.props.children).length===0?'true':undefined}):cell));}));});
 return React.createElement('table',{...props,className:['responsive-table',props.className].filter(Boolean).join(' ')},...body);
}
