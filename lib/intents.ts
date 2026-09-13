/** Conservative candidate roles shared by local extraction and the final provider filter. */
export function isPolicyOrDescription(text: string) {
  return (
    /\b(?:requests? (?:must|should|are)|(?:late|missed) (?:work|assignments?)|(?:absence|extension|attendance|grading|integrity|accommodations?) polic|(?:we|instructors?|professors?) (?:aim|try|will respond|respond)|reduced credit|(?:final )?grade is|worth \d+\s*%|(?:students|you) should .+\bif\b|qualifications?|requirements?:|years? of experience|(?:was|were) (?:thinking|talking)|thinking out loud|no (?:actual )?tasks|professor said|\bis (?:difficult|interesting)|may (?:receive|request)|in advance|unless|if received|other commitments)\b/i.test(
      text,
    ) ||
    /\b(?:by\s+)?via\s+canvas\s+\d+\s*%/i.test(text) ||
    (/\d+\s*%/.test(text) && !/\b(?:due|submit|exam on)\b/i.test(text))
  );
}
export const assessment =
  /\b(?:homework|assignment|essay|observation|problem set|proposal|project|report|midterm|exam|quiz|test|application|registration|payment)\b/i;
export const explicitDate =
  /\b(?:today|tonight|tomorrow|yesterday|next|this weekend|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}\b|\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\b|\b\d{1,2}[/-]\d{1,2}\b/i;
const actionStart =
  /^(?:(?:i|we) (?:need to|have to|will|must|should)|remind me|don't forget|please|finish|email|send|call|submit|upload|buy|pick up|review|prepare|complete|draft|update|study|pay|book|pack|bring|register|apply|read|attend|do)\b/i;
export function cleanSpeech(text: string) {
  return text
    .replace(/\bemial\b/gi, 'email')
    .replace(/\btomorow\b/gi, 'tomorrow')
    .replace(/\bhw\b/gi, 'homework')
    .replace(/\bcalc\b/gi, 'calculus')
    .replace(/\bprob\b/gi, 'probability')
    .replace(/\b(?:okay|ok|uh|um|yeah|definitely)\b[,]?\s*/gi, '')
    .replace(
      /\b(?:so|then|probably|like|actually)\s+(?=(?:i |email|do |finish|submit|at |three|two))/gi,
      '',
    )
    .replace(
      /\bat\s+(?:like\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi,
      (all, h: string) => {
        const n =
          [
            'one',
            'two',
            'three',
            'four',
            'five',
            'six',
            'seven',
            'eight',
            'nine',
            'ten',
            'eleven',
            'twelve',
          ].indexOf(h.toLowerCase()) + 1;
        return `at ${n}`;
      },
    );
}
function startsIntent(text: string) {
  const t = text.replace(/^(?:(?:oh|and|also|then|plus)\s+)+/i, '').trim();
  return (
    actionStart.test(t) ||
    /^(?:i have|my\b|(?:a |the )?(?:dentist|\w+(?: \w+){0,3} (?:homework|midterm|exam|test|meeting)|homework|meeting|appointment|idea|club meeting))\b/i.test(
      t,
    )
  );
}
export function segmentIntents(input: string) {
  let text = cleanSpeech(input)
    .replace(/\r/g, '')
    .replace(/^[^\p{L}\p{N}]+/gmu, '')
    .replace(/^[\s•*\-\d.)]+/gm, '')
    .trim();
  // A correction replaces the date in its own clause, never a sibling's date.
  const day = '(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)';
  text = text.replace(
    new RegExp(
      `\\b${day}\\b(?:\\s+at\\s+\\d+(?::\\d+)?(?:\\s*[AP]M)?)?\\s*,?\\s*(?:wait\\s+)?(?:sorry|no|actually)\\s+(${day}\\b(?:\\s+at\\s+\\d+(?::\\d+)?(?:\\s*[AP]M)?)?)`,
      'gi',
    ),
    '$1',
  );
  text = text.replace(
    new RegExp(`\\bisn't\\s+${day}\\s*,?\\s*it(?:'s| is)\\s+(${day})`, 'gi'),
    '$1',
  );
  const pieces = text.split(
    /(\n+|;|[.!?](?:\s+|$)|,(?!\s*\d{4}\b)|\s+(?:and then|oh and|and|also|then|plus)\s+)/i,
  );
  const result: string[] = [];
  for (let i = 0; i < pieces.length; i += 2) {
    const piece = pieces[i].trim().replace(/^(?:and|oh|then)\s+/i, '');
    if (!piece) continue;
    const connector = pieces[i - 1] || '';
    // Only a conjunction can join shared objects; sentence and newline boundaries remain real.
    if (
      result.length &&
      /and/i.test(connector) &&
      (!startsIntent(piece) || /^\d+\s+for the exam\b/i.test(piece)) &&
      (!assessment.test(piece) || /^\d+\s+for the exam\b/i.test(piece)) &&
      !/\b(?:appointment|flight|departure|conference|ceremony)\b/i.test(piece) &&
      !isPolicyOrDescription(piece) &&
      piece.split(/\s+/).length < 8
    ) {
      result[result.length - 1] += ' and ' + piece;
    } else result.push(piece);
  }
  return result.slice(0, 100);
}
export function actionableClause(text: string) {
  if (isPolicyOrDescription(text)) return false;
  if (/\b(?:cancel|cancelled|canceled|isn't happening)\b/i.test(text)) return false;
  if (
    actionStart.test(text) ||
    /^[A-Z][\p{L} -]{1,30}[:—-]\s*(?:email|send|finish|submit|review|prepare|draft)\b/iu.test(text)
  )
    return true;
  if (/^(?:idea\b|what if\b)/i.test(text)) return true;
  if (/https?:\/\//.test(text) && /^https?:|^save (?:this )?link/i.test(text)) return true;
  if (
    assessment.test(text) &&
    (explicitDate.test(text) ||
      /^(?:a |the |my |i have (?:a )?)?[\w -]{0,35}(?:homework|midterm|exam|test|quiz)\b/i.test(
        text,
      ))
  )
    return true;
  return (
    /\b(?:dentist|appointment|meeting|conference|flight|ceremony|launch|workshop)\b/i.test(text) &&
    (explicitDate.test(text) || /^my |^i have /i.test(text))
  );
}
export function normalizeActionTitle(value: string) {
  return value
    .replace(/^(?:(?:okay|so|uh|oh|then)\s+)+/i, '')
    .replace(
      /^(?:i think\s+)?(?:i (?:have|need to|have to|should probably)|we (?:need to|must)|need to|don't forget to|remind me to|please|idea:)\s+/i,
      '',
    )
    .replace(/^(?:a (?=.*(?:test|exam|midterm|meeting))|the |my )/i, '')
    .replace(/^(?:finish|do) (?:the )?(?=.*\bhomework\b)/i, '')
    .replace(/^(finish|submit|upload|review|prepare|complete|draft|update) (?:the|my) /i, '$1 ')
    .replace(/\bfor the exam\s*$/i, '')
    .replace(/\b(?:is due|is|due|by|on|at|before)\s*$/i, '')
    .replace(/[\s,.:!?|—–-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^((?:email|call) [\p{L} -]{1,35}) about .{60,}$/iu, '$1')
    .replace(/^dentist$/i, 'Dentist appointment')
    .replace(/^./, (c) => c.toUpperCase());
}
