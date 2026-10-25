/** Resolve template pronouns from explicit party data, never from a person's name. */
export function partyPronouns(text: string, values: Record<string, string>, apply?: (find: RegExp, replacement: string) => void): string {
  type Side = 'Executant' | 'Claimant' | 'Attorney';
  const role = (noun: string): Side => /^(?:vendee|claimant|donee|second)/i.test(noun) ? 'Claimant' : /^attorney/i.test(noun) ? 'Attorney' : 'Executant';
  const nouns = /\b(?:Vendors?|Vendees?|Donors?|Donees?|Executants?|Principals?|Claimants?|Attorneys|Attorney(?: Holder)?|First Part(?:y|ies)|Second Part(?:y|ies))(?:\/s)?\b/gi;
  let inherited: Side = 'Executant';
  for (const clause of text.split(/(?<=[.;])\s+|(?=\band\s+the\s+(?:Vendor|Vendee|Donor|Donee|First Party|Second Party))/i)) {
    const identity = clause.match(/<\s*(EXECUTANT|PRINCIPAL|CLAIMANT|ATTORNEY) NAME\s*>/i);
    const prose = clause.replace(/<[^<>]+>/g, '');
    const subjects = [...prose.matchAll(nouns)];
    const subject = identity ? role(identity[1]) : subjects.length ? role(subjects[0][0]) : inherited;
    inherited = subject;
    const joint = !identity && /(?:vendor(?:s|\/s)?\s+and\s+vendee|donor(?:s|\/s)?\s+and\s+donee|first part(?:y|ies)(?:\/s)?[”"']?\s+and\s+[“"']?(?:the\s+)?second part|parties.*their|part(?:y|ies)(?:\/s)?\s+here\s*to)/i.test(prose);
    let replacement = clause.replace(/<[^<>]+>|\b(?:his\/her(?:\/their)?|her\/his(?:\/their)?|his\/their|her\/their|him\/her(?:\/them)?|her\/him(?:\/them)?|he\/she(?:\/they)?|she\/he(?:\/they)?|himself\/herself(?:\/themselves)?|herself\/himself(?:\/themselves)?|his|her|their|him|them|he|she|they|himself|herself|themselves)\b/gi, (token, offset: number) => {
      if (token.startsWith('<')) return token;
      const before = clause.slice(0, offset);
      let side = subject;
      // A claim through a donor/vendor refers back to that party, even when
      // the sentence's subject is the recipient.
      if (/(?:from|through)\s+(?:the\s+)?(?:Vendor|Donor|Principal|First Party)(?:s|\/s)?\b[^.;]*$/i.test(before)) side = 'Executant';
      if (/\b(?:upon|on)\s*$/i.test(before) && /Attorney Holder/i.test(before)) side = 'Attorney';
      if (/\bin\s*$/i.test(before) && /capacity\s+as\s+Attorney/i.test(clause.slice(offset))) side = 'Claimant';
      const immediate = before.match(/\b(Vendor|Vendee|Donor|Donee|Principal|Claimant|Attorney|First Party|Second Party)(?:s|\/s)?\s*$/i);
      if (immediate) side = role(immediate[1]);
      const countKey = side === 'Executant' ? 'Ownership Vendor Count' : side === 'Claimant' ? 'Ownership Vendee Count' : 'Authority Attorney Count';
      const count = identity && side === subject ? 1 : Number(values[countKey]) || (side === 'Attorney' ? Number(values['Ownership Vendee Count']) : 1) || 1;
      const gender = (values[`${side} Gender`] || '').toLowerCase();
      if (count === 1 && !['male', 'female', 'other'].includes(gender)) return token;
      const plural = joint || count > 1 || gender === 'other';
      const word = token.toLowerCase();
      let result: string;
      if (/self|selves/.test(word)) result = plural ? 'themselves' : gender === 'female' ? 'herself' : 'himself';
      else if (/^(?:he\/|she\/|he$|she$|they$)/.test(word)) result = plural ? 'they' : gender === 'female' ? 'she' : 'he';
      else if (/him|them/.test(word) || (word === 'her' && /\b(?:through|to|unto|by|upon|from|with)\s*$/i.test(before))) result = plural ? 'them' : gender === 'female' ? 'her' : 'him';
      else result = plural ? 'their' : gender === 'female' ? 'her' : 'his';
      return /^[A-Z]/.test(token) ? result[0].toUpperCase() + result.slice(1) : result;
    });
    const agreement: Record<string, string> = { has: 'have', is: 'are', was: 'were', does: 'do', gets: 'get', owns: 'own' };
    replacement = replacement.replace(/\bthey\s+(has|is|was|does|gets|owns)\b/gi, (_, verb: string) => 'they ' + agreement[verb.toLowerCase()]);
    const singular: Record<string, string> = { have: 'has', are: 'is', were: 'was', do: 'does', get: 'gets', own: 'owns' };
    replacement = replacement.replace(/\b(he|she)\s+(have|are|were|do|get|own)\b/gi, (_, pronoun: string, verb: string) => pronoun + ' ' + singular[verb.toLowerCase()]);
    if (replacement !== clause) {
      const find = new RegExp(clause.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      apply?.(find, replacement);
      text = text.replace(find, () => replacement);
    }
  }
  return text;
}
