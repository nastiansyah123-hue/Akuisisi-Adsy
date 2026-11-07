import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ResponsiveTable from './ResponsiveTable.js';
const h=React.createElement;
test('mobile labels follow conditional columns and fragments without losing table semantics',()=>{
 for(const isCS of [true,false]){
  const header=h('thead',null,h('tr',null,
   h('th',null,'Tanggal'),isCS&&h('th',null,'CS'),
   h(React.Fragment,null,h('th',null,'Produk'),h('th',null,'Omzet')),h('th',null,'')
  ));
  const body=h('tbody',null,h('tr',null,
   h('td',null,'07/11/2026'),isCS&&h('td',null,'Inggrid'),
   h(React.Fragment,null,h('td',null,'Primagold'),h('td',null,'Rp15.000')),h('td',null,false)
  ));
  const html=renderToStaticMarkup(h(ResponsiveTable,null,header,body));
  assert.match(html,/<table class="responsive-table">/);
  assert.match(html,/data-label="Tanggal"/);
  assert.match(html,/data-label="Produk"[^>]*>Primagold/);
  assert.match(html,/data-label="Omzet"[^>]*>Rp15.000/);
  assert.match(html,/data-label="Aksi" data-empty="true"/);
  assert.equal(html.includes('data-label="CS"'),isCS);
 }
});
