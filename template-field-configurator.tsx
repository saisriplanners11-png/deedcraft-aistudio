import React, { useEffect, useState } from 'react';
import type { LibraryRevision } from './template-library-types';
import { templateRequest } from './template-library-client';
import { EMPTY_FIELD_CONTRACT, fieldName, type BindingCatalogItem, type TemplateField } from './template-fields';

export function TemplateFieldConfigurator({ version, csrf, onSaved }: { version: LibraryRevision; csrf: string; onSaved: () => Promise<void> }) {
  const [catalog, setCatalog] = useState<BindingCatalogItem[]>([]);
  const [fields, setFields] = useState<TemplateField[]>(() => {
    const inherited = version.fieldContract?.fields || [];
    return [...inherited, ...(version.inspection?.unresolved || []).filter(name => !inherited.some(field => fieldName(field.placeholder) === fieldName(name))).map(name => {
      const type = /date/i.test(name) ? 'date' : /amount|charge|price|balance/i.test(name) ? 'currency' : 'text';
      return { id: crypto.randomUUID(), placeholder: name, label: name, help: '', type, scope: 'transaction', required: true, options: [], sampleValue: type === 'date' ? '2026-10-13' : type === 'currency' ? '1000' : 'SAMPLE VALUE', extractionEnabled: true, extractionDescription: name, evidenceContext: 'current' } as TemplateField;
    })];
  });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { templateRequest<BindingCatalogItem[]>('/binding-catalog?instrument=sale').then(setCatalog).catch(error => setError(error.message)); }, []);
  function update(index: number, patch: Partial<TemplateField>) {
    setFields(old => old.map((field, i) => i !== index ? field : { ...field, ...patch, id: ['type', 'scope', 'roleId', 'existingPlaceholder'].some(key => Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== field[key]) ? crypto.randomUUID() : field.id }));
  }
  async function save() {
    setBusy(true); setError('');
    try {
      await templateRequest(`/versions/${version.id}/fields`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ expectedSchemaRevision: version.schemaRevision || 0, contract: { version: 1, fields } }) });
      await onSaved();
    } catch (error: any) { setError(error.message); } finally { setBusy(false); }
  }
  return <div className="field-configurator"><h3>Configure template fields</h3><p>Map placeholders to existing information or define new inputs. New AI values always require review. Sample values are used only in review documents.</p>
    {error && <p role="alert" className="notice">{error}</p>}
    {fields.map((field, index) => <fieldset key={field.placeholder}><legend>&lt;{field.placeholder}&gt;</legend>
      {(version.inspection?.occurrences || []).filter(item => fieldName(item.placeholder) === fieldName(field.placeholder)).slice(0, 3).map((item, i) => <p className="field-context" key={i}>{item.text} <small>({item.part}{item.supported ? '' : ' — unsupported location'})</small></p>)}
      <label>Data source<select aria-label={`${field.placeholder} data source`} value={field.existingPlaceholder || ''} onChange={event => { const target = catalog.find(item => item.placeholder === event.target.value); update(index, target ? { existingPlaceholder: target.placeholder, type: target.type, scope: target.scope, roleId: target.roleId, extractionEnabled: false } : { existingPlaceholder: undefined, extractionEnabled: true }); }}><option value="">Create a new field</option>{catalog.map(item => <option key={item.placeholder} value={item.placeholder}>{item.label} — &lt;{item.placeholder}&gt;</option>)}</select></label>
      <div className="field-config-grid">
        <label>Label<input aria-label={`${field.placeholder} label`} value={field.label} onChange={event => update(index, { label: event.target.value })} /></label>
        <label>Field type<select aria-label={`${field.placeholder} field type`} disabled={!!field.existingPlaceholder} value={field.type} onChange={event => update(index, { type: event.target.value as any, sampleValue: event.target.value === 'boolean' ? 'true' : event.target.value === 'date' ? '2026-10-13' : event.target.value === 'currency' || event.target.value === 'number' ? '1000' : 'SAMPLE VALUE' })}>{['text', 'multiline', 'number', 'currency', 'date', 'dropdown', 'boolean'].map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Scope<select aria-label={`${field.placeholder} scope`} disabled={!!field.existingPlaceholder} value={field.scope === 'party' ? field.roleId : field.scope} onChange={event => update(index, event.target.value === 'vendor' || event.target.value === 'purchaser' ? { scope: 'party', roleId: event.target.value } : { scope: event.target.value as any, roleId: undefined })}><option value="transaction">Whole deed</option><option value="property">Each property</option><option value="vendor">Each vendor</option><option value="purchaser">Each purchaser</option></select></label>
        <label>Sample value<input aria-label={`${field.placeholder} sample value`} value={field.sampleValue} onChange={event => update(index, { sampleValue: event.target.value })} /></label>
      </div>
      {field.type === 'dropdown' && <label>Choices (one per line)<textarea value={field.options.join('\n')} onChange={event => update(index, { options: event.target.value.split('\n') })} /></label>}
      <label>Help text<input value={field.help} onChange={event => update(index, { help: event.target.value })} /></label>
      <label className="template-review"><input type="checkbox" checked={field.required} onChange={event => update(index, { required: event.target.checked })} />Required when this placeholder's document section is used</label>
      {!field.existingPlaceholder && <><label className="template-review"><input type="checkbox" checked={field.extractionEnabled} onChange={event => update(index, { extractionEnabled: event.target.checked })} />Extract from uploaded evidence, with user review</label>
        {field.extractionEnabled && <><label>Describe the fact to extract<input value={field.extractionDescription} onChange={event => update(index, { extractionDescription: event.target.value })} /></label><label>Evidence meaning<select value={field.evidenceContext} onChange={event => update(index, { evidenceContext: event.target.value as any })}><option value="current">Current transaction / current fact</option><option value="historical">Historical fact is allowed</option></select></label></>}
      </>}
    </fieldset>)}
    {!fields.length && <p>No unfamiliar placeholders were found.</p>}
    <button disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save field configuration'}</button>
  </div>;
}
