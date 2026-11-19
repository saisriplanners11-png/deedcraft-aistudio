import React, { useState } from 'react';
import { PartyDetails, Witnesses } from '../types';
import { UserCheck, Users, Briefcase, Calendar, MapPin, Plus, Trash2, Sparkles, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { parseDocumentFile } from '../services/sketchAiService';
import { planDocumentInput } from '../../../plan-document-input';

interface PartiesFormProps {
  executant: PartyDetails[];
  claimant: PartyDetails[];
  witnesses: Witnesses;
  onExecutantChange: (updated: PartyDetails[]) => void;
  onClaimantChange: (updated: PartyDetails[]) => void;
  onWitnessesChange: (updated: Witnesses) => void;
  onApplyExtractedData?: (extracted: any) => void;
}

const RELATION_OPTIONS = [
  { value: 'S/o', label: 'S/o (Son of)' },
  { value: 'W/o', label: 'W/o (Wife of)' },
  { value: 'D/o', label: 'D/o (Daughter of)' },
  { value: 'C/o', label: 'C/o (Care of)' },
  { value: 'Rep. by', label: 'Rep. by (Represented by)' },
];

const getOrdinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const getEmptyParty = (): PartyDetails => ({
  name: '',
  relation: 'S/o',
  relativeName: '',
  age: '',
  occupation: '',
  address: '',
});

export const PartiesForm: React.FC<PartiesFormProps> = ({
  executant,
  claimant,
  witnesses,
  onExecutantChange,
  onClaimantChange,
  onWitnessesChange,
  onApplyExtractedData,
}) => {
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [extractedFeedback, setExtractedFeedback] = useState<string | null>(null);

  const documentRead = React.useRef<AbortController | null>(null);
  const applyDocument = React.useRef(onApplyExtractedData);
  applyDocument.current = onApplyExtractedData;
  React.useEffect(() => () => documentRead.current?.abort(), []);

  const handleDocumentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    documentRead.current?.abort();
    const controller = new AbortController();
    documentRead.current = controller;
    setIsUploadingDoc(true);
    setExtractedFeedback(null);
    try {
      const input = await planDocumentInput(file, controller.signal);
      const extracted = await parseDocumentFile(input, 'parties', controller.signal);
      if (controller.signal.aborted) return;
      
      const rawExecs = extracted.executants || (Array.isArray(extracted.executant) ? extracted.executant : (extracted.executant ? [extracted.executant] : []));
      const rawClaims = extracted.claimants || (Array.isArray(extracted.claimant) ? extracted.claimant : (extracted.claimant ? [extracted.claimant] : []));
      
      const validExecs: PartyDetails[] = rawExecs
        .filter((item) => item && (item.name?.trim() || item.relativeName?.trim()))
        .map((item) => ({
          partyType: item.partyType || 'individual',
          name: item.name?.trim() || '',
          relation: item.relation?.trim() || '',
          relativeName: item.relativeName?.trim() || '',
          age: item.age !== undefined && item.age !== null ? String(item.age).trim() : '',
          occupation: item.occupation?.trim() || '',
          address: item.address?.trim() || '',
          representativeType: item.representativeType || '',
          representativeName: item.representativeName || '',
          representativeRelation: item.representativeRelation || 'S/o',
          representativeRelativeName: item.representativeRelativeName || '',
          representativeAge: item.representativeAge ? String(item.representativeAge).trim() : '',
          representativeOccupation: item.representativeOccupation || '',
          representativeAddress: item.representativeAddress || '',
          gpaDocDetails: item.gpaDocDetails || '',
          companyRegNo: item.companyRegNo || '',
        }));

      const validClaims: PartyDetails[] = rawClaims
        .filter((item) => item && (item.name?.trim() || item.relativeName?.trim()))
        .map((item) => ({
          partyType: item.partyType || 'individual',
          name: item.name?.trim() || '',
          relation: item.relation?.trim() || '',
          relativeName: item.relativeName?.trim() || '',
          age: item.age !== undefined && item.age !== null ? String(item.age).trim() : '',
          occupation: item.occupation?.trim() || '',
          address: item.address?.trim() || '',
          representativeType: item.representativeType || '',
          representativeName: item.representativeName || '',
          representativeRelation: item.representativeRelation || 'S/o',
          representativeRelativeName: item.representativeRelativeName || '',
          representativeAge: item.representativeAge ? String(item.representativeAge).trim() : '',
          representativeOccupation: item.representativeOccupation || '',
          representativeAddress: item.representativeAddress || '',
          gpaDocDetails: item.gpaDocDetails || '',
          companyRegNo: item.companyRegNo || '',
        }));

      if (applyDocument.current) {
        applyDocument.current(extracted);
      } else {
        if (validExecs.length > 0) onExecutantChange(validExecs);
        if (validClaims.length > 0) onClaimantChange(validClaims);
      }

      setExtractedFeedback(
        `సంగ్రహించబడ్డాయి: ${validExecs.length || (extracted.executant ? 1 : 0)} Executants, ${validClaims.length || (extracted.claimant ? 1 : 0)} Claimants Auto-Filled!`
      );
    } catch (err: any) {
      if (controller.signal.aborted) return;
      alert('డ్యాక్యుమెంట్ పార్సింగ్ విఫలమైంది: ' + (err.message || 'Error'));
    } finally {
      if (documentRead.current === controller) {
        documentRead.current = null;
        setIsUploadingDoc(false);
        e.target.value = '';
      }
    }
  };

  const updateParty = (list: PartyDetails[], index: number, field: keyof PartyDetails, value: string, setter: (updated: PartyDetails[]) => void) => {
    const updated = [...list];
    updated[index] = { ...updated[index], [field]: value };
    setter(updated);
  };

  const addParty = (list: PartyDetails[], setter: (updated: PartyDetails[]) => void) => {
    setter([...list, getEmptyParty()]);
  };

  const removeParty = (list: PartyDetails[], index: number, setter: (updated: PartyDetails[]) => void) => {
    if (list.length <= 1) {
      setter([getEmptyParty()]);
    } else {
      setter(list.filter((_, i) => i !== index));
    }
  };

  const renderPartyList = (parties: PartyDetails[], type: 'executant' | 'claimant', title: string, subtitle: string, Icon: React.ElementType, iconBg: string, iconColor: string) => {
    const isExec = type === 'executant';
    const setter = isExec ? onExecutantChange : onClaimantChange;
    const roleName = isExec ? 'Executant / Seller' : 'Claimant / Purchaser';

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 ${iconBg} ${iconColor} rounded-lg`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
                <span className="text-[10px] font-extrabold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                  Total: {parties.length}
                </span>
              </div>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {parties.map((p, index) => {
            const pType = p.partyType || 'individual';

            return (
              <div key={index} className="space-y-4 relative p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-800 bg-white border border-slate-200 px-2.5 py-0.5 rounded shadow-2xs">
                      {getOrdinal(index + 1)} {roleName} Details
                    </span>
                    {index === 0 && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                        Primary
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {parties.length > 1 && (
                      <button
                        type="button"
                        title={`Remove ${roleName} ${index + 1}`}
                        onClick={() => removeParty(parties, index, setter)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 rounded-md transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                    {parties.length === 1 && (
                      <button
                        type="button"
                        title="Clear details"
                        onClick={() => removeParty(parties, index, setter)}
                        className="px-2 py-1 text-[10px] text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Party Type Selector */}
                <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Select Party Category / Type (పార్టీ కేటగిరీ రకము):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-1.5 text-[11px]">
                    {[
                      { id: 'individual', label: '1. Individual / Principal', sub: 'సాధారణ / యజమాని' },
                      { id: 'gpa_attorney', label: '2. GPA / Attorney', sub: 'అటోర్నీ / GPA' },
                      { id: 'minor_guardian', label: '3. Minor & Guardian', sub: 'మైనర్ & సంరక్షకుడు' },
                      { id: 'company', label: '4. Pvt Ltd / Company', sub: 'కంపెనీ' },
                      { id: 'society', label: '5. Society / Trust', sub: 'సొసైటీ / ట్రస్ట్' },
                      { id: 'firm', label: '6. Firm / Partnership', sub: 'ఫర్మ్ / భాగస్వామ్యం' },
                    ].map((t) => {
                      const isSelected = pType === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => updateParty(parties, index, 'partyType', t.id as any, setter)}
                          className={`px-2 py-1.5 rounded-md border text-left flex flex-col justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-rose-600 text-white border-rose-600 font-bold shadow-2xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                          }`}
                        >
                          <span className="text-[10.5px] leading-tight">{t.label}</span>
                          <span className={`text-[9px] ${isSelected ? 'text-rose-100' : 'text-slate-500'}`}>{t.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* FORM FIELDS BY PARTY TYPE */}

                {/* 1. INDIVIDUAL / PRINCIPAL */}
                {pType === 'individual' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Full Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder={`e.g. ${isExec ? 'CHINTA RAJESH' : 'GUNDA LAXMI'}`}
                        value={p.name}
                        onChange={(e) => updateParty(parties, index, 'name', e.target.value, setter)}
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-900 uppercase"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Relation
                        </label>
                        <select
                          value={p.relation || 'S/o'}
                          onChange={(e) => updateParty(parties, index, 'relation', e.target.value, setter)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-800"
                        >
                          {RELATION_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Relative Name <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Father's / Husband's Name"
                          value={p.relativeName}
                          onChange={(e) => updateParty(parties, index, 'relativeName', e.target.value, setter)}
                          className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-900 uppercase"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Age (Years)
                        </label>
                        <div className="relative">
                          <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="number"
                            placeholder="e.g. 38"
                            value={p.age}
                            onChange={(e) => updateParty(parties, index, 'age', e.target.value, setter)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-900"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Occupation
                        </label>
                        <div className="relative">
                          <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            placeholder="e.g. Business / Agriculture / Housewife"
                            value={p.occupation}
                            onChange={(e) => updateParty(parties, index, 'occupation', e.target.value, setter)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-900"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Full Residential Address
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <textarea
                          rows={2}
                          placeholder="H.No, Street, Village/Town, Mandal, District"
                          value={p.address}
                          onChange={(e) => updateParty(parties, index, 'address', e.target.value, setter)}
                          className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-900 uppercase"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. GPA / ATTORNEY */}
                {pType === 'gpa_attorney' && (
                  <div className="space-y-4 bg-amber-50/50 p-3.5 rounded-lg border border-amber-200">
                    <div className="space-y-3 pb-3 border-b border-amber-200">
                      <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block">
                        A. Principal / Property Owner Details (ప్రధాన ఆస్తి యజమాని):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700">Principal Owner Name</label>
                          <input
                            type="text"
                            placeholder="e.g. VEMULA RAMA RAO"
                            value={p.name}
                            onChange={(e) => updateParty(parties, index, 'name', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Relation & Relative</label>
                          <div className="flex gap-1">
                            <select
                              value={p.relation || 'S/o'}
                              onChange={(e) => updateParty(parties, index, 'relation', e.target.value, setter)}
                              className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium"
                            >
                              <option value="S/o">S/o</option>
                              <option value="W/o">W/o</option>
                              <option value="D/o">D/o</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Father/Husband"
                              value={p.relativeName}
                              onChange={(e) => updateParty(parties, index, 'relativeName', e.target.value, setter)}
                              className="w-full px-2 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Principal Age</label>
                          <input
                            type="number"
                            placeholder="e.g. 52"
                            value={p.age}
                            onChange={(e) => updateParty(parties, index, 'age', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700">Principal Address</label>
                          <input
                            type="text"
                            placeholder="H.No, Village, Mandal, District"
                            value={p.address}
                            onChange={(e) => updateParty(parties, index, 'address', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block">
                        B. G.P.A. Holder / Attorney Details (అటోర్నీ / GPA పొందిన వ్యక్తి):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700">Attorney / GPA Holder Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. KOTHA SRINIVAS"
                            value={p.representativeName || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeName', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-amber-300 rounded-md font-medium uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">GPA Holder Relative</label>
                          <div className="flex gap-1">
                            <select
                              value={p.representativeRelation || 'S/o'}
                              onChange={(e) => updateParty(parties, index, 'representativeRelation', e.target.value, setter)}
                              className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium"
                            >
                              <option value="S/o">S/o</option>
                              <option value="W/o">W/o</option>
                              <option value="D/o">D/o</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Relative Name"
                              value={p.representativeRelativeName || ''}
                              onChange={(e) => updateParty(parties, index, 'representativeRelativeName', e.target.value, setter)}
                              className="w-full px-2 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">GPA Holder Age</label>
                          <input
                            type="number"
                            placeholder="e.g. 40"
                            value={p.representativeAge || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeAge', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">GPA Holder Occupation</label>
                          <input
                            type="text"
                            placeholder="e.g. Business"
                            value={p.representativeOccupation || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeOccupation', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">GPA Registration Doc Info</label>
                          <input
                            type="text"
                            placeholder="e.g. Doc No. 1234/2023 of SRO Sircilla"
                            value={p.gpaDocDetails || ''}
                            onChange={(e) => updateParty(parties, index, 'gpaDocDetails', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-amber-300 rounded-md font-medium uppercase"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700">GPA Holder Address</label>
                        <input
                          type="text"
                          placeholder="H.No, Village, Mandal, District"
                          value={p.representativeAddress || ''}
                          onChange={(e) => updateParty(parties, index, 'representativeAddress', e.target.value, setter)}
                          className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. MINOR & GUARDIAN */}
                {pType === 'minor_guardian' && (
                  <div className="space-y-4 bg-blue-50/50 p-3.5 rounded-lg border border-blue-200">
                    <div className="space-y-3 pb-3 border-b border-blue-200">
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                        A. Minor Details (మైనర్ వివరాలు):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700">Minor Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. KOTHA RAHUL"
                            value={p.name}
                            onChange={(e) => updateParty(parties, index, 'name', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-blue-300 rounded-md font-medium uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Minor Age (Years)</label>
                          <input
                            type="number"
                            placeholder="e.g. 12"
                            value={p.age}
                            onChange={(e) => updateParty(parties, index, 'age', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                        B. Natural / Legal Guardian Details (సంరక్షకుని వివరాలు):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Guardian Relation Title</label>
                          <select
                            value={p.representativeType || 'Natural Guardian & Father'}
                            onChange={(e) => updateParty(parties, index, 'representativeType', e.target.value, setter)}
                            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium"
                          >
                            <option value="Natural Guardian & Father">Natural Guardian & Father (తండ్రి)</option>
                            <option value="Natural Guardian & Mother">Natural Guardian & Mother (తల్లి)</option>
                            <option value="Legal Guardian">Legal Guardian (లీగల్ గార్డియన్)</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700">Guardian Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. KOTHA SRINIVAS"
                            value={p.representativeName || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeName', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-blue-300 rounded-md font-medium uppercase"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Guardian Relative</label>
                          <div className="flex gap-1">
                            <select
                              value={p.representativeRelation || 'S/o'}
                              onChange={(e) => updateParty(parties, index, 'representativeRelation', e.target.value, setter)}
                              className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium"
                            >
                              <option value="S/o">S/o</option>
                              <option value="W/o">W/o</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Father Name"
                              value={p.representativeRelativeName || ''}
                              onChange={(e) => updateParty(parties, index, 'representativeRelativeName', e.target.value, setter)}
                              className="w-full px-2 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Guardian Age</label>
                          <input
                            type="number"
                            placeholder="e.g. 42"
                            value={p.representativeAge || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeAge', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Guardian Occupation</label>
                          <input
                            type="text"
                            placeholder="e.g. Business"
                            value={p.representativeOccupation || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeOccupation', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700">Residential Address</label>
                        <input
                          type="text"
                          placeholder="H.No, Village, Mandal, District"
                          value={p.address}
                          onChange={(e) => updateParty(parties, index, 'address', e.target.value, setter)}
                          className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. COMPANY / PVT LTD */}
                {pType === 'company' && (
                  <div className="space-y-4 bg-indigo-50/50 p-3.5 rounded-lg border border-indigo-200">
                    <div className="space-y-3 pb-3 border-b border-indigo-200">
                      <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider block">
                        A. Company Details (ప్రైవేట్ లిమిటెడ్ కంపెనీ వివరాలు):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700">Company Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. M/S SRI RAMA CONSTRUCTIONS PRIVATE LIMITED"
                            value={p.name}
                            onChange={(e) => updateParty(parties, index, 'name', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-indigo-300 rounded-md font-medium uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">CIN / Registration No.</label>
                          <input
                            type="text"
                            placeholder="e.g. CIN: U12345TG2020PTC123456"
                            value={p.companyRegNo || ''}
                            onChange={(e) => updateParty(parties, index, 'companyRegNo', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700">Registered Office Address</label>
                        <input
                          type="text"
                          placeholder="Registered Office Address"
                          value={p.address}
                          onChange={(e) => updateParty(parties, index, 'address', e.target.value, setter)}
                          className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider block">
                        B. Authorized Representative / Director (ప్రతినిధి / డైరెక్టర్):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Designation</label>
                          <select
                            value={p.representativeType || 'Managing Director'}
                            onChange={(e) => updateParty(parties, index, 'representativeType', e.target.value, setter)}
                            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium"
                          >
                            <option value="Managing Director">Managing Director (మేనేజింగ్ డైరెక్టర్)</option>
                            <option value="Director">Director (డైరెక్టర్)</option>
                            <option value="Authorized Signatory">Authorized Signatory (ప్రతినిధి)</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700">Director Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. VEMULA RAMA RAO"
                            value={p.representativeName || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeName', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-indigo-300 rounded-md font-medium uppercase"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Director Relative</label>
                          <div className="flex gap-1">
                            <select
                              value={p.representativeRelation || 'S/o'}
                              onChange={(e) => updateParty(parties, index, 'representativeRelation', e.target.value, setter)}
                              className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium"
                            >
                              <option value="S/o">S/o</option>
                              <option value="W/o">W/o</option>
                              <option value="D/o">D/o</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Father/Husband"
                              value={p.representativeRelativeName || ''}
                              onChange={(e) => updateParty(parties, index, 'representativeRelativeName', e.target.value, setter)}
                              className="w-full px-2 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Director Age</label>
                          <input
                            type="number"
                            placeholder="e.g. 45"
                            value={p.representativeAge || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeAge', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Director Address</label>
                          <input
                            type="text"
                            placeholder="Address"
                            value={p.representativeAddress || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeAddress', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. SOCIETY / TRUST */}
                {pType === 'society' && (
                  <div className="space-y-4 bg-emerald-50/50 p-3.5 rounded-lg border border-emerald-200">
                    <div className="space-y-3 pb-3 border-b border-emerald-200">
                      <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
                        A. Society / Trust Details (సొసైటీ / ట్రస్ట్ వివరాలు):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700">Society / Trust Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. SRI SEETHA RAMA EDUCATIONAL SOCIETY"
                            value={p.name}
                            onChange={(e) => updateParty(parties, index, 'name', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-emerald-300 rounded-md font-medium uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Registration No.</label>
                          <input
                            type="text"
                            placeholder="e.g. Regd No. 456/2015"
                            value={p.companyRegNo || ''}
                            onChange={(e) => updateParty(parties, index, 'companyRegNo', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700">Society Address</label>
                        <input
                          type="text"
                          placeholder="Office Address"
                          value={p.address}
                          onChange={(e) => updateParty(parties, index, 'address', e.target.value, setter)}
                          className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
                        B. President / Secretary / Representative Details:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Designation</label>
                          <select
                            value={p.representativeType || 'President'}
                            onChange={(e) => updateParty(parties, index, 'representativeType', e.target.value, setter)}
                            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium"
                          >
                            <option value="President">President (ప్రెసిడెంట్)</option>
                            <option value="Secretary">Secretary (సెక్రటరీ)</option>
                            <option value="Trustee">Trustee (ట్రస్టీ)</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700">Representative Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. VEMULA RAMA RAO"
                            value={p.representativeName || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeName', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-emerald-300 rounded-md font-medium uppercase"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Relative</label>
                          <div className="flex gap-1">
                            <select
                              value={p.representativeRelation || 'S/o'}
                              onChange={(e) => updateParty(parties, index, 'representativeRelation', e.target.value, setter)}
                              className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium"
                            >
                              <option value="S/o">S/o</option>
                              <option value="W/o">W/o</option>
                              <option value="D/o">D/o</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Relative Name"
                              value={p.representativeRelativeName || ''}
                              onChange={(e) => updateParty(parties, index, 'representativeRelativeName', e.target.value, setter)}
                              className="w-full px-2 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Age</label>
                          <input
                            type="number"
                            placeholder="e.g. 50"
                            value={p.representativeAge || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeAge', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Address</label>
                          <input
                            type="text"
                            placeholder="Address"
                            value={p.representativeAddress || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeAddress', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. FIRM / PARTNERSHIP */}
                {pType === 'firm' && (
                  <div className="space-y-4 bg-teal-50/50 p-3.5 rounded-lg border border-teal-200">
                    <div className="space-y-3 pb-3 border-b border-teal-200">
                      <span className="text-xs font-bold text-teal-900 uppercase tracking-wider block">
                        A. Firm / Partnership Details (ఫర్మ్ / భాగస్వామ్య వివరాలు):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700">Firm Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. M/S SAI SRI TRADERS"
                            value={p.name}
                            onChange={(e) => updateParty(parties, index, 'name', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-teal-300 rounded-md font-medium uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Firm Type / Regd Info</label>
                          <input
                            type="text"
                            placeholder="e.g. A Partnership Firm"
                            value={p.companyRegNo || ''}
                            onChange={(e) => updateParty(parties, index, 'companyRegNo', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700">Firm Office Address</label>
                        <input
                          type="text"
                          placeholder="Office Address"
                          value={p.address}
                          onChange={(e) => updateParty(parties, index, 'address', e.target.value, setter)}
                          className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-xs font-bold text-teal-900 uppercase tracking-wider block">
                        B. Managing Partner / Representative Details:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Designation</label>
                          <select
                            value={p.representativeType || 'Managing Partner'}
                            onChange={(e) => updateParty(parties, index, 'representativeType', e.target.value, setter)}
                            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium"
                          >
                            <option value="Managing Partner">Managing Partner (మేనేజింగ్ పార్ట్‌నర్)</option>
                            <option value="Partner">Partner (పార్ట్‌నర్)</option>
                            <option value="Proprietor">Proprietor (ప్రోప్రైటర్)</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700">Partner Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. KOTHA SRINIVAS"
                            value={p.representativeName || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeName', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-teal-300 rounded-md font-medium uppercase"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Relative</label>
                          <div className="flex gap-1">
                            <select
                              value={p.representativeRelation || 'S/o'}
                              onChange={(e) => updateParty(parties, index, 'representativeRelation', e.target.value, setter)}
                              className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium"
                            >
                              <option value="S/o">S/o</option>
                              <option value="W/o">W/o</option>
                              <option value="D/o">D/o</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Relative Name"
                              value={p.representativeRelativeName || ''}
                              onChange={(e) => updateParty(parties, index, 'representativeRelativeName', e.target.value, setter)}
                              className="w-full px-2 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Age</label>
                          <input
                            type="number"
                            placeholder="e.g. 40"
                            value={p.representativeAge || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeAge', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">Address</label>
                          <input
                            type="text"
                            placeholder="Address"
                            value={p.representativeAddress || ''}
                            onChange={(e) => updateParty(parties, index, 'representativeAddress', e.target.value, setter)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-medium uppercase"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Bottom Add Party Button */}
          <button
            type="button"
            onClick={() => addParty(parties, setter)}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-dashed border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Another {isExec ? 'Executant / Seller (2A)' : 'Claimant / Purchaser (2B)'}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div id="section-parties-details" className="space-y-6">
      {/* Upload Document Banner for Quick Party Auto-Fill */}
      <div className="bg-gradient-to-r from-amber-50/80 via-rose-50/80 to-indigo-50/80 p-4 rounded-xl border border-amber-200 shadow-2xs space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
            <h3 className="text-xs font-bold text-slate-900">
              Auto-Extract All Executants (2A) & Claimants (2B) from Document
            </h3>
          </div>
          <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
            Multiple Parties Supported
          </span>
        </div>

        <div className="flex items-center gap-3">
          <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-dashed border-amber-300 rounded-lg cursor-pointer hover:bg-amber-50/50 transition-all text-xs font-semibold text-slate-700 shadow-2xs ${isUploadingDoc ? 'opacity-70 pointer-events-none' : ''}`}>
            {isUploadingDoc ? (
              <>
                <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                <span>Extracting all Executants & Claimants from Document...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 text-amber-600" />
                <span>Upload Word (.docx), PDF, or Deed Image to Auto-Fill All Parties (2A & 2B)</span>
              </>
            )}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.rtf,image/jpeg,image/png,image/webp,image/*"
              onChange={handleDocumentFileUpload}
              className="hidden"
              disabled={isUploadingDoc}
            />
          </label>
        </div>

        {extractedFeedback && (
          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{extractedFeedback}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderPartyList(executant, "executant", "2A. Executant / Seller Details", "Party who is executing/selling the property (All joint owners/sellers)", UserCheck, "bg-amber-50", "text-amber-700")}
        {renderPartyList(claimant, "claimant", "2B. Claimant / Purchaser Details", "Party in whose favor the document is executed (All joint purchasers)", Users, "bg-blue-50", "text-blue-700")}
      </div>
    </div>
  );
};
