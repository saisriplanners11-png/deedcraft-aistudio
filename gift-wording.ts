/** Grammatical agreement is owned by the renderer, not individual Word revisions. */
export function giftPartyWording(text: string, donors: number, donees: number, apply?: (find: RegExp, replacement: string) => void, genderSelected = false): string {
  const replace = (find: RegExp, replacement: string) => { apply?.(find, replacement); text = text.replace(find, replacement); };
  replace(/\bDonors?\b(?:\/s)?/gi, 'Donor/s');
  replace(/\bDonees?\b(?:\/s)?/gi, 'Donee/s');
  const donor = donors > 1 ? 'Donors' : 'Donor', donee = donees > 1 ? 'Donees' : 'Donee';
  replace(/Donor\/s\s+(?:is\/are|is|are)\b/gi, `${donor} ${donors > 1 ? 'are' : 'is'}`);
  replace(/Donor\/s\s+(?:has\/have|has|have)\b/gi, `${donor} ${donors > 1 ? 'have' : 'has'}`);
  replace(/Donee\/s\s+(?:has\/have|has|have)\b/gi, `${donee} ${donees > 1 ? 'have' : 'has'}`);
  replace(/Donee\/s\s+(?:is\/are|is|are)\b/gi, `${donee} ${donees > 1 ? 'are' : 'is'}`);
  replace(/Donee\/s\s+shall\s+has\/have/gi, `${donee} shall have`);
  replace(/Donor\/s hereby voluntarily and absolutely gifts?, conveys?, transfers? and settles?/gi, `${donor} hereby voluntarily and absolutely ${donors > 1 ? 'gift, convey, transfer and settle' : 'gifts, conveys, transfers and settles'}`);
  replace(/Donee\/s hereby accepts?/gi, `${donee} hereby ${donees > 1 ? 'accept' : 'accepts'}`);
  replace(/Donor\/s hereby undertakes? and agrees?/gi, `${donor} hereby ${donors > 1 ? 'undertake and agree' : 'undertakes and agrees'}`);
  replace(/Donor\/s further declares that she\/he has/gi, `${donor} further ${donors > 1 ? 'declare that they have' : genderSelected ? 'declares that she/he has' : 'declares that the Donor has'}`);
  if (!genderSelected) replace(/through her\/him/gi, `through the ${donor}`);
  replace(/Donor\/s/gi, donor);
  replace(/Donee\/s/gi, donee);
  replace(/owner\/s/gi, /absolute, lawful and exclusive/i.test(text) ? donors > 1 ? 'owners' : 'owner' : donees > 1 ? 'owners' : 'owner');
  replace(/FAMILY MEMBER(S)?/gi, donees > 1 ? 'FAMILY MEMBERS' : 'FAMILY MEMBER');
  replace(/is\/are/gi, donors > 1 ? 'are' : 'is');
  replace(/SIGN\/S OF THE Donors?/gi, donors > 1 ? 'SIGNATURES OF THE DONORS' : 'SIGNATURE OF THE DONOR');
  replace(/SIGN\/S OF THE Donees?/gi, donees > 1 ? 'SIGNATURES OF THE DONEES' : 'SIGNATURE OF THE DONEE');
  replace(/WITNESSES\/S/gi, 'WITNESSES');
  return text;
}
