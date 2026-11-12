import React, { useState } from 'react';
import { PartyDetails, Witnesses } from '../types';
import { UserCheck, Users, Briefcase, Calendar, MapPin, Plus, Trash2, Sparkles, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { parseDocumentFile } from '../services/sketchAiService';
import mammoth from 'mammoth';

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

  const handleDocumentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    setExtractedFeedback(null);
    try {
      let textContent = '';
      if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        textContent = result.value;
      }

      let base64 = undefined;
      if (!textContent) {
        const reader = new FileReader();
        base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      const extracted = await parseDocumentFile(base64, mimeType, textContent || undefined);
      
      const rawExecs = extracted.executants || (Array.isArray(extracted.executant) ? extracted.executant : (extracted.executant ? [extracted.executant] : []));
      const rawClaims = extracted.claimants || (Array.isArray(extracted.claimant) ? extracted.claimant : (extracted.claimant ? [extracted.claimant] : []));
      
      const validExecs: PartyDetails[] = rawExecs
        .filter((item) => item && (item.name?.trim() || item.relativeName?.trim()))
        .map((item) => ({
          name: item.name?.trim() || '',
          relation: item.relation?.trim() || 'S/o',
          relativeName: item.relativeName?.trim() || '',
          age: item.age !== undefined && item.age !== null ? String(item.age).trim() : '',
          occupation: item.occupation?.trim() || '',
          address: item.address?.trim() || '',
        }));

      const validClaims: PartyDetails[] = rawClaims
        .filter((item) => item && (item.name?.trim() || item.relativeName?.trim()))
        .map((item) => ({
          name: item.name?.trim() || '',
          relation: item.relation?.trim() || 'S/o',
          relativeName: item.relativeName?.trim() || '',
          age: item.age !== undefined && item.age !== null ? String(item.age).trim() : '',
          occupation: item.occupation?.trim() || '',
          address: item.address?.trim() || '',
        }));

      if (onApplyExtractedData) {
        onApplyExtractedData(extracted);
      } else {
        if (validExecs.length > 0) onExecutantChange(validExecs);
        if (validClaims.length > 0) onClaimantChange(validClaims);
      }

      setExtractedFeedback(
        `సంగ్రహించబడ్డాయి: ${validExecs.length || (extracted.executant ? 1 : 0)} Executants, ${validClaims.length || (extracted.claimant ? 1 : 0)} Claimants Auto-Filled!`
      );
    } catch (err: any) {
      alert('డ్యాక్యుమెంట్ పార్సింగ్ విఫలమైంది: ' + (err.message || 'Error'));
    } finally {
      setIsUploadingDoc(false);
      e.target.value = '';
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
          {parties.map((p, index) => (
            <div key={index} className="space-y-4 relative p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
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

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder={`e.g. ${isExec ? 'CHINTA RAJESH' : 'GUNDA LAXMI'}`}
                  value={p.name}
                  onChange={(e) => updateParty(parties, index, 'name', e.target.value, setter)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-medium text-slate-900 uppercase"
                />
              </div>

              {/* Relation & Relative Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Relation / Spouse
                  </label>
                  <select
                    value={p.relation}
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

              {/* Age & Occupation */}
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

              {/* Address */}
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
          ))}

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
