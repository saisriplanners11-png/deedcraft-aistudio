/** Resolve party-count grammar while the template still contains identity placeholders. */
export function partyWording(text: string, vendors: number, vendees: number, apply?: (find: RegExp, replacement: string) => void, attorneys = vendees): string {
  const change = (find: RegExp, replacement: string) => { find.lastIndex = 0; if (!find.test(text)) return; find.lastIndex = 0; const next = text.replace(find, replacement); if (next === text) return; find.lastIndex = 0; apply?.(find, replacement); text = next; };
  const counts: [string, number][] = [['Vendor', vendors], ['Vendee', vendees], ['Executant', vendors], ['Principal', vendors], ['Claimant', vendees], ['Attorney Holder', attorneys], ['Attorney', attorneys], ['Holder', attorneys], ['First Party', vendors], ['Second Party', vendees]];
  for (const [noun, count] of counts) {
    const plural = count > 1;
    // Placeholders such as <EXECUTANT NAME> are never modified.
    const title = noun === 'First Party' || noun === 'Second Party' ? noun.replace('Party', plural ? 'Parties' : 'Party') : noun + (plural ? 's' : '');
    const token = noun.replace(/ /g, '\\s+');
    const source = /Party$/.test(noun) ? token.replace('Party', 'Part(?:y|ies)') + '(?:/s)?' : token + '(?:s|/s)?';
    change(new RegExp('\\b' + noun.toUpperCase().replace(/ /g, '\\s+') + '/S\\b', 'g'), title.toUpperCase());
    change(new RegExp('\\b' + token + '/s\\b', 'gi'), title);
    change(new RegExp('SIGNATURE/S OF ' + title + '\\b', 'gi'), (plural ? 'SIGNATURES' : 'SIGNATURE') + ' OF ' + title.toUpperCase());
    change(new RegExp('\\b' + source + '(\\s+(?:hereby|further|also)\\s+|\\s+)(?:is/are|is|are)\\b', 'gi'), title + '$1' + (plural ? 'are' : 'is'));
    change(new RegExp('\\b' + source + '(\\s+(?:hereby|further|also)\\s+|\\s+)(?:has/have|has|have)\\b', 'gi'), title + '$1' + (plural ? 'have' : 'has'));
    for (const verb of ['acknowledge', 'admit', 'discharge', 'sell', 'convey', 'transfer', 'assign', 'declare', 'undertake', 'agree', 'covenant', 'accept', 'nominate', 'constitute', 'appoint', 'confirm', 'assure', 'represent', 'ratify']) {
      const singular = verb.endsWith('y') ? verb.slice(0, -1) + 'ies' : verb + 's';
      change(new RegExp('\\b' + source + '(\\s+(?:hereby|further|also)\\s+|\\s+)(?:' + verb + '(?:/s)?|' + singular + ')\\b', 'gi'), title + '$1' + (plural ? verb : singular));
    }
  }
  // Resolve slash choices from the subject of each clause, independently on each side.
  let subject = vendors > 1;
  const clauses = text.split(/(?<=[.;])\s+|(?=\band\s+the\s+(?:Vendor|Vendee|First Party|Second Party))/i);
  for (const clause of clauses) {
    const firstSubject = clause.match(/\b(Vendors?|Vendees?|Executants?|Principals?|Claimants?|Attorneys|Attorney|First Part(?:y|ies)|Second Part(?:y|ies))\b/i)?.[0] || '';
    if (firstSubject) subject = /^(?:Vendee|Claimant|Attorney|Attorneys|Second)/i.test(firstSubject) ? vendees > 1 : vendors > 1;
    if (firstSubject || /owner\/s|possessor\/s|his\/her\/their|him\/her\/them|himself\/herself\/themselves|\w+\/s|has\/have|is\/are/i.test(clause)) {
      let replacement = clause.replace(/owner\/s/gi, subject ? 'owners' : 'owner').replace(/possessor\/s/gi, subject ? 'possessors' : 'possessor')
        .replace(/his\/her\/their/gi, subject ? 'their' : 'his/her').replace(/him\/her\/them/gi, subject ? 'them' : 'him/her')
        .replace(/himself\/herself\/themselves/gi, subject ? 'themselves' : 'himself/herself')
        .replace(/\b(sell|convey|transfer|assign|nominate|constitute|appoint|assure|represent|undertake|covenant|agree|confirm|ratify|acknowledge|admit|declare|accept)\/s\b/gi, (_, verb) => subject ? verb : verb.endsWith('y') ? verb.slice(0, -1) + 'ies' : verb + 's')
        .replace(/has\/have/gi, subject ? 'have' : 'has').replace(/is\/are/gi, subject ? 'are' : 'is');
      if (firstSubject && subject && /\bhereby\b/i.test(clause)) {
        const head = replacement.split(/\bthat\b/i)[0];
        const agreedHead = head.replace(/\b(acknowledge|admit|discharge|sell|convey|transfer|assign|declare|undertake|agree|covenant|accept|nominate|constitute|appoint|confirm|assure|represent|ratify)s\b/gi, '$1');
        replacement = agreedHead + replacement.slice(head.length);
      }
      const escaped = clause.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      change(new RegExp(escaped, 'g'), replacement);
    }
  }
  change(/\bright\/s\b/gi, 'rights');
  const many = vendors > 1;
  for (const [find, replacement] of [[/\bI\/We\b/gi, many ? 'We' : 'I'], [/\bmy\/our\b/gi, many ? 'our' : 'my'], [/\bme\/us\b/gi, many ? 'us' : 'me'], [/\bam\/are\b/gi, many ? 'are' : 'am']] as [RegExp, string][]) change(find, replacement);
  change(/\bI have\b/gi, 'I have');
  change(/\bI are\b/gi, 'I am');
  change(/\bI has\b/gi, 'I have');
  change(/\bI are\b/gi, 'I am');
  change(/\bSIGN\/S OF (?:THE )?(?:Vendors?)\b/gi, vendors > 1 ? 'SIGNATURES OF VENDORS' : 'SIGNATURE OF VENDOR');
  change(/\bSIGN\/S OF (?:THE )?(?:Vendees?)\b/gi, vendees > 1 ? 'SIGNATURES OF VENDEES' : 'SIGNATURE OF VENDEE');
  change(/\b(First Part(?:y|ies))\s+SIGN\/S\b/gi, '$1 ' + (vendors > 1 ? 'SIGNATURES' : 'SIGNATURE'));
  change(/\b(Second Part(?:y|ies))\s+SIGN\/S\b/gi, '$1 ' + (vendees > 1 ? 'SIGNATURES' : 'SIGNATURE'));
  change(/WITNESSES\/S/gi, 'WITNESSES');
  return text;
}
