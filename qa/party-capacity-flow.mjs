import assert from 'node:assert/strict';
import {loadTemplateRuntime} from '../template-runtime-loader.mjs';
const rt=await loadTemplateRuntime();
for(const mode of ['ordinary-plot','ordinary-house-finished','ordinary-flat-finished','gpa-plot','agpa-plot']) for(const capacity of ['Guardian','Confirming Party','Consenting Party','Legal Heir']) for(const gift of [false,true]) {
 if(gift && !mode.startsWith('ordinary'))continue;
 const state=rt.sampleState(mode);
 if(gift){state.deedType='Gift';state.form.giftRelationship='daughter';}
 state.form.executantPartyType=capacity;state.form.claimantPartyType=capacity;
 const schedules=rt.scheduleMergesFor(state);
 const result=gift?await rt.fillGiftDeed(rt.mergeValues(state),rt.rewritesFor(state),schedules):await rt.fillSaleDeed(rt.mergeValues(state),schedules[0].variant,rt.rewritesFor(state),schedules);
 const text=await rt.docxToText(new Uint8Array(await result.blob.arrayBuffer()));
 for(const side of ['executant','claimant'])assert.ok(text.includes(capacity+': '+state.form[side+'Name'].toUpperCase()),`${mode} ${gift?'Gift':'Sale'} ${side} ${capacity}`);
}
console.log('PASS: capacity prefixes across Sale/Gift plot, house, flat and Sale GPA/AGPA modes.');
