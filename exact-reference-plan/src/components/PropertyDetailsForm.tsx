import React, { useState } from 'react';
import { PropertyDetails, PropertyType, HouseDetails, BoundaryDimensions } from '../types';
import { calculateSqMtrs, parseDimensionToNumber } from '../utils/dimensionUtils';
import { Calculator, Building, MapPin, Hash, Home, Ruler, Check, CheckSquare, Square, FileText, Sparkles, RefreshCw, Plus, Trash2, Layers, Upload, Loader2 } from 'lucide-react';
import { parseDocumentFile } from '../services/sketchAiService';
import mammoth from 'mammoth';

interface PropertyDetailsFormProps {
  property: PropertyDetails;
  onChange: (updated: PropertyDetails) => void;
  onCalculateArea?: () => void;
  boundaries?: BoundaryDimensions;
  onApplyExtractedData?: (extracted: any) => void;
}

const PROPERTY_TYPES: PropertyType[] = [
  'Open Plot',
  'House',
  'Open Place',
  'Demolished House',
  'Part Open Place',
  'Flat',
  'Commercial Building',
  'Agricultural Land',
  'Other',
];

const LOCALITY_SUGGESTIONS = [
  'Thukkaraopally/Ganeshnagar',
  'Gandhi Nagar',
  'Sri Sai Enclave',
  'Venkateshwara Colony',
  'Balaji Hills',
  'RTC Colony',
  'Teachers Colony',
  'Officers Colony',
  'Green Meadows',
];

const VILLAGE_SUGGESTIONS = [
  'Sircilla',
  'Kompally',
  'Gachibowli',
  'Miyapur',
  'Uppal',
  'Shamshabad',
  'Medchal',
  'Kukatpally',
  'Narsingi',
];

const MANDAL_SUGGESTIONS = [
  'Sircilla',
  'Quthbullapur',
  'Serilingampally',
  'Gandipet',
  'Ghatkesar',
  'Rajendranagar',
  'Medchal',
  'Hayathnagar',
];

const DISTRICT_SUGGESTIONS = [
  'Rajanna Sircilla',
  'Medchal-Malkajgiri',
  'Rangareddy',
  'Hyderabad',
  'Sangareddy',
  'Yadadri Bhuvanagiri',
  'Visakhapatnam',
  'Vijayawada',
];

const parseDimensionValue = (val: string | number | undefined, isMeters: boolean, fallback: number): number => {
  return parseDimensionToNumber(val, isMeters, fallback);
};

export const PropertyDetailsForm: React.FC<PropertyDetailsFormProps> = ({
  property,
  onChange,
  onCalculateArea,
  boundaries,
  onApplyExtractedData,
}) => {
  const [autoAdjustFromSetbacks, setAutoAdjustFromSetbacks] = React.useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = React.useState(false);
  const [extractedInfo, setExtractedInfo] = React.useState<{
    houseNo?: string;
    plotNo?: string;
    surveyNo?: string;
    areaSqYards?: number | string;
    propertyType?: string;
    village?: string;
    executantsCount?: number;
    claimantsCount?: number;
    plinthAreaSqFt?: number | string;
    structureType?: string;
  } | null>(null);

  const handleDocumentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
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
      const validExecCount = rawExecs.filter(e => e && ((e.name && e.name.trim()) || (e.relativeName && e.relativeName.trim()))).length;
      const validClaimCount = rawClaims.filter(c => c && ((c.name && c.name.trim()) || (c.relativeName && c.relativeName.trim()))).length;

      const extractedPlinth = extracted.house?.plinthAreaSqFt || (extracted.houses && extracted.houses.length > 0 ? extracted.houses.reduce((s, h) => s + (h.plinthAreaSqFt || 0), 0) : undefined);
      const extractedStruct = extracted.house?.structureType || extracted.house?.plinthPrefix || (extracted.houses && extracted.houses[0]?.structureType);

      setExtractedInfo({
        houseNo: extracted.houseNo || (extracted.nearHNo ? extracted.nearHNo.match(/([0-9]+[-/][0-9]+(?:[-/][a-zA-Z0-9]+)?)/)?.[1] : undefined),
        plotNo: extracted.plotNo,
        surveyNo: extracted.surveyNo,
        areaSqYards: extracted.areaSqYards,
        propertyType: extracted.propertyType,
        village: extracted.village,
        executantsCount: validExecCount,
        claimantsCount: validClaimCount,
        plinthAreaSqFt: extractedPlinth && extractedPlinth > 0 ? extractedPlinth : undefined,
        structureType: extractedStruct,
      });

      if (onApplyExtractedData) {
        onApplyExtractedData(extracted);
      } else {
        onChange({
          ...property,
          propertyType: (extracted.propertyType as any) || property.propertyType,
          areaSqYards: extracted.areaSqYards || property.areaSqYards,
          surveyNo: extracted.surveyNo || property.surveyNo,
          plotNo: extracted.plotNo || property.plotNo,
          houseNo: extracted.houseNo || property.houseNo,
          houseAuthority: extracted.houseAuthority || property.houseAuthority,
          locationTemplateType: (extracted.locationTemplateType as any) || property.locationTemplateType,
          nearHNo: extracted.nearHNo || property.nearHNo,
          village: extracted.village || property.village,
          mandal: extracted.mandal || property.mandal,
          district: extracted.district || property.district,
        });
      }
    } catch (err: any) {
      alert('డ్యాక్యుమెంట్ పార్సింగ్ విఫలమైంది: ' + (err.message || 'Error'));
    } finally {
      setIsUploadingDoc(false);
      e.target.value = '';
    }
  };
  const isMeters = boundaries?.dimensionUnit === 'Metres';

  // Compute plot boundary spans
  const nPlot = boundaries ? parseDimensionValue(boundaries.northDim.raw || boundaries.northDim.normalized, isMeters, isMeters ? 12.19 : 40) : (isMeters ? 12.19 : 40);
  const sPlot = boundaries ? parseDimensionValue(boundaries.southDim.raw || boundaries.southDim.normalized, isMeters, isMeters ? 12.19 : 40) : (isMeters ? 12.19 : 40);
  const ePlot = boundaries ? parseDimensionValue(boundaries.eastDim.raw || boundaries.eastDim.normalized, isMeters, isMeters ? 18.28 : 60) : (isMeters ? 18.28 : 60);
  const wPlot = boundaries ? parseDimensionValue(boundaries.westDim.raw || boundaries.westDim.normalized, isMeters, isMeters ? 18.28 : 60) : (isMeters ? 18.28 : 60);
  const avgPlotW = Math.round(((nPlot + sPlot) / 2) * 100) / 100;
  const avgPlotL = Math.round(((ePlot + wPlot) / 2) * 100) / 100;

  const formatDimensionStr = (val: number): string => {
    if (!val || val <= 0) return isMeters ? "0" : "0'-0\"";
    if (isMeters) {
      return val.toString();
    }
    const totalInches = Math.round(val * 12);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return inches > 0 ? `${feet}'-${inches}"` : `${feet}'-0"`;
  };
  const handleAreaChange = (val: string) => {
    if (val === '') {
      onChange({
        ...property,
        areaSqYards: '',
        areaSqMtrs: '',
      });
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange({
        ...property,
        areaSqYards: num,
        areaSqMtrs: calculateSqMtrs(num),
      });
    }
  };

  const handleManualCalculate = () => {
    if (property.areaSqYards !== '') {
      const calculated = calculateSqMtrs(property.areaSqYards);
      onChange({
        ...property,
        areaSqMtrs: calculated,
      });
    }
    if (onCalculateArea) onCalculateArea();
  };

  const handlePropertyTypeChange = (newType: PropertyType) => {
    const house = property.house || { enabled: false, widthRaw: '', lengthRaw: '', plinthAreaSqFt: '' };
    onChange({ ...property, propertyType: newType,
      house: { ...house, enabled: newType === 'House' },
      locationTemplateType: newType === 'House' ? (property.plotNo ? 'bearing_and_plot' : 'bearing_only')
        : newType === 'Part Open Place' ? 'part_open_place_hno'
        : newType === 'Demolished House' ? 'demolished_house_hno' : property.locationTemplateType,
    });
  };

  const isHouseLikeType = 
    property.propertyType === 'House' || 
    property.propertyType === 'Part Open Place' || 
    property.propertyType === 'Demolished House';

  const isPlotType = 
    property.propertyType === 'Plot' || 
    property.propertyType === 'Open Plot' || 
    property.propertyType === 'Open Place';

  const computeBearingLocationString = (
    pType: PropertyType,
    hNo: string,
    pNo: string,
    auth: string
  ): string => {
    const rawH = (hNo || '').trim();
    const cleanH = rawH.startsWith('.') ? rawH.substring(1).trim() : rawH;
    const cleanP = (pNo || '').trim();
    const cleanAuth = (auth || 'Municipal Council House No.').trim();

    if (!cleanH && !cleanP) return '';

    const authPrefix = cleanAuth.toLowerCase().startsWith('bearing ') ? cleanAuth : `bearing ${cleanAuth}`;
    const houseStr = cleanH ? (authPrefix.endsWith('.') ? `${authPrefix}${cleanH}` : `${authPrefix}.${cleanH}`) : '';
    if (cleanH && cleanP) {
      return `${houseStr} and in plot no.${cleanP}`;
    } else if (houseStr) {
      return houseStr;
    } else if (cleanP) {
      return `in plot no.${cleanP}`;
    }
    return '';
  };

  const handleUpdatePlotTemplate = (
    tmpl: 'near_adjacent_hno' | 'near_hno' | 'adjacent_hno' | 'opp_hno' | 'beside_hno' | 'part_open_place_hno' | 'demolished_house_hno',
    hVal?: string
  ) => {
    const rawH = hVal !== undefined ? hVal : (property.houseNo || '');
    const clean = rawH.replace(/^(NEAR\/ADJACENT|NEAR|ADJACENT|OPP\.?|BESIDE|BEARING|H\.NO\.?|\s)+/gi, '').trim();
    const hDisplay = clean ? clean : '_______';
    let formatted = '';

    if (tmpl === 'near_adjacent_hno') {
      formatted = `NEAR/ADJACENT H.NO.${hDisplay}`;
    } else if (tmpl === 'adjacent_hno') {
      formatted = `ADJACENT H.NO.${hDisplay}`;
    } else if (tmpl === 'opp_hno') {
      formatted = `OPP. H.NO.${hDisplay}`;
    } else if (tmpl === 'beside_hno') {
      formatted = `BESIDE H.NO.${hDisplay}`;
    } else if (tmpl === 'part_open_place_hno') {
      formatted = `bearing H.No.${hDisplay}`;
    } else if (tmpl === 'demolished_house_hno') {
      formatted = `bearing H.No.${hDisplay}`;
    } else {
      formatted = `NEAR H.NO.${hDisplay}`;
    }

    onChange({
      ...property,
      locationTemplateType: tmpl,
      houseNo: clean,
      nearHNo: formatted,
    });
  };

  const handlePlotHNoChange = (val: string) => {
    const clean = val.replace(/^(NEAR\/ADJACENT|NEAR|ADJACENT|OPP\.?|BESIDE|BEARING|H\.NO\.?|\s)+/gi, '').trim();
    const tmpl = property.locationTemplateType || 'near_adjacent_hno';
    const hDisplay = clean ? clean : (val.trim() ? val.trim() : '_______');
    let formatted = '';

    if (tmpl === 'near_adjacent_hno') {
      formatted = `NEAR/ADJACENT H.NO.${hDisplay}`;
    } else if (tmpl === 'adjacent_hno') {
      formatted = `ADJACENT H.NO.${hDisplay}`;
    } else if (tmpl === 'opp_hno') {
      formatted = `OPP. H.NO.${hDisplay}`;
    } else if (tmpl === 'beside_hno') {
      formatted = `BESIDE H.NO.${hDisplay}`;
    } else if (tmpl === 'part_open_place_hno') {
      formatted = `bearing H.No.${hDisplay} (PART)`;
    } else if (tmpl === 'demolished_house_hno') {
      formatted = `bearing dismantled house H.No.${hDisplay}`;
    } else {
      formatted = `NEAR H.NO.${hDisplay}`;
    }

    onChange({
      ...property,
      houseNo: val,
      nearHNo: formatted,
    });
  };

  const handleHouseNoChange = (val: string) => {
    if (isHouseLikeType) {
      const auth = property.houseAuthority || 'Municipal Council House No.';
      const pNo = property.plotNo || '';
      const formatted = computeBearingLocationString(property.propertyType, val, pNo, auth);
      onChange({
        ...property,
        houseNo: val,
        locationTemplateType: 'bearing_and_plot',
        nearHNo: formatted,
      });
      return;
    }

    onChange({
      ...property,
      houseNo: val,
      nearHNo: val ? (val.toUpperCase().startsWith('NEAR') ? val : `NEAR H.NO. ${val}`) : '',
    });
  };

  const handlePlotNoChange = (val: string) => {
    if (isHouseLikeType) {
      const auth = property.houseAuthority || 'Municipal Council House No.';
      const hNo = property.houseNo || '';
      const formatted = computeBearingLocationString(property.propertyType, hNo, val, auth);
      onChange({
        ...property,
        plotNo: val,
        locationTemplateType: 'bearing_and_plot',
        nearHNo: formatted,
      });
      return;
    }
    
    onChange({
      ...property,
      plotNo: val,
    });
  };

  const handleSurveyNoChange = (val: string) => {
    onChange({
      ...property,
      surveyNo: val,
    });
  };

  const getHousesList = (): HouseDetails[] => {
    if (property.houses && property.houses.length > 0) {
      return property.houses;
    }
    if (property.house) {
      return [property.house];
    }
    return [{ id: 'house-1', name: '', position: 'center', enabled: property.propertyType === 'House',
      widthRaw: '', lengthRaw: '', structureType: '', roofType: '', plinthAreaSqFt: '',
      setbackNorth: '', setbackSouth: '', setbackEast: '', setbackWest: '', showMeasurements: true, showSetbacks: true }];
  };

  const handleHouseItemUpdate = (index: number, patch: Partial<HouseDetails>) => {
    const list = [...getHousesList()];
    const current = list[index] || {
      id: `house-${index + 1}`,
      name: '',
      position: index === 0 ? 'center' : (index === 1 ? 'east' : 'west'),
      enabled: true,
      widthFeet: 24,
      lengthFeet: 36,
      widthRaw: "24'-0\"",
      lengthRaw: "36'-0\"",
      structureType: 'R.C.C. Building',
      roofType: 'R.C.C. Slab',
      plinthAreaSqFt: 864,
      plinthAreaSqYds: 96,
      showMeasurements: true,
      showSetbacks: true,
      setbackNorth: "12'-0\"",
      setbackSouth: "12'-0\"",
      setbackEast: "8'-0\"",
      setbackWest: "8'-0\"",
    };

    const updated: HouseDetails = { ...current, ...patch };

    // If setback was changed and autoAdjustFromSetbacks is active, recalculate house dimensions
    if (autoAdjustFromSetbacks) {
      if ('setbackWest' in patch || 'setbackEast' in patch) {
        const sbW = parseDimensionValue(updated.setbackWest, isMeters, 0);
        const sbE = parseDimensionValue(updated.setbackEast, isMeters, 0);
        const newW = Math.max(isMeters ? 1.83 : 6, Math.round((avgPlotW - sbW - sbE) * 100) / 100);
        updated.widthFeet = newW;
        updated.widthRaw = formatDimensionStr(newW);
      }
      if ('setbackNorth' in patch || 'setbackSouth' in patch) {
        const sbN = parseDimensionValue(updated.setbackNorth, isMeters, 0);
        const sbS = parseDimensionValue(updated.setbackSouth, isMeters, 0);
        const newL = Math.max(isMeters ? 1.83 : 6, Math.round((avgPlotL - sbN - sbS) * 100) / 100);
        updated.lengthFeet = newL;
        updated.lengthRaw = formatDimensionStr(newL);
      }
    }

    // Recompute plinth area if width or length changed
    if ('widthRaw' in patch || 'lengthRaw' in patch || 'widthFeet' in patch || 'lengthFeet' in patch) {
      const w = parseDimensionValue(updated.widthRaw || updated.widthFeet, isMeters, isMeters ? 7.32 : 24);
      const l = parseDimensionValue(updated.lengthRaw || updated.lengthFeet, isMeters, isMeters ? 10.97 : 36);
      updated.widthFeet = Math.round(w * 100) / 100;
      updated.lengthFeet = Math.round(l * 100) / 100;
      
      const area = Math.round(w * l * 100) / 100;
      if (isMeters) {
        updated.plinthAreaSqMtrs = area;
        updated.plinthAreaSqFt = Math.round(area / 0.092903 * 100) / 100;
        updated.plinthAreaSqYds = Math.round(area * 1.19599 * 100) / 100;
      } else {
        updated.plinthAreaSqFt = area;
        updated.plinthAreaSqMtrs = Math.round(area * 0.092903 * 100) / 100;
        updated.plinthAreaSqYds = Math.round((area / 9) * 100) / 100;
      }
    }

    list[index] = updated;

    onChange({
      ...property,
      house: list[0],
      houses: list,
    });
  };

  const handleHouseUpdate = (patch: Partial<HouseDetails>) => {
    handleHouseItemUpdate(0, patch);
  };

  const handleAddHouse = () => {
    const list = [...getHousesList()];
    const newIdx = list.length;
    const defaultPositions: Array<HouseDetails['position']> = [
      'center', 'east', 'west', 'north', 'south', 'north-west', 'north-east', 'south-west', 'south-east'
    ];
    const newPos = defaultPositions[newIdx] || 'custom';

    const defaultHouseW = Math.max(isMeters ? 3 : 10, Math.round(avgPlotW * 0.36));
    const defaultHouseL = Math.max(isMeters ? 3.6 : 12, Math.round(avgPlotL * 0.38));
    const wRaw = isMeters ? `${defaultHouseW}` : `${defaultHouseW}'-0"`;
    const lRaw = isMeters ? `${defaultHouseL}` : `${defaultHouseL}'-0"`;
    const area = defaultHouseW * defaultHouseL;

    const newHouse: HouseDetails = {
      id: `house-${Date.now()}`,
      name: '',
      position: newPos,
      enabled: true,
      widthFeet: defaultHouseW,
      lengthFeet: defaultHouseL,
      widthRaw: wRaw,
      lengthRaw: lRaw,
      structureType: 'R.C.C. Building',
      roofType: 'R.C.C. Slab',
      plinthPrefix: 'R.C.C.',
      plinthAreaSqFt: isMeters ? Math.round(area / 0.092903 * 100) / 100 : area,
      plinthAreaSqYds: isMeters ? Math.round(area * 1.19599 * 100) / 100 : Math.round((area / 9) * 100) / 100,
      showMeasurements: true,
      showSetbacks: false,
      setbackNorth: isMeters ? "2.00" : "6'-0\"",
      setbackSouth: isMeters ? "2.00" : "6'-0\"",
      setbackEast: isMeters ? "1.50" : "5'-0\"",
      setbackWest: isMeters ? "1.50" : "5'-0\"",
    };

    list.push(newHouse);
    onChange({
      ...property,
      house: list[0],
      houses: list,
    });
  };

  const handleRemoveHouse = (index: number) => {
    const list = [...getHousesList()];
    if (list.length <= 1) {
      list[0] = { ...list[0], enabled: false };
      onChange({
        ...property,
        house: list[0],
        houses: list,
      });
      return;
    }
    list.splice(index, 1);
    onChange({
      ...property,
      house: list[0],
      houses: list,
    });
  };

  const handleAutoCalcHouseFromSetbacks = (index: number = 0) => {
    const list = getHousesList();
    const current = list[index] || property.house || {};
    const sbN = parseDimensionValue(current.setbackNorth, isMeters, isMeters ? 3.66 : 12);
    const sbS = parseDimensionValue(current.setbackSouth, isMeters, isMeters ? 3.66 : 12);
    const sbW = parseDimensionValue(current.setbackWest, isMeters, isMeters ? 2.44 : 8);
    const sbE = parseDimensionValue(current.setbackEast, isMeters, isMeters ? 2.44 : 8);

    const calcW = Math.max(isMeters ? 1.83 : 6, Math.round((avgPlotW - sbW - sbE) * 100) / 100);
    const calcL = Math.max(isMeters ? 1.83 : 6, Math.round((avgPlotL - sbN - sbS) * 100) / 100);
    const area = Math.round(calcW * calcL * 100) / 100;

    let plinthAreaSqFt, plinthAreaSqMtrs, plinthAreaSqYds;
    if (isMeters) {
      plinthAreaSqMtrs = area;
      plinthAreaSqFt = Math.round(area / 0.092903 * 100) / 100;
      plinthAreaSqYds = Math.round(area * 1.19599 * 100) / 100;
    } else {
      plinthAreaSqFt = area;
      plinthAreaSqMtrs = Math.round(area * 0.092903 * 100) / 100;
      plinthAreaSqYds = Math.round((area / 9) * 100) / 100;
    }

    handleHouseItemUpdate(index, {
      widthFeet: calcW,
      widthRaw: formatDimensionStr(calcW),
      lengthFeet: calcL,
      lengthRaw: formatDimensionStr(calcL),
      plinthAreaSqFt,
      plinthAreaSqMtrs,
      plinthAreaSqYds,
    });
  };

  const handleAutoBalanceSetbacks = (index: number = 0) => {
    const list = getHousesList();
    const current = list[index] || property.house || {};
    const w = parseDimensionValue(current.widthRaw || current.widthFeet, isMeters, isMeters ? 7.32 : 24);
    const l = parseDimensionValue(current.lengthRaw || current.lengthFeet, isMeters, isMeters ? 10.97 : 36);

    const remW = Math.max(0, avgPlotW - w);
    const remL = Math.max(0, avgPlotL - l);

    const sideW = Math.round((remW / 2) * 100) / 100;
    const sideL = Math.round((remL / 2) * 100) / 100;

    handleHouseItemUpdate(index, {
      setbackWest: formatDimensionStr(sideW),
      setbackEast: formatDimensionStr(sideW),
      setbackNorth: formatDimensionStr(sideL),
      setbackSouth: formatDimensionStr(sideL),
    });
  };

  const currentHouses = getHousesList();
  const activeHousesList = currentHouses.filter(h => h.enabled !== false);
  const isHouseActive = property.propertyType === 'House' || activeHousesList.length > 0;

  return (
    <div id="section-property-details" className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">1. Property Details</h2>
            <p className="text-xs text-slate-500">Core property classification, measurements, and location hierarchy</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Property Type */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Property Type <span className="text-rose-600">*</span>
          </label>
          <select
            id="input-property-type"
            value={property.propertyType}
            onChange={(e) => handlePropertyTypeChange(e.target.value as PropertyType)}
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all font-medium text-slate-800"
          >
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {property.propertyType === 'Other' && (
            <input
              type="text"
              id="input-custom-property-type"
              placeholder="Specify custom type (e.g. Commercial Shed)"
              value={property.customPropertyType || ''}
              onChange={(e) =>
                onChange({
                  ...property,
                  customPropertyType: e.target.value,
                })
              }
              className="mt-2 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          )}
        </div>

        {/* Upload Deed / Document (Word, DOCX, DOC, PDF, Images) for Auto-Fill */}
        <div className="space-y-1.5 md:col-span-3 bg-gradient-to-r from-rose-50/75 to-indigo-50/75 p-3.5 rounded-xl border border-rose-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-rose-600 animate-pulse" />
              Upload Deed / Property Document (Word, DOCX, PDF, Scan Images) for Auto-Fill
            </label>
            <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">
              AI Auto-Fill Engine
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-dashed border-rose-300 rounded-lg cursor-pointer hover:bg-rose-50/50 transition-all text-xs font-semibold text-slate-700 shadow-2xs ${isUploadingDoc ? 'opacity-70 pointer-events-none' : ''}`}>
              {isUploadingDoc ? (
                <>
                  <Loader2 className="w-4 h-4 text-rose-600 animate-spin" />
                  <span>Analyzing Document & Extracting House No, Boundaries & Measurements...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-rose-600" />
                  <span>Choose Word (.doc, .docx), PDF, or Deed Image to Auto-Fill Plan</span>
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

          {extractedInfo && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-emerald-900 shadow-2xs">
              <span className="font-bold text-emerald-800 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" /> డాక్యుమెంట్ నుండి సంగ్రహించబడింది:
              </span>
              {extractedInfo.houseNo && (
                <span className="bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded font-mono font-bold text-emerald-950">
                  🏠 H.No: {extractedInfo.houseNo}
                </span>
              )}
              {extractedInfo.plinthAreaSqFt && (
                <span className="bg-amber-100 border border-amber-300 px-2 py-0.5 rounded font-mono font-black text-amber-950">
                  🏛️ Plinth: {extractedInfo.plinthAreaSqFt} Sq.Ft {extractedInfo.structureType ? `(${extractedInfo.structureType})` : ''}
                </span>
              )}
              {extractedInfo.plotNo && (
                <span className="bg-white border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                  Plot: {extractedInfo.plotNo}
                </span>
              )}
              {extractedInfo.surveyNo && (
                <span className="bg-white border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                  Sy No: {extractedInfo.surveyNo}
                </span>
              )}
              {extractedInfo.areaSqYards && (
                <span className="bg-white border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                  Area: {extractedInfo.areaSqYards} Sq.Yds
                </span>
              )}
              {extractedInfo.propertyType && (
                <span className="bg-white border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                  Type: {extractedInfo.propertyType}
                </span>
              )}
              {extractedInfo.village && (
                <span className="bg-white border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                  Village: {extractedInfo.village}
                </span>
              )}
              {typeof extractedInfo.executantsCount === 'number' && extractedInfo.executantsCount > 0 && (
                <span className="bg-indigo-100 border border-indigo-200 text-indigo-900 px-1.5 py-0.5 rounded font-semibold">
                  👥 {extractedInfo.executantsCount} Executant{extractedInfo.executantsCount > 1 ? 's' : ''} (2A)
                </span>
              )}
              {typeof extractedInfo.claimantsCount === 'number' && extractedInfo.claimantsCount > 0 && (
                <span className="bg-teal-100 border border-teal-200 text-teal-900 px-1.5 py-0.5 rounded font-semibold">
                  👥 {extractedInfo.claimantsCount} Claimant{extractedInfo.claimantsCount > 1 ? 's' : ''} (2B)
                </span>
              )}
            </div>
          )}

          <p className="text-[10px] text-slate-500">
            Upload any sale deed, partition deed, gift deed, municipal tax receipt, or layout document. AI will accurately read House Number (H.No), Survey No, Plot No, Dimensions, Area, Boundaries & fill all templates.
          </p>
        </div>

        {/* Total Area Sq.Yards */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Total Area (Sq.Yards) <span className="text-rose-600">*</span>
            </label>
            <span className="text-[11px] text-slate-400 font-mono">User input</span>
          </div>
          <input
            id="input-area-sq-yards"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 200 or 166.66"
            value={property.areaSqYards}
            onChange={(e) => handleAreaChange(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-mono font-semibold text-slate-900"
          />
        </div>

        {/* Total Area Sq.Mtrs (Auto + Calculate Area button) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Total Area (Sq.Mtrs) <span className="text-emerald-700 font-mono text-[10px]">(Auto)</span>
            </label>
            <button
              type="button"
              id="btn-calculate-area"
              onClick={handleManualCalculate}
              title="Calculate / display Sq.Mtrs from Sq.Yards (factor 0.836127)"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:text-rose-800 hover:underline cursor-pointer"
            >
              <Calculator className="w-3 h-3" />
              Calculate Area
            </button>
          </div>
          <div className="relative">
            <input
              id="input-area-sq-mtrs"
              type="number"
              readOnly
              placeholder="Sq.Yards × 0.836127"
              value={property.areaSqMtrs}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-mono font-semibold cursor-not-allowed"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-medium">
              Sq.Mtrs
            </span>
          </div>
        </div>
      </div>

      {/* Optional toggle when not 'House' */}
      {property.propertyType !== 'House' && (
        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-700">
              Plot లో నిర్మించిన ఇల్లు / భవనం ఉందా? (Include House Structure inside Plot)
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (activeHousesList.length > 0) {
                const disabled = currentHouses.map((h) => ({ ...h, enabled: false }));
                onChange({
                  ...property,
                  house: { ...(currentHouses[0] || {}), enabled: false },
                  houses: disabled,
                });
              } else {
                const enabledList = currentHouses.map((h, i) => (i === 0 ? { ...h, enabled: true } : h));
                if (enabledList.length === 0) {
                  handleAddHouse();
                } else {
                  onChange({
                    ...property,
                    house: { ...enabledList[0], enabled: true },
                    houses: enabledList,
                  });
                }
              }
            }}
            className={`px-3 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
              activeHousesList.length > 0
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            {activeHousesList.length > 0 ? `✓ ${activeHousesList.length} House(s) Enabled` : '+ Add House Sketch'}
          </button>
        </div>
      )}

      {/* ================= HOUSE MEASUREMENTS & SKETCH CONFIGURATION CARD ================= */}
      {isHouseActive && (
        <div id="section-house-details" className="bg-rose-50/70 border-2 border-rose-300/80 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-rose-200">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-600 text-white rounded-lg shadow-xs">
                <Home className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                  House Measurements & Sketch Drawing
                  <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-300">
                    {activeHousesList.length} {activeHousesList.length === 1 ? 'Structure' : 'Structures'}
                  </span>
                </h3>
                <p className="text-xs text-slate-600">
                  ఇంటి లేదా భవనాల కొలతలు, రూఫ్ టైపు మరియు సందుల వివరాలు స్కెచ్‌లో ఆటోమేటిక్‌గా డ్రా అవుతాయి
                </p>
              </div>
            </div>
          </div>

          {/* Consolidated Plinth Area Summary if multiple structures */}
          {currentHouses.length > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white/90 rounded-lg border border-rose-200 text-xs">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-rose-600" />
                <span className="font-bold text-slate-700">Total Combined Plinth Area:</span>
                <span className="font-mono font-black text-rose-800">
                  {currentHouses
                    .filter((h) => h.enabled !== false)
                    .reduce((sum, h) => {
                      const val = typeof h.plinthAreaSqFt === 'number' ? h.plinthAreaSqFt : parseFloat(String(h.plinthAreaSqFt) || '0');
                      return sum + (isNaN(val) ? 0 : val);
                    }, 0)
                    .toFixed(2)}{' '}
                  Sq.Ft.
                </span>
                <span className="text-slate-400">|</span>
                <span className="font-mono font-bold text-slate-600">
                  {(
                    currentHouses
                      .filter((h) => h.enabled !== false)
                      .reduce((sum, h) => {
                        const val = typeof h.plinthAreaSqFt === 'number' ? h.plinthAreaSqFt : parseFloat(String(h.plinthAreaSqFt) || '0');
                        return sum + (isNaN(val) ? 0 : val);
                      }, 0) / 9
                  ).toFixed(2)}{' '}
                  Sq.Yards
                </span>
              </div>
              <span className="text-[11px] text-rose-700 font-semibold">
                ({activeHousesList.length} of {currentHouses.length} structures active in sketch)
              </span>
            </div>
          )}

          {/* List of Houses / Structures */}
          <div className="space-y-4">
            {currentHouses.map((house, idx) => {
              const isEnabled = house.enabled !== false;
              return (
                <div
                  key={house.id || `house-card-${idx}`}
                  id={`house-card-${idx}`}
                  className={`bg-white rounded-xl border p-4 space-y-3.5 transition-all ${
                    isEnabled ? 'border-rose-300 shadow-xs' : 'border-slate-200 opacity-60 bg-slate-50'
                  }`}
                >
                  {/* Structure Item Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-black bg-rose-100 text-rose-800 rounded-md">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Location in Plot */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-700">Location (స్థానం):</span>
                        <select
                          value={house.position || (idx === 0 ? 'center' : 'attached-east')}
                          onChange={(e) => handleHouseItemUpdate(idx, { position: e.target.value as HouseDetails['position'] })}
                          className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-300 rounded text-slate-900 focus:ring-1 focus:ring-rose-500 shadow-2xs"
                        >
                          {idx === 0 ? (
                            <>
                              <option value="center">Center of Plot (ప్లాట్ మధ్యలో)</option>
                              <option value="north-west">North-West Corner (వాయువ్యం కార్నర్)</option>
                              <option value="north-east">North-East Corner (ఈశాన్యం కార్నర్)</option>
                              <option value="south-west">South-West Corner (నైరుతి కార్నర్)</option>
                              <option value="south-east">South-East Corner (ఆగ్నేయం కార్నర్)</option>
                              <option value="west">West Side / Left (పడమర వైపు)</option>
                              <option value="east">East Side / Right (తూర్పు వైపు)</option>
                              <option value="north">North Side / Rear (ఉత్తరం / వెనుక)</option>
                              <option value="south">South Side / Front (దక్షిణం / ముందు)</option>
                              <option value="custom">Custom Setbacks Driven (సందుల కొలతల ప్రకారం)</option>
                            </>
                          ) : (
                            <>
                              <optgroup label="🏠 Main House ఆనుకొని / కార్నర్స్ / మధ్యలో (Attached to Main House)">
                                <option value="attached-center">Main House Middle / Center (మెయిన్ హౌస్ మధ్యలో / లోపల)</option>
                                <option value="attached-west">Main House Left Side (మెయిన్ హౌస్ ఎడమవైపు ఆనుకొని)</option>
                                <option value="attached-east">Main House Right Side (మెయిన్ హౌస్ కుడివైపు ఆనుకొని)</option>
                                <option value="attached-north">Main House Rear / North (మెయిన్ హౌస్ వెనుక ఆనుకొని)</option>
                                <option value="attached-south">Main House Front / South (మెయిన్ హౌస్ ముందు ఆనుకొని)</option>
                                <option value="attached-nw-corner">Main House North-West Corner (మెయిన్ హౌస్ వాయువ్యం కార్నర్ ఆనుకొని)</option>
                                <option value="attached-ne-corner">Main House North-East Corner (మెయిన్ హౌస్ ఈశాన్యం కార్నర్ ఆనుకొని)</option>
                                <option value="attached-sw-corner">Main House South-West Corner (మెయిన్ హౌస్ నైరుతి కార్నర్ ఆనుకొని)</option>
                                <option value="attached-se-corner">Main House South-East Corner (మెయిన్ హౌస్ ఆగ్నేయం కార్నర్ ఆనుకొని)</option>
                              </optgroup>
                              <optgroup label="🗺️ Plot Corners & Sides (ప్లాట్ హద్దుల ప్రకారం)">
                                <option value="center">Plot Center (ప్లాట్ మధ్యలో)</option>
                                <option value="north-west">Plot North-West Corner (ప్లాట్ వాయువ్యం కార్నర్)</option>
                                <option value="north-east">Plot North-East Corner (ప్లాట్ ఈశాన్యం కార్నర్)</option>
                                <option value="south-west">Plot South-West Corner (ప్లాట్ నైరుతి కార్నర్)</option>
                                <option value="south-east">Plot South-East Corner (ప్లాట్ ఆగ్నేయం కార్నర్)</option>
                                <option value="west">Plot West Side (ప్లాట్ పడమర)</option>
                                <option value="east">Plot East Side (ప్లాట్ తూర్పు)</option>
                                <option value="north">Plot North Side (ప్లాట్ ఉత్తరం)</option>
                                <option value="south">Plot South Side (ప్లాట్ దక్షిణం)</option>
                                <option value="custom">Custom Setbacks Driven (సందుల కొలతల ప్రకారం)</option>
                              </optgroup>
                            </>
                          )}
                        </select>
                      </div>

                      {/* Enable/Disable Toggle */}
                      <label className="flex items-center gap-1 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => handleHouseItemUpdate(idx, { enabled: e.target.checked })}
                          className="rounded text-rose-600 w-3.5 h-3.5 cursor-pointer"
                        />
                        Active in Drawing
                      </label>

                      {/* Remove Button */}
                      {currentHouses.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveHouse(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove this house structure"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Position Selector Bar for Additional Houses */}
                  {idx > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-rose-50/80 rounded-lg border border-rose-200">
                      <span className="text-[10px] font-black uppercase text-rose-800 tracking-wider">
                        Quick Position:
                      </span>
                      {[
                        { label: '🏠 Middle (మధ్యలో)', val: 'attached-center' },
                        { label: '⬅️ Left (ఎడమ)', val: 'attached-west' },
                        { label: '➡️ Right (కుడి)', val: 'attached-east' },
                        { label: '⬆️ Rear (వెనుక)', val: 'attached-north' },
                        { label: '⬇️ Front (ముందు)', val: 'attached-south' },
                        { label: '↖️ NW Corner', val: 'attached-nw-corner' },
                        { label: '↗️ NE Corner', val: 'attached-ne-corner' },
                        { label: '↙️ SW Corner', val: 'attached-sw-corner' },
                        { label: '↘️ SE Corner', val: 'attached-se-corner' },
                      ].map((btn) => {
                        const isSelected = (house.position || 'attached-east') === btn.val;
                        return (
                          <button
                            key={btn.val}
                            type="button"
                            onClick={() => handleHouseItemUpdate(idx, { position: btn.val as HouseDetails['position'] })}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-rose-100 hover:text-rose-900'
                            }`}
                          >
                            {btn.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Dimensions and Roof Type Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                    {/* Width */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                        Width (వెడల్పు) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder={isMeters ? 'e.g. 7.32' : 'e.g. 24\'-0" or 25'}
                        value={house.widthRaw ?? ''}
                        onChange={(e) => handleHouseItemUpdate(idx, { widthRaw: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 text-slate-900"
                      />
                      <span className="text-[10px] text-slate-500 block">
                        Width: {house.widthFeet ?? (isMeters ? 7.32 : 24)} {isMeters ? 'm' : 'ft'}
                      </span>
                    </div>

                    {/* Length */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                        Length (పొడవు) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder={isMeters ? 'e.g. 10.97' : 'e.g. 36\'-0" or 35'}
                        value={house.lengthRaw ?? ''}
                        onChange={(e) => handleHouseItemUpdate(idx, { lengthRaw: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 text-slate-900"
                      />
                      <span className="text-[10px] text-slate-500 block">
                        Depth: {house.lengthFeet ?? (isMeters ? 10.97 : 36)} {isMeters ? 'm' : 'ft'}
                      </span>
                    </div>

                    {/* Structure / Roof Type */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                        Structure / Roof Type
                      </label>
                      <select
                        value={
                          [
                            'R.C.C. Building',
                            'R.C.C. Roof House',
                            'Ground Floor House',
                            'G + 1 Upper Floor',
                            'G + 2 Upper Floors',
                            'Independent House / Villa',
                            'Tiled House',
                            'A.C. Sheet Roof House',
                            'Madras Terrace House',
                            'Commercial Building',
                            'Shed Structure',
                          ].includes(house.structureType ?? 'R.C.C. Building')
                            ? (house.structureType ?? 'R.C.C. Building')
                            : 'custom'
                        }
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            handleHouseItemUpdate(idx, { structureType: '' });
                          } else {
                            handleHouseItemUpdate(idx, { structureType: e.target.value });
                          }
                        }}
                        className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 text-slate-800"
                      >
                        <option value="R.C.C. Building">R.C.C. Building</option>
                        <option value="R.C.C. Roof House">R.C.C. Roof House</option>
                        <option value="Ground Floor House">Ground Floor House</option>
                        <option value="G + 1 Upper Floor">G + 1 Upper Floor</option>
                        <option value="G + 2 Upper Floors">G + 2 Upper Floors</option>
                        <option value="Independent House / Villa">Independent Villa</option>
                        <option value="Tiled House">Tiled House</option>
                        <option value="A.C. Sheet Roof House">A.C. Sheet Roof House</option>
                        <option value="Madras Terrace House">Madras Terrace House</option>
                        <option value="Commercial Building">Commercial Building</option>
                        <option value="Shed Structure">Shed Structure</option>
                        <option value="custom">Other / Custom Structure...</option>
                      </select>
                      {(![
                        'R.C.C. Building',
                        'R.C.C. Roof House',
                        'Ground Floor House',
                        'G + 1 Upper Floor',
                        'G + 2 Upper Floors',
                        'Independent House / Villa',
                        'Tiled House',
                        'A.C. Sheet Roof House',
                        'Madras Terrace House',
                        'Commercial Building',
                        'Shed Structure',
                      ].includes(house.structureType ?? 'R.C.C. Building') ||
                        house.structureType === '') && (
                        <input
                          type="text"
                          placeholder="Enter custom structure / roof type"
                          value={house.structureType ?? ''}
                          onChange={(e) => handleHouseItemUpdate(idx, { structureType: e.target.value })}
                          className="w-full mt-1 px-2.5 py-1 text-xs font-semibold bg-white border border-rose-400 rounded focus:ring-1 focus:ring-rose-500 text-slate-900"
                        />
                      )}
                    </div>

                    {/* Plinth Area */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                          Plinth Area (Sq.Ft.)
                        </label>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={house.plinthAreaSqFt !== undefined ? String(house.plinthAreaSqFt) : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const num = parseFloat(val);
                            handleHouseItemUpdate(idx, {
                              plinthAreaSqFt: isNaN(num) ? val : num,
                              plinthAreaSqYds: !isNaN(num) ? Math.round((num / 9) * 100) / 100 : '',
                            });
                          }}
                          placeholder="e.g. 1172.00"
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-black bg-white border border-rose-300 rounded text-rose-950 focus:ring-1 focus:ring-rose-500"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-slate-500 font-bold">
                          {house.plinthAreaSqYds ? `${house.plinthAreaSqYds} Yds` : ''}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        Auto: {house.widthFeet ?? '—'} × {house.lengthFeet ?? '—'} ft
                      </span>
                    </div>
                  </div>

                  {/* Setbacks for this structure */}
                  <div className="pt-2.5 border-t border-slate-100 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                        <Ruler className="w-3 h-3 text-rose-600" />
                        Setbacks & Open Spaces (సందుల కొలతలు):
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={house.showMeasurements !== false}
                            onChange={(e) => handleHouseItemUpdate(idx, { showMeasurements: e.target.checked })}
                            className="rounded text-rose-600 w-3 h-3 cursor-pointer"
                          />
                          Show Dims
                        </label>
                        <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={house.showSetbacks !== false}
                            onChange={(e) => handleHouseItemUpdate(idx, { showSetbacks: e.target.checked })}
                            className="rounded text-rose-600 w-3 h-3 cursor-pointer"
                          />
                          Show Setbacks
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAutoCalcHouseFromSetbacks(idx)}
                          className="px-2 py-0.5 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded cursor-pointer"
                          title="Auto-calculate house dimensions from plot minus setbacks"
                        >
                          Auto-Calc
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAutoBalanceSetbacks(idx)}
                          className="px-2 py-0.5 text-[10px] font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded cursor-pointer"
                          title="Evenly balance setbacks around this house"
                        >
                          Center House
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">
                          South (Front) Open:
                        </label>
                        <input
                          type="text"
                          value={house.setbackSouth ?? ''}
                          onChange={(e) => handleHouseItemUpdate(idx, { setbackSouth: e.target.value })}
                          placeholder={isMeters ? 'e.g. 3.66' : 'e.g. 12\'-0"'}
                          className="mt-0.5 w-full px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded focus:ring-1 focus:ring-rose-500"
                        />
                      </div>

                      <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">
                          North (Rear) Open:
                        </label>
                        <input
                          type="text"
                          value={house.setbackNorth ?? ''}
                          onChange={(e) => handleHouseItemUpdate(idx, { setbackNorth: e.target.value })}
                          placeholder={isMeters ? 'e.g. 3.66' : 'e.g. 12\'-0"'}
                          className="mt-0.5 w-full px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded focus:ring-1 focus:ring-rose-500"
                        />
                      </div>

                      <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">
                          West (Left) Open:
                        </label>
                        <input
                          type="text"
                          value={house.setbackWest ?? ''}
                          onChange={(e) => handleHouseItemUpdate(idx, { setbackWest: e.target.value })}
                          placeholder={isMeters ? 'e.g. 2.44' : 'e.g. 8\'-0"'}
                          className="mt-0.5 w-full px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded focus:ring-1 focus:ring-rose-500"
                        />
                      </div>

                      <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">
                          East (Right) Open:
                        </label>
                        <input
                          type="text"
                          value={house.setbackEast ?? ''}
                          onChange={(e) => handleHouseItemUpdate(idx, { setbackEast: e.target.value })}
                          placeholder={isMeters ? 'e.g. 2.44' : 'e.g. 8\'-0"'}
                          className="mt-0.5 w-full px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Action: Add Structure Button */}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              id="btn-add-house-bottom"
              onClick={handleAddHouse}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white hover:bg-rose-50 text-rose-700 border-2 border-dashed border-rose-300 hover:border-rose-400 rounded-xl transition-all shadow-2xs cursor-pointer w-full justify-center"
            >
              <Plus className="w-4 h-4" />
              + Add Another House / Out-House / Shed to Drawing (మరొక ఇల్లు లేదా షెడ్ జోడించండి)
            </button>
          </div>
        </div>
      )}

      {/* Location Details Sub-grid */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-rose-600" />
            Location & Identification Details
          </h3>

          {isPlotType && (
            <div className="flex flex-wrap items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg p-1.5">
              <span className="text-[10px] font-bold text-blue-700 uppercase flex items-center gap-1 px-1">
                <Sparkles className="w-3 h-3 text-blue-600" /> Plot Template:
              </span>
              <button
                type="button"
                id="btn-template-near-adjacent-hno"
                onClick={() => handleUpdatePlotTemplate('near_adjacent_hno')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition-all ${
                  property.locationTemplateType === 'near_adjacent_hno' || !property.locationTemplateType
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-blue-100'
                }`}
              >
                Near/Adjacent H.No.
              </button>
              <button
                type="button"
                id="btn-template-plot-near-hno"
                onClick={() => handleUpdatePlotTemplate('near_hno')}
                className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                  property.locationTemplateType === 'near_hno'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-blue-100'
                }`}
              >
                Near H.No.
              </button>
              <button
                type="button"
                id="btn-template-adjacent-hno"
                onClick={() => handleUpdatePlotTemplate('adjacent_hno')}
                className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                  property.locationTemplateType === 'adjacent_hno'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-blue-100'
                }`}
              >
                Adjacent H.No.
              </button>
              <button
                type="button"
                id="btn-template-opp-hno"
                onClick={() => handleUpdatePlotTemplate('opp_hno')}
                className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                  property.locationTemplateType === 'opp_hno'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-blue-100'
                }`}
              >
                Opp. H.No.
              </button>
              <button
                type="button"
                id="btn-template-beside-hno"
                onClick={() => handleUpdatePlotTemplate('beside_hno')}
                className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                  property.locationTemplateType === 'beside_hno'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-blue-100'
                }`}
              >
                Beside H.No.
              </button>
              <button
                type="button"
                id="btn-template-part-open-place-hno"
                onClick={() => handleUpdatePlotTemplate('part_open_place_hno')}
                className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                  property.locationTemplateType === 'part_open_place_hno'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-blue-100'
                }`}
              >
                Part Open Place H.No.
              </button>
              <button
                type="button"
                id="btn-template-demolished-house-hno"
                onClick={() => handleUpdatePlotTemplate('demolished_house_hno')}
                className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                  property.locationTemplateType === 'demolished_house_hno'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-blue-100'
                }`}
              >
                Demolished House H.No.
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Survey No */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                {isPlotType ? 'Survey No / Survey No/s.' : 'Survey No.'}{' '}
                <span className="text-[10px] font-normal text-slate-500">
                  {isPlotType ? '(సర్వే నెం. - ఐచ్ఛికం)' : '(సర్వే నెం. - ఐచ్ఛికం)'}
                </span>
              </label>
              {isHouseLikeType && property.surveyNo?.trim() && (
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                  Survey Active
                </span>
              )}
              {isPlotType && property.surveyNo?.trim() && (
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                  Survey Active
                </span>
              )}
            </div>
            <div className="relative">
              <Hash className={`w-4 h-4 absolute left-3 top-3 ${isPlotType ? 'text-blue-500' : 'text-rose-500'}`} />
              <input
                id="input-survey-no"
                type="text"
                placeholder={isPlotType ? "e.g. 848/B & 848/C or 124/A" : "e.g. 508/B or 124/A"}
                value={property.surveyNo || ''}
                onChange={(e) => handleSurveyNoChange(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Plot No */}
          {property.propertyType !== 'Open Place' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                {isPlotType ? 'Open Plot No.' : 'Plot No.'}{' '}
                <span className="text-[10px] font-normal text-slate-500">
                  {isPlotType ? '(ఓపెన్ ప్లాట్ నెం.)' : '(ప్లాట్ నెం.)'}
                </span>
              </label>
              {isHouseLikeType && property.plotNo?.trim() && (
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                  Plot Active
                </span>
              )}
              {isPlotType && (
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                  Open Plot
                </span>
              )}
            </div>
            <div className="relative">
              <Hash className="w-4 h-4 text-rose-500 absolute left-3 top-3" />
              <input
                id="input-plot-no"
                type="text"
                placeholder={isPlotType ? "e.g. 25 or 12/Part" : "e.g. 45 or 12/Part"}
                value={property.plotNo || ''}
                onChange={(e) => handlePlotNoChange(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-medium text-slate-800"
              />
            </div>
          </div>
          )}

          {/* House No / Bearing H.No or Near / Adjacent H.No */}
          {isHouseLikeType ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  {property.propertyType === 'Demolished House'
                    ? 'Bearing Dismantled H.No.'
                    : property.propertyType === 'Part Open Place'
                    ? 'Bearing H.No. (PART)'
                    : 'Bearing H.No.'}{' '}
                  <span className="text-[10px] font-normal text-slate-500">
                    {property.propertyType === 'Demolished House'
                      ? '(కూల్చిన ఇల్లు హౌస్ నెం.)'
                      : property.propertyType === 'Part Open Place'
                      ? '(బేరింగ్ హౌస్ నెం. - పార్ట్)'
                      : '(బేరింగ్ హౌస్ నెం.)'}
                  </span>
                </label>
                <div className="flex items-center gap-1">
                  <select
                    id="select-house-authority"
                    value={property.houseAuthority || 'Municipal Council House No.'}
                    onChange={(e) => {
                      const newAuth = e.target.value;
                      const rawH = property.houseNo?.trim() || '';
                      const rawP = property.plotNo?.trim() || '';
                      const newNearHNo = computeBearingLocationString(property.propertyType, rawH, rawP, newAuth);
                      onChange({
                        ...property,
                        houseAuthority: newAuth,
                        nearHNo: newNearHNo,
                      });
                    }}
                    className="text-[10px] font-semibold bg-rose-50 border border-rose-200 text-rose-800 rounded px-1.5 py-0.5"
                  >
                    <option value="Municipal Council House No.">Municipal Council House No.</option>
                    <option value="Gram Panchayat House No.">Gram Panchayat House No.</option>
                    <option value="Municipal Corporation House No.">Municipal Corporation House No.</option>
                    <option value="House No.">House No.</option>
                    <option value="H.No.">H.No.</option>
                  </select>
                  {property.houseNo?.trim() && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                      H.No. Active
                    </span>
                  )}
                </div>
              </div>
              <div className="relative">
                <Home className="w-4 h-4 text-rose-600 absolute left-3 top-3" />
                <input
                  id="input-bearing-hno"
                  type="text"
                  placeholder="e.g. 6-5-48/2 or 3-45/1"
                  value={property.houseNo || ''}
                  onChange={(e) => handleHouseNoChange(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-medium text-slate-900"
                />
              </div>
            </div>
          ) : isPlotType ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  {property.locationTemplateType === 'adjacent_hno'
                    ? 'Adjacent H.No.'
                    : property.locationTemplateType === 'opp_hno'
                    ? 'Opp. H.No.'
                    : property.locationTemplateType === 'beside_hno'
                    ? 'Beside H.No.'
                    : property.locationTemplateType === 'near_hno'
                    ? 'Near H.No.'
                    : property.locationTemplateType === 'part_open_place_hno'
                    ? 'Part Open Place H.No. (PART)'
                    : property.locationTemplateType === 'demolished_house_hno'
                    ? 'Demolished House H.No.'
                    : 'Near/Adjacent H.No.'}{' '}
                  <span className="text-[10px] font-normal text-slate-500">(ల్యాండ్‌మార్క్ హౌస్ నెం.)</span>
                </label>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                  Plot Template
                </span>
              </div>
              <div className="relative">
                <Home className="w-4 h-4 text-blue-600 absolute left-3 top-3" />
                <input
                  id="input-landmark-hno"
                  type="text"
                  placeholder="e.g. 9-7-8 or 12-108"
                  value={property.houseNo || ''}
                  onChange={(e) => handlePlotHNoChange(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Near H.No.
              </label>
              <div className="relative">
                <Home className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="input-near-hno"
                  type="text"
                  placeholder="e.g. 3-45/1 or 12-108"
                  value={property.nearHNo}
                  onChange={(e) => onChange({ ...property, nearHNo: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-medium text-slate-800"
                />
              </div>
            </div>
          )}

          {/* Locality */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Locality
            </label>
            <input
              id="input-locality"
              type="text"
              list="locality-suggestions"
              placeholder="e.g. Thukkaraopally/Ganeshnagar or Sri Sai Nagar"
              value={property.locality}
              onChange={(e) => onChange({ ...property, locality: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-medium text-slate-800"
            />
            <datalist id="locality-suggestions">
              {LOCALITY_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* Village */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Village <span className="text-rose-600">*</span>
            </label>
            <input
              id="input-village"
              type="text"
              list="village-suggestions"
              placeholder="e.g. Sircilla or Kompally"
              value={property.village}
              onChange={(e) => onChange({ ...property, village: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-medium text-slate-800"
            />
            <datalist id="village-suggestions">
              {VILLAGE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* Mandal */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Mandal <span className="text-rose-600">*</span>
            </label>
            <input
              id="input-mandal"
              type="text"
              list="mandal-suggestions"
              placeholder="e.g. Sircilla or Quthbullapur"
              value={property.mandal}
              onChange={(e) => onChange({ ...property, mandal: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-medium text-slate-800"
            />
            <datalist id="mandal-suggestions">
              {MANDAL_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* District */}
          <div className="space-y-1.5 md:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              District
            </label>
            <input
              id="input-district"
              type="text"
              list="district-suggestions"
              placeholder="e.g. Rajanna Sircilla or Medchal-Malkajgiri"
              value={property.district}
              onChange={(e) => onChange({ ...property, district: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 font-medium text-slate-800"
            />
            <datalist id="district-suggestions">
              {DISTRICT_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Live Identification Deed Template Preview */}
        <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
              <FileText className={`w-3.5 h-3.5 ${isPlotType ? 'text-blue-600' : 'text-rose-600'}`} />
              {isPlotType ? 'Open Plot Legal Description Preview (ఓపెన్ ప్లాట్ లీగల్ డిస్క్రిప్షన్)' : 'Registration Deed Format Line (రిజిస్ట్రేషన్ దస్తావేజు టెంప్లేట్)'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Auto-generated</span>
          </div>
          {isPlotType ? (
            <div className="p-2.5 bg-white border border-blue-200 rounded-lg text-xs font-mono text-slate-800 leading-relaxed">
              <span className="font-bold text-blue-700">
                {property.propertyType === 'Open Place'
                  ? 'THE OPEN PLACE,'
                  : property.propertyType === 'Part Open Place'
                  ? (property.plotNo && property.plotNo.trim() ? `THE PART OPEN PLACE / PLOT NO.${property.plotNo.trim()},` : 'THE PART OPEN PLACE,')
                  : property.propertyType === 'Demolished House'
                  ? (property.houseNo && property.houseNo.trim() ? `THE DEMOLISHED HOUSE BEARING H.NO.${property.houseNo.trim()},` : 'THE DEMOLISHED HOUSE,')
                  : (property.plotNo && property.plotNo.trim() ? `THE OPEN PLOT NO.${property.plotNo.trim()},` : 'THE OPEN PLOT,')}
              </span>{' '}
              {property.areaSqYards ? (
                <>
                  ADMEASURING A TOTAL AREA OF{' '}
                  <span className="font-bold text-slate-900">{typeof property.areaSqYards === 'number' ? property.areaSqYards.toFixed(2) : property.areaSqYards}</span> SQUARE YARDS
                  {property.areaSqMtrs ? (
                    <>
                      {' '}EQUIVALENT TO{' '}
                      <span className="font-bold text-slate-900">{typeof property.areaSqMtrs === 'number' ? property.areaSqMtrs.toFixed(2) : property.areaSqMtrs}</span> SQUARE METERS
                    </>
                  ) : null},
                </>
              ) : null}
              {property.surveyNo?.trim() ? (
                <>
                  {' '}SURVEY NO/S.{' '}
                  <span className="font-bold text-slate-900">{property.surveyNo.trim()}</span>,
                </>
              ) : null}
              {property.nearHNo?.trim() ? (
                <>
                  {' '}SITUATED{' '}
                  <span className="font-bold text-blue-700 underline decoration-blue-300">
                    {property.nearHNo.trim()}
                  </span>
                  {property.locality?.trim() ? ' OF ' : ', '}
                </>
              ) : (property.locality?.trim() || property.village?.trim()) ? (
                <> SITUATED AT </>
              ) : null}
              {property.locality?.trim() ? (
                <>
                  ‘<span className="font-bold text-blue-700">{property.locality.trim().toUpperCase()}</span>’ LOCALITY OF{' '}
                </>
              ) : null}
              {property.village?.trim() ? (
                <span className="font-bold text-slate-900">
                  {(() => {
                    const v = property.village.trim().replace(/\s+VILLAGE$/i, '');
                    return `${v.toUpperCase()} VILLAGE`;
                  })()}
                </span>
              ) : null}
              {property.mandal?.trim() ? (
                <span className="font-bold text-slate-900">
                  , {(() => {
                    const m = property.mandal.trim().replace(/\s+MANDAL$/i, '');
                    return `${m.toUpperCase()} MANDAL`;
                  })()}
                </span>
              ) : null}
              {property.district?.trim() ? `, ${property.district.trim().toUpperCase()}` : ''}.
            </div>
          ) : (
            <div className="p-3 bg-white border border-rose-200 rounded-lg text-xs font-mono text-slate-800 leading-relaxed space-y-1.5 uppercase">
              <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">
                Exact Legal Deed Description (రిజిస్ట్రేషన్ లీగల్ దస్తావేజు టెంప్లేట్):
              </div>
              <div className="leading-relaxed uppercase">
                ALL THAT THE{' '}
                <span className="font-bold text-rose-700">
                  {(() => {
                    if (property.propertyType === 'Part Open Place') {
                      return 'OPEN PLACE';
                    }
                    if (property.propertyType === 'Demolished House') {
                      return 'OPEN PLACE TOGETHER WITH THE DISMANTLED HOUSE';
                    }
                    const st = property.house?.structureType?.trim() || 'R.C.C. Building';
                    return (st.toLowerCase().includes('with open place') ? st : `${st} with open place`).toUpperCase();
                  })()}
                </span>
                {(() => {
                  const rawH = property.houseNo?.trim();
                  if (!rawH) {
                    if (property.propertyType === 'Part Open Place') {
                      return <> <span className="font-bold text-rose-700">(PART)</span></>;
                    }
                    return null;
                  }
                  const auth = (property.houseAuthority || 'Municipal Council House No.').trim();
                  let display = '';
                  if (rawH.toLowerCase().startsWith('bearing ')) {
                    display = rawH;
                  } else if (
                    rawH.toLowerCase().startsWith('municipal council') ||
                    rawH.toLowerCase().startsWith('gram panchayat') ||
                    rawH.toLowerCase().startsWith('municipal corporation') ||
                    rawH.toLowerCase().startsWith('house no') ||
                    rawH.toLowerCase().startsWith('h.no')
                  ) {
                    display = `bearing ${rawH}`;
                  } else {
                    const authPrefix = auth.toLowerCase().startsWith('bearing ') ? auth : `bearing ${auth}`;
                    const cleanH = rawH.startsWith('.') ? rawH.substring(1).trim() : rawH;
                    display = authPrefix.endsWith('.') ? `${authPrefix}${cleanH}` : `${authPrefix}.${cleanH}`;
                  }
                  if (property.propertyType === 'Part Open Place') {
                    display = `${display} (PART)`;
                  }
                  return <> <span className="font-bold text-rose-700">{display.toUpperCase()}</span></>;
                })()}
                {property.areaSqYards ? (
                  <>
                    , ADMEASURING A TOTAL AREA OF{' '}
                    <span className="font-bold text-slate-900">
                      {typeof property.areaSqYards === 'number' ? property.areaSqYards.toFixed(2) : property.areaSqYards}
                    </span>{' '}
                    SQUARE YARDS
                    {property.areaSqMtrs ? (
                      <>
                        {' '}EQUIVALENT TO{' '}
                        <span className="font-bold text-slate-900">
                          {typeof property.areaSqMtrs === 'number' ? property.areaSqMtrs.toFixed(2) : property.areaSqMtrs}
                        </span>{' '}
                        SQUARE METERS
                      </>
                    ) : null}
                  </>
                ) : null}
                {property.propertyType === 'House' && (
                  activeHousesList.length > 1 ? (
                    <>
                      , HAVING TOTAL PLINTH AREA OF{' '}
                      <span className="font-bold text-rose-700">
                        {activeHousesList
                          .reduce((sum, h) => sum + (typeof h.plinthAreaSqFt === 'number' ? h.plinthAreaSqFt : parseFloat(String(h.plinthAreaSqFt) || '0') || 0), 0)
                          .toFixed(2)}{' '}
                        SQUARE FEETS
                      </span>
                    </>
                  ) : (property.house?.plinthAreaSqFt !== undefined && property.house?.plinthAreaSqFt !== '' && String(property.house?.plinthAreaSqFt) !== '0' && String(property.house?.plinthAreaSqFt) !== '0.00') ? (
                    <>
                      , HAVING PLINTH AREA OF{' '}
                      <span className="font-bold text-rose-700">
                        {typeof property.house.plinthAreaSqFt === 'number'
                          ? property.house.plinthAreaSqFt.toFixed(2)
                          : property.house.plinthAreaSqFt}{' '}
                        SQUARE FEETS
                      </span>
                    </>
                  ) : null
                )}
                {property.plotNo?.trim() && property.surveyNo?.trim() ? (
                  <>
                    , IN PLOT NO.<span className="font-bold text-slate-900">{property.plotNo.trim()}</span> AND SURVEY NO.<span className="font-bold text-slate-900">{property.surveyNo.trim()}</span>
                  </>
                ) : property.plotNo?.trim() ? (
                  <>
                    , IN PLOT NO.<span className="font-bold text-slate-900">{property.plotNo.trim()}</span>
                  </>
                ) : property.surveyNo?.trim() ? (
                  <>
                    , IN SURVEY NO.<span className="font-bold text-slate-900">{property.surveyNo.trim()}</span>
                  </>
                ) : null}
                {property.locality?.trim() && property.village?.trim() ? (
                  <>
                    , SITUATED AT ‘
                    <span className="font-bold text-rose-700">
                      {property.locality.trim().replace(/^['"‘“]+|['"’”]+$/g, '').toUpperCase()}
                    </span>
                    ’ LOCALITY OF{' '}
                    <span className="font-bold text-slate-900">
                      {(() => {
                        const v = property.village.trim().replace(/\s+VILLAGE$/i, '');
                        return `${v.toUpperCase()} VILLAGE`;
                      })()}
                    </span>
                  </>
                ) : property.locality?.trim() ? (
                  <>
                    , SITUATED AT ‘
                    <span className="font-bold text-rose-700">
                      {property.locality.trim().replace(/^['"‘“]+|['"’”]+$/g, '').toUpperCase()}
                    </span>
                    ’ LOCALITY
                  </>
                ) : property.village?.trim() ? (
                  <>
                    , SITUATED AT{' '}
                    <span className="font-bold text-slate-900">
                      {(() => {
                        const v = property.village.trim().replace(/\s+VILLAGE$/i, '');
                        return `${v.toUpperCase()} VILLAGE`;
                      })()}
                    </span>
                  </>
                ) : null}
                {property.mandal?.trim() ? (
                  <span className="font-bold text-slate-900">
                    , {(() => {
                      const m = property.mandal.trim().replace(/\s+MANDAL$/i, '');
                      return `${m.toUpperCase()} MANDAL`;
                    })()}
                  </span>
                ) : null}
                {property.district?.trim() ? (
                  <>
                    , DISTRICT:
                    <span className="font-bold text-slate-900">
                      {property.district.trim().toUpperCase()}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
